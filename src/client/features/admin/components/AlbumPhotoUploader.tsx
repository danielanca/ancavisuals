import React, { useEffect, useRef, useState } from "react";
import { createAlbumPreview } from "./createAlbumPreview";
import { albumZipManifestHash, buildAlbumZip, uploadAlbumZip } from "./albumZip";
import { loadFirebaseAuth } from "../providers/loadFirebaseAuth";
import { sanitizeAlbumPhotoName } from "../../../../shared/albumPhotoName";

interface AlbumPhotoUploaderProps {
  eventId: string;
  albumSlug: string;
  accessToken: string;
  /** Chemat după originale + WebP + photos.zip. Repară pe server doar ce lipsește (preview-uri, ZIP). */
  onComplete?: () => void;
}

type OriginalStatus = "pending" | "active" | "done" | "error";
type PreviewStatus = "pending" | "active" | "done" | "fallback";

interface Row {
  file: File;
  original: OriginalStatus;
  preview: PreviewStatus;
}

type Phase = "idle" | "originals" | "previews" | "zip" | "done" | "stopped";
type ZipStage = "idle" | "checking" | "building" | "uploading" | "verifying" | "done" | "skipped" | "error";
interface ZipState { stage: ZipStage; done: number; total: number; message?: string }

// Decoded camera images are much larger than their compressed files.
const CONCURRENCY = 2;

async function uploadRequest(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 120_000);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

const isAlbumPhoto = (file: File) =>
  /\.(jpe?g|png)$/i.test(file.name) || file.type === "image/jpeg" || file.type === "image/png";

const formatBytes = (bytes: number) => bytes >= 1024 ** 3
  ? `${(bytes / 1024 ** 3).toLocaleString("ro-RO", { maximumFractionDigits: 2 })} GB`
  : `${Math.round(bytes / 1024 ** 2).toLocaleString("ro-RO")} MB`;

const percent = (done: number, total: number) => (total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0);

/** Runs `task` on every index (max CONCURRENCY at once) and returns the indices that failed. */
async function runPool(indices: number[], signal: AbortSignal, task: (index: number) => Promise<boolean>): Promise<number[]> {
  let cursor = 0;
  const failed: number[] = [];
  const worker = async () => {
    while (cursor < indices.length && !signal.aborted) {
      const index = indices[cursor++];
      if (!(await task(index)) && !signal.aborted) failed.push(index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, indices.length) }, worker));
  return failed.sort((a, b) => a - b);
}

export default function AlbumPhotoUploader({ eventId, albumSlug, accessToken, onComplete }: AlbumPhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRun = useRef<AbortController | null>(null);
  // Canonical Bunny names of originals already uploaded from this selection; a retry never re-sends them.
  const uploadedNames = useRef(new Map<number, string>());
  const uploadedPreviews = useRef(new Set<number>());
  useEffect(() => () => activeRun.current?.abort(), []);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [zip, setZip] = useState<ZipState>({ stage: "idle", done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [automaticRetry, setAutomaticRetry] = useState(false);

  const updateRow = (index: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const token = async () => {
    const { auth } = await loadFirebaseAuth();
    return auth.currentUser ? auth.currentUser.getIdToken() : accessToken;
  };

  const uploadOriginal = async (file: File, index: number, signal: AbortSignal, sessionId: string): Promise<boolean> => {
    try {
      const res = await uploadRequest(
        `/api/admin/events/${eventId}/upload-photo?name=${encodeURIComponent(file.name)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/octet-stream", "X-Album-Upload-Session": sessionId },
          body: file,
          signal,
        },
      );
      if (!res.ok) return false;
      const data = await res.json() as { name: string };
      uploadedNames.current.set(index, data.name);
      return true;
    } catch {
      return false;
    }
  };

  const uploadPreview = async (file: File, name: string, signal: AbortSignal): Promise<boolean> => {
    try {
      const preview = await createAlbumPreview(file, signal);
      const uploaded = await uploadRequest(`/api/admin/events/${eventId}/upload-photo-preview?name=${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "image/webp" },
        body: preview,
        signal,
      });
      return uploaded.ok;
    } catch {
      return false;
    }
  };

  /** Phase 1: originals → {slug}/photos/, monitored by a server session that emails if the batch is abandoned. */
  const runOriginals = async (sourceRows: Row[], targets: number[], controller: AbortController): Promise<number> => {
    let sessionId: string;
    try {
      const response = await uploadRequest(`/api/admin/events/${eventId}/upload-session`, {
        method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ files: targets.map((index) => sourceRows[index].file.name) }), signal: controller.signal,
      });
      const data = await response.json() as { sessionId?: string };
      if (!response.ok || !data.sessionId) throw new Error("Monitoring unavailable");
      sessionId = data.sessionId;
    } catch {
      if (controller.signal.aborted) return targets.length;
      targets.forEach((index) => updateRow(index, { original: "error" }));
      setError("Uploadul nu a pornit: monitorizarea pentru email nu a putut fi activată. Reîncearcă atunci când revine conexiunea.");
      return targets.length;
    }
    const updateSession = async (action: "heartbeat" | "finish") => {
      const response = await uploadRequest(`/api/admin/events/${eventId}/upload-session/${sessionId}`, {
        method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action }), signal: controller.signal,
      });
      if (!response.ok) throw new Error("Monitoring update failed");
    };
    const heartbeat = setInterval(() => { void updateSession("heartbeat").catch(() => {}); }, 60_000);
    const stopHeartbeat = () => clearInterval(heartbeat);
    controller.signal.addEventListener("abort", stopHeartbeat, { once: true });

    const pass = (indices: number[], final: boolean) => runPool(indices, controller.signal, async (index) => {
      updateRow(index, { original: "active" });
      const ok = await uploadOriginal(sourceRows[index].file, index, controller.signal, sessionId);
      if (!controller.signal.aborted) updateRow(index, { original: ok ? "done" : final ? "error" : "pending" });
      return ok;
    });
    let failed = await pass(targets, false);
    if (failed.length && !controller.signal.aborted) {
      setAutomaticRetry(true);
      failed = await pass(failed, true);
      setAutomaticRetry(false);
    }

    stopHeartbeat();
    controller.signal.removeEventListener("abort", stopHeartbeat);
    if (!controller.signal.aborted) {
      // Even if this request fails offline, the VPS detects the abandoned durable session.
      try { await updateSession("finish"); } catch { /* Server checks after 15 minutes without activity. */ }
    }
    return failed.length;
  };

  /** Phase 2: WebP previews for every uploaded original that still lacks one. Failures fall back to the VPS. */
  const runPreviews = async (sourceRows: Row[], controller: AbortController) => {
    const indices = sourceRows
      .map((_, index) => (uploadedNames.current.has(index) && !uploadedPreviews.current.has(index) ? index : -1))
      .filter((index) => index >= 0);
    const pass = (list: number[], final: boolean) => runPool(list, controller.signal, async (index) => {
      updateRow(index, { preview: "active" });
      const ok = await uploadPreview(sourceRows[index].file, uploadedNames.current.get(index)!, controller.signal);
      if (!controller.signal.aborted) {
        updateRow(index, { preview: ok ? "done" : final ? "fallback" : "pending" });
        if (ok) uploadedPreviews.current.add(index);
      }
      return ok;
    });
    const failed = await pass(indices, false);
    if (failed.length && !controller.signal.aborted) {
      setAutomaticRetry(true);
      await pass(failed, true);
      setAutomaticRetry(false);
    }
  };

  /** Phase 3: photos.zip built on this computer (nothing on the VPS disk) and streamed into Bunny. */
  const runZip = async (sourceRows: Row[], controller: AbortController): Promise<"done" | "skipped" | "error"> => {
    const entries = sourceRows.map((row, index) => ({ name: uploadedNames.current.get(index)!, file: row.file }));
    const names = entries.map((entry) => entry.name);
    try {
      setZip({ stage: "checking", done: 0, total: 0 });
      const checkRes = await uploadRequest(`/api/admin/events/${eventId}/album-zip/check`, {
        method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ files: names }), signal: controller.signal,
      });
      const check = await checkRes.json() as { complete?: boolean; missingCount?: number; error?: string };
      if (!checkRes.ok) throw new Error(check.error ?? `Verificarea albumului a eșuat (${checkRes.status}).`);
      if (!check.complete) {
        setZip({
          stage: "skipped", done: 0, total: 0,
          message: `Albumul are în Bunny și alte ${check.missingCount ?? ""} originale care nu sunt în selecția ta, deci ZIP-ul complet va fi generat pe server.`,
        });
        return "skipped";
      }

      const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
      setZip({ stage: "building", done: 0, total: totalBytes });
      const archive = await buildAlbumZip(entries, controller.signal, (done, total) => setZip({ stage: "building", done, total }));
      const manifest = await albumZipManifestHash(names);

      setZip({ stage: "uploading", done: 0, total: archive.size });
      const uploaded = await uploadAlbumZip(
        `/api/admin/events/${eventId}/upload-album-zip`,
        archive,
        { Authorization: `Bearer ${await token()}`, "Content-Type": "application/zip", "X-Album-Zip-Manifest": manifest },
        controller.signal,
        (done, total) => setZip({ stage: done >= total ? "verifying" : "uploading", done, total }),
      );
      if (!uploaded.ok) {
        throw new Error(uploaded.status === 413
          ? "nginx a respins ZIP-ul (413): pe VPS lipsește `client_max_body_size 0` pentru /upload-album-zip."
          : uploaded.error ?? `Serverul a răspuns ${uploaded.status}.`);
      }
      setZip({ stage: "done", done: archive.size, total: archive.size });
      return "done";
    } catch (err) {
      if (controller.signal.aborted) return "error";
      setZip({ stage: "error", done: 0, total: 0, message: err instanceof Error ? err.message : String(err) });
      return "error";
    }
  };

  const finishRun = (controller: AbortController) => {
    activeRun.current = null;
    if (controller.signal.aborted) return false;
    setRunning(false);
    setAutomaticRetry(false);
    return true;
  };

  const runQueue = async (sourceRows: Row[], targets: number[]) => {
    if (activeRun.current) return;
    const controller = new AbortController();
    activeRun.current = controller;
    setError(null);
    setRunning(true);
    setZip({ stage: "idle", done: 0, total: 0 });
    targets.forEach((i) => updateRow(i, { original: "pending" }));

    setPhase("originals");
    const failedOriginals = await runOriginals(sourceRows, targets, controller);
    if (controller.signal.aborted) return void finishRun(controller);

    setPhase("previews");
    await runPreviews(sourceRows, controller);
    if (controller.signal.aborted) return void finishRun(controller);

    if (failedOriginals > 0) {
      setPhase("stopped");
      finishRun(controller);
      setError((current) => current ?? "Unele originale nu s-au încărcat nici la a doua încercare. Sunt păstrate mai jos pentru reîncercare manuală; photos.zip se face după ce urcă toate. Serverul trimite o alertă prin email; dacă s-a pierdut conexiunea, după 15 minute fără activitate.");
      return;
    }

    setPhase("zip");
    const zipResult = await runZip(sourceRows, controller);
    if (!finishRun(controller)) return;
    if (zipResult === "error") {
      setPhase("stopped");
      return;
    }
    setPhase("done");
    onComplete?.();
  };

  const retryZip = async () => {
    if (activeRun.current) return;
    const controller = new AbortController();
    activeRun.current = controller;
    setRunning(true);
    setPhase("zip");
    const result = await runZip(rows, controller);
    if (!finishRun(controller)) return;
    setPhase(result === "error" ? "stopped" : "done");
    if (result !== "error") onComplete?.();
  };

  const zipOnServer = () => {
    setZip({ stage: "skipped", done: 0, total: 0, message: "ZIP-ul va fi generat pe server după procesarea preview-urilor." });
    setPhase("done");
    onComplete?.();
  };

  const pick = (fileList: FileList | File[]) => {
    if (activeRun.current) return;
    const picked = Array.from(fileList).filter(isAlbumPhoto);
    if (picked.length === 0) {
      setError("Selectează fișiere JPG sau PNG.");
      return;
    }
    const previewNames = picked.map((file) => sanitizeAlbumPhotoName(file.name).replace(/\.[^.]+$/, ".webp"));
    if (new Set(previewNames).size !== previewNames.length) {
      setError("Unele poze ar avea același nume în album. Redenumește fișierele duplicate înainte de upload.");
      return;
    }
    const next = picked.map<Row>((file) => ({ file, original: "pending", preview: "pending" }));
    uploadedNames.current = new Map();
    uploadedPreviews.current = new Set();
    setRows(next);
    void runQueue(next, next.map((_, i) => i));
  };

  const retryFailed = () => {
    const failed = rows.map((r, i) => (r.original === "error" ? i : -1)).filter((i) => i >= 0);
    if (failed.length) void runQueue(rows, failed);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer.files.length) pick(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) pick(e.target.files);
    e.target.value = "";
  };

  const total = rows.length;
  const originalsDone = rows.filter((r) => r.original === "done").length;
  const originalsFailed = rows.filter((r) => r.original === "error").length;
  const previewsDone = rows.filter((r) => r.preview === "done").length;
  const previewFallbacks = rows.filter((r) => r.preview === "fallback").length;
  const previewTotal = total - originalsFailed;

  const stepState = (step: "originals" | "previews" | "zip"): "pending" | "active" | "done" | "error" | "skipped" => {
    const order = ["originals", "previews", "zip"];
    if (step === "zip" && zip.stage === "error") return "error";
    if (step === "zip" && zip.stage === "skipped") return "skipped";
    if (step === "originals" && originalsFailed > 0 && !running) return "error";
    if (phase === step && running) return "active";
    if (phase === "done") return "done";
    if (phase === "stopped") return step === "zip" ? "pending" : "done";
    return order.indexOf(step) < order.indexOf(phase) ? "done" : "pending";
  };

  const zipDetail = (() => {
    switch (zip.stage) {
      case "checking": return "Verific că selecția conține toate originalele albumului…";
      case "building": return `Se creează arhiva pe calculatorul tău… ${formatBytes(zip.done)} / ${formatBytes(zip.total)}`;
      case "uploading": return `Se încarcă photos.zip în Bunny… ${formatBytes(zip.done)} / ${formatBytes(zip.total)}`;
      case "verifying": return "Se verifică photos.zip în Bunny…";
      case "done": return `✓ photos.zip urcat și verificat (${formatBytes(zip.total)})`;
      case "skipped": return zip.message ?? "";
      case "error": return zip.message ?? "Încărcarea ZIP-ului a eșuat.";
      default: return "Se face după originale și preview-uri, direct de pe calculatorul tău.";
    }
  })();

  const steps = [
    {
      key: "originals" as const, label: "Originale",
      detail: `${originalsDone}/${total} în ${albumSlug}/photos/${automaticRetry && phase === "originals" ? " · reîncercare automată" : ""}${originalsFailed ? ` · ${originalsFailed} eșuate` : ""}`,
      pct: percent(originalsDone + originalsFailed, total),
    },
    {
      key: "previews" as const, label: "Previzualizări WebP",
      detail: `${previewsDone}/${previewTotal} generate și urcate în photos_preview/${automaticRetry && phase === "previews" ? " · reîncercare automată" : ""}`,
      pct: percent(previewsDone + previewFallbacks, previewTotal),
    },
    {
      key: "zip" as const, label: "photos.zip",
      detail: zipDetail,
      pct: zip.stage === "done" || zip.stage === "verifying" ? 100 : percent(zip.done, zip.total),
    },
  ];

  const icon = { pending: "○", active: "●", done: "✓", error: "✕", skipped: "–" };
  const tone = {
    pending: "text-neutral-600", active: "text-violet-400 animate-pulse", done: "text-emerald-400", error: "text-red-400", skipped: "text-amber-400",
  };

  return (
    <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => { if (!running) inputRef.current?.click(); }}
        className={[
          "border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors",
          dragging ? "border-violet-500 bg-violet-500/10" : "border-neutral-700 hover:border-neutral-500",
        ].join(" ")}
      >
        <p className="text-xs text-neutral-500">
          Trage pozele originale aici sau <span className="text-neutral-300 underline">selectează</span>
          <span className="block mt-0.5 text-neutral-600">
            Originalele JPG / PNG merg în <span className="font-mono">{albumSlug}/photos/</span>.
            Previzualizările WebP și photos.zip sunt create pe calculatorul tău și încărcate automat.
          </span>
        </p>
      </div>

      {total > 0 && (
        <ol className="space-y-2.5" aria-label="Etape upload album">
          {steps.map((step, index) => {
            const state = stepState(step.key);
            return (
              <li key={step.key} className="space-y-1" data-state={state}>
                <div className="flex items-baseline gap-2 text-xs">
                  <span className={`w-3 text-center ${tone[state]}`} aria-hidden>{icon[state]}</span>
                  <span className={state === "pending" ? "text-neutral-500" : "text-neutral-200"}>{index + 1}. {step.label}</span>
                  <span className={`ml-auto text-right ${state === "error" ? "text-red-400" : state === "skipped" ? "text-amber-400" : "text-neutral-400"}`}>{step.detail}</span>
                </div>
                {state !== "skipped" && (
                  <div className="ml-5 bg-neutral-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${state === "error" ? "bg-red-500" : state === "done" ? "bg-emerald-500" : "bg-violet-500"}`}
                      style={{ width: `${state === "done" ? 100 : step.pct}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {running && <p className="text-xs text-neutral-400">Ține pagina deschisă și calculatorul treaz până termină. WebP: maximum 1.400 px lățime.</p>}
      {previewFallbacks > 0 && <p className="text-xs text-amber-400">{previewFallbacks} previzualizări vor fi generate pe server după încărcarea tuturor originalelor.</p>}
      {phase === "done" && !running && <p className="text-xs text-emerald-400">Gata. Serverul verifică acum doar ce lipsește (preview-uri eșuate) — primești email când termină.</p>}

      {originalsFailed > 0 && !running && (
        <div className="space-y-2">
          <ul className="max-h-40 overflow-y-auto text-xs text-red-400" aria-label="Poze neîncărcate">
            {rows.filter((row) => row.original === "error").map((row) => <li key={row.file.name}>{row.file.name}</li>)}
          </ul>
          <button
            onClick={retryFailed}
            className="text-xs text-neutral-300 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg px-3 py-1.5 transition-colors"
          >
            Reîncearcă {originalsFailed} eșuate
          </button>
        </div>
      )}

      {zip.stage === "error" && !running && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void retryZip()}
            className="text-xs text-neutral-300 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg px-3 py-1.5 transition-colors"
          >
            Reîncearcă photos.zip
          </button>
          <button
            onClick={zipOnServer}
            className="text-xs text-neutral-500 hover:text-neutral-300 border border-neutral-800 hover:border-neutral-600 rounded-lg px-3 py-1.5 transition-colors"
          >
            Lasă serverul să facă ZIP-ul
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple disabled={running} className="hidden" onChange={handleChange} />
    </div>
  );
}
