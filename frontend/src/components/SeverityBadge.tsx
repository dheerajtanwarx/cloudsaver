import type { Severity } from "../types";

const STYLES: Record<Severity, { cls: string; dot: string }> = {
  high: { cls: "bg-red-50 text-red-800 ring-red-200", dot: "bg-red-600" },
  medium: { cls: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  low: { cls: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = STYLES[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {severity}
    </span>
  );
}
