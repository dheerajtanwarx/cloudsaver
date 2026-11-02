import { formatDateTime } from "../format";
import type { Health, ScanResult } from "../types";

interface Props {
  health: Health | undefined;
  scan: ScanResult | undefined;
  scanning: boolean;
  onScan: () => void;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className="font-mono text-sm text-slate-100">{value}</span>
    </div>
  );
}

export function Header({ health, scan, scanning, onScan }: Props) {
  const regions = scan?.regions.join(", ") ?? health?.region ?? "-";
  return (
    <header className="border-b border-slate-800 bg-[#232f3e] text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
            <rect width="32" height="32" rx="6" fill="#ff9900" />
            <path d="M9 21a5 5 0 0 1 1-9.9A7 7 0 0 1 23 13a4 4 0 0 1 0 8z" fill="#232f3e" />
          </svg>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold leading-tight">CloudSaver</h1>
              {health?.demoMode && (
                <span className="rounded border border-amber-300/60 bg-amber-300/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-200">
                  Demo data
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">AWS cost optimization scanner · read-only</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <Meta label="Account" value={scan?.accountId ?? "-"} />
          <Meta label="Region" value={health?.scanAllRegions && !scan ? "all enabled" : regions} />
          <Meta label="Last scan" value={scan ? formatDateTime(scan.timestamp) : "never"} />
          <button
            type="button"
            onClick={onScan}
            disabled={scanning}
            className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-70"
          >
            {scanning && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            )}
            {scanning ? "Scanning..." : "Run scan"}
          </button>
        </div>
      </div>
    </header>
  );
}
