import { paginateDescribeSnapshots, paginateDescribeVolumes } from "@aws-sdk/client-ec2";
import { round2, SNAPSHOT_PRICE_PER_GB } from "../pricing.js";
import type { Finding } from "../types.js";
import { type CheckDefinition, findingId, nameTag, usd } from "./util.js";

export const oldSnapshots: CheckDefinition = {
  checkType: "old-snapshot",
  label: "Old / orphaned EBS snapshots",
  async run({ region, clients, snapshotAgeDays }) {
    const volumeIds = new Set<string>();
    for await (const page of paginateDescribeVolumes({ client: clients.ec2 }, {})) {
      for (const v of page.Volumes ?? []) if (v.VolumeId) volumeIds.add(v.VolumeId);
    }

    const cutoff = Date.now() - snapshotAgeDays * 86_400_000;
    const findings: Finding[] = [];
    for await (const page of paginateDescribeSnapshots({ client: clients.ec2 }, { OwnerIds: ["self"] })) {
      for (const s of page.Snapshots ?? []) {
        if (!s.SnapshotId) continue;
        const started = s.StartTime?.getTime() ?? Date.now();
        const old = started < cutoff;
        // vol-ffffffff is the placeholder AWS uses for snapshots copied from another snapshot/AMI.
        const orphaned = !!s.VolumeId && s.VolumeId !== "vol-ffffffff" && !volumeIds.has(s.VolumeId);
        if (!old && !orphaned) continue;

        const size = s.VolumeSize ?? 0;
        const cost = round2(size * SNAPSHOT_PRICE_PER_GB);
        const ageDays = Math.floor((Date.now() - started) / 86_400_000);
        const reasons = [old ? `${ageDays} days old` : "", orphaned ? `source volume ${s.VolumeId} no longer exists` : ""].filter(Boolean);
        findings.push({
          id: findingId("old-snapshot", region, s.SnapshotId),
          checkType: "old-snapshot",
          resourceId: s.SnapshotId,
          resourceName: nameTag(s.Tags) || (s.Description ?? ""),
          region,
          details: `${size} GB snapshot, ${reasons.join("; ")}. Estimated up to ${usd(cost)}/month (snapshots are incremental, so real cost can be lower).`,
          estimatedMonthlyCostUSD: cost,
          severity: orphaned ? "medium" : "low",
          recommendation: orphaned
            ? "The source volume is gone. If this snapshot is not used by an AMI or a backup policy, delete it. Otherwise move it to the EBS Snapshots Archive tier (75% cheaper)."
            : "Check if this snapshot is still needed. Use Amazon Data Lifecycle Manager to expire old snapshots automatically, or archive long-term ones.",
          awsCliFixCommand: `aws ec2 delete-snapshot --snapshot-id ${s.SnapshotId} --region ${region}`,
        });
      }
    }
    return findings;
  },
};
