/**
 * Regenerates data/demo-scan.json (used when DEMO_MODE=true).
 * Run: npx tsx scripts/generate-demo-data.ts   (from the repo root)
 * Totals are computed with the same summarize() the real scanner uses, so they always add up.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarize } from "../backend/src/scanner.js";
import type { Finding, ScanResult } from "../backend/src/types.js";

const R = "ap-south-1";
const ACCOUNT = "123456789012";

function resize(id: string, to: string): string {
  return (
    `aws ec2 stop-instances --instance-ids ${id} --region ${R} && \\\n  ` +
    `aws ec2 wait instance-stopped --instance-ids ${id} --region ${R} && \\\n  ` +
    `aws ec2 modify-instance-attribute --instance-id ${id} --instance-type Value=${to} --region ${R} && \\\n  ` +
    `aws ec2 start-instances --instance-ids ${id} --region ${R}`
  );
}

const current: Finding[] = [
  {
    id: `idle-instance:${R}:i-0a1b2c3d4e5f60718`, checkType: "idle-instance", resourceId: "i-0a1b2c3d4e5f60718", resourceName: "reporting-server", region: R,
    details: "m5.xlarge averaged 3.2% CPU over the last 7 days (threshold 10%). Current $147.46/month, m5.large would be $73.73/month.",
    estimatedMonthlyCostUSD: 73.73, severity: "high",
    recommendation: "Right-size m5.xlarge -> m5.large (saves about $73.73/month). Check memory and network usage first, since CPU alone does not tell the whole story. If it averages under 2%, consider stopping it or moving it to a scheduled start/stop.",
    awsCliFixCommand: resize("i-0a1b2c3d4e5f60718", "m5.large"),
  },
  {
    id: `unattached-ebs:${R}:vol-0f3a9c1e7b2d48a61`, checkType: "unattached-ebs", resourceId: "vol-0f3a9c1e7b2d48a61", resourceName: "old-db-data", region: R,
    details: "200 GB gp2 volume in ap-south-1a, not attached to any instance, created 96 days ago. Billed $22.80/month for storage nobody uses.",
    estimatedMonthlyCostUSD: 22.8, severity: "high",
    recommendation: "Take a final snapshot if the data might be needed, then delete the volume.",
    awsCliFixCommand: `aws ec2 create-snapshot --volume-id vol-0f3a9c1e7b2d48a61 --description "final backup before delete" --region ${R} && \\\n  aws ec2 delete-volume --volume-id vol-0f3a9c1e7b2d48a61 --region ${R}`,
  },
  {
    id: `stopped-instance:${R}:i-07c4e2a9b1d3f5068`, checkType: "stopped-instance", resourceId: "i-07c4e2a9b1d3f5068", resourceName: "staging-api", region: R,
    details: "t3.large instance is stopped (since 2026-09-16, 47 days). No compute charge, but its 2 EBS volume(s) totalling 130 GB still cost $12.54/month.",
    estimatedMonthlyCostUSD: 12.54, severity: "high",
    recommendation: "If the instance is no longer needed, create an AMI as a backup and terminate it. If it is needed occasionally, keep it but consider snapshotting and deleting the volumes between uses.",
    awsCliFixCommand: `aws ec2 create-image --instance-id i-07c4e2a9b1d3f5068 --name "i-07c4e2a9b1d3f5068-final-backup" --region ${R} && \\\n  aws ec2 terminate-instances --instance-ids i-07c4e2a9b1d3f5068 --region ${R}`,
  },
  {
    id: `gp2-volume:${R}:vol-02b8d6f4a1c3e5970`, checkType: "gp2-volume", resourceId: "vol-02b8d6f4a1c3e5970", resourceName: "prod-web-1-root", region: R,
    details: "500 GB gp2 volume attached to i-0d2e4f6a8b0c1e357. $57.00/month now, $45.60/month on gp3 (save $11.40). gp3 includes 3,000 IOPS and 125 MB/s baseline, which is equal or better than gp2 at this size.",
    estimatedMonthlyCostUSD: 11.4, severity: "medium",
    recommendation: "Change the volume type to gp3. This is an online change: no downtime, no detach, done in minutes.",
    awsCliFixCommand: `aws ec2 modify-volume --volume-id vol-02b8d6f4a1c3e5970 --volume-type gp3 --region ${R}`,
  },
  {
    id: `previous-generation:${R}:i-0b9a8c7d6e5f40312`, checkType: "previous-generation", resourceId: "i-0b9a8c7d6e5f40312", resourceName: "jenkins", region: R,
    details: "Instance (running) runs previous-generation type t2.large. t2.large is $72.42/month vs t3.large at $65.41/month (or t4g.large on Graviton/ARM at $52.34/month). Newer generations give better performance per dollar.",
    estimatedMonthlyCostUSD: 7.01, severity: "low",
    recommendation: "Move to t3.large, or t4g.large if the software supports ARM64 (about 20% cheaper). t3 also uses unlimited burst mode by default; check CPU credits. Requires a stop/start; check ENA/NVMe driver support on old AMIs.",
    awsCliFixCommand: resize("i-0b9a8c7d6e5f40312", "t3.large"),
  },
  {
    id: `old-snapshot:${R}:snap-0e1d2c3b4a5968778`, checkType: "old-snapshot", resourceId: "snap-0e1d2c3b4a5968778", resourceName: "pre-upgrade backup", region: R,
    details: "80 GB snapshot, 142 days old; source volume vol-0aa11bb22cc33dd44 no longer exists. Estimated up to $4.00/month (snapshots are incremental, so real cost can be lower).",
    estimatedMonthlyCostUSD: 4, severity: "medium",
    recommendation: "The source volume is gone. If this snapshot is not used by an AMI or a backup policy, delete it. Otherwise move it to the EBS Snapshots Archive tier (75% cheaper).",
    awsCliFixCommand: `aws ec2 delete-snapshot --snapshot-id snap-0e1d2c3b4a5968778 --region ${R}`,
  },
  {
    id: `public-ipv4:${R}:13.233.45.120`, checkType: "public-ipv4", resourceId: "13.233.45.120", resourceName: "i-0d2e4f6a8b0c1e357", region: R,
    details: "Auto-assigned public IP 13.233.45.120 on eni-0c3d5e7f9a1b2c468 (i-0d2e4f6a8b0c1e357). Since Feb 2024 AWS bills every public IPv4 address $3.65/month, even when in use.",
    estimatedMonthlyCostUSD: 3.65, severity: "low",
    recommendation: "Keep only addresses that must be reachable from the internet. Put web servers behind one load balancer, give private servers outbound access through a NAT gateway or VPC endpoints, use SSM Session Manager instead of public SSH, or move to IPv6.",
    awsCliFixCommand: `aws ec2 modify-network-interface-attribute --network-interface-id eni-0c3d5e7f9a1b2c468 --no-associate-public-ip-address --region ${R}`,
  },
  {
    id: `s3-no-lifecycle:${R}:acme-app-logs-123456789012`, checkType: "s3-no-lifecycle", resourceId: "acme-app-logs-123456789012", resourceName: "acme-app-logs-123456789012", region: R,
    details: "Bucket has no lifecycle rules, so objects stay in S3 Standard forever; versioning is Enabled but old (noncurrent) versions never expire. No exact cost without CloudWatch storage metrics; this is a cost risk that grows over time.",
    estimatedMonthlyCostUSD: 0, severity: "low",
    recommendation: "Add a lifecycle rule: move objects to Standard-IA after 30 days and Glacier after 90 (or enable Intelligent-Tiering), expire noncurrent versions after 30 days, and abort incomplete multipart uploads after 7 days.",
    awsCliFixCommand: `aws s3api put-bucket-lifecycle-configuration --bucket acme-app-logs-123456789012 --region ${R} --lifecycle-configuration '{"Rules":[{"ID":"cloudsaver-default","Status":"Enabled","Filter":{},"Transitions":[{"Days":30,"StorageClass":"STANDARD_IA"},{"Days":90,"StorageClass":"GLACIER"}],"NoncurrentVersionExpiration":{"NoncurrentDays":30},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}}]}'`,
  },
];

// Findings that existed in earlier scans and were fixed since (so the trend goes down).
const batchWorker: Finding = {
  id: `idle-instance:${R}:i-0c5d6e7f8a9b01234`, checkType: "idle-instance", resourceId: "i-0c5d6e7f8a9b01234", resourceName: "batch-worker", region: R,
  details: "c5.2xlarge averaged 4.8% CPU over the last 7 days (threshold 10%). Current $248.20/month, c5.xlarge would be $124.10/month.",
  estimatedMonthlyCostUSD: 124.1, severity: "high",
  recommendation: "Right-size c5.2xlarge -> c5.xlarge (saves about $124.10/month).",
  awsCliFixCommand: resize("i-0c5d6e7f8a9b01234", "c5.xlarge"),
};
const tempVolume: Finding = {
  id: `unattached-ebs:${R}:vol-09e8d7c6b5a4f3210`, checkType: "unattached-ebs", resourceId: "vol-09e8d7c6b5a4f3210", resourceName: "temp-migration", region: R,
  details: "250 GB gp2 volume in ap-south-1b, not attached to any instance. Billed $28.50/month for storage nobody uses.",
  estimatedMonthlyCostUSD: 28.5, severity: "high",
  recommendation: "Take a final snapshot if the data might be needed, then delete the volume.",
  awsCliFixCommand: `aws ec2 delete-volume --volume-id vol-09e8d7c6b5a4f3210 --region ${R}`,
};
const eip = (n: number, ip: string): Finding => ({
  id: `unassociated-eip:${R}:eipalloc-0${n}a2b3c4d5e6f7a8b9`, checkType: "unassociated-eip", resourceId: `eipalloc-0${n}a2b3c4d5e6f7a8b9`, resourceName: ip, region: R,
  details: `Elastic IP ${ip} is allocated but not attached to anything. AWS bills every public IPv4 address hourly: $3.65/month.`,
  estimatedMonthlyCostUSD: 3.65, severity: "medium",
  recommendation: "Release the Elastic IP if no DNS record or allow-list depends on it.",
  awsCliFixCommand: `aws ec2 release-address --allocation-id eipalloc-0${n}a2b3c4d5e6f7a8b9 --region ${R}`,
});
const bigSnapshot: Finding = {
  id: `old-snapshot:${R}:snap-0123abcd4567ef890`, checkType: "old-snapshot", resourceId: "snap-0123abcd4567ef890", resourceName: "nightly-2025-12", region: R,
  details: "200 GB snapshot, 310 days old. Estimated up to $10.00/month (snapshots are incremental, so real cost can be lower).",
  estimatedMonthlyCostUSD: 10, severity: "low",
  recommendation: "Check if this snapshot is still needed. Use Amazon Data Lifecycle Manager to expire old snapshots automatically.",
  awsCliFixCommand: `aws ec2 delete-snapshot --snapshot-id snap-0123abcd4567ef890 --region ${R}`,
};

function scan(date: string, findings: Finding[], durationMs: number): ScanResult {
  const sorted = [...findings].sort((a, b) => b.estimatedMonthlyCostUSD - a.estimatedMonthlyCostUSD);
  return {
    id: `demo-${date.replace(/[:.]/g, "-")}`, timestamp: date, accountId: ACCOUNT, regions: [R], demo: true, durationMs,
    ...summarize(sorted), failedChecks: [], findings: sorted,
  };
}

const history = [
  scan("2026-10-12T09:30:00.000Z", [...current, batchWorker, tempVolume, eip(1, "13.127.88.14"), eip(2, "65.0.112.201"), bigSnapshot], 4210),
  scan("2026-10-19T09:30:00.000Z", [...current, tempVolume, eip(1, "13.127.88.14"), eip(2, "65.0.112.201"), bigSnapshot], 3980),
  scan("2026-10-26T09:30:00.000Z", [...current, eip(2, "65.0.112.201"), bigSnapshot], 3870),
];
const out = { current: scan("2026-11-02T09:30:00.000Z", current, 3650), history };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
fs.writeFileSync(path.join(root, "data", "demo-scan.json"), JSON.stringify(out, null, 2) + "\n");
console.log([...history, out.current].map((s) => `${s.timestamp.slice(0, 10)}  ${s.totalFindings} findings  $${s.totalEstimatedMonthlyCostUSD}`).join("\n"));
