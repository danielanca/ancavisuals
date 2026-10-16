import React, { useEffect, useState } from "react";
import { estimateRemainingMs, type UploadItem } from "./useUploadQueue";

const formatDuration = (ms: number) => {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
};

const STATUS_TEXT: Record<UploadItem["status"], string> = {
  queued: "În coadă",
  uploading: "Se încarcă…",
  done: "Gata ✓",
  error: "Eroare",
};

/**
 * Panou fix jos-dreapta pentru o coadă de încărcări: câte sunt în coadă, cât mai durează,
 * progresul lotului și fiecare încărcare cu starea ei. Se închide singur după ce toate s-au
 * terminat cu succes; erorile rămân cu „Reîncearcă” / închidere.
 */
export default function UploadQueuePanel({ items, averageMs, concurrency, title, onRetry, onDismiss }: {
  items: UploadItem[];
  averageMs: number;
  concurrency: number;
  title: string;
  onRetry: (key: string) => void;
  onDismiss: (key: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);
  // Lotul curent: tot ce a intrat de când panoul s-a deschis (pentru „3/5” și bara de progres).
  // Cele terminate dispar din `items`, dar rămân numărate în lot până se golește panoul.
  const [batch, setBatch] = useState<Set<string>>(() => new Set());

  const active = items.filter(item => item.status === "queued" || item.status === "uploading");
  const errors = items.filter(item => item.status === "error");
  const batchKeys = new Set([...batch, ...items.map(item => item.key)]);
  const batchTotal = batchKeys.size;
  const batchDone = batchTotal - active.length - errors.length;
  const allDone = batchTotal > 0 && active.length === 0 && errors.length === 0;

  useEffect(() => {
    setBatch(prev => (items.every(item => prev.has(item.key)) ? prev : new Set([...prev, ...items.map(item => item.key)])));
  }, [items]);

  useEffect(() => {
    if (!active.length) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [active.length]);

  // „Toate gata ✓” rămâne câteva secunde, apoi panoul dispare și lotul se golește.
  useEffect(() => {
    if (!allDone) return;
    const timer = setTimeout(() => setBatch(new Set()), 4000);
    return () => clearTimeout(timer);
  }, [allDone]);

  const dismiss = (key: string) => {
    setBatch(prev => { const next = new Set(prev); next.delete(key); return next; });
    onDismiss(key);
  };

  if (batchTotal === 0) return null;

  const remainingMs = estimateRemainingMs(items, concurrency, averageMs, now);
  const queuedCount = items.filter(item => item.status === "queued").length;
  const progress = batchTotal ? Math.round((batchDone / batchTotal) * 100) : 100;
  const queuePosition = (key: string) => items.filter(item => item.status === "queued").findIndex(item => item.key === key) + 1;

  return (
    <section
      role="status"
      aria-label={title}
      className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900/95 text-sm text-neutral-200 shadow-2xl shadow-black/60 backdrop-blur"
    >
      <button
        type="button"
        onClick={() => setCollapsed(value => !value)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-800/60"
      >
        {active.length ? (
          <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
        ) : (
          <span aria-hidden="true" className={`shrink-0 ${errors.length ? "text-red-400" : "text-emerald-400"}`}>{errors.length ? "!" : "✓"}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-white">
            {active.length
              ? `${title}: ${batchDone}/${batchTotal}`
              : errors.length
                ? `${errors.length} ${errors.length === 1 ? "încărcare eșuată" : "încărcări eșuate"}`
                : "Toate gata ✓"}
          </span>
          {active.length > 0 && (
            <span className="block text-xs text-neutral-400">
              {queuedCount > 0 ? `${queuedCount} în coadă · ` : ""}mai durează ~{formatDuration(remainingMs)}
            </span>
          )}
        </span>
        <span aria-hidden="true" className="text-xs text-neutral-500">{collapsed ? "▲" : "▼"}</span>
      </button>

      <div className="h-1 w-full bg-neutral-800" role="progressbar" aria-label="Progres încărcări" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {!collapsed && items.length > 0 && (
        <ul className="max-h-72 divide-y divide-neutral-800 overflow-y-auto">
          {items.map(item => (
            <li key={item.key} className="flex items-center gap-3 px-4 py-2">
              {item.thumbUrl
                ? <img src={item.thumbUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                : <span className="h-10 w-10 shrink-0 rounded-md bg-neutral-800" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-neutral-200">{item.label}</span>
                <span className={`block text-[11px] ${item.status === "error" ? "text-red-400" : item.status === "done" ? "text-emerald-400" : "text-neutral-500"}`}>
                  {item.status === "queued" ? `${STATUS_TEXT.queued} #${queuePosition(item.key)}`
                    : item.status === "uploading" ? `${STATUS_TEXT.uploading} ${formatDuration(now - (item.startedAt ?? now))}`
                    : item.status === "error" ? `${STATUS_TEXT.error}: ${item.error}` : STATUS_TEXT.done}
                </span>
                {item.status === "uploading" && (
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-neutral-800">
                    <span
                      className="block h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(95, ((now - (item.startedAt ?? now)) / averageMs) * 100)}%` }}
                    />
                  </span>
                )}
              </span>
              {item.status === "error" && (
                <span className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => onRetry(item.key)} className="rounded-md px-2 py-1 text-[11px] text-emerald-300 hover:bg-neutral-800">Reîncearcă</button>
                  <button type="button" onClick={() => dismiss(item.key)} aria-label={`Închide ${item.label}`} className="rounded-md px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-800">✕</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
