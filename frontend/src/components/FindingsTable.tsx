import { Fragment, useMemo, useState } from "react";
import { CHECK_LABELS, formatInr, formatUsd, SEVERITY_RANK } from "../format";
import type { CheckType, Finding, Severity } from "../types";
import { CopyButton } from "./CopyButton";
import { Panel } from "./Panel";
import { SeverityBadge } from "./SeverityBadge";

type SortKey = "severity" | "checkType" | "resource" | "region" | "cost";
type SortDir = "asc" | "desc";

interface Props {
  findings: Finding[];
  usdToInr: number;
  csvUrl: string;
}

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "severity", label: "Severity" },
  { key: "checkType", label: "Check" },
  { key: "resource", label: "Resource" },
  { key: "region", label: "Region" },
  { key: "cost", label: "Est. monthly", align: "right" },
];

function compare(a: Finding, b: Finding, key: SortKey): number {
  switch (key) {
    case "severity": return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.estimatedMonthlyCostUSD - b.estimatedMonthlyCostUSD;
    case "checkType": return CHECK_LABELS[a.checkType].localeCompare(CHECK_LABELS[b.checkType]);
    case "resource": return (a.resourceName || a.resourceId).localeCompare(b.resourceName || b.resourceId);
    case "region": return a.region.localeCompare(b.region);
    case "cost": return a.estimatedMonthlyCostUSD - b.estimatedMonthlyCostUSD;
  }
}

const selectCls = "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-series focus:outline-none focus:ring-1 focus:ring-series";

export function FindingsTable({ findings, usdToInr, csvUrl }: Props) {
  const [checkFilter, setCheckFilter] = useState<CheckType | "all">("all");
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "cost", dir: "desc" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const presentChecks = useMemo(() => [...new Set(findings.map((f) => f.checkType))], [findings]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = findings.filter(
      (f) =>
        (checkFilter === "all" || f.checkType === checkFilter) &&
        (sevFilter === "all" || f.severity === sevFilter) &&
        (!q || `${f.resourceId} ${f.resourceName} ${f.details}`.toLowerCase().includes(q)),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => compare(a, b, sort.key) * dir);
  }, [findings, checkFilter, sevFilter, query, sort]);

  const visibleTotal = rows.reduce((s, f) => s + f.estimatedMonthlyCostUSD, 0);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "cost" || key === "severity" ? "desc" : "asc" }));
  }
  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <Panel
      title="Findings"
      subtitle={`${rows.length} of ${findings.length} shown · ${formatUsd(visibleTotal)} / month`}
      action={
        <a href={csvUrl} download className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M10 3a1 1 0 0 1 1 1v7.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42L9 11.6V4a1 1 0 0 1 1-1zM4 15a1 1 0 0 1 1 1h10a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2 1 1 0 0 1 1-1z" /></svg>
          Download CSV
        </a>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select aria-label="Filter by check type" className={selectCls} value={checkFilter} onChange={(e) => setCheckFilter(e.target.value as CheckType | "all")}>
          <option value="all">All check types</option>
          {presentChecks.map((c) => <option key={c} value={c}>{CHECK_LABELS[c]}</option>)}
        </select>
        <select aria-label="Filter by severity" className={selectCls} value={sevFilter} onChange={(e) => setSevFilter(e.target.value as Severity | "all")}>
          <option value="all">All severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input
          type="search"
          placeholder="Search resource ID or name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${selectCls} w-64`}
        />
        {(checkFilter !== "all" || sevFilter !== "all" || query) && (
          <button type="button" className="text-sm text-series hover:underline" onClick={() => { setCheckFilter("all"); setSevFilter("all"); setQuery(""); }}>
            Clear filters
          </button>
        )}
      </div>

      <div className="-mx-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="w-8 px-5 py-2" />
              {COLUMNS.map((c) => (
                <th key={c.key} className={`py-2 ${c.align === "right" ? "pl-3 pr-5 text-right" : "px-3"}`} aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
                    {c.label}
                    <span className="text-[10px] text-slate-400">{sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No findings match these filters.</td></tr>
            )}
            {rows.map((f) => {
              const open = expanded.has(f.id);
              return (
                <Fragment key={f.id}>
                  <tr
                    className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${open ? "bg-slate-50" : ""}`}
                    onClick={() => toggleRow(f.id)}
                    aria-expanded={open}
                  >
                    <td className="px-5 py-3 text-slate-400">
                      <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} fill="currentColor" aria-hidden><path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L11.6 10 7.3 5.7a1 1 0 0 1 0-1.4z" /></svg>
                    </td>
                    <td className="px-3 py-3"><SeverityBadge severity={f.severity} /></td>
                    <td className="px-3 py-3 text-slate-700">{CHECK_LABELS[f.checkType]}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">{f.resourceName || <span className="text-slate-400">(no name)</span>}</div>
                      <div className="font-mono text-xs text-slate-500">{f.resourceId}</div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">{f.region}</td>
                    <td className="py-3 pl-3 pr-5 text-right">
                      {f.estimatedMonthlyCostUSD > 0 ? (
                        <>
                          <div className="font-medium text-slate-900">{formatUsd(f.estimatedMonthlyCostUSD)}</div>
                          <div className="text-xs text-slate-500">{formatInr(f.estimatedMonthlyCostUSD * usdToInr)}</div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500">cost risk</span>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td />
                      <td colSpan={5} className="pb-5 pl-3 pr-5 pt-1">
                        <dl className="grid gap-4 md:grid-cols-2">
                          <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Details</dt>
                            <dd className="mt-1 text-slate-700">{f.details}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendation</dt>
                            <dd className="mt-1 text-slate-700">{f.recommendation}</dd>
                          </div>
                        </dl>
                        <div className="mt-4">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">AWS CLI fix</span>
                            <span className="text-xs text-slate-500">Review before running. CloudSaver never executes this.</span>
                          </div>
                          <div className="flex items-start gap-3 rounded-md bg-slate-900 p-3" onClick={(e) => e.stopPropagation()}>
                            <code className="flex-1 whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-slate-100">{f.awsCliFixCommand}</code>
                            <CopyButton text={f.awsCliFixCommand} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
