import { useCallback, useEffect, useReducer, useRef } from "react";
import Breadcrumb from "./Breadcrumb";
import JSZip from "jszip";

type FileStatus = "pending" | "processing" | "done" | "error";

type FileEntry = {
  id: string;
  name: string;
  originalSize: number;
  estimatedSize?: number;
  webpSize?: number;
  status: FileStatus;
  blob?: Blob;
};

type State = {
  files: FileEntry[];
  processing: boolean;
  done: boolean;
  width: number;
  quality: number;
};

type Action =
  | { type: "ADD_FILES"; files: FileEntry[] }
  | { type: "UPDATE_FILE"; id: string; patch: Partial<FileEntry> }
  | { type: "UPDATE_ESTIMATES"; estimates: Record<string, number> }
  | { type: "SET_PROCESSING"; value: boolean }
  | { type: "SET_DONE"; value: boolean }
  | { type: "SET_WIDTH"; value: number }
  | { type: "SET_QUALITY"; value: number }
  | { type: "RESET" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_FILES":
      return { ...state, files: [...state.files, ...action.files], done: false };
    case "UPDATE_FILE":
      return { ...state, files: state.files.map((f) => f.id === action.id ? { ...f, ...action.patch } : f) };
    case "UPDATE_ESTIMATES":
      return {
        ...state,
        files: state.files.map((f) =>
          action.estimates[f.id] != null && f.status === "pending"
            ? { ...f, estimatedSize: action.estimates[f.id] }
            : f,
        ),
      };
    case "SET_PROCESSING": return { ...state, processing: action.value };
    case "SET_DONE": return { ...state, done: action.value };
    case "SET_WIDTH": return { ...state, width: action.value };
    case "SET_QUALITY": return { ...state, quality: action.value };
    case "RESET": return { files: [], processing: false, done: false, width: 1400, quality: 72 };
    default: return state;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const THUMB_WIDTH = 160;

function buildThumbCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const scale = THUMB_WIDTH / img.width;
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_WIDTH;
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToWebPBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error("toBlob failed")),
      "image/webp",
      quality / 100,
    ),
  );
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load failed")); };
    img.src = url;
  });
}

async function convertToWebP(file: File, maxWidth: number, quality: number): Promise<Blob> {
  const img = await loadImageFromFile(file);
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvasToWebPBlob(canvas, quality);
}

export default function ImageOptimizerPage() {
  const [state, dispatch] = useReducer(reducer, {
    files: [], processing: false, done: false, width: 1400, quality: 72,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const thumbMap = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const fileMap = useRef<Map<string, File>>(new Map());
  const estimateTimer = useRef<number | null>(null);

  // Recompute estimates for all pending files at given quality
  const reestimate = useCallback(async (quality: number) => {
    const entries = [...thumbMap.current.entries()];
    if (!entries.length) return;
    const estimates: Record<string, number> = {};
    await Promise.all(
      entries.map(async ([id, canvas]) => {
        try {
          const blob = await canvasToWebPBlob(canvas, quality);
          // Find original size from state files
          const f = state.files.find((f) => f.id === id);
          if (!f) return;
          // Ratio from thumbnail: thumbWebpSize / (thumb w*h*3 bytes approx)
          // Better: use original image size and the thumb compression ratio
          const thumbRaw = canvas.width * canvas.height * 3;
          const ratio = blob.size / thumbRaw;
          // Estimated full webp = original * ratio * adjustment factor (WebP scales sub-linearly)
          estimates[id] = Math.round(f.originalSize * ratio * 0.55);
        } catch {}
      }),
    );
    dispatch({ type: "UPDATE_ESTIMATES", estimates });
  }, [state.files]);

  // Debounce reestimate when quality changes
  useEffect(() => {
    if (!thumbMap.current.size) return;
    if (estimateTimer.current) window.clearTimeout(estimateTimer.current);
    estimateTimer.current = window.setTimeout(() => reestimate(state.quality), 300);
    return () => { if (estimateTimer.current) window.clearTimeout(estimateTimer.current); };
  }, [state.quality, reestimate]);

  const addFiles = useCallback(async (rawFiles: FileList | File[]) => {
    const accepted = Array.from(rawFiles).filter((f) => /\.(jpe?g|png)$/i.test(f.name));
    const existing = new Set(state.files.map((f) => f.name));
    const fresh = accepted.filter((f) => !existing.has(f.name));
    if (!fresh.length) return;

    const newEntries: FileEntry[] = fresh.map((f) => ({
      id: `${f.name}-${f.size}`,
      name: f.name,
      originalSize: f.size,
      status: "pending",
    }));
    dispatch({ type: "ADD_FILES", files: newEntries });

    // Build thumbnails and estimate immediately
    const estimates: Record<string, number> = {};
    await Promise.all(
      fresh.map(async (f, i) => {
        const id = newEntries[i].id;
        fileMap.current.set(id, f);
        try {
          const img = await loadImageFromFile(f);
          const canvas = buildThumbCanvas(img);
          thumbMap.current.set(id, canvas);
          const blob = await canvasToWebPBlob(canvas, state.quality);
          const thumbRaw = canvas.width * canvas.height * 3;
          const ratio = blob.size / thumbRaw;
          estimates[id] = Math.round(f.size * ratio * 0.55);
        } catch {}
      }),
    );
    dispatch({ type: "UPDATE_ESTIMATES", estimates });
  }, [state.files, state.quality]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const processAll = async () => {
    if (state.processing) return;
    dispatch({ type: "SET_PROCESSING", value: true });
    dispatch({ type: "SET_DONE", value: false });

    const pending = state.files.filter((f) => f.status === "pending");

    for (const entry of pending) {
      dispatch({ type: "UPDATE_FILE", id: entry.id, patch: { status: "processing" } });
      try {
        const rawFile = fileMap.current.get(entry.id);
        if (!rawFile) throw new Error("File not found");
        const blob = await convertToWebP(rawFile, state.width, state.quality);
        const baseName = entry.name.replace(/\.[^.]+$/, "");
        dispatch({
          type: "UPDATE_FILE",
          id: entry.id,
          patch: { status: "done", webpSize: blob.size, blob, name: `${baseName}.webp` },
        });
      } catch {
        dispatch({ type: "UPDATE_FILE", id: entry.id, patch: { status: "error" } });
      }
    }

    dispatch({ type: "SET_PROCESSING", value: false });
    dispatch({ type: "SET_DONE", value: true });
  };

  const downloadZip = async () => {
    const done = state.files.filter((f) => f.status === "done" && f.blob);
    if (!done.length) return;
    const zip = new JSZip();
    done.forEach((f) => zip.file(f.name, f.blob!));
    const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 1 } });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zipBlob);
    a.download = "photos_preview.zip";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadSingle = (entry: FileEntry) => {
    if (!entry.blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(entry.blob);
    a.download = entry.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doneCount = state.files.filter((f) => f.status === "done").length;
  const totalCount = state.files.length;
  const savedBytes = state.files
    .filter((f) => f.status === "done" && f.webpSize)
    .reduce((sum, f) => sum + (f.originalSize - (f.webpSize ?? 0)), 0);

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumb />

        <div>
          <h1 className="text-xl font-semibold text-white">Optimizare poze — photos_preview</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Drag & drop pozele originale. Browserul le convertește în WebP local, fără server.
            Descarcă ZIP-ul și uploadează-l în Bunny la{" "}
            <span className="font-mono text-neutral-300">{"{slug}"}/photos_preview/</span>
          </p>
        </div>

        {/* Settings */}
        <div className="flex flex-wrap gap-6 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-neutral-400 uppercase tracking-wide w-24">Lățime max</label>
            <input
              type="number"
              value={state.width}
              onChange={(e) => dispatch({ type: "SET_WIDTH", value: Number(e.target.value) })}
              className="w-24 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-neutral-500"
              min={400} max={3000} step={100}
            />
            <span className="text-neutral-500 text-xs">px</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-neutral-400 uppercase tracking-wide w-24">Calitate</label>
            <input
              type="range"
              value={state.quality}
              onChange={(e) => dispatch({ type: "SET_QUALITY", value: Number(e.target.value) })}
              min={40} max={95} step={1}
              className="w-32 accent-violet-500"
            />
            <span className="text-white text-sm font-mono w-8">{state.quality}</span>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-neutral-700 hover:border-violet-500 rounded-xl p-12 text-center cursor-pointer transition-colors"
        >
          <p className="text-neutral-400 text-sm">
            Trage pozele aici sau <span className="text-violet-400 underline">selectează fișierele</span>
          </p>
          <p className="text-neutral-600 text-xs mt-1">JPG, JPEG, PNG — oricâte</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* Actions */}
        {totalCount > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={processAll}
              disabled={state.processing || doneCount === totalCount}
              className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              {state.processing
                ? `Procesează... ${doneCount}/${totalCount}`
                : `Convertește ${totalCount} poze în WebP`}
            </button>
            {doneCount > 0 && (
              <button
                onClick={downloadZip}
                className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
              >
                Descarcă ZIP ({doneCount} poze)
              </button>
            )}
            <button
              onClick={() => { thumbMap.current.clear(); fileMap.current.clear(); dispatch({ type: "RESET" }); }}
              className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white text-sm transition-colors"
            >
              Resetează
            </button>
          </div>
        )}

        {/* Summary */}
        {doneCount > 0 && (
          <div className="flex gap-6 text-sm">
            <span className="text-emerald-400">✓ {doneCount} convertite</span>
            {savedBytes > 0 && (
              <span className="text-neutral-400">
                Economisit: <span className="text-white font-medium">{formatBytes(savedBytes)}</span>
              </span>
            )}
          </div>
        )}

        {/* File list */}
        {totalCount > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_100px_80px_32px] text-xs text-neutral-500 uppercase tracking-wide px-4 py-2 border-b border-neutral-800">
              <span>Fișier</span>
              <span className="text-right">Original</span>
              <span className="text-right">WebP</span>
              <span className="text-right">Reducere</span>
              <span />
            </div>
            <div className="max-h-[480px] overflow-y-auto divide-y divide-neutral-800">
              {state.files.map((f) => {
                const displaySize = f.status === "done" ? f.webpSize : f.estimatedSize;
                const isEstimate = f.status !== "done" && f.estimatedSize != null;
                const saving = displaySize != null
                  ? Math.round((1 - displaySize / f.originalSize) * 100)
                  : null;

                return (
                  <div key={f.id} className="grid grid-cols-[1fr_80px_100px_80px_32px] items-center px-4 py-2.5">
                    <span className="truncate font-mono text-xs text-neutral-300 pr-4">{f.name}</span>

                    <span className="text-neutral-500 text-xs text-right">{formatBytes(f.originalSize)}</span>

                    <span className={`text-xs text-right ${isEstimate ? "text-neutral-400" : "text-white"}`}>
                      {displaySize != null ? (
                        <>
                          {isEstimate && <span className="text-neutral-600 mr-0.5">~</span>}
                          {formatBytes(displaySize)}
                        </>
                      ) : "—"}
                    </span>

                    <span className={`text-xs text-right ${saving != null ? isEstimate ? "text-amber-400/70" : "text-emerald-400" : "text-neutral-600"}`}>
                      {saving != null ? (
                        <>{isEstimate && "~"}-{saving}%</>
                      ) : "—"}
                    </span>

                    <span className="flex items-center justify-end">
                      {f.status === "processing" && (
                        <svg className="animate-spin text-violet-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                      )}
                      {f.status === "done" && (
                        <button onClick={() => downloadSingle(f)} className="text-emerald-400 hover:text-emerald-300 text-xs transition-colors">↓</button>
                      )}
                      {f.status === "error" && <span className="text-red-400 text-xs">!</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
