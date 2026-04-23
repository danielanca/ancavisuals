import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
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

  const localMatch = useCallback((query: string): string[] => {
    const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, " ").trim();
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return allTags.filter((tag) => {
      const normalizedTag = normalize(tag);
      return words.some((w) => normalizedTag.includes(w) || w.includes(normalizedTag));
    });
  }, [allTags]);

  const suggestTags = useCallback(async (query: string) => {
    if (!query.trim()) { setDetectedTags([]); setAiLoading(false); return; }
    setAiLoading(true);
    const start = Date.now();
    const localTags = localMatch(query);
    try {
      const response = await fetch("/api/admin/inspiration/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, availableTags: allTags }),
      });
      const data = await response.json();
      const aiTags: string[] = data.tags ?? [];
      const tags = Array.from(new Set([...localTags, ...aiTags]));
      setDetectedTags(tags);
      setDebugLog({
        query,
        sentTags: allTags,
        receivedTags: tags,
        rawResponse: JSON.stringify(data, null, 2),
        durationMs: Date.now() - start,
      });
    } catch (error) {
      setDetectedTags(localTags);
      setDebugLog({ query, sentTags: allTags, receivedTags: localTags, rawResponse: String(error), durationMs: Date.now() - start });
    } finally {
      setAiLoading(false);
    }
  }, [allTags, localMatch]);

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

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <button
            onClick={() => navigate("/admin")}
            className="text-neutral-500 hover:text-white transition-colors"
          >
            Dashboard
          </button>
          <span className="text-neutral-700">/</span>
          <span className="text-neutral-300">Inspirație Foto</span>
        </nav>

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
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
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
            <div className="flex flex-wrap items-center gap-2 min-h-[24px] mt-3">
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
        </div>

        {/* Tag pills — full width, below search */}
        {!searchQuery.trim() && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-neutral-500 text-xs uppercase tracking-wide font-medium">Tag-uri</p>
              {filterTags.length > 0 && (
                <button onClick={() => setFilterTags([])} className="text-xs text-neutral-500 hover:text-white transition-colors underline underline-offset-2">
                  Resetează
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {allTags.map((tag) => (
                <TagPill key={tag} tag={tag} selected={filterTags.includes(tag)} onClick={() => toggleFilter(tag)} />
              ))}
            </div>
          </div>
        )}

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
          initialPhoto={preview}
          photos={filtered}
          allTags={allTags}
          onClose={() => setPreview(null)}
          onDelete={handleDelete}
          onUpdated={(updated) => {
            setPhotos((previous) => previous.map((photo) => photo.id === updated.id ? updated : photo));
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
  initialPhoto,
  photos,
  allTags,
  onClose,
  onDelete,
  onUpdated,
}: {
  initialPhoto: InspirationPhoto;
  photos: InspirationPhoto[];
  allTags: string[];
  onClose: () => void;
  onDelete: (photo: InspirationPhoto) => void;
  onUpdated: (photo: InspirationPhoto) => void;
}) {
  const startIndex = photos.findIndex((photo) => photo.id === initialPhoto.id);
  const [currentIndex, setCurrentIndex] = useState(startIndex >= 0 ? startIndex : 0);
  const [localPhotos, setLocalPhotos] = useState(photos);
  const currentPhoto = localPhotos[currentIndex] ?? localPhotos[0];

  const [displayedUrl, setDisplayedUrl] = useState(currentPhoto.url);
  const [incomingUrl, setIncomingUrl] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTags, setEditTags] = useState<string[]>(currentPhoto.tags);
  const [editNotes, setEditNotes] = useState(currentPhoto.notes ?? "");
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);
  const touchStartX = useRef<number | null>(null);

  function goToIndex(newIndex: number) {
    if (newIndex === currentIndex || isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex(newIndex);
    setIncomingUrl(localPhotos[newIndex].url);
  }

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    setEditing(false);
    setEditTags(currentPhoto.tags);
    setEditNotes(currentPhoto.notes ?? "");
  }, [currentIndex]);

  useEffect(() => {
    [currentIndex - 1, currentIndex + 1]
      .filter((index) => index >= 0 && index < localPhotos.length)
      .forEach((index) => {
        const image = new Image();
        image.src = localPhotos[index].url;
      });
  }, [currentIndex, localPhotos]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") goToIndex(Math.min(currentIndex + 1, localPhotos.length - 1));
      if (event.key === "ArrowLeft") goToIndex(Math.max(currentIndex - 1, 0));
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, localPhotos.length, onClose, isTransitioning]);

  function handleDeleteCurrent() {
    if (!confirm("Ștergi poza definitiv?")) return;
    const photoToDelete = currentPhoto;
    const remaining = localPhotos.filter((photo) => photo.id !== photoToDelete.id);
    if (remaining.length === 0) {
      onDelete(photoToDelete);
      onClose();
      return;
    }
    const newIndex = Math.min(currentIndex, remaining.length - 1);
    setLocalPhotos(remaining);
    setCurrentIndex(newIndex);
    setDisplayedUrl(remaining[newIndex].url);
    setIncomingUrl(null);
    onDelete(photoToDelete);
  }

  const toggleTag = (tag: string) =>
    setEditTags((previous) =>
      previous.includes(tag) ? previous.filter((existingTag) => existingTag !== tag) : [...previous, tag]
    );

  const addCustomTag = () => {
    const trimmed = customTag.trim().toLowerCase();
    if (trimmed && !editTags.includes(trimmed)) setEditTags((previous) => [...previous, trimmed]);
    setCustomTag("");
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/admin/inspiration/photos/${currentPhoto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: editTags, notes: editNotes }),
    });
    setSaving(false);
    setEditing(false);
    const updated = { ...currentPhoto, tags: editTags, notes: editNotes };
    setLocalPhotos((previous) => previous.map((photo) => photo.id === updated.id ? updated : photo));
    onUpdated(updated);
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null) return;
        const delta = event.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 50) {
          if (delta < 0) goToIndex(Math.min(currentIndex + 1, localPhotos.length - 1));
          else goToIndex(Math.max(currentIndex - 1, 0));
        }
        touchStartX.current = null;
      }}
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
            title="Închide"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {currentIndex > 0 && (
            <button
              onClick={(event) => { event.stopPropagation(); goToIndex(currentIndex - 1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/40 hover:border-emerald-400 hover:text-emerald-300 transition-all shadow-lg shadow-emerald-900/30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {currentIndex < localPhotos.length - 1 && (
            <button
              onClick={(event) => { event.stopPropagation(); goToIndex(currentIndex + 1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/40 hover:border-emerald-400 hover:text-emerald-300 transition-all shadow-lg shadow-emerald-900/30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          <div className="relative">
            <img
              src={displayedUrl}
              alt=""
              className="w-full max-h-[65vh] object-contain rounded-xl block"
            />
            {incomingUrl && (
              <img
                src={incomingUrl}
                alt=""
                className="absolute top-0 left-0 w-full h-full object-contain rounded-xl crossfade-in"
                onAnimationEnd={() => {
                  setDisplayedUrl(incomingUrl);
                  setIncomingUrl(null);
                  setIsTransitioning(false);
                }}
              />
            )}
          </div>
        </div>

        {localPhotos.length > 1 && (
          <p className="text-center text-neutral-600 text-xs mt-2">{currentIndex + 1} / {localPhotos.length}</p>
        )}

        <div className="mt-3 bg-neutral-900/80 backdrop-blur rounded-xl p-3 space-y-3">
          {!editing ? (
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {currentPhoto.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs">
                    {tag}
                  </span>
                ))}
                {currentPhoto.notes && (
                  <p className="text-neutral-400 text-xs mt-1 w-full">{currentPhoto.notes}</p>
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
                  href={currentPhoto.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs hover:bg-neutral-700 transition-colors"
                  onClick={(event) => event.stopPropagation()}
                >
                  Download
                </a>
                <button
                  onClick={handleDeleteCurrent}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-colors"
                >
                  Șterge
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {allTags.map((tag) => (
                  <TagPill key={tag} tag={tag} selected={editTags.includes(tag)} onClick={() => toggleTag(tag)} />
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-1.5 outline-none focus:border-violet-500 transition-colors placeholder-neutral-600"
                  placeholder="Tag nou..."
                  value={customTag}
                  onChange={(event) => setCustomTag(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomTag(); } }}
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
                onChange={(event) => setEditNotes(event.target.value)}
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
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [notes, setNotes] = useState("");
  const [progresses, setProgresses] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiTagLoading, setAiTagLoading] = useState(false);
  const [aiSuggestedTags, setAiSuggestedTags] = useState<string[] | null>(null);

  const pickFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => [...prev, ...newFiles.map((f) => URL.createObjectURL(f))]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleTag = (tag: string) =>
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag("");
  };

  const suggestTagsFromImage = async () => {
    if (files.length === 0) return;
    setAiTagLoading(true);
    try {
      const file = files[0];
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const mediaType = file.type || "image/jpeg";
      const res = await fetch("/api/admin/inspiration/suggest-tags-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType, availableTags: PRESET_TAGS }),
      });
      const data = await res.json();
      if (data.tags?.length > 0) {
        setAiSuggestedTags(data.tags);
        setTags(data.tags);
      }
    } catch {
      // silently fail
    } finally {
      setAiTagLoading(false);
    }
  };

  const uploadFile = (file: File): Promise<void> =>
    new Promise((resolve, reject) => {
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name.replace(/\s+/g, "_")}`;
      const storageRef = ref(storage, `inspiration-library/${safeName}`);
      const task = uploadBytesResumable(storageRef, file);

      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setProgresses((prev) => ({ ...prev, [file.name]: pct }));
        },
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          const res = await fetch("/api/admin/inspiration/photos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, tags, notes }),
          });
          const data = await res.json();
          onAdded({ id: data.id, url, tags, notes, uploadedAt: new Date().toISOString() });
          resolve();
        },
      );
    });

  const handleSave = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setErrors([]);
    const results = await Promise.allSettled(files.map((f) => uploadFile(f)));
    const failed = results
      .map((r, i) => r.status === "rejected" ? files[i].name : null)
      .filter(Boolean) as string[];
    setUploading(false);
    if (failed.length === 0) {
      onClose();
    } else {
      setErrors(failed.map((name) => `Upload eșuat: ${name}`));
    }
  };

  const isUploading = uploading;
  const totalProgress = files.length === 0 ? 0
    : Math.round(Object.values(progresses).reduce((a, b) => a + b, 0) / files.length);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white text-base font-semibold">
            Adaugă {files.length > 1 ? `${files.length} poze` : "poze"}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors text-lg">✕</button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pickFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragging ? "border-violet-500 bg-violet-500/10" : "border-neutral-700 hover:border-neutral-500"
          }`}
        >
          <p className="text-neutral-400 text-sm">Trage poze sau <span className="underline text-neutral-200">selectează</span></p>
          <p className="text-neutral-600 text-xs mt-1">JPG, PNG, WEBP · multiple fișiere acceptate</p>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) pickFiles(Array.from(e.target.files)); }}
          />
        </div>

        {/* Previews grid */}
        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {files.map((file, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden aspect-square group">
                <img src={previews[i]} alt="" className="w-full h-full object-cover" />
                {isUploading ? (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">{progresses[file.name] ?? 0}%</span>
                  </div>
                ) : (
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tag selector */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-neutral-400 text-xs uppercase tracking-wide font-medium">Tag-uri</p>
            {files.length > 0 && (
              <button
                onClick={suggestTagsFromImage}
                disabled={aiTagLoading}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-500/20 text-violet-300 text-xs hover:bg-violet-500/30 disabled:opacity-50 transition-colors"
              >
                {aiTagLoading ? (
                  <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <span>✦</span>
                )}
                {aiTagLoading ? "Analizează..." : "Sugerează cu AI"}
              </button>
            )}
          </div>

          {aiSuggestedTags !== null && (
            <div className="space-y-2 mb-2">
              <p className="text-neutral-600 text-xs">Bifează tag-urile corecte:</p>
              <div className="flex flex-wrap gap-1.5">
                {aiSuggestedTags.map((tag) => (
                  <TagPill key={tag} tag={tag} selected={tags.includes(tag)} onClick={() => toggleTag(tag)} />
                ))}
              </div>
              <button
                onClick={() => { setAiSuggestedTags(null); setTags([]); }}
                className="text-xs text-neutral-600 hover:text-neutral-400 underline underline-offset-2 transition-colors"
              >
                Resetează
              </button>
            </div>
          )}

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

        {/* Overall progress */}
        {isUploading && (
          <div className="space-y-1">
            <p className="text-xs text-neutral-400">Se încarcă... {totalProgress}%</p>
            <div className="w-full bg-neutral-700 rounded-full h-1">
              <div className="bg-violet-500 h-1 rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
            </div>
          </div>
        )}

        {errors.map((err, i) => (
          <p key={i} className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{err}</p>
        ))}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 transition-colors">
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={files.length === 0 || isUploading || tags.length === 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {isUploading ? `Se încarcă... ${totalProgress}%` : `Salvează${files.length > 1 ? ` (${files.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
