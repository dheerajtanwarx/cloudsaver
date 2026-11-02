import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatDateTime, formatInr, formatUsd, formatUsdShort } from "../format";
import type { ScanSummary } from "../types";
import { ChartTooltip } from "./ChartTooltip";
import { Panel } from "./Panel";

interface Point { label: string; usd: number; findings: number; timestamp: string }

export function TrendChart({ scans, usdToInr }: { scans: ScanSummary[]; usdToInr: number }) {
  const points: Point[] = scans.map((s) => ({
    label: formatDate(s.timestamp),
    usd: s.totalEstimatedMonthlyCostUSD,
    findings: s.totalFindings,
    timestamp: s.timestamp,
  }));
  const first = points[0];
  const last = points[points.length - 1];
  const change = first && last && points.length > 1 ? last.usd - first.usd : undefined;

  return (
    <Panel
      title="Total waste over time"
      subtitle="Estimated USD per month, one point per scan"
      action={
        change !== undefined && (
          <span className={`text-xs font-medium ${change <= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {change <= 0 ? "Down" : "Up"} {formatUsd(Math.abs(change))} since first scan
          </span>
        )
      }
    >
      {points.length < 2 ? (
        <p className="py-16 text-center text-sm text-slate-500">Run at least two scans to see the trend.</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#eef0f3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
              <YAxis tickFormatter={formatUsdShort} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as Point | undefined;
                  if (!active || !p) return null;
                  return <ChartTooltip title={formatDateTime(p.timestamp)} value={`${formatUsd(p.usd)} / month`} sub={`${formatInr(p.usd * usdToInr)} · ${p.findings} findings`} />;
                }}
              />
              <Line type="linear" dataKey="usd" stroke="#2a78d6" strokeWidth={2} dot={{ r: 4, fill: "#2a78d6", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
