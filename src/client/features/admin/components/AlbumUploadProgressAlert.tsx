/*
 * Purpose: the "upload neterminat" warning for an album — reads GET /api/admin/events/:id/upload-progress
 * (kept on the server for the last batch, so it survives a closed page) and says e.g. "500 din 1385
 * poze încărcate, mai trebuie 885", with the missing file names and how to resume.
 * Shown on the event card (even with the upload area closed) and inside AlbumPhotoUploader.
 */
import { useCallback, useEffect, useState } from "react";

export type AlbumUploadProgress = {
  slug: string;
  expected: number;
  uploaded: number;
  pending: string[];
  startedAt: number;
  lastActivityAt: number;
  finishedAt: number | null;
};

/** A batch with photos still missing; null when there is none or it finished. */
export const incompleteUpload = (progress: AlbumUploadProgress | null) =>
  progress && progress.pending.length > 0 && !progress.finishedAt ? progress : null;

/** Photos are still arriving: the last one came less than 2 minutes ago. */
const ACTIVE_MS = 2 * 60_000;

const formatWhen = (ms: number) =>
  new Date(ms).toLocaleString("ro-RO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });

export async function fetchAlbumUploadProgress(eventId: string, accessToken: string): Promise<AlbumUploadProgress | null> {
  const res = await fetch(`/api/admin/events/${eventId}/upload-progress`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({})) as { progress?: AlbumUploadProgress | null; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Eroare ${res.status}`);
  return data.progress ?? null;
}

export default function AlbumUploadProgressAlert({ eventId, accessToken, refreshKey = 0, hideWhileRunning = false }: {
  eventId: string;
  accessToken: string;
  /** Change it to fetch again (e.g. after an upload run ends). */
  refreshKey?: number;
  /** The uploader on this page is running: its own progress bars are the truth. */
  hideWhileRunning?: boolean;
}) {
  const [progress, setProgress] = useState<AlbumUploadProgress | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      setProgress(await fetchAlbumUploadProgress(eventId, accessToken));
      setCheckedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut verifica progresul.");
    } finally {
      setChecking(false);
    }
  }, [eventId, accessToken]);

  useEffect(() => { void check(); }, [check, refreshKey]);

  const dismiss = async () => {
    if (!window.confirm("Ascunzi avertismentul? Pozele lipsă nu se încarcă singure; fă asta doar dacă le-ai urcat altfel.")) return;
    try {
      await fetch(`/api/admin/events/${eventId}/upload-progress`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
      setProgress(null);
    } catch {
      setError("Nu am putut ascunde avertismentul.");
    }
  };

  const open = incompleteUpload(progress);
  if (hideWhileRunning || (!open && !error)) return null;
  if (!open) return <p className="text-xs text-red-400">{error}</p>;

  const missing = open.pending.length;
  const active = Date.now() - open.lastActivityAt < ACTIVE_MS;
  const pct = Math.round((open.uploaded / open.expected) * 100);

  return (
    <div
      role="alert"
      onClick={(e) => e.stopPropagation()}
      className={`space-y-2 border-2 p-3 ${active ? "border-sky-500 bg-sky-500/10" : "border-amber-400 bg-amber-500/15"}`}
    >
      <p className={`text-sm font-semibold ${active ? "text-sky-200" : "text-amber-200"}`}>
        {active ? "⏳ Upload în curs" : "⚠️ Upload neterminat"}: {open.uploaded} din {open.expected} poze încărcate. Mai trebuie încărcate {missing}.
      </p>
      <div className="h-2 bg-neutral-800" aria-hidden="true">
        <div className={`h-2 ${active ? "bg-sky-400" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-neutral-300">
        Început pe {formatWhen(open.startedAt)}, ultima poză urcată pe {formatWhen(open.lastActivityAt)}.
        {active
          ? " Pozele încă ajung: probabil uploadul rulează în alt tab sau pe alt calculator."
          : ` Ca să continui, deschide „⬆️ Încarcă poze” și selectează din nou toate cele ${open.expected} de poze: cele deja încărcate sunt sărite automat.`}
      </p>
      <details className="text-xs text-neutral-400">
        <summary className="cursor-pointer text-neutral-300">Vezi cele {missing} poze lipsă</summary>
        <ul className="mt-1 max-h-40 overflow-y-auto font-mono">{open.pending.map((name) => <li key={name}>{name}</li>)}</ul>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void check()} disabled={checking} className="border border-neutral-600 px-2.5 py-1 text-xs text-neutral-200 hover:border-white disabled:opacity-50">
          {checking ? "Se verifică…" : "🔄 Verifică progresul"}
        </button>
        <button type="button" onClick={() => void dismiss()} className="px-2.5 py-1 text-xs text-neutral-500 underline hover:text-neutral-300">Am rezolvat, ascunde</button>
        {checkedAt && <span className="text-[11px] text-neutral-500">verificat la {new Date(checkedAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
