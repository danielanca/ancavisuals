import React, { useEffect, useRef, useState, useCallback } from "react";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../../firebase";
import AncaLoader from "../../../components/UI/AncaLoader";

interface InspirationPhoto {
  id: string;
  url: string;
  tags: string[];
  notes?: string;
  uploadedAt: string;
}


const PRESET_TAGS = [
  "biserică", "cununia civilă", "recepție",
  "mire", "mireasă", "mire+mireasă",
  "grup", "copii", "portret",
  "detalii", "buchet", "verighete",
  "natură", "interior", "exterior",
  "decor", "lumini", "seară",
];

function TagPill({
  tag,
  selected,
  onClick,
}: {
  tag: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
        selected
          ? "bg-violet-500 text-white"
          : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
      }`}
    >
      {tag}
    </button>
  );
}

export default function InspirationPage() {
  const [photos, setPhotos] = useState<InspirationPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [detectedTags, setDetectedTags] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [debugLog, setDebugLog] = useState<{ query: string; sentTags: string[]; receivedTags: string[]; rawResponse: string; durationMs: number } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [preview, setPreview] = useState<InspirationPhoto | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/admin/inspiration/photos")
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos ?? []))
      .finally(() => setLoading(false));
  }, []);

  const allTags = Array.from(
    new Set([...PRESET_TAGS, ...photos.flatMap((p) => p.tags)]),
  );

  const suggestTags = useCallback(async (query: string) => {
    if (!query.trim()) { setDetectedTags([]); setAiLoading(false); return; }
    setAiLoading(true);
    const start = Date.now();
    try {
      const response = await fetch("/api/admin/inspiration/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, availableTags: allTags }),
      });
      const data = await response.json();
      const tags = data.tags ?? [];
      setDetectedTags(tags);
      setDebugLog({
        query,
        sentTags: allTags,
        receivedTags: tags,
        rawResponse: JSON.stringify(data, null, 2),
        durationMs: Date.now() - start,
      });
    } catch (error) {
      setDetectedTags([]);
      setDebugLog({ query, sentTags: allTags, receivedTags: [], rawResponse: String(error), durationMs: Date.now() - start });
    } finally {
      setAiLoading(false);
    }
  }, [allTags]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setFilterTags([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setDetectedTags([]); setAiLoading(false); return; }
    setAiLoading(true);
    debounceRef.current = setTimeout(() => suggestTags(value), 600);
  };

  const activeTags = searchQuery.trim() ? detectedTags : filterTags;

  const toggleFilter = (tag: string) =>
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((tag2) => tag2 !== tag) : [...prev, tag],
    );

  const filtered =
    activeTags.length === 0
      ? photos
      : photos.filter((photo) => activeTags.some((tag) => photo.tags.includes(tag)));

  const handleDelete = async (photo: InspirationPhoto) => {
    try {
      await deleteObject(ref(storage, photo.url));
    } catch {
      // file may not exist in storage
    }
    await fetch(`/api/admin/inspiration/photos/${photo.id}`, { method: "DELETE" });
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    if (preview?.id === photo.id) setPreview(null);
  };

  const handleAdded = (photo: InspirationPhoto) =>
    setPhotos((prev) => [photo, ...prev]);

  if (loading) return <AncaLoader />;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Inspirație Foto</h1>
            <p className="text-neutral-500 text-sm mt-1">{photos.length} poze · {filtered.length} afișate</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Adaugă poză
          </button>
        </div>

        {/* Search */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg pl-9 pr-10 py-2.5 outline-none focus:border-violet-500 transition-colors placeholder-neutral-500"
              placeholder="Descrie ce cauți... ex: nuntă mire mireasă, biserică seară"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {searchQuery && !aiLoading && (
              <button
                onClick={() => { setSearchQuery(""); setDetectedTags([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
            {aiLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Detected tags from search */}
          {searchQuery.trim() && (
            <div className="flex flex-wrap items-center gap-2 min-h-[24px]">
              <span className="text-neutral-500 text-xs">Tag-uri detectate:</span>
              {aiLoading ? (
                <span className="text-neutral-600 text-xs italic">Claude analizează...</span>
              ) : detectedTags.length > 0 ? detectedTags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs font-medium">
                  {tag}
                </span>
              )) : (
                <span className="text-neutral-600 text-xs italic">niciun tag recunoscut</span>
              )}
            </div>
          )}

          {/* Manual tag pills — shown only when no search query */}
          {!searchQuery.trim() && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-neutral-500 text-xs uppercase tracking-wide font-medium">sau alege tag-uri</p>
                {filterTags.length > 0 && (
                  <button onClick={() => setFilterTags([])} className="text-xs text-neutral-500 hover:text-white transition-colors underline underline-offset-2">
                    Resetează
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <TagPill key={tag} tag={tag} selected={filterTags.includes(tag)} onClick={() => toggleFilter(tag)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Debug panel */}
        {debugLog && (
          <div className="bg-neutral-950 border border-yellow-500/30 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowDebug((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-yellow-400/80 text-xs font-mono hover:bg-yellow-500/5 transition-colors"
            >
              <span>🐛 Debug AI — query: "{debugLog.query}" · {debugLog.durationMs}ms · {debugLog.receivedTags.length} tag-uri găsite</span>
              <span>{showDebug ? "▲ ascunde" : "▼ arată"}</span>
            </button>
            {showDebug && (
              <div className="px-4 pb-4 space-y-3 font-mono text-xs">
                <div>
                  <p className="text-neutral-500 uppercase tracking-wide mb-1">Query trimis</p>
                  <p className="text-white bg-neutral-900 rounded-lg px-3 py-2">"{debugLog.query}"</p>
                </div>
                <div>
                  <p className="text-neutral-500 uppercase tracking-wide mb-1">Tag-uri disponibile trimise ({debugLog.sentTags.length})</p>
                  <p className="text-neutral-300 bg-neutral-900 rounded-lg px-3 py-2 leading-relaxed">{debugLog.sentTags.join(", ")}</p>
                </div>
                <div>
                  <p className="text-neutral-500 uppercase tracking-wide mb-1">Răspuns Claude</p>
                  <pre className="text-emerald-400 bg-neutral-900 rounded-lg px-3 py-2 whitespace-pre-wrap overflow-auto max-h-40">{debugLog.rawResponse}</pre>
                </div>
                <div>
                  <p className="text-neutral-500 uppercase tracking-wide mb-1">Tag-uri validate finale</p>
                  <div className="flex flex-wrap gap-1.5">
                    {debugLog.receivedTags.length > 0 ? debugLog.receivedTags.map((tag) => (
                      <span key={tag} className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-300">{tag}</span>
                    )) : <span className="text-neutral-600 italic">niciunul</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Masonry grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-500 text-sm">
              {filterTags.length > 0 ? "Nicio poză cu aceste tag-uri." : "Biblioteca e goală. Adaugă prima poză!"}
            </p>
          </div>
        ) : (
          <div style={{ columns: "2 160px", columnGap: "10px" }}>
            {filtered.map((photo) => (
              <div
                key={photo.id}
                className="group relative rounded-xl overflow-hidden border border-neutral-800 hover:border-violet-500/50 transition-colors cursor-pointer mb-2.5 break-inside-avoid"
                onClick={() => setPreview(photo)}
              >
                <img
                  src={photo.url}
                  alt=""
                  className="w-full h-auto block"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                    {photo.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 rounded-full bg-black/60 text-white text-xs">
                        {tag}
                      </span>
                    ))}
                    {photo.tags.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-black/60 text-neutral-300 text-xs">
                        +{photo.tags.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen preview */}
      {preview && (
        <PreviewModal
          photo={preview}
          allTags={allTags}
          onClose={() => setPreview(null)}
          onDelete={handleDelete}
          onUpdated={(updated) => {
            setPhotos((prev) => prev.map((p) => p.id === updated.id ? updated : p));
            setPreview(updated);
          }}
        />
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onAdded={(photo) => { handleAdded(photo); setShowUpload(false); }}
        />
      )}
    </div>
  );
}

function PreviewModal({
  photo,
  allTags,
  onClose,
  onDelete,
  onUpdated,
}: {
  photo: InspirationPhoto;
  allTags: string[];
  onClose: () => void;
  onDelete: (photo: InspirationPhoto) => void;
  onUpdated: (photo: InspirationPhoto) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTags, setEditTags] = useState<string[]>(photo.tags);
  const [editNotes, setEditNotes] = useState(photo.notes ?? "");
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: string) =>
    setEditTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (t && !editTags.includes(t)) setEditTags((prev) => [...prev, t]);
    setCustomTag("");
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/admin/inspiration/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: editTags, notes: editNotes }),
    });
    setSaving(false);
    setEditing(false);
    onUpdated({ ...photo, tags: editTags, notes: editNotes });
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={photo.url} alt="" className="w-full max-h-[65vh] object-contain rounded-xl" />

        <div className="mt-3 bg-neutral-900/80 backdrop-blur rounded-xl p-3 space-y-3">
          {!editing ? (
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {photo.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs">
                    {tag}
                  </span>
                ))}
                {photo.notes && (
                  <p className="text-neutral-400 text-xs mt-1 w-full">{photo.notes}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 text-xs hover:bg-violet-500/30 transition-colors"
                >
                  Editează
                </button>
                <a
                  href={photo.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs hover:bg-neutral-700 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  Download
                </a>
                <button
                  onClick={() => { if (confirm("Ștergi poza definitiv?")) onDelete(photo); }}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-colors"
                >
                  Șterge
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs hover:bg-neutral-700 transition-colors"
                >
                  Închide
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <TagPill key={tag} tag={tag} selected={editTags.includes(tag)} onClick={() => toggleTag(tag)} />
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-1.5 outline-none focus:border-violet-500 transition-colors placeholder-neutral-600"
                  placeholder="Tag nou..."
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                />
                <button
                  onClick={addCustomTag}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs hover:bg-neutral-700 transition-colors"
                >
                  Adaugă
                </button>
              </div>
              <textarea
                className="w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 transition-colors resize-none placeholder-neutral-600"
                rows={2}
                placeholder="Notă..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 px-3 py-2 rounded-lg border border-neutral-700 text-neutral-300 text-xs hover:border-neutral-500 transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors"
                >
                  {saving ? "Se salvează..." : "Salvează"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (photo: InspirationPhoto) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const pickFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const toggleTag = (tag: string) =>
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag("");
  };

  const handleSave = async () => {
    if (!file) return;
    setError(null);
    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const storageRef = ref(storage, `inspiration-library/${safeName}`);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { setError(`Upload eșuat: ${err.message}`); setProgress(null); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const res = await fetch("/api/admin/inspiration/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, tags, notes }),
        });
        const data = await res.json();
        onAdded({ id: data.id, url, tags, notes, uploadedAt: new Date().toISOString() });
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white text-base font-semibold">Adaugă poză</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors text-lg">✕</button>
        </div>

        {/* Drop zone / preview */}
        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragging ? "border-violet-500 bg-violet-500/10" : "border-neutral-700 hover:border-neutral-500"
            }`}
          >
            <p className="text-neutral-400 text-sm">Trage o poză sau <span className="underline text-neutral-200">selectează</span></p>
            <p className="text-neutral-600 text-xs mt-1">JPG, PNG</p>
            <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden">
            <img src={preview!} alt="" className="w-full h-48 object-cover" />
            <button
              onClick={() => { setFile(null); setPreview(null); setProgress(null); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-sm flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tag selector */}
        <div>
          <p className="text-neutral-400 text-xs uppercase tracking-wide font-medium mb-2">Tag-uri</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESET_TAGS.map((tag) => (
              <TagPill key={tag} tag={tag} selected={tags.includes(tag)} onClick={() => toggleTag(tag)} />
            ))}
          </div>
          {tags.filter((t) => !PRESET_TAGS.includes(t)).map((tag) => (
            <TagPill key={tag} tag={tag} selected onClick={() => toggleTag(tag)} />
          ))}
          <div className="flex gap-2 mt-2">
            <input
              className="flex-1 bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-1.5 outline-none focus:border-violet-500 transition-colors placeholder-neutral-600"
              placeholder="Tag personalizat..."
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
            />
            <button
              onClick={addCustomTag}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs hover:bg-neutral-700 transition-colors"
            >
              Adaugă
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="text-neutral-400 text-xs uppercase tracking-wide font-medium mb-1">Notă (opțional)</p>
          <textarea
            className="w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 transition-colors resize-none placeholder-neutral-600"
            rows={2}
            placeholder="ex: unghi special, lumină naturală..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Progress */}
        {progress !== null && (
          <div className="space-y-1">
            <p className="text-xs text-neutral-400">Se încarcă... {progress}%</p>
            <div className="w-full bg-neutral-700 rounded-full h-1">
              <div className="bg-violet-500 h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 transition-colors">
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={!file || progress !== null || tags.length === 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {progress !== null ? "Se încarcă..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}
