import React, { useRef, useState } from "react";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../../firebase";

interface MultiFileDropZoneProps {
  label: string;
  storagePath: string;          // prefix — files are saved as {storagePath}/{filename}
  urls: string[];
  onUrlsChange: (urls: string[]) => void;
  accept?: string;
}

function fileName(url: string): string {
  try {
    const decoded = decodeURIComponent(url.split("?")[0]);
    return decoded.split("/").pop() ?? "fișier";
  } catch {
    return "fișier";
  }
}

function isImage(url: string): boolean {
  const lower = url.split("?")[0].toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp)$/.test(lower);
}

export default function MultiFileDropZone({
  label,
  storagePath,
  urls,
  onUrlsChange,
  accept = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp",
}: MultiFileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = (file: File) => {
    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const storageRef = ref(storage, `${storagePath}/${safeName}`);
    const task = uploadBytesResumable(storageRef, file);

    setUploading((prev) => [...prev, { name: file.name, progress: 0 }]);

    task.on(
      "state_changed",
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setUploading((prev) => prev.map((u) => u.name === file.name ? { ...u, progress: pct } : u));
      },
      (err) => {
        setError(`Upload eșuat: ${err.message}`);
        setUploading((prev) => prev.filter((u) => u.name !== file.name));
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setUploading((prev) => prev.filter((u) => u.name !== file.name));
        onUrlsChange([...urls, url]);
      },
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files).forEach(uploadFile);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(uploadFile);
    e.target.value = "";
  };

  const handleDelete = async (url: string) => {
    try { await deleteObject(ref(storage, url)); } catch { /* may no longer exist */ }
    onUrlsChange(urls.filter((u) => u !== url));
  };

  return (
    <div>
      <p className="text-neutral-400 text-xs font-medium uppercase tracking-wide mb-1.5">{label}</p>

      {/* Existing files */}
      {urls.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {urls.map((url) => (
            <div key={url} className="flex items-center justify-between bg-neutral-800 border border-emerald-500/20 rounded-lg px-3 py-2 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {isImage(url) ? (
                  <img src={url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <span className="text-emerald-400 text-sm shrink-0">📄</span>
                )}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:text-emerald-300 truncate transition-colors"
                >
                  {fileName(url)}
                </a>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(url)}
                className="text-xs text-red-500 hover:text-red-400 transition-colors shrink-0"
              >
                Șterge
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Uploading progress */}
      {uploading.map((u) => (
        <div key={u.name} className="mb-2 space-y-1">
          <p className="text-xs text-neutral-400">{u.name} — {u.progress}%</p>
          <div className="w-full bg-neutral-700 rounded-full h-1">
            <div className="bg-emerald-500 h-1 rounded-full transition-all" style={{ width: `${u.progress}%` }} />
          </div>
        </div>
      ))}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          "border-2 border-dashed rounded-lg px-4 py-4 text-center cursor-pointer transition-colors",
          dragging ? "border-emerald-500 bg-emerald-500/10" : "border-neutral-700 hover:border-neutral-500",
        ].join(" ")}
      >
        <p className="text-xs text-neutral-500">
          Trage fișiere aici sau <span className="text-neutral-300 underline">selectează</span>
          <span className="block mt-0.5 text-neutral-600">PDF, imagini — multiple fișiere acceptate</span>
        </p>
      </div>

      {error && <p className="mt-1 text-red-400 text-xs">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
