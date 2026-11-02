import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHECK_LABELS, formatInr, formatUsd, formatUsdShort } from "../format";
import type { ScanResult } from "../types";
import { ChartTooltip } from "./ChartTooltip";
import { Panel } from "./Panel";

interface Row { label: string; usd: number; findings: number }

export function SavingsByCheckChart({ scan, usdToInr }: { scan: ScanResult; usdToInr: number }) {
  const rows: Row[] = scan.totalsByCheckType
    .filter((t) => t.estimatedMonthlyCostUSD > 0)
    .map((t) => ({ label: CHECK_LABELS[t.checkType], usd: t.estimatedMonthlyCostUSD, findings: t.findings }))
    .sort((a, b) => b.usd - a.usd);
  const riskOnly = scan.totalsByCheckType.filter((t) => t.findings > 0 && t.estimatedMonthlyCostUSD === 0);

  return (
    <Panel title="Savings by check type" subtitle="Estimated USD per month">
      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">No costed findings in this scan.</p>
      ) : (
        <div style={{ height: Math.max(160, rows.length * 40 + 30) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap={8}>
              <CartesianGrid horizontal={false} stroke="#eef0f3" />
              <XAxis type="number" tickFormatter={formatUsdShort} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={190} tick={{ fontSize: 12, fill: "#334155" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                content={({ active, payload }) => {
                  const r = payload?.[0]?.payload as Row | undefined;
                  if (!active || !r) return null;
                  return <ChartTooltip title={r.label} value={`${formatUsd(r.usd)} / month`} sub={`${formatInr(r.usd * usdToInr)} · ${r.findings} finding${r.findings === 1 ? "" : "s"}`} />;
                }}
              />
              <Bar dataKey="usd" fill="#2a78d6" radius={[0, 4, 4, 0]} maxBarSize={22}>
                <LabelList dataKey="usd" position="right" formatter={(v: number) => formatUsd(v)} style={{ fontSize: 11, fill: "#334155" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {riskOnly.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Not costed (risk only): {riskOnly.map((t) => `${CHECK_LABELS[t.checkType]} (${t.findings})`).join(", ")}
        </p>
      )}
    </Panel>
  );
}
