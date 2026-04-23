import React, { useRef, useState } from "react";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../../firebase";

interface FileDropZoneProps {
  label: string;
  storagePath: string;
  currentUrl?: string;
  onUploaded: (url: string) => void;
  onDeleted?: () => void;
}

export default function FileDropZone({ label, storagePath, currentUrl, onUploaded, onDeleted }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = (file: File) => {
    setError(null);
    const ext = file.name.split(".").pop() ?? "pdf";
    const storageRef = ref(storage, `${storagePath}.${ext}`);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { setError(`Upload eșuat: ${err.message}`); setProgress(null); console.error("[FileDropZone]", err); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setProgress(null);
        onUploaded(url);
      },
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  return (
    <div>
      <p className="text-neutral-400 text-xs font-medium uppercase tracking-wide mb-1.5">{label}</p>

      {currentUrl ? (
        <div className="flex items-center justify-between bg-neutral-800 border border-emerald-500/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-emerald-400 text-sm">✓</span>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:text-emerald-300 truncate transition-colors"
            >
              Vezi fișierul
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Înlocuiește
            </button>
            {onDeleted && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteObject(ref(storage, currentUrl));
                  } catch {
                    // file may no longer exist in Storage — continue anyway
                  }
                  onDeleted();
                }}
                className="text-xs text-red-500 hover:text-red-400 transition-colors"
                title="Șterge fișierul"
              >
                Șterge
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={[
            "border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors",
            dragging
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-neutral-700 hover:border-neutral-500",
          ].join(" ")}
        >
          {progress !== null ? (
            <div className="space-y-1.5">
              <p className="text-xs text-neutral-400">Se încarcă... {progress}%</p>
              <div className="w-full bg-neutral-700 rounded-full h-1">
                <div className="bg-emerald-500 h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">
              Trage fișierul aici sau <span className="text-neutral-300 underline">selectează</span>
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-red-400 text-xs">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
