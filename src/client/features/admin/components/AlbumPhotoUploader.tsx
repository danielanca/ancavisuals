import React, { useEffect, useRef, useState } from "react";
import { createAlbumPreview } from "./createAlbumPreview";
import { loadFirebaseAuth } from "../providers/loadFirebaseAuth";
import { sanitizeAlbumPhotoName } from "../../../../shared/albumPhotoName";

interface AlbumPhotoUploaderProps {
  eventId: string;
  albumSlug: string;
  accessToken: string;
  /** Chemat numai după ce toate originalele au fost urcate. Repară preview-urile lipsă pe server. */
  onComplete?: () => void;
}

type FileStatus = "pending" | "uploading" | "preview" | "done" | "error";

interface Row {
  file: File;
  status: FileStatus;
}

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

export default function AlbumPhotoUploader({ eventId, albumSlug, accessToken, onComplete }: AlbumPhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRun = useRef<AbortController | null>(null);
  useEffect(() => () => activeRun.current?.abort(), []);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackCount, setFallbackCount] = useState(0);
  const [automaticRetry, setAutomaticRetry] = useState(false);

  const setStatus = (index: number, status: FileStatus) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, status } : r)));

  const token = async () => {
    const { auth } = await loadFirebaseAuth();
    return auth.currentUser ? auth.currentUser.getIdToken() : accessToken;
  };

  const uploadOne = async (
    file: File, index: number, signal: AbortSignal, originalNames: Map<number, string>, sessionId: string,
  ): Promise<"done" | "error" | "preview-error"> => {
    try {
      let name = originalNames.get(index);
      if (!name) {
        const res = await uploadRequest(
          `/api/admin/events/${eventId}/upload-photo?name=${encodeURIComponent(file.name)}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/octet-stream", "X-Album-Upload-Session": sessionId },
            body: file,
            signal,
          },
        );
        if (!res.ok) return "error";
        const data = await res.json() as { name: string };
        name = data.name;
        originalNames.set(index, name);
      }
      setStatus(index, "preview");
      try {
        const preview = await createAlbumPreview(file, signal);
        const uploaded = await uploadRequest(`/api/admin/events/${eventId}/upload-photo-preview?name=${encodeURIComponent(name)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "image/webp" },
          body: preview,
          signal,
        });
        if (!uploaded.ok) throw new Error("Preview upload failed");
      } catch {
        return signal.aborted ? "error" : "preview-error";
      }
      return "done";
    } catch {
      return "error";
    }
  };

  const runQueue = async (sourceRows: Row[], targets: number[]) => {
    if (activeRun.current) return;
    const controller = new AbortController();
    activeRun.current = controller;
    setError(null);
    setRunning(true);
    targets.forEach((i) => setStatus(i, "pending"));

    setAutomaticRetry(false);
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
      activeRun.current = null;
      if (controller.signal.aborted) return;
      targets.forEach((index) => setStatus(index, "error"));
      setRunning(false);
      setError("Uploadul nu a pornit: monitorizarea pentru email nu a putut fi activată. Reîncearcă atunci când revine conexiunea.");
      return;
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
    const originalNames = new Map<number, string>();
    let failed = 0;
    const runPass = async (indices: number[], finalPass: boolean): Promise<number[]> => {
      let cursor = 0;
      const retry: number[] = [];
      const worker = async () => {
        while (cursor < indices.length && !controller.signal.aborted) {
          const index = indices[cursor++];
          setStatus(index, "uploading");
          const result = await uploadOne(sourceRows[index].file, index, controller.signal, originalNames, sessionId);
          if (controller.signal.aborted) return;
          if (result === "done") {
            setStatus(index, "done");
          } else if (!finalPass) {
            setStatus(index, "error");
            retry.push(index);
          } else if (result === "preview-error") {
            // Keep the original; let the VPS repair only the missing preview.
            setStatus(index, "done");
            setFallbackCount((count) => count + 1);
          } else {
            setStatus(index, "error");
            failed++;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, indices.length) }, worker));
      return retry.sort((a, b) => a - b);
    };
    const retry = await runPass(targets, false);
    if (retry.length && !controller.signal.aborted) {
      setAutomaticRetry(true);
      retry.forEach((index) => setStatus(index, "pending"));
      await runPass(retry, true);
    }

    stopHeartbeat();
    controller.signal.removeEventListener("abort", stopHeartbeat);
    if (!controller.signal.aborted) {
      // Even if this request fails offline, the VPS detects the abandoned durable session.
      try { await updateSession("finish"); } catch { /* Server checks after 15 minutes without activity. */ }
    }
    activeRun.current = null;
    if (controller.signal.aborted) return;
    setRunning(false);
    setAutomaticRetry(false);
    if (failed > 0) {
      setError("Unele originale nu s-au încărcat nici la a doua încercare. Sunt păstrate mai jos pentru reîncercare manuală. Serverul trimite o alertă prin email; dacă s-a pierdut conexiunea, după 15 minute fără activitate.");
      return;
    }
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
    const next = picked.map<Row>((file) => ({ file, status: "pending" }));
    setRows(next);
    setFallbackCount(0);
    void runQueue(next, next.map((_, i) => i));
  };

  const retryFailed = () => {
    const failed = rows.map((r, i) => (r.status === "error" ? i : -1)).filter((i) => i >= 0);
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
  const done = rows.filter((r) => r.status === "done").length;
  const failed = rows.filter((r) => r.status === "error").length;
  const pct = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;

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
            Previzualizările WebP sunt generate pe calculatorul tău și încărcate automat.
          </span>
        </p>
      </div>

      {total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>{running ? `${automaticRetry ? "Reîncercare automată" : "Originale + WebP"}… ${done + failed}/${total}` : `✓ ${done} urcate`}</span>
            {failed > 0 && <span className="text-red-400">{failed} eșuate</span>}
          </div>
          <div className="w-full bg-neutral-800 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${running ? "bg-violet-500" : "bg-violet-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {running && <p className="text-xs text-neutral-400">Ține pagina deschisă și calculatorul treaz până termină. WebP: maximum 1.400 px lățime.</p>}
      {fallbackCount > 0 && <p className="text-xs text-amber-400">{fallbackCount} previzualizări vor fi generate pe server după încărcarea tuturor originalelor.</p>}

      {failed > 0 && !running && (
        <div className="space-y-2">
          <ul className="max-h-40 overflow-y-auto text-xs text-red-400" aria-label="Poze neîncărcate">
            {rows.filter((row) => row.status === "error").map((row) => <li key={row.file.name}>{row.file.name}</li>)}
          </ul>
          <button
            onClick={retryFailed}
            className="text-xs text-neutral-300 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg px-3 py-1.5 transition-colors"
          >
            Reîncearcă {failed} eșuate
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple disabled={running} className="hidden" onChange={handleChange} />
    </div>
  );
}
