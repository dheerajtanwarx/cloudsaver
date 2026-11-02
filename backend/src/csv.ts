import type { ScanResult } from "./types.js";

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function scanToCsv(scan: ScanResult, usdToInr: number): string {
  const header = [
    "id", "checkType", "severity", "resourceId", "resourceName", "region",
    "estimatedMonthlyCostUSD", "estimatedMonthlyCostINR", "details", "recommendation", "awsCliFixCommand",
  ];
  const rows = scan.findings.map((f) => [
    f.id, f.checkType, f.severity, f.resourceId, f.resourceName, f.region,
    f.estimatedMonthlyCostUSD.toFixed(2), (f.estimatedMonthlyCostUSD * usdToInr).toFixed(0),
    f.details, f.recommendation, f.awsCliFixCommand,
  ]);
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
