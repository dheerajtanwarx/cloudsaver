import type { CheckType, Severity } from "./types";

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const usdShort = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const formatUsd = (n: number) => usdFmt.format(n);
export const formatUsdShort = (n: number) => usdShort.format(n);
export const formatInr = (n: number) => inrFmt.format(n);

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

export const CHECK_LABELS: Record<CheckType, string> = {
  "unattached-ebs": "Unattached EBS volumes",
  "old-snapshot": "Old / orphaned snapshots",
  "unassociated-eip": "Unassociated Elastic IPs",
  "stopped-instance": "Stopped EC2 instances",
  "idle-instance": "Idle / oversized EC2",
  "previous-generation": "Previous-generation types",
  "gp2-volume": "gp2 to gp3",
  "s3-no-lifecycle": "S3 without lifecycle",
  "public-ipv4": "Public IPv4 addresses",
};
