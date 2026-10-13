import React from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { ClientFeedback } from "../../../../shared/feedback/feedback";

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
}

type FormState = {
  author: string;
  city: string;
  date: string;
  rating: number;
  text: string;
  category: "wedding" | "oferta" | "both";
  offerSlug: string;
  verified: boolean;
  existingPhotos: ReviewPhoto[];
  newPhotoFiles: File[];
  selectedAlbumPhotos: AlbumPhoto[];
  sourceFeedbackId?: string;
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
  existingPhotos: [],
  newPhotoFiles: [],
  selectedAlbumPhotos: [],
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
  const newPhotoPreviews = useObjectUrls(form.newPhotoFiles);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
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
      existingPhotos: review.photos,
      newPhotoFiles: [],
      selectedAlbumPhotos: [],
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
      selectedAlbumPhotos: current.selectedAlbumPhotos.some(item => item.url === photo.url)
        ? current.selectedAlbumPhotos.filter(item => item.url !== photo.url)
        : current.existingPhotos.length + current.selectedAlbumPhotos.length + current.newPhotoFiles.length >= 5
            ? current.selectedAlbumPhotos
            : [...current.selectedAlbumPhotos, photo],
    }));
  }

  const selectedPhotoCount = form.existingPhotos.length + form.selectedAlbumPhotos.length + form.newPhotoFiles.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      body.set("albumPhotoUrls", JSON.stringify(form.selectedAlbumPhotos));
      body.set("date", form.date);
      body.set("rating", String(form.rating));
      body.set("text", form.text.trim());
      body.set("category", form.category);
      if (form.category !== "wedding") body.set("offerSlug", form.offerSlug.trim());
      if (form.sourceFeedbackId) body.set("sourceFeedbackId", form.sourceFeedbackId);
      body.set("verified", String(form.verified));
      form.newPhotoFiles.forEach((file) => body.append("photos", file));
      if (editingId) body.set("keepPhotoUrls", JSON.stringify(form.existingPhotos.map((p) => p.url)));

      const url = editingId ? `/api/reviews/admin/${editingId}` : "/api/reviews/admin";
      const res = await fetch(url, { method: editingId ? "PUT" : "POST", headers: authHeader, body });
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
              Creează recenzii manual sau acceptă mesaje din Feedback clienți. Alege afișarea pe homepage și paginile de oraș, pe oferte sau în ambele zone.
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
        {loading ? (
          <p className="text-sm text-neutral-500">Se încarcă...</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-neutral-500">Nicio recenzie adăugată încă.</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((review) => (
              <div key={review.id} className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
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
              {form.sourceFeedbackId && <p className="text-sm text-neutral-400">Verifică numele, textul și locul afișării. Publicarea are loc doar după salvare. Feedback-ul original rămâne păstrat. Formularul clientului nu cere stele; adaugă un rating doar dacă l-a oferit clientul.</p>}
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
                  <label className="block text-xs text-neutral-400">Poze (opțional, maximum 5)</label>
                  <span className="text-xs text-neutral-500">{selectedPhotoCount}/5</span>
                </div>
                <div className="mb-3 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
                  <label className="block text-xs text-neutral-400 mb-2">Alege dintr-un album</label>
                  <select value={activeAlbumSlug} onChange={(e) => void loadAlbumPhotos(e.target.value)} className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white">
                    <option value="">Selectează albumul...</option>
                    {albumSlugs.map(slug => <option key={slug} value={slug}>{slug}</option>)}
                  </select>
                  <button type="button" onClick={() => setGalleryOpen(true)} className="mt-3 w-full rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-400/20">
                    Deschide galeria full page {form.selectedAlbumPhotos.length > 0 ? `(${form.selectedAlbumPhotos.length} selectate)` : ""}
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
                    if (files.length) setForm((f) => ({ ...f, newPhotoFiles: [...f.newPhotoFiles, ...files] }));
                  }}
                >
                  <label className="block cursor-pointer rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500">
                    {dragging ? "Dă drumul aici..." : "Trage poze (una sau mai multe) sau apasă"}
                    <input type="file" accept="image/*" multiple className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length) setForm((f) => ({ ...f, newPhotoFiles: [...f.newPhotoFiles, ...files] }));
                        e.target.value = "";
                      }} />
                  </label>

                  {(form.existingPhotos.length > 0 || form.selectedAlbumPhotos.length > 0 || form.newPhotoFiles.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {form.existingPhotos.map((photo) => (
                        <div key={photo.url} className="group relative h-16 w-16 shrink-0">
                          <img src={photo.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, existingPhotos: f.existingPhotos.filter((p) => p.url !== photo.url) }))}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-xs text-neutral-300 ring-1 ring-neutral-700 hover:bg-red-500/80 hover:text-white"
                            title="Șterge poza"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {form.selectedAlbumPhotos.map((photo) => (
                        <div key={`album-${photo.url}`} className="group relative h-16 w-16 shrink-0">
                          <img src={photo.url} alt={photo.name} className="h-16 w-16 rounded-lg object-cover" />
                          <button type="button" onClick={() => toggleAlbumPhoto(photo)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-xs text-neutral-300 ring-1 ring-neutral-700 hover:bg-red-500/80 hover:text-white" title="Scoate poza">✕</button>
                        </div>
                      ))}
                      {form.newPhotoFiles.map((file, i) => (
                        <div key={`${file.name}-${i}`} className="group relative h-16 w-16 shrink-0">
                          <img src={newPhotoPreviews[i]} alt="" className="h-16 w-16 rounded-lg object-cover" />
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, newPhotoFiles: f.newPhotoFiles.filter((_, idx) => idx !== i) }))}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-xs text-neutral-300 ring-1 ring-neutral-700 hover:bg-red-500/80 hover:text-white"
                            title="Șterge poza"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500">
                  Anulează
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50">
                  {saving ? "Se salvează..." : editingId ? "Salvează" : form.sourceFeedbackId ? "Acceptă și publică recenzia" : "Adaugă"}
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
            <span className="text-sm text-neutral-400">{selectedPhotoCount}/5 fotografii selectate</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
            {albumLoading && <p className="py-16 text-center text-neutral-400">Se încarcă fotografiile...</p>}
            {!albumLoading && !activeAlbumSlug && <p className="py-16 text-center text-neutral-500">Alege mai întâi un album.</p>}
            {!albumLoading && activeAlbumSlug && albumPhotos.length === 0 && <p className="py-16 text-center text-neutral-500">Albumul nu are fotografii disponibile.</p>}
            {!albumLoading && albumPhotos.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">{albumPhotos.map(photo => { const selected = form.selectedAlbumPhotos.some(item => item.url === photo.url); const disabled = !selected && selectedPhotoCount >= 5; return <button key={photo.url} type="button" disabled={disabled} onClick={() => toggleAlbumPhoto(photo)} className={`group relative aspect-square overflow-hidden border-2 ${selected ? "border-emerald-400" : "border-transparent"} ${disabled ? "cursor-not-allowed opacity-45" : "hover:border-neutral-400"}`}><img src={photo.url} alt={photo.name} className="h-full w-full object-cover" loading="lazy" />{selected && <span className="absolute inset-0 flex items-center justify-center bg-emerald-500/35 text-3xl font-bold text-white">✓</span>}</button>; })}</div>}
          </div>
          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-800 bg-neutral-950 px-5 py-4 sm:px-8"><button type="button" onClick={() => setGalleryOpen(false)} className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:border-neutral-500">Anulează</button><button type="button" onClick={() => setGalleryOpen(false)} className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-neutral-950 hover:bg-emerald-400">Confirmă selecția ({form.selectedAlbumPhotos.length})</button></footer>
        </div>
      )}
    </div>
  );
};

export default ReviewsAdminPage;
