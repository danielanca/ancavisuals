import React from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { ClientFeedback } from "../../../../shared/feedback/feedback";
import { uploadUrl } from "../../../utils/address";

const MAX_REVIEW_PHOTOS = 15;

interface ReviewPhoto {
  url: string;
  name: string;
}
type AlbumPhoto = ReviewPhoto;

interface Review {
  id: string;
  author: string;
  city?: string;
  date: string;
  rating: number | null;
  text: string;
  photos: ReviewPhoto[];
  verified: boolean;
  category: "wedding" | "oferta" | "both";
  offerSlug: string | null;
  status: ReviewStatus;
}

// Draft = salvată în admin, dar nu apare pe site. Publicată = vizibilă în zonele alese.
type ReviewStatus = "draft" | "published";
type StatusFilter = "all" | ReviewStatus;

type FormState = {
  author: string;
  city: string;
  date: string;
  rating: number;
  text: string;
  category: "wedding" | "oferta" | "both";
  offerSlug: string;
  verified: boolean;
  selectedPhotos: SelectedPhoto[];
  sourceFeedbackId?: string;
  status: ReviewStatus;
};

type SelectedPhoto = {
  id: string;
  source: "existing" | "album" | "file";
  photo?: ReviewPhoto;
  file?: File;
};

const emptyForm = (): FormState => ({
  author: "",
  city: "",
  date: new Date().toISOString().slice(0, 10),
  rating: 5,
  text: "",
  category: "wedding",
  offerSlug: "",
  verified: false,
  selectedPhotos: [],
  status: "published",
});

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-label={`${n} stele`} onClick={() => onChange(n)} className="text-xl leading-none">
          <span className={n <= value ? "text-amber-400" : "text-neutral-700"}>★</span>
        </button>
      ))}
    </div>
  );
}

function useObjectUrls(files: File[]): string[] {
  const [urls, setUrls] = React.useState<string[]>([]);
  React.useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  return urls;
}

function createPhotoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const ReviewsAdminPage: React.FC = () => {
  const { auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authHeader = React.useMemo(() => ({ Authorization: `Bearer ${auth.accessToken}` }), [auth.accessToken]);

  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [dragging, setDragging] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const newPhotoFiles = React.useMemo(() => form.selectedPhotos.filter((item): item is SelectedPhoto & { file: File } => item.source === "file" && Boolean(item.file)), [form.selectedPhotos]);
  const newPhotoFileValues = React.useMemo(() => newPhotoFiles.map(item => item.file), [newPhotoFiles]);
  const newPhotoPreviews = useObjectUrls(newPhotoFileValues);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const draftCount = reviews.filter(review => review.status === "draft").length;
  const visibleReviews = statusFilter === "all" ? reviews : reviews.filter(review => review.status === statusFilter);
  const [albumSlugs, setAlbumSlugs] = React.useState<string[]>([]);
  const [activeAlbumSlug, setActiveAlbumSlug] = React.useState("");
  const [albumPhotos, setAlbumPhotos] = React.useState<AlbumPhoto[]>([]);
  const [albumLoading, setAlbumLoading] = React.useState(false);
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const editHandledRef = React.useRef<string | null>(null);

  const loadReviews = React.useCallback(() => {
    if (!auth.accessToken) return;
    setLoading(true);
    fetch("/api/reviews/admin/all", { headers: authHeader })
      .then((r) => r.json())
      .then((data) => setReviews(Array.isArray(data.reviews) ? data.reviews : []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [auth.accessToken, authHeader]);

  React.useEffect(() => { loadReviews(); }, [loadReviews]);
  React.useEffect(() => {
    const feedback = (location.state as { feedback?: ClientFeedback } | null)?.feedback;
    if (!feedback) return;
    setEditingId(null);
    setForm({ ...emptyForm(), author: feedback.name, text: feedback.message, date: feedback.createdAt.slice(0, 10), rating: 0, category: "both", offerSlug: "olx", sourceFeedbackId: feedback.id });
    setError(null);
    setShowForm(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setActiveAlbumSlug(""); setAlbumPhotos([]);
    void loadAlbumSlugs();
    setShowForm(true);
  }

  const openEditForm = React.useCallback((review: Review) => {
    setEditingId(review.id);
    setForm({
      author: review.author,
      city: review.city ?? "",
      date: review.date,
      rating: review.rating ?? 0,
      text: review.text,
      category: review.category,
      offerSlug: review.offerSlug ?? "",
      verified: review.verified,
      selectedPhotos: review.photos.map(photo => ({ id: `existing-${photo.url}`, source: "existing", photo })),
      status: review.status,
    });
    setActiveAlbumSlug(""); setAlbumPhotos([]);
    void loadAlbumSlugs();
    setError(null);
    setShowForm(true);
  // loadAlbumSlugs is intentionally resolved from the latest admin session when the form opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || loading || editHandledRef.current === editId) return;
    const review = reviews.find(item => item.id === editId);
    if (review) {
      editHandledRef.current = editId;
      openEditForm(review);
      navigate(location.pathname, { replace: true });
    }
  }, [searchParams, reviews, loading, location.pathname, navigate, openEditForm]);

  async function loadAlbumSlugs() {
    try {
      const response = await fetch("/api/album/admin/list", { headers: authHeader });
      const data = await response.json() as { slugs?: string[] };
      setAlbumSlugs(data.slugs ?? []);
    } catch { setAlbumSlugs([]); }
  }

  async function loadAlbumPhotos(slug: string) {
    setActiveAlbumSlug(slug); setAlbumPhotos([]);
    if (!slug) return;
    setAlbumLoading(true);
    try {
      const response = await fetch(`/api/album/${encodeURIComponent(slug)}`, { headers: authHeader });
      const data = await response.json() as { photos?: string[] };
      setAlbumPhotos((data.photos ?? []).map(url => ({ url, name: url.split("/").pop() ?? "fotografie" })));
    } catch { setAlbumPhotos([]); }
    finally { setAlbumLoading(false); }
  }

  function toggleAlbumPhoto(photo: AlbumPhoto) {
    setForm(current => ({
      ...current,
      selectedPhotos: current.selectedPhotos.some(item => item.source === "album" && item.photo?.url === photo.url)
        ? current.selectedPhotos.filter(item => !(item.source === "album" && item.photo?.url === photo.url))
        : current.selectedPhotos.length >= MAX_REVIEW_PHOTOS
            ? current.selectedPhotos
            : [...current.selectedPhotos, { id: `album-${photo.url}`, source: "album", photo }],
    }));
  }

  const selectedPhotoCount = form.selectedPhotos.length;

  function addNewPhotoFiles(files: File[]) {
    setForm(current => ({
      ...current,
      selectedPhotos: [...current.selectedPhotos, ...files].slice(0, MAX_REVIEW_PHOTOS).map((item) => item instanceof File ? { id: `file-${createPhotoId()}`, source: "file" as const, file: item } : item),
    }));
  }

  function movePhoto(id: string, direction: "first" | "up" | "down") {
    setForm(current => {
      const index = current.selectedPhotos.findIndex(item => item.id === id);
      if (index < 0) return current;
      const target = direction === "first" ? 0 : direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= current.selectedPhotos.length || target === index) return current;
      const selectedPhotos = [...current.selectedPhotos];
      const [photo] = selectedPhotos.splice(index, 1);
      selectedPhotos.splice(target, 0, photo);
      return { ...current, selectedPhotos };
    });
  }

  // Enter în formular păstrează starea curentă; butoanele aleg explicit draft / publicat.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void saveReview(form.status);
  }

  async function saveReview(status: ReviewStatus) {
    if (!form.author.trim() || !form.text.trim()) {
      setError("Numele și textul recenziei sunt obligatorii.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("author", form.author.trim());
      body.set("city", form.city.trim());
      body.set("albumPhotoUrls", JSON.stringify(form.selectedPhotos.filter(item => item.source === "album").map(item => item.photo)));
      body.set("photoOrder", JSON.stringify(form.selectedPhotos.map(item => item.source === "file" ? `file:${item.id}` : item.photo?.url).filter(Boolean)));
      body.set("photoFileIds", JSON.stringify(newPhotoFiles.map(item => item.id)));
      body.set("date", form.date);
      body.set("rating", String(form.rating));
      body.set("text", form.text.trim());
      body.set("category", form.category);
      if (form.category !== "wedding") body.set("offerSlug", form.offerSlug.trim());
      if (form.sourceFeedbackId) body.set("sourceFeedbackId", form.sourceFeedbackId);
      body.set("verified", String(form.verified));
      body.set("status", status);
      newPhotoFiles.forEach((item) => body.append("photos", item.file));
      if (editingId) body.set("keepPhotoUrls", JSON.stringify(form.selectedPhotos.filter(item => item.source === "existing").map(item => item.photo?.url).filter(Boolean)));

      const url = editingId ? `/api/reviews/admin/${editingId}` : "/api/reviews/admin";
      const res = await fetch(uploadUrl(url), { method: editingId ? "PUT" : "POST", headers: authHeader, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Recenzia nu a putut fi salvată.");
      setShowForm(false);
      loadReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recenzia nu a putut fi salvată.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(review: Review) {
    const status: ReviewStatus = review.status === "draft" ? "published" : "draft";
    setTogglingId(review.id);
    setError(null);
    try {
      const body = new FormData();
      body.set("status", status);
      const response = await fetch(`/api/reviews/admin/${review.id}`, { method: "PUT", headers: authHeader, body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Starea recenziei nu a putut fi schimbată.");
      setReviews((current) => current.map((item) => item.id === review.id ? { ...item, status } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare de conexiune.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/reviews/admin/${id}`, { method: "DELETE", headers: authHeader });
      if (!response.ok) throw new Error("Recenzia nu a putut fi ștearsă.");
      setReviews((current) => current.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare de conexiune.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Breadcrumb />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-light tracking-tight text-white">Recenzii</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Creează recenzii manual sau acceptă mesaje din Feedback clienți. Alege afișarea pe homepage și paginile de oraș, pe oferte sau în ambele zone. Draft-urile rămân doar aici, până le publici.
            </p>
            <Link to="/admin/feedback" className="mt-3 inline-block text-sm text-amber-200">Vezi feedback-ul primit →</Link>
          </div>
          <button
            onClick={openAddForm}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Adaugă recenzie
          </button>
        </div>

        {error && !showForm && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {!loading && reviews.length > 0 && (
          <div role="tablist" aria-label="Filtru stare recenzii" className="flex flex-wrap gap-1">
            {([["all", `Toate (${reviews.length})`], ["published", `Publicate (${reviews.length - draftCount})`], ["draft", `Draft (${draftCount})`]] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={statusFilter === value} onClick={() => setStatusFilter(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === value ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-neutral-500">Se încarcă...</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-neutral-500">Nicio recenzie adăugată încă.</p>
        ) : visibleReviews.length === 0 ? (
          <p className="text-sm text-neutral-500">{statusFilter === "draft" ? "Nicio recenzie în draft." : "Nicio recenzie publicată."}</p>
        ) : (
          <div className="space-y-2">
            {visibleReviews.map((review) => (
              <div key={review.id} className={`flex items-start gap-3 rounded-xl border p-4 ${review.status === "draft" ? "border-dashed border-neutral-700 bg-neutral-900/50" : "border-neutral-800 bg-neutral-900"}`}>
                {review.photos.length > 0 && (
                  <div className="relative h-16 w-16 shrink-0">
                    <img src={review.photos[0].url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    {review.photos.length > 1 && (
                      <span className="absolute -right-1.5 -top-1.5 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300 ring-1 ring-neutral-700">
                        +{review.photos.length - 1}
                      </span>
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">{review.author}</span>
                    {review.status === "draft"
                      ? <span className="rounded bg-neutral-700/60 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">Draft · nu apare pe site</span>
                      : <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">Publicată</span>}
                    {review.verified && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">Verificată</span>}
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
                      {review.category === "both" ? `Homepage + ofertă · ${review.offerSlug || "toate"}` : review.category === "oferta" ? `Ofertă${review.offerSlug ? ` · ${review.offerSlug}` : " · toate"}` : "Homepage + orașe"}
                    </span>
                    {review.rating !== null && <span className="text-xs text-amber-400">{"★".repeat(review.rating)}<span className="text-neutral-700">{"★".repeat(5 - review.rating)}</span></span>}
                    <span className="text-xs text-neutral-600">{review.date}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-neutral-400">{review.text}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void toggleStatus(review)}
                    disabled={togglingId === review.id}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${review.status === "draft" ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "text-neutral-400 hover:bg-neutral-800 hover:text-white"}`}
                  >
                    {review.status === "draft" ? "Publică" : "Treci în draft"}
                  </button>
                  <button onClick={() => openEditForm(review)} className="p-1.5 rounded-lg text-neutral-600 hover:text-amber-400 hover:bg-neutral-800 transition-colors" title="Editează">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button onClick={() => handleDelete(review.id)} disabled={deletingId === review.id} className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-neutral-800 transition-colors disabled:opacity-50">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowForm(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">{editingId ? "Editează recenzia" : form.sourceFeedbackId ? "Acceptă feedback ca recenzie" : "Recenzie nouă"}</h2>
              <button onClick={() => setShowForm(false)} className="text-neutral-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {form.sourceFeedbackId && <p className="text-sm text-neutral-400">Verifică numele, textul și locul afișării. Poți salva ca draft (nu apare pe site) sau publica direct. Feedback-ul original rămâne păstrat. Formularul clientului nu cere stele; adaugă un rating doar dacă l-a oferit clientul.</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Nume client</label>
                  <input value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Dată</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">Orașul evenimentului</label>
                <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="ex: Cluj-Napoca"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Notă</label>
                  <StarPicker value={form.rating} onChange={(n) => setForm((f) => ({ ...f, rating: n }))} />
                  <button type="button" onClick={() => setForm(f => ({ ...f, rating: 0 }))} className="mt-2 text-xs text-neutral-400 underline">{form.rating === 0 ? "Fără rating" : "Elimină ratingul"}</button>
                </div>
                <label className="flex items-center gap-2 text-xs text-neutral-400">
                  <input type="checkbox" checked={form.verified} onChange={(e) => setForm((f) => ({ ...f, verified: e.target.checked }))} />
                  Recenzie verificată
                </label>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">Text recenzie</label>
                <textarea value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} rows={4}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Unde apare</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as "wedding" | "oferta" }))}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500">
                  <option value="wedding">Homepage + paginile de oraș</option>
                  <option value="oferta">Ofertă (/oferta/:slug)</option>
                  <option value="both">Homepage + orașe + ofertă</option>
                  </select>
                </div>
                {form.category !== "wedding" && (
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Slug ofertă (gol = toate)</label>
                    <input value={form.offerSlug} onChange={(e) => setForm((f) => ({ ...f, offerSlug: e.target.value }))} placeholder="ex: olx"
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500" />
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs text-neutral-400">Poze de la client (opțional, maximum {MAX_REVIEW_PHOTOS})</label>
                  <span className="text-xs text-neutral-500">{selectedPhotoCount}/{MAX_REVIEW_PHOTOS}</span>
                </div>
                <div className="mb-3 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
                  <label className="block text-xs text-neutral-400 mb-2">Alege dintr-un album</label>
                  <select value={activeAlbumSlug} onChange={(e) => void loadAlbumPhotos(e.target.value)} className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white">
                    <option value="">Selectează albumul...</option>
                    {albumSlugs.map(slug => <option key={slug} value={slug}>{slug}</option>)}
                  </select>
                  <button type="button" onClick={() => setGalleryOpen(true)} className="mt-3 w-full rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-400/20">
                    Deschide galeria full page {form.selectedPhotos.filter(item => item.source === "album").length > 0 ? `(${form.selectedPhotos.filter(item => item.source === "album").length} selectate)` : ""}
                  </button>
                  {activeAlbumSlug && albumLoading && <p className="mt-2 text-xs text-neutral-500">Se încarcă fotografiile...</p>}
                </div>
                <div
                  className={`rounded-lg border transition-colors ${dragging ? "border-emerald-500 bg-emerald-600/10" : "border-transparent"}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
                    if (files.length) addNewPhotoFiles(files);
                  }}
                >
                  <label className="block cursor-pointer rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500">
                    {dragging ? "Dă drumul aici..." : "Trage poze (una sau mai multe) sau apasă"}
                    <input type="file" accept="image/*" multiple className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length) addNewPhotoFiles(files);
                        e.target.value = "";
                      }} />
                  </label>

                  {form.selectedPhotos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {form.selectedPhotos.map((item, index) => {
                        const src = item.source === "file" ? newPhotoPreviews[newPhotoFiles.findIndex(file => file.id === item.id)] : item.photo?.url;
                        if (!src) return null;
                        return <div key={item.id} className="group relative h-16 w-16 shrink-0">
                          <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                          {index === 0 && <span className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-emerald-500/90 px-1 py-0.5 text-center text-[9px] font-medium text-neutral-950">FEATURED</span>}
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, selectedPhotos: f.selectedPhotos.filter(photo => photo.id !== item.id) }))}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-xs text-neutral-300 ring-1 ring-neutral-700 hover:bg-red-500/80 hover:text-white"
                            title="Șterge poza"
                          >
                            ✕
                          </button>
                          <div className="absolute -bottom-1 -right-1 hidden gap-0.5 group-hover:flex">
                            {index > 0 && <button type="button" onClick={() => movePhoto(item.id, "up")} className="rounded bg-neutral-900 px-1 text-[10px] text-white" title="Mută mai sus">↑</button>}
                            {index > 0 && <button type="button" onClick={() => movePhoto(item.id, "first")} className="rounded bg-emerald-500 px-1 text-[10px] text-neutral-950" title="Setează ca featured">★</button>}
                            {index < form.selectedPhotos.length - 1 && <button type="button" onClick={() => movePhoto(item.id, "down")} className="rounded bg-neutral-900 px-1 text-[10px] text-white" title="Mută mai jos">↓</button>}
                          </div>
                        </div>;
                      })}
                    </div>
                  )}
                  {form.selectedPhotos.length > 0 && <p className="mt-2 text-[11px] text-neutral-500">Prima fotografie este featured. Folosește ↑ / ★ / ↓ pentru ordinea caruselului.</p>}
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500">
                  Anulează
                </button>
                <button type="button" onClick={() => void saveReview("draft")} disabled={saving} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:border-neutral-500 disabled:opacity-50">
                  {saving ? "Se salvează..." : editingId ? "Salvează ca draft" : form.sourceFeedbackId ? "Acceptă ca draft" : "Adaugă ca draft"}
                </button>
                <button type="button" onClick={() => void saveReview("published")} disabled={saving} className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50">
                  {saving ? "Se salvează..." : editingId ? "Salvează și publică" : form.sourceFeedbackId ? "Acceptă și publică recenzia" : "Adaugă și publică"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {galleryOpen && (
        <div className="fixed inset-0 z-[80] flex min-h-screen flex-col bg-neutral-950 text-white">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-800 px-5 py-4 sm:px-8">
            <div><p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Galerie recenzie</p><h2 className="mt-1 text-xl font-medium">Alege fotografiile evenimentului</h2></div>
            <button type="button" onClick={() => setGalleryOpen(false)} className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500">Înapoi</button>
          </header>
          <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-5 py-4 sm:px-8">
            <select value={activeAlbumSlug} onChange={(e) => void loadAlbumPhotos(e.target.value)} className="min-w-[240px] rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white"><option value="">Selectează albumul...</option>{albumSlugs.map(slug => <option key={slug} value={slug}>{slug}</option>)}</select>
            <span className="text-sm text-neutral-400">{selectedPhotoCount}/{MAX_REVIEW_PHOTOS} fotografii selectate</span>
            <span className="text-xs text-neutral-500">Prima din selecție va fi fotografia featured</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
            {albumLoading && <p className="py-16 text-center text-neutral-400">Se încarcă fotografiile...</p>}
            {!albumLoading && !activeAlbumSlug && <p className="py-16 text-center text-neutral-500">Alege mai întâi un album.</p>}
            {!albumLoading && activeAlbumSlug && albumPhotos.length === 0 && <p className="py-16 text-center text-neutral-500">Albumul nu are fotografii disponibile.</p>}
            {!albumLoading && albumPhotos.length > 0 && <div className="columns-2 gap-3 sm:columns-3 md:columns-5 lg:columns-7">{albumPhotos.map(photo => { const selected = form.selectedPhotos.some(item => item.source === "album" && item.photo?.url === photo.url); const disabled = !selected && selectedPhotoCount >= MAX_REVIEW_PHOTOS; return <button key={photo.url} type="button" disabled={disabled} onClick={() => toggleAlbumPhoto(photo)} className={`group relative mb-3 block w-full break-inside-avoid overflow-hidden border-2 ${selected ? "border-emerald-400" : "border-transparent"} ${disabled ? "cursor-not-allowed opacity-45" : "hover:border-neutral-400"}`}><img src={photo.url} alt={photo.name} className="block h-auto w-full" loading="lazy" />{selected && <span className="absolute inset-0 flex items-center justify-center bg-emerald-500/35 text-3xl font-bold text-white">✓</span>}</button>; })}</div>}
          </div>
          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-800 bg-neutral-950 px-5 py-4 sm:px-8"><button type="button" onClick={() => setGalleryOpen(false)} className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:border-neutral-500">Anulează</button><button type="button" onClick={() => setGalleryOpen(false)} className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-neutral-950 hover:bg-emerald-400">Confirmă selecția ({form.selectedPhotos.filter(item => item.source === "album").length})</button></footer>
        </div>
      )}
    </div>
  );
};

export default ReviewsAdminPage;
