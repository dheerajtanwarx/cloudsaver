import type { Health, ScanResult, ScanSummary } from "./types";

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError("API_UNREACHABLE", "Cannot reach the CloudSaver API. Is the backend running (npm run dev)?", 0);
  }
  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new ApiError(err?.code ?? `HTTP_${res.status}`, err?.message ?? `Request failed with status ${res.status}`, res.status);
  }
  return body as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
  listScans: () => request<ScanSummary[]>("/api/scans"),
  getScan: (id: string) => request<ScanResult>(`/api/scans/${encodeURIComponent(id)}`),
  runScan: () => request<ScanResult>("/api/scan", { method: "POST" }),
  csvUrl: (id: string) => `/api/scans/${encodeURIComponent(id)}/report.csv`,
};
