export type Severity = "high" | "medium" | "low";

export type CheckType =
  | "unattached-ebs"
  | "old-snapshot"
  | "unassociated-eip"
  | "stopped-instance"
  | "idle-instance"
  | "previous-generation"
  | "gp2-volume"
  | "s3-no-lifecycle"
  | "public-ipv4";

export interface Finding {
  id: string;
  checkType: CheckType;
  resourceId: string;
  resourceName: string;
  region: string;
  details: string;
  /** Monthly cost of the waste (or the monthly saving for "optimize" findings like gp2 -> gp3). */
  estimatedMonthlyCostUSD: number;
  severity: Severity;
  recommendation: string;
  /** Display-only. CloudSaver never executes this. */
  awsCliFixCommand: string;
}

export interface FailedCheck {
  checkType: CheckType;
  region: string;
  errorCode: string;
  message: string;
}

export interface CheckTotal {
  checkType: CheckType;
  label: string;
  findings: number;
  estimatedMonthlyCostUSD: number;
}

export interface ScanResult {
  id: string;
  timestamp: string;
  accountId: string;
  regions: string[];
  demo: boolean;
  durationMs: number;
  totalFindings: number;
  highSeverityFindings: number;
  totalEstimatedMonthlyCostUSD: number;
  totalsByCheckType: CheckTotal[];
  failedChecks: FailedCheck[];
  findings: Finding[];
}

export interface ScanSummary {
  id: string;
  timestamp: string;
  accountId: string;
  regions: string[];
  demo: boolean;
  totalFindings: number;
  highSeverityFindings: number;
  totalEstimatedMonthlyCostUSD: number;
}
