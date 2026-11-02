import {
  GetBucketLifecycleConfigurationCommand,
  GetBucketLocationCommand,
  GetBucketVersioningCommand,
  ListBucketsCommand,
  type LifecycleRule,
} from "@aws-sdk/client-s3";
import { clientsFor } from "../aws/clients.js";
import type { Finding } from "../types.js";
import { type CheckDefinition, findingId } from "./util.js";

function errName(err: unknown): string {
  return err && typeof err === "object" && "name" in err && typeof err.name === "string" ? err.name : "";
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.allSettled(items.slice(i, i + size).map(fn))));
  return out;
}

export const s3Lifecycle: CheckDefinition = {
  checkType: "s3-no-lifecycle",
  label: "S3 buckets without lifecycle rules",
  global: true,
  async run({ clients }) {
    const { Buckets = [] } = await clients.s3.send(new ListBucketsCommand({}));
    const names = Buckets.map((b) => b.Name).filter((n): n is string => !!n);

    const results = await inBatches(names, 10, async (bucket): Promise<Finding | undefined> => {
      const loc = await clients.s3.send(new GetBucketLocationCommand({ Bucket: bucket }));
      const raw = loc.LocationConstraint as string | undefined;
      const bucketRegion = !raw ? "us-east-1" : raw === "EU" ? "eu-west-1" : raw;
      const s3 = clientsFor(bucketRegion).s3;

      let rules: LifecycleRule[] = [];
      try {
        rules = (await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }))).Rules ?? [];
      } catch (err) {
        if (errName(err) !== "NoSuchLifecycleConfiguration") throw err;
      }
      const versioning = (await s3.send(new GetBucketVersioningCommand({ Bucket: bucket }))).Status;
      const enabledRules = rules.filter((r) => r.Status === "Enabled");
      const hasNoncurrentExpiry = enabledRules.some((r) => r.NoncurrentVersionExpiration);
      const versioned = versioning === "Enabled" || versioning === "Suspended";

      const problems: string[] = [];
      if (enabledRules.length === 0) problems.push("No lifecycle rules, so objects stay in S3 Standard forever");
      if (versioned && !hasNoncurrentExpiry) problems.push(`Versioning is ${versioning} but old (noncurrent) versions never expire`);
      if (problems.length === 0) return undefined;

      return {
        id: findingId("s3-no-lifecycle", bucketRegion, bucket),
        checkType: "s3-no-lifecycle",
        resourceId: bucket,
        resourceName: bucket,
        region: bucketRegion,
        details: `${problems.join(". ")}. No exact cost without CloudWatch storage metrics; this is a cost risk that grows over time.`,
        estimatedMonthlyCostUSD: 0,
        severity: "low",
        recommendation:
          "Add a lifecycle rule: move objects to Standard-IA after 30 days and Glacier after 90 (or enable Intelligent-Tiering), expire noncurrent versions after 30 days, and abort incomplete multipart uploads after 7 days.",
        awsCliFixCommand:
          `aws s3api put-bucket-lifecycle-configuration --bucket ${bucket} --region ${bucketRegion} --lifecycle-configuration ` +
          `'{"Rules":[{"ID":"cloudsaver-default","Status":"Enabled","Filter":{},` +
          `"Transitions":[{"Days":30,"StorageClass":"STANDARD_IA"},{"Days":90,"StorageClass":"GLACIER"}],` +
          `"NoncurrentVersionExpiration":{"NoncurrentDays":30},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}}]}'`,
      };
    });

    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (names.length > 0 && failures.length === names.length) throw failures[0]?.reason;
    return results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
  },
};
