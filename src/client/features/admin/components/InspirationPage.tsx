import React, { useEffect, useRef, useState, useCallback } from "react";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import { useNavigate } from "react-router-dom";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../../firebase";
import AncaLoader from "../../../components/UI/AncaLoader";
import useAuth from "../auth/useAuth";

interface InspirationPhoto {
  id: string;
  url: string;
  tags: string[];
  notes?: string;
  uploadedAt: string;
}

interface InspirationProposal {
  id: string;
  url: string;
  tags: string[];
  notes: string;
  proposedByEmail: string;
  proposedAt: string;
}


const PRESET_TAGS = [
  // Tip eveniment
  "nuntă", "botez", "cununia civilă", "logodnă", "cununie",

  // Locație
  "biserică", "altar", "restaurant", "sală", "curte", "grădină", "parc",
  "exterior", "interior", "natură", "terrasă", "mansardă", "plajă",

  // Subiecți nuntă
  "mire", "mireasă", "mire+mireasă", "nași", "nașă", "nas",
  "socri", "părinți", "bunici", "tineri-căsătoriți",

  // Subiecți botez
  "bebeluș", "nași-botez", "cristelniță",

  // Subiecți generali
  "grup", "copii", "portret", "familie", "invitați",

  // Momente nuntă
  "ceremonie", "primul-dans", "vals", "hora", "primul-sărut",
  "schimb-inele", "tort", "buchet-aruncat", "discurs", "felicitări",
  "intrare", "ieșire", "petrecere", "jocul-mirilor",
  "fum-artificial", "confetti", "foc-artificii", "aplauze",

  // Momente botez
  "lumânare", "botezul-propriu-zis", "masa-botez",

  // Sesiune foto
  "sesiune-foto", "after-session",

  // Detalii
  "detalii", "buchet", "verighete", "rochie", "voal", "costum",
  "pantofi", "aranjament-floral", "invitație", "tort-nuntă", "tort-botez",
  "lumânare-nuntă", "coronită", "candy-bar", "decorațiuni", "flori", "baloane",

  // Expresii & emoție
  "emoție", "lacrimi", "zâmbet", "râs", "romantic", "vesel", "intim",

  // Lumină
  "golden-hour", "lumină-naturală", "lumina-ferestrei", "backlight",
  "seară", "lumini", "dramatic", "moody",

  // Stil fotografic
  "candid", "editorial", "fine-art", "alb-negru", "silhouetă",
  "close-up", "wide-angle", "reflecție",

  // Misc
  "decor", "machiaj", "dans",
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

type AdminTab = "gallery" | "proposals";

export default function InspirationPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [adminTab, setAdminTab] = useState<AdminTab>("gallery");
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
  const [proposals, setProposals] = useState<InspirationProposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [proposalsFetched, setProposalsFetched] = useState(false);
  useBodyScrollLock(preview !== null || showUpload);
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

  const loadProposals = useCallback(() => {
    if (!auth.accessToken) return;
    setProposalsLoading(true);
    fetch("/api/inspiration-proposals/admin/pending", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((response) => response.json())
      .then((data: { proposals?: InspirationProposal[] }) => {
        setProposals(data.proposals ?? []);
        setProposalsFetched(true);
      })
      .finally(() => setProposalsLoading(false));
  }, [auth.accessToken]);

  useEffect(() => {
    if (adminTab === "proposals" && !proposalsFetched) {
      loadProposals();
    }
  }, [adminTab, proposalsFetched, loadProposals]);

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
          {adminTab === "gallery" && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Adaugă poză
            </button>
          )}
        </div>

        {/* Admin tabs */}
        <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
          <button
            onClick={() => setAdminTab("gallery")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              adminTab === "gallery" ? "bg-violet-600 text-white" : "text-neutral-400 hover:text-white"
            }`}
          >
            Galerie
          </button>
          <button
            onClick={() => setAdminTab("proposals")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              adminTab === "proposals" ? "bg-violet-600 text-white" : "text-neutral-400 hover:text-white"
            }`}
          >
            Propuneri
            {proposals.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-400 text-xs font-semibold">
                {proposals.length}
              </span>
            )}
          </button>
        </div>

        {adminTab === "proposals" && (
          <ProposalsPanel
            proposals={proposals}
            loading={proposalsLoading}
            token={auth.accessToken}
            onReviewed={(reviewedId) => {
              setProposals((previous) => previous.filter((proposal) => proposal.id !== reviewedId));
            }}
          />
        )}

        {adminTab === "gallery" && <>

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

        </>}
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
          onAdded={handleAdded}
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
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full h-[90dvh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex-1 min-h-0"
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
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-emerald-800/60 border border-emerald-700/60 text-emerald-300 flex items-center justify-center hover:bg-emerald-700/80 hover:text-emerald-200 transition-colors"
            title="Închide"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {currentIndex > 0 && (
            <button
              onClick={(event) => { event.stopPropagation(); goToIndex(currentIndex - 1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-emerald-800/60 border border-emerald-700/60 text-emerald-300 flex items-center justify-center hover:bg-emerald-700/80 hover:border-emerald-600 hover:text-emerald-200 transition-all shadow-lg shadow-emerald-900/20"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {currentIndex < localPhotos.length - 1 && (
            <button
              onClick={(event) => { event.stopPropagation(); goToIndex(currentIndex + 1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-emerald-800/60 border border-emerald-700/60 text-emerald-300 flex items-center justify-center hover:bg-emerald-700/80 hover:border-emerald-600 hover:text-emerald-200 transition-all shadow-lg shadow-emerald-900/20"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          <div className="relative h-full">
            <img
              src={displayedUrl}
              alt=""
              className="w-full h-full object-contain rounded-xl block"
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
          <p className="text-center text-neutral-600 text-xs mt-1 flex-shrink-0">{currentIndex + 1} / {localPhotos.length}</p>
        )}

        <div className="mt-2 bg-neutral-900/80 backdrop-blur rounded-xl p-3 space-y-3 flex-shrink-0 overflow-y-auto max-h-[40vh]">
          {!editing ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {currentPhoto.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs whitespace-nowrap shrink-0">
                      {tag}
                    </span>
                  ))}
                </div>
                {currentPhoto.notes && (
                  <p className="text-neutral-400 text-xs mt-1">{currentPhoto.notes}</p>
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

function ProposalsPanel({
  proposals,
  loading,
  token,
  onReviewed,
}: {
  proposals: InspirationProposal[];
  loading: boolean;
  token: string;
  onReviewed: (id: string) => void;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const review = async (id: string, action: "approve" | "reject", reason?: string) => {
    setProcessingId(id);
    try {
      await fetch(`/api/inspiration-proposals/admin/review/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, rejectionReason: reason ?? "" }),
      });
      onReviewed(id);
    } finally {
      setProcessingId(null);
      setRejectingId(null);
      setRejectReason("");
    }
  };

  if (loading) {
    return <p className="text-neutral-600 text-sm text-center py-10">Se încarcă propunerile...</p>;
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-neutral-500 text-sm">Nicio propunere în așteptare.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-neutral-500 text-sm">{proposals.length} propuneri în așteptare</p>
      {proposals.map((proposal) => (
        <div key={proposal.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="flex gap-4 p-4">
            <img
              src={proposal.url}
              alt=""
              className="w-28 h-28 rounded-lg object-cover shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-white text-sm font-medium truncate">{proposal.proposedByEmail}</p>
                <p className="text-neutral-500 text-xs">
                  {new Date(proposal.proposedAt).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              {proposal.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {proposal.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs">
                      {tag}
                    </span>
                  ))}
                  {proposal.tags.length > 5 && (
                    <span className="text-neutral-500 text-xs">+{proposal.tags.length - 5}</span>
                  )}
                </div>
              )}
              {proposal.notes && (
                <p className="text-neutral-400 text-xs italic">"{proposal.notes}"</p>
              )}
            </div>
          </div>

          {rejectingId === proposal.id ? (
            <div className="px-4 pb-4 space-y-2 border-t border-neutral-800 pt-3">
              <p className="text-neutral-400 text-xs">Motiv respingere (opțional):</p>
              <textarea
                className="w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-red-500 transition-colors resize-none placeholder-neutral-600"
                rows={2}
                placeholder="ex: calitate slabă, nu se potrivește stilului..."
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setRejectingId(null); setRejectReason(""); }}
                  className="flex-1 px-3 py-2 rounded-lg border border-neutral-700 text-neutral-400 text-xs hover:border-neutral-500 transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={() => review(proposal.id, "reject", rejectReason)}
                  disabled={processingId === proposal.id}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 disabled:opacity-40 transition-colors"
                >
                  {processingId === proposal.id ? "Se procesează..." : "Confirmă respingerea"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 px-4 pb-4 border-t border-neutral-800 pt-3">
              <button
                onClick={() => review(proposal.id, "approve")}
                disabled={processingId === proposal.id}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"
              >
                {processingId === proposal.id ? "..." : "✓ Acceptă"}
              </button>
              <button
                onClick={() => setRejectingId(proposal.id)}
                disabled={processingId === proposal.id}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 disabled:opacity-40 transition-colors"
              >
                ✕ Respinge
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface PhotoEntry {
  file: File;
  preview: string;
  tags: string[];
  notes: string;
  aiLoading: boolean;
  aiDone: boolean;
  progress: number | null;
}

const ANCA_LOADER_STYLES = `
  @keyframes ancaGlow { 0%,100%{opacity:.15} 50%{opacity:1} }
  @keyframes ancaDot  { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1.2)} }
  .ul-wrap  { animation: ancaGlow 2.4s ease-in-out infinite; }
  .ul-dots  { display:flex; justify-content:center; gap:8px; margin-top:20px; }
  .ul-dots span { width:6px; height:6px; border-radius:50%; background:#fff; animation:ancaDot 1.4s ease-in-out infinite; }
  .ul-dots span:nth-child(2){animation-delay:.2s}
  .ul-dots span:nth-child(3){animation-delay:.4s}
`;

function AllAiLoader({ current, total }: { current: number; total: number }) {
  return (
    <div className="absolute inset-0 z-20 bg-black/90 rounded-2xl flex flex-col items-center justify-center gap-6">
      <style>{ANCA_LOADER_STYLES}</style>
      <div className="ul-wrap text-center">
        <div style={{ fontSize: "1.6rem", letterSpacing: "0.25em", textTransform: "uppercase", lineHeight: 1 }}>
          <span style={{ fontWeight: 700, color: "#fff" }}>Anca</span>
          <span style={{ fontWeight: 300, color: "#d1d5db" }}>Visuals</span>
        </div>
        <div style={{ fontSize: "0.6rem", letterSpacing: "0.35em", textTransform: "uppercase", color: "#9ca3af", fontStyle: "italic", marginTop: 6 }}>
          You feel it. We frame it.
        </div>
      </div>
      <div className="ul-dots"><span /><span /><span /></div>
      <div className="text-center">
        <p className="text-neutral-300 text-sm font-medium">Analizează pozele...</p>
        <p className="text-neutral-500 text-xs mt-1">Poza {current} din {total}</p>
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
  const touchStartX = useRef<number | null>(null);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [customTag, setCustomTag] = useState("");
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [allAiLoading, setAllAiLoading] = useState(false);
  const [allAiCurrent, setAllAiCurrent] = useState(0);

  const hasPhotos = photos.length > 0;
  const current = photos[currentIndex];

  const hasPending = pendingFiles.length > 0;

  const onPickFiles = (newFiles: File[]) => {
    const valid = newFiles.filter((f) => f.type.startsWith("image/"));
    setPendingFiles((prev) => [...prev, ...valid]);
    setPendingPreviews((prev) => [...prev, ...valid.map((f) => URL.createObjectURL(f))]);
  };

  const removePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const confirmLoad = () => {
    if (pendingFiles.length === 0) return;
    const entries: PhotoEntry[] = pendingFiles.map((file, i) => ({
      file,
      preview: pendingPreviews[i],
      tags: [],
      notes: "",
      aiLoading: false,
      aiDone: false,
      progress: null,
    }));
    setPhotos((prev) => {
      const updated = [...prev, ...entries];
      setCurrentIndex(prev.length === 0 ? 0 : prev.length);
      return updated;
    });
    setPendingFiles([]);
    setPendingPreviews([]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setCurrentIndex((prev) => Math.min(prev, Math.max(0, photos.length - 2)));
  };

  const updatePhoto = (index: number, updates: Partial<PhotoEntry>) => {
    setPhotos((prev) => prev.map((p, i) => i === index ? { ...p, ...updates } : p));
  };

  const toggleTag = (tag: string) => {
    if (!current) return;
    const next = current.tags.includes(tag)
      ? current.tags.filter((t) => t !== tag)
      : [...current.tags, tag];
    updatePhoto(currentIndex, { tags: next });
  };

  const addCustomTag = () => {
    if (!current) return;
    const newTags = customTag
      .split(/[,;]+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && !current.tags.includes(t));
    if (newTags.length > 0) updatePhoto(currentIndex, { tags: [...current.tags, ...newTags] });
    setCustomTag("");
  };

  const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const suggestForIndex = async (index: number): Promise<void> => {
    const photo = photos[index];
    if (!photo) return;
    updatePhoto(index, { aiLoading: true });
    try {
      const base64 = await getBase64(photo.file);
      const res = await fetch("/api/admin/inspiration/suggest-tags-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: photo.file.type || "image/jpeg", availableTags: PRESET_TAGS }),
      });
      const data = await res.json();
      const newTags: string[] = data.tags ?? [];
      setPhotos((prev) => prev.map((p, i) => {
        if (i !== index) return p;
        const merged = Array.from(new Set([...p.tags, ...newTags]));
        return { ...p, tags: merged, aiLoading: false, aiDone: true };
      }));
    } catch {
      updatePhoto(index, { aiLoading: false });
    }
  };

  const suggestCurrent = () => suggestForIndex(currentIndex);

  const suggestAll = async () => {
    setAllAiLoading(true);
    for (let i = 0; i < photos.length; i++) {
      setAllAiCurrent(i + 1);
      await suggestForIndex(i);
    }
    setAllAiLoading(false);
    setAllAiCurrent(0);
  };

  const uploadPhoto = (entry: PhotoEntry, index: number): Promise<void> =>
    new Promise((resolve, reject) => {
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${entry.file.name.replace(/\s+/g, "_")}`;
      const storageRef = ref(storage, `inspiration-library/${safeName}`);
      const task = uploadBytesResumable(storageRef, entry.file);
      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          updatePhoto(index, { progress: pct });
        },
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          const res = await fetch("/api/admin/inspiration/photos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, tags: entry.tags, notes: entry.notes }),
          });
          const data = await res.json();
          onAdded({ id: data.id, url, tags: entry.tags, notes: entry.notes, uploadedAt: new Date().toISOString() });
          resolve();
        },
      );
    });

  const handleSaveAll = async () => {
    const missingTags = photos.findIndex((p) => p.tags.length === 0);
    if (missingTags !== -1) {
      setCurrentIndex(missingTags);
      setErrors([`Poza ${missingTags + 1} nu are niciun tag. Adaugă cel puțin un tag înainte de salvare.`]);
      return;
    }
    setUploading(true);
    setErrors([]);
    const snapshot = [...photos];
    const results = await Promise.allSettled(snapshot.map((p, i) => uploadPhoto(p, i)));
    const failed = results
      .map((r, i) => r.status === "rejected" ? snapshot[i].file.name : null)
      .filter(Boolean) as string[];
    setUploading(false);
    if (failed.length === 0) { onClose(); } else {
      setErrors(failed.map((name) => `Upload eșuat: ${name}`));
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || allAiLoading) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0 && currentIndex < photos.length - 1) setCurrentIndex((i) => i + 1);
      if (delta > 0 && currentIndex > 0) setCurrentIndex((i) => i - 1);
    }
    touchStartX.current = null;
  };

  const photosWithoutTags = photos.filter((p) => p.tags.length === 0).length;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="relative bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* AncaVisuals loader overlay during suggestAll */}
        {allAiLoading && <AllAiLoader current={allAiCurrent} total={photos.length} />}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 sticky top-0 bg-neutral-900 z-10">
          <h2 className="text-white text-base font-semibold">
            {hasPhotos ? `${photos.length} ${photos.length === 1 ? "poză" : "poze"} · poza ${currentIndex + 1}` : "Adaugă poze"}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors text-lg">✕</button>
        </div>

        <div className="p-5 space-y-5">

          {/* File picker section */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-violet-500 hover:text-violet-300 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Selectează poze
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) onPickFiles(Array.from(e.target.files)); }}
              />
              {hasPending && (
                <button
                  onClick={confirmLoad}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
                >
                  Încarcă ({pendingFiles.length})
                </button>
              )}
            </div>

            {/* Pending previews */}
            {hasPending && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {pendingFiles.map((_, i) => (
                  <div key={i} className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden group">
                    <img src={pendingPreviews[i]} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePending(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {hasPhotos && (
            <>
              {/* Featured photo */}
              <div
                className="relative rounded-xl overflow-hidden bg-neutral-950"
                style={{ aspectRatio: "4/3" }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <img src={current.preview} alt="" className="w-full h-full object-contain" />

                {/* Per-photo AI loading */}
                {current.aiLoading && !allAiLoading && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      <p className="text-neutral-300 text-xs">Analizează poza...</p>
                    </div>
                  </div>
                )}

                {/* Upload progress */}
                {current.progress !== null && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
                    <p className="text-white font-semibold text-lg">{current.progress}%</p>
                    <div className="w-36 bg-neutral-700 rounded-full h-1.5">
                      <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${current.progress}%` }} />
                    </div>
                  </div>
                )}

                {/* AI done badge */}
                {current.aiDone && !current.aiLoading && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs">
                    ✦ AI gata
                  </div>
                )}

                {/* Nav arrows */}
                {currentIndex > 0 && (
                  <button
                    onClick={() => !allAiLoading && setCurrentIndex((i) => i - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white text-xl flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    ‹
                  </button>
                )}
                {currentIndex < photos.length - 1 && (
                  <button
                    onClick={() => !allAiLoading && setCurrentIndex((i) => i + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white text-xl flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    ›
                  </button>
                )}

                {/* Delete */}
                {!uploading && !allAiLoading && (
                  <button
                    onClick={() => removePhoto(currentIndex)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 text-white text-xs flex items-center justify-center hover:bg-red-500 transition-colors"
                    title="Șterge poza"
                  >
                    ✕
                  </button>
                )}

                {/* Counter */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/60 text-white text-xs">
                  {currentIndex + 1} / {photos.length}
                </div>
              </div>

              {/* Thumbnails */}
              {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((photo, i) => (
                    <button
                      key={i}
                      onClick={() => !allAiLoading && setCurrentIndex(i)}
                      className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        i === currentIndex ? "border-violet-500" : "border-transparent opacity-50 hover:opacity-90"
                      }`}
                    >
                      <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                      {photo.tags.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="text-amber-400 text-xs">!</span>
                        </div>
                      )}
                      {photo.aiDone && photo.tags.length > 0 && (
                        <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <span style={{ fontSize: "8px", color: "#fff" }}>✓</span>
                        </div>
                      )}
                      {photo.aiLoading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* AI buttons */}
              <div className="flex gap-2">
                <button
                  onClick={suggestCurrent}
                  disabled={current.aiLoading || allAiLoading || uploading}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-500/25 disabled:opacity-40 transition-colors"
                >
                  {current.aiLoading ? (
                    <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                  ) : <span>✦</span>}
                  Sugerează AI
                </button>
                <button
                  onClick={suggestAll}
                  disabled={allAiLoading || uploading}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-500/25 disabled:opacity-40 transition-colors"
                >
                  <span>✦✦</span>
                  Sugerează AI (All)
                </button>
              </div>

              {/* Tags for current photo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-neutral-400 text-xs uppercase tracking-wide font-medium">
                    Tag-uri
                    {current.tags.length > 0
                      ? <span className="ml-1.5 text-violet-400 normal-case font-normal">· {current.tags.length} selectate</span>
                      : <span className="ml-1.5 text-amber-400 normal-case font-normal">· niciun tag</span>
                    }
                  </p>
                  {current.tags.length > 0 && (
                    <button
                      onClick={() => updatePhoto(currentIndex, { tags: [], aiDone: false })}
                      className="text-xs text-neutral-600 hover:text-neutral-400 underline underline-offset-2 transition-colors"
                    >
                      Resetează
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {PRESET_TAGS.map((tag) => (
                    <TagPill key={tag} tag={tag} selected={current.tags.includes(tag)} onClick={() => toggleTag(tag)} />
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    className="flex-1 bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-1.5 outline-none focus:border-violet-500 transition-colors placeholder-neutral-600"
                    placeholder="Tag custom separat prin virgulă..."
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

              {/* Notes per photo */}
              <div>
                <p className="text-neutral-400 text-xs uppercase tracking-wide font-medium mb-1">
                  Notă · poza {currentIndex + 1} <span className="normal-case font-normal text-neutral-600">(opțional)</span>
                </p>
                <textarea
                  className="w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 transition-colors resize-none placeholder-neutral-600"
                  rows={2}
                  placeholder="ex: unghi special, lumină naturală..."
                  value={current.notes}
                  onChange={(e) => updatePhoto(currentIndex, { notes: e.target.value })}
                />
              </div>
            </>
          )}

          {errors.map((err, i) => (
            <p key={i} className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{err}</p>
          ))}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 transition-colors"
            >
              Anulează
            </button>
            <button
              onClick={handleSaveAll}
              disabled={photos.length === 0 || uploading || allAiLoading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors"
            >
              {uploading
                ? "Se încarcă..."
                : photosWithoutTags > 0
                  ? `${photosWithoutTags} poze fără tag-uri`
                  : `Salvează pe toate (${photos.length})`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
