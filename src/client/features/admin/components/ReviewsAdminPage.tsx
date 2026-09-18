import React from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";

interface Review {
  id: string;
  author: string;
  date: string;
  rating: number;
  text: string;
  photo: { url: string; name: string } | null;
  verified: boolean;
  category: "wedding" | "oferta";
  offerSlug: string | null;
}

type FormState = {
  author: string;
  date: string;
  rating: number;
  text: string;
  category: "wedding" | "oferta";
  offerSlug: string;
  verified: boolean;
  photoFile: File | null;
  removePhoto: boolean;
};

const emptyForm = (): FormState => ({
  author: "",
  date: new Date().toISOString().slice(0, 10),
  rating: 5,
  text: "",
  category: "wedding",
  offerSlug: "",
  verified: false,
  photoFile: null,
  removePhoto: false,
});

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="text-xl leading-none">
          <span className={n <= value ? "text-amber-400" : "text-neutral-700"}>★</span>
        </button>
      ))}
    </div>
  );
}

const ReviewsAdminPage: React.FC = () => {
  const { auth } = useAuth();
  const authHeader = React.useMemo(() => ({ Authorization: `Bearer ${auth.accessToken}` }), [auth.accessToken]);

  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [dragging, setDragging] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

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

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setShowForm(true);
  }

  function openEditForm(review: Review) {
    setEditingId(review.id);
    setForm({
      author: review.author,
      date: review.date,
      rating: review.rating,
      text: review.text,
      category: review.category,
      offerSlug: review.offerSlug ?? "",
      verified: review.verified,
      photoFile: null,
      removePhoto: false,
    });
    setError(null);
    setShowForm(true);
  }

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
      body.set("date", form.date);
      body.set("rating", String(form.rating));
      body.set("text", form.text.trim());
      body.set("category", form.category);
      if (form.category === "oferta") body.set("offerSlug", form.offerSlug.trim());
      body.set("verified", String(form.verified));
      if (form.photoFile) body.set("photo", form.photoFile);
      if (form.removePhoto) body.set("removePhoto", "true");

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
    try {
      await fetch(`/api/reviews/admin/${id}`, { method: "DELETE", headers: authHeader });
      setReviews((current) => current.filter((r) => r.id !== id));
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
              Recenziile de aici apar pe paginile publice — cele de tip "nuntă" pe paginile de oraș, cele de tip "ofertă" pe paginile /oferta/:slug.
            </p>
          </div>
          <button
            onClick={openAddForm}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Adaugă recenzie
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">Se încarcă...</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-neutral-500">Nicio recenzie adăugată încă.</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((review) => (
              <div key={review.id} className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                {review.photo && (
                  <img src={review.photo.url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">{review.author}</span>
                    {review.verified && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">Verificată</span>}
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
                      {review.category === "oferta" ? `Ofertă${review.offerSlug ? ` · ${review.offerSlug}` : " · toate"}` : "Nuntă"}
                    </span>
                    <span className="text-xs text-amber-400">{"★".repeat(review.rating)}<span className="text-neutral-700">{"★".repeat(5 - review.rating)}</span></span>
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
              <h2 className="text-lg font-medium text-white">{editingId ? "Editează recenzia" : "Recenzie nouă"}</h2>
              <button onClick={() => setShowForm(false)} className="text-neutral-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Notă</label>
                  <StarPicker value={form.rating} onChange={(n) => setForm((f) => ({ ...f, rating: n }))} />
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
                    <option value="wedding">Nuntă (paginile de oraș)</option>
                    <option value="oferta">Ofertă (/oferta/:slug)</option>
                  </select>
                </div>
                {form.category === "oferta" && (
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Slug ofertă (gol = toate)</label>
                    <input value={form.offerSlug} onChange={(e) => setForm((f) => ({ ...f, offerSlug: e.target.value }))} placeholder="ex: olx"
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">Poză (opțional)</label>
                <div
                  className={`flex items-center gap-2 rounded-lg border transition-colors ${dragging ? "border-emerald-500 bg-emerald-600/10" : "border-transparent"}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) setForm((f) => ({ ...f, photoFile: file, removePhoto: false }));
                  }}
                >
                  <label className="flex-1 min-w-0 cursor-pointer truncate rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500">
                    {form.photoFile ? form.photoFile.name : dragging ? "Dă drumul aici..." : "Trage o poză sau apasă"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) setForm((f) => ({ ...f, photoFile: file, removePhoto: false })); }} />
                  </label>
                  {editingId && !form.photoFile && (
                    <label className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <input type="checkbox" checked={form.removePhoto} onChange={(e) => setForm((f) => ({ ...f, removePhoto: e.target.checked }))} />
                      șterge poza
                    </label>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500">
                  Anulează
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50">
                  {saving ? "Se salvează..." : editingId ? "Salvează" : "Adaugă"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsAdminPage;
