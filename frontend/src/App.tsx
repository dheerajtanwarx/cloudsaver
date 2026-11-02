import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { FindingsTable } from "./components/FindingsTable";
import { Header } from "./components/Header";
import { ErrorBanner, FailedChecks } from "./components/Notices";
import { SavingsByCheckChart } from "./components/SavingsByCheckChart";
import { SummaryCards } from "./components/SummaryCards";
import { TrendChart } from "./components/TrendChart";
import type { Health, ScanResult, ScanSummary } from "./types";

interface UiError { code: string; message: string }

function toUiError(err: unknown): UiError {
  if (err instanceof ApiError) return { code: err.code, message: err.message };
  return { code: "UNKNOWN", message: err instanceof Error ? err.message : String(err) };
}

export default function App() {
  const [health, setHealth] = useState<Health>();
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [scan, setScan] = useState<ScanResult>();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UiError>();

  const refreshScans = useCallback(async () => {
    const list = await api.listScans();
    setScans(list);
    return list;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setHealth(await api.health());
        const list = await refreshScans();
        const latest = list[list.length - 1];
        if (latest) setScan(await api.getScan(latest.id));
      } catch (err) {
        setError(toUiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshScans]);

  async function handleScan() {
    setScanning(true);
    setError(undefined);
    try {
      setScan(await api.runScan());
      await refreshScans();
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setScanning(false);
    }
  }

  const usdToInr = health?.usdToInr ?? 84;

  return (
    <div className="min-h-screen">
      <Header health={health} scan={scan} scanning={scanning} onScan={handleScan} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && <ErrorBanner code={error.code} message={error.message} onDismiss={() => setError(undefined)} />}

        {loading ? (
          <p className="py-24 text-center text-sm text-slate-500">Loading...</p>
        ) : !scan ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
            <h2 className="text-base font-semibold text-slate-900">No scans yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Run a read-only scan of {health?.scanAllRegions ? "all enabled regions" : health?.region ?? "your region"} to find unused and over-provisioned resources.
            </p>
            <button type="button" onClick={handleScan} disabled={scanning} className="mt-5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-brand-hover disabled:opacity-70">
              {scanning ? "Scanning..." : "Run first scan"}
            </button>
          </div>
        ) : (
          <>
            <SummaryCards scan={scan} usdToInr={usdToInr} />
            <FailedChecks failed={scan.failedChecks} />
            <div className="grid gap-6 lg:grid-cols-2">
              <SavingsByCheckChart scan={scan} usdToInr={usdToInr} />
              <TrendChart scans={scans} usdToInr={usdToInr} />
            </div>
            <FindingsTable key={scan.id} findings={scan.findings} usdToInr={usdToInr} csvUrl={api.csvUrl(scan.id)} />
            <p className="pb-4 text-center text-xs text-slate-400">
              Prices are approximate on-demand rates for ap-south-1 from a static table. Scan took {(scan.durationMs / 1000).toFixed(1)}s. CloudSaver is read-only and never changes your AWS resources.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
