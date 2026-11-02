import { paginateDescribeVolumes } from "@aws-sdk/client-ec2";
import { ebsMonthly } from "../pricing.js";
import type { Finding } from "../types.js";
import { type CheckDefinition, findingId, nameTag, usd } from "./util.js";

export const unattachedEbs: CheckDefinition = {
  checkType: "unattached-ebs",
  label: "Unattached EBS volumes",
  async run({ region, clients }) {
    const findings: Finding[] = [];
    const pages = paginateDescribeVolumes(
      { client: clients.ec2 },
      { Filters: [{ Name: "status", Values: ["available"] }] },
    );
    for await (const page of pages) {
      for (const v of page.Volumes ?? []) {
        if (!v.VolumeId) continue;
        const size = v.Size ?? 0;
        const cost = ebsMonthly(v.VolumeType, size);
        const ageDays = v.CreateTime ? Math.floor((Date.now() - v.CreateTime.getTime()) / 86_400_000) : undefined;
        findings.push({
          id: findingId("unattached-ebs", region, v.VolumeId),
          checkType: "unattached-ebs",
          resourceId: v.VolumeId,
          resourceName: nameTag(v.Tags),
          region,
          details: `${size} GB ${v.VolumeType} volume in ${v.AvailabilityZone}, not attached to any instance` +
            (ageDays !== undefined ? `, created ${ageDays} days ago` : "") +
            (cost === undefined ? ". Price for this volume type is not in the pricing table." : `. Billed ${usd(cost)}/month for storage nobody uses.`),
          estimatedMonthlyCostUSD: cost ?? 0,
          severity: (cost ?? 0) >= 10 ? "high" : "medium",
          recommendation: "Take a final snapshot if the data might be needed, then delete the volume.",
          awsCliFixCommand:
            `aws ec2 create-snapshot --volume-id ${v.VolumeId} --description "final backup before delete" --region ${region} && \\\n  ` +
            `aws ec2 delete-volume --volume-id ${v.VolumeId} --region ${region}`,
        });
      }
    }
    return findings;
  },
};
