import { paginateDescribeVolumes } from "@aws-sdk/client-ec2";
import { EBS_PRICE_PER_GB, GP3_IOPS_PRICE, round2 } from "../pricing.js";
import type { Finding } from "../types.js";
import { type CheckDefinition, findingId, nameTag, usd } from "./util.js";

const GP2 = EBS_PRICE_PER_GB.gp2 ?? 0.114;
const GP3 = EBS_PRICE_PER_GB.gp3 ?? 0.0912;
const GP3_FREE_IOPS = 3000;

export const gp2Volumes: CheckDefinition = {
  checkType: "gp2-volume",
  label: "gp2 volumes (migrate to gp3)",
  async run({ region, clients }) {
    const findings: Finding[] = [];
    // Only in-use volumes: unattached gp2 volumes are reported by the unattached-EBS check (delete beats migrate).
    const pages = paginateDescribeVolumes(
      { client: clients.ec2 },
      { Filters: [{ Name: "volume-type", Values: ["gp2"] }, { Name: "status", Values: ["in-use"] }] },
    );
    for await (const page of pages) {
      for (const v of page.Volumes ?? []) {
        if (!v.VolumeId) continue;
        const size = v.Size ?? 0;
        // gp2 baseline is 3 IOPS/GB (min 100, max 16,000). gp3 includes 3,000 IOPS; above that you pay per IOPS.
        const gp2Iops = Math.min(16000, Math.max(100, size * 3));
        const extraIops = Math.max(0, gp2Iops - GP3_FREE_IOPS);
        const current = round2(size * GP2);
        const after = round2(size * GP3 + extraIops * GP3_IOPS_PRICE);
        const saving = round2(current - after);
        if (saving <= 0) continue;

        const iopsNote = extraIops > 0
          ? ` gp3 price includes ${extraIops} extra provisioned IOPS (${usd(extraIops * GP3_IOPS_PRICE)}) to match gp2's ${gp2Iops} IOPS.`
          : " gp3 includes 3,000 IOPS and 125 MB/s baseline, which is equal or better than gp2 at this size.";
        const attachedTo = v.Attachments?.[0]?.InstanceId;
        findings.push({
          id: findingId("gp2-volume", region, v.VolumeId),
          checkType: "gp2-volume",
          resourceId: v.VolumeId,
          resourceName: nameTag(v.Tags),
          region,
          details: `${size} GB gp2 volume attached to ${attachedTo ?? "an instance"}. ${usd(current)}/month now, ${usd(after)}/month on gp3 (save ${usd(saving)}).${iopsNote}`,
          estimatedMonthlyCostUSD: saving,
          severity: saving >= 5 ? "medium" : "low",
          recommendation: "Change the volume type to gp3. This is an online change: no downtime, no detach, done in minutes.",
          awsCliFixCommand: extraIops > 0
            ? `aws ec2 modify-volume --volume-id ${v.VolumeId} --volume-type gp3 --iops ${gp2Iops} --region ${region}`
            : `aws ec2 modify-volume --volume-id ${v.VolumeId} --volume-type gp3 --region ${region}`,
        });
      }
    }
    return findings;
  },
};
