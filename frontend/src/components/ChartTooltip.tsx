export function ChartTooltip({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-0.5 font-mono text-slate-700">{value}</p>
      {sub && <p className="mt-0.5 text-slate-500">{sub}</p>}
    </div>
  );
}
