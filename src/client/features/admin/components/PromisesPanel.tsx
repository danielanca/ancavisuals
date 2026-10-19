/*
 * Purpose: "Ce le-ai promis clienților" — small but loud panel at the top of the admin dashboard.
 * Every dated album update ("pozele vor fi gata în jurul datei de…", "mai durează 10 zile") is a
 * promise; overdue ones are red, the ones due within 4 days amber, the rest folded away. "✓ Făcut"
 * closes a promise. The same promises are emailed to the owner 4 days before (see albumPromises).
 */
import { useCallback, useEffect, useState } from "react";
import { formatEstimateDate } from "../../../../shared/albumUpdates";

type PromiseStatus = "overdue" | "soon" | "later";

type AlbumPromise = {
  id: string;
  albumSlug: string;
  clients: string[];
  label: string;
  text: string;
  estimateDate: string;
  daysLeft: number;
  status: PromiseStatus;
};

export const whenText = (daysLeft: number) =>
  daysLeft < 0 ? `depășit cu ${-daysLeft} ${-daysLeft === 1 ? "zi" : "zile"}`
    : daysLeft === 0 ? "azi"
      : daysLeft === 1 ? "mâine"
        : `peste ${daysLeft} zile`;

const STATUS_STYLE: Record<PromiseStatus, { row: string; chip: string }> = {
  overdue: { row: "border-red-500/60 bg-red-950/40", chip: "bg-red-600 text-white" },
  soon: { row: "border-amber-500/60 bg-amber-950/30", chip: "bg-amber-500 text-black" },
  later: { row: "border-neutral-800 bg-neutral-950", chip: "bg-neutral-800 text-neutral-200" },
};

export default function PromisesPanel({ accessToken }: { accessToken: string }) {
  const [promises, setPromises] = useState<AlbumPromise[] | null>(null);
  const [showLater, setShowLater] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch("/api/album-subscriptions/admin/promises", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return;
      const data = (await res.json()) as { promises?: AlbumPromise[] };
      setPromises(data.promises ?? []);
    } catch { /* the dashboard works without it */ }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const done = async (promise: AlbumPromise) => {
    const who = promise.clients.join(" & ") || promise.albumSlug;
    if (!window.confirm(`Ai livrat ce i-ai promis lui ${who} (${formatEstimateDate(promise.estimateDate)})?`)) return;
    setClosing(promise.id);
    try {
      const res = await fetch(`/api/album-subscriptions/admin/promises/${encodeURIComponent(promise.id)}/done`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) setPromises((current) => (current ?? []).filter((p) => p.id !== promise.id));
    } finally {
      setClosing(null);
    }
  };

  if (!promises || promises.length === 0) return null;
  const urgent = promises.filter((p) => p.status !== "later");
  const later = promises.filter((p) => p.status === "later");
  const overdue = promises.filter((p) => p.status === "overdue").length;

  const row = (promise: AlbumPromise) => (
    <li key={promise.id} className={`flex flex-col gap-2 border p-3 sm:flex-row sm:items-center ${STATUS_STYLE[promise.status].row}`}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-white">{promise.clients.join(" & ") || promise.albumSlug}</span>
          <span className={`px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLE[promise.status].chip}`}>
            {formatEstimateDate(promise.estimateDate)} · {whenText(promise.daysLeft)}
          </span>
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-neutral-400">
          <span className="text-neutral-300">{promise.label}:</span> {promise.text}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <a href={`/media/${encodeURIComponent(promise.albumSlug)}`} target="_blank" rel="noreferrer" className="border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-400">
          Album ↗
        </a>
        <button
          type="button"
          onClick={() => void done(promise)}
          disabled={closing === promise.id}
          aria-label={`Marchează ca făcut: ${promise.clients.join(" & ") || promise.albumSlug}`}
          className="bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-neutral-200 disabled:opacity-50"
        >
          ✓ Făcut
        </button>
      </div>
    </li>
  );

  return (
    <section aria-label="Promisiuni către clienți" className={`border-2 p-4 ${overdue > 0 ? "border-red-500" : urgent.length > 0 ? "border-amber-500" : "border-neutral-700"} bg-neutral-900`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-white">⏰ Ce le-ai promis clienților</h2>
        <p className="text-xs text-neutral-400">
          {overdue > 0 && <span className="font-semibold text-red-400">{overdue} depășite · </span>}
          {urgent.length - overdue > 0 && <span className="font-semibold text-amber-400">{urgent.length - overdue} în următoarele 4 zile · </span>}
          {promises.length} în total
        </p>
      </div>
      {urgent.length > 0
        ? <ul className="space-y-2">{urgent.map(row)}</ul>
        : <p className="text-xs text-neutral-400">Niciun termen în următoarele 4 zile. Primești email cu 4 zile înainte de fiecare.</p>}
      {later.length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setShowLater((v) => !v)} aria-expanded={showLater} className="text-xs text-neutral-400 underline underline-offset-4 hover:text-white">
            {showLater ? "Ascunde" : "Vezi"} termenele de mai târziu ({later.length})
          </button>
          {showLater && <ul className="mt-2 space-y-2">{later.map(row)}</ul>}
        </div>
      )}
    </section>
  );
}
