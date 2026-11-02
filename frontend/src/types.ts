// Mirrors backend/src/types.ts
export type Severity = "high" | "medium" | "low";
export type CheckType =
  | "unattached-ebs" | "old-snapshot" | "unassociated-eip" | "stopped-instance" | "idle-instance"
  | "previous-generation" | "gp2-volume" | "s3-no-lifecycle" | "public-ipv4";

export interface Finding {
  id: string;
  checkType: CheckType;
  resourceId: string;
  resourceName: string;
  region: string;
  details: string;
  estimatedMonthlyCostUSD: number;
  severity: Severity;
  recommendation: string;
  awsCliFixCommand: string;
}

export interface FailedCheck { checkType: CheckType; region: string; errorCode: string; message: string }
export interface CheckTotal { checkType: CheckType; label: string; findings: number; estimatedMonthlyCostUSD: number }

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

export interface ScanResult extends ScanSummary {
  durationMs: number;
  totalsByCheckType: CheckTotal[];
  failedChecks: FailedCheck[];
  findings: Finding[];
}

export interface Health {
  ok: boolean;
  demoMode: boolean;
  region: string;
  scanAllRegions: boolean;
  usdToInr: number;
  readOnly: boolean;
}
