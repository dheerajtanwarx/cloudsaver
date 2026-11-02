import { formatInr, formatUsd } from "../format";
import type { ScanResult } from "../types";

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

export function SummaryCards({ scan, usdToInr }: { scan: ScanResult; usdToInr: number }) {
  const total = scan.totalEstimatedMonthlyCostUSD;
  const yearly = total * 12;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card
        label="Estimated monthly waste"
        value={formatUsd(total)}
        sub={`${formatInr(total * usdToInr)} / month · ${formatUsd(yearly)} / year`}
      />
      <Card label="Findings" value={String(scan.totalFindings)} sub={`across ${scan.totalsByCheckType.filter((t) => t.findings > 0).length} check types`} />
      <Card label="High severity" value={String(scan.highSeverityFindings)} sub="fix these first" />
    </div>
  );
}
