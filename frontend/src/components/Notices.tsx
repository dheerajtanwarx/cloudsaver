import { CHECK_LABELS } from "../format";
import type { FailedCheck } from "../types";

export function ErrorBanner({ code, message, onDismiss }: { code: string; message: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="currentColor" aria-hidden><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-.9-11.6a.9.9 0 1 1 1.8 0v4a.9.9 0 1 1-1.8 0v-4zM10 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" /></svg>
      <div className="flex-1 text-sm">
        <p className="font-semibold text-red-900">Scan failed <span className="font-mono text-xs font-normal text-red-700">({code})</span></p>
        <p className="mt-1 text-red-800">{message}</p>
      </div>
      <button type="button" onClick={onDismiss} className="text-sm font-medium text-red-700 hover:text-red-900">Dismiss</button>
    </div>
  );
}

export function FailedChecks({ failed }: { failed: FailedCheck[] }) {
  if (failed.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
      <p className="font-semibold text-amber-900">
        {failed.length} check{failed.length === 1 ? "" : "s"} could not run. Other checks completed normally.
      </p>
      <ul className="mt-2 space-y-1 text-amber-800">
        {failed.map((f) => (
          <li key={`${f.checkType}-${f.region}`}>
            <span className="font-medium">{CHECK_LABELS[f.checkType]}</span> <span className="font-mono text-xs">({f.region}, {f.errorCode})</span>: {f.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
