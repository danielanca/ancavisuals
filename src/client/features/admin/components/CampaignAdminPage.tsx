import React, { useReducer, useEffect, useCallback } from "react";
import Breadcrumb from "./Breadcrumb";
import type { CampaignPage, CampaignPackage, CampaignTestimonial } from "../../../pages/CampaignLanding/CampaignLandingPage";

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit) {
  const { getAuth } = await import("firebase/auth");
  const token = await getAuth().currentUser?.getIdToken();
  return fetch(path, {
    ...options,
    headers: { ...(options?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

async function apiPost(path: string, body: unknown) {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function apiPut(path: string, body: unknown) {
  const response = await apiFetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
}

async function apiDelete(path: string, body?: unknown) {
  const response = await apiFetch(path, {
    method: "DELETE",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(await response.text());
}

async function apiUploadFile(path: string, file: File): Promise<{ url: string; bunnyPath?: string }> {
  const { getAuth } = await import("firebase/auth");
  const token = await getAuth().currentUser?.getIdToken();
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(path, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{ url: string; bunnyPath?: string }>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "list" | "edit";

interface State {
  view: View;
  pages: CampaignPage[];
  editingPage: CampaignPage | null;
  loading: boolean;
  saving: boolean;
  uploadingHeroImage: boolean;
  uploadingHeroVideo: boolean;
  uploadingGallery: boolean;
  deletingGalleryUrl: string | null;
  showAddPackage: boolean;
  showAddTestimonial: boolean;
  newSlug: string;
  newTitle: string;
  creating: boolean;
}

type Action =
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_PAGES"; pages: CampaignPage[] }
  | { type: "OPEN_EDIT"; page: CampaignPage }
  | { type: "CLOSE_EDIT" }
  | { type: "PATCH_EDITING"; patch: Partial<CampaignPage> }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_UPLOADING_HERO_IMAGE"; value: boolean }
  | { type: "SET_UPLOADING_HERO_VIDEO"; value: boolean }
  | { type: "SET_UPLOADING_GALLERY"; value: boolean }
  | { type: "SET_DELETING_GALLERY"; url: string | null }
  | { type: "SET_SHOW_ADD_PACKAGE"; value: boolean }
  | { type: "SET_SHOW_ADD_TESTIMONIAL"; value: boolean }
  | { type: "SET_NEW_SLUG"; value: string }
  | { type: "SET_NEW_TITLE"; value: string }
  | { type: "SET_CREATING"; value: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_LOADING": return { ...state, loading: action.value };
    case "SET_PAGES": return { ...state, pages: action.pages, loading: false };
    case "OPEN_EDIT": return { ...state, view: "edit", editingPage: { ...action.page } };
    case "CLOSE_EDIT": return { ...state, view: "list", editingPage: null };
    case "PATCH_EDITING": return state.editingPage ? { ...state, editingPage: { ...state.editingPage, ...action.patch } } : state;
    case "SET_SAVING": return { ...state, saving: action.value };
    case "SET_UPLOADING_HERO_IMAGE": return { ...state, uploadingHeroImage: action.value };
    case "SET_UPLOADING_HERO_VIDEO": return { ...state, uploadingHeroVideo: action.value };
    case "SET_UPLOADING_GALLERY": return { ...state, uploadingGallery: action.value };
    case "SET_DELETING_GALLERY": return { ...state, deletingGalleryUrl: action.url };
    case "SET_SHOW_ADD_PACKAGE": return { ...state, showAddPackage: action.value };
    case "SET_SHOW_ADD_TESTIMONIAL": return { ...state, showAddTestimonial: action.value };
    case "SET_NEW_SLUG": return { ...state, newSlug: action.value };
    case "SET_NEW_TITLE": return { ...state, newTitle: action.value };
    case "SET_CREATING": return { ...state, creating: action.value };
    default: return state;
  }
}

const initialState: State = {
  view: "list",
  pages: [],
  editingPage: null,
  loading: true,
  saving: false,
  uploadingHeroImage: false,
  uploadingHeroVideo: false,
  uploadingGallery: false,
  deletingGalleryUrl: null,
  showAddPackage: false,
  showAddTestimonial: false,
  newSlug: "",
  newTitle: "",
  creating: false,
};

// ─── Add Package Modal ────────────────────────────────────────────────────────

interface AddPackageModalProps {
  onClose: () => void;
  onSaved: (pkg: CampaignPackage) => void;
}

function AddPackageModal({ onClose, onSaved }: AddPackageModalProps) {
  const [form, setForm] = React.useState({ name: "", price: "", featuresText: "", highlighted: false });
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const features = form.featuresText.split("\n").map((line) => line.trim()).filter(Boolean);
      const pkg: CampaignPackage = { id: Date.now().toString(), name: form.name, price: form.price, features, highlighted: form.highlighted };
      onSaved(pkg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md p-6">
        <h3 className="text-white font-semibold mb-4">Adaugă pachet</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm" placeholder="Nume pachet (ex: Esențial)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm" placeholder="Preț (ex: 1500 EUR)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Ce include (câte un item pe rând)</label>
            <textarea className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm resize-none" rows={4} placeholder="Fotografie\nFilmare\nAlbum online" value={form.featuresText} onChange={(e) => setForm({ ...form, featuresText: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={form.highlighted} onChange={(e) => setForm({ ...form, highlighted: e.target.checked })} />
            Marcat ca popular
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-neutral-700 text-neutral-400 rounded-lg hover:text-white transition-colors">Anulează</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">Adaugă</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Testimonial Modal ────────────────────────────────────────────────────

interface AddTestimonialModalProps {
  onClose: () => void;
  onSaved: (testimonial: CampaignTestimonial) => void;
}

function AddTestimonialModal({ onClose, onSaved }: AddTestimonialModalProps) {
  const [form, setForm] = React.useState({ name: "", eventType: "nuntă", text: "" });
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const testimonial: CampaignTestimonial = { id: Date.now().toString(), ...form };
      onSaved(testimonial);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md p-6">
        <h3 className="text-white font-semibold mb-4">Adaugă testimonial</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm" placeholder="Nume client" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm" placeholder="Tip eveniment (ex: nuntă)" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} />
          <textarea className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm resize-none" rows={4} placeholder="Textul recenziei" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} required />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-neutral-700 text-neutral-400 rounded-lg hover:text-white transition-colors">Anulează</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">Adaugă</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Create Campaign Modal ────────────────────────────────────────────────────

interface CreateCampaignModalProps {
  onClose: () => void;
  onCreated: (slug: string) => void;
}

function CreateCampaignModal({ onClose, onCreated }: CreateCampaignModalProps) {
  const [slug, setSlug] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      await apiPost("/api/campaign", { slug, title });
      onCreated(slug);
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-sm p-6">
        <h3 className="text-white font-semibold mb-1">Campanie nouă</h3>
        <p className="text-neutral-500 text-xs mb-4">Pagina va fi accesibilă la /oferta/{"{slug}"}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Slug (ex: olx, smart-wedding)</label>
            <input
              className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm"
              placeholder="olx"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              required
              pattern="[a-z0-9-]+"
            />
          </div>
          <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm" placeholder="Titlu pagină" value={title} onChange={(e) => setTitle(e.target.value)} required />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-neutral-700 text-neutral-400 rounded-lg hover:text-white transition-colors">Anulează</button>
            <button type="submit" disabled={creating} className="flex-1 px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
              {creating ? "Se creează..." : "Creează"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit View ────────────────────────────────────────────────────────────────

interface EditViewProps {
  page: CampaignPage;
  state: State;
  dispatch: React.Dispatch<Action>;
  onSave: () => void;
  onDelete: () => void;
}

function EditView({ page, state, dispatch, onSave, onDelete }: EditViewProps) {
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  async function handleHeroImageUpload(file: File) {
    dispatch({ type: "SET_UPLOADING_HERO_IMAGE", value: true });
    try {
      const result = await apiUploadFile(`/api/campaign/${page.slug}/hero-image`, file);
      dispatch({ type: "PATCH_EDITING", patch: { heroImageUrl: result.url } });
    } finally {
      dispatch({ type: "SET_UPLOADING_HERO_IMAGE", value: false });
    }
  }

  async function handleHeroVideoUpload(file: File) {
    dispatch({ type: "SET_UPLOADING_HERO_VIDEO", value: true });
    try {
      const result = await apiUploadFile(`/api/campaign/${page.slug}/hero-video`, file);
      dispatch({ type: "PATCH_EDITING", patch: { heroVideoUrl: result.url } });
    } finally {
      dispatch({ type: "SET_UPLOADING_HERO_VIDEO", value: false });
    }
  }

  async function handleGalleryUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    dispatch({ type: "SET_UPLOADING_GALLERY", value: true });
    try {
      const uploads = Array.from(files).map((file) =>
        apiUploadFile(`/api/campaign/${page.slug}/gallery`, file)
      );
      const results = await Promise.all(uploads);
      const newItems = results.map((result) => ({ url: result.url, bunnyPath: result.bunnyPath ?? "" }));
      dispatch({ type: "PATCH_EDITING", patch: { gallery: [...page.gallery, ...newItems] } });
    } finally {
      dispatch({ type: "SET_UPLOADING_GALLERY", value: false });
    }
  }

  async function handleDeleteGalleryItem(url: string, bunnyPath: string) {
    dispatch({ type: "SET_DELETING_GALLERY", url });
    try {
      await apiDelete(`/api/campaign/${page.slug}/gallery`, { url, bunnyPath });
      dispatch({ type: "PATCH_EDITING", patch: { gallery: page.gallery.filter((item) => item.url !== url) } });
    } finally {
      dispatch({ type: "SET_DELETING_GALLERY", url: null });
    }
  }

  async function handleDeletePackage(packageId: string) {
    await apiDelete(`/api/campaign/${page.slug}/packages/${packageId}`);
    dispatch({ type: "PATCH_EDITING", patch: { packages: page.packages.filter((pkg) => pkg.id !== packageId) } });
  }

  async function handleDeleteTestimonial(testimonialId: string) {
    await apiDelete(`/api/campaign/${page.slug}/testimonials/${testimonialId}`);
    dispatch({ type: "PATCH_EDITING", patch: { testimonials: page.testimonials.filter((item) => item.id !== testimonialId) } });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => dispatch({ type: "CLOSE_EDIT" })} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors mb-1">← Înapoi</button>
          <h2 className="text-white font-semibold text-lg">{page.title || page.slug}</h2>
          <a href={`/oferta/${page.slug}`} target="_blank" rel="noreferrer" className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
            /oferta/{page.slug} ↗
          </a>
        </div>
        <div className="flex gap-2">
          <button onClick={onDelete} className="px-3 py-1.5 text-xs border border-red-800 text-red-400 hover:text-red-300 rounded-lg transition-colors">Șterge</button>
          <button onClick={onSave} disabled={state.saving} className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
            {state.saving ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: General + Hero ── */}
        <div className="space-y-5">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs text-neutral-400 uppercase tracking-wider">General</h3>

            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-10 h-5 rounded-full transition-colors ${page.active ? "bg-green-600" : "bg-neutral-700"}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${page.active ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <input type="checkbox" className="hidden" checked={page.active} onChange={(e) => dispatch({ type: "PATCH_EDITING", patch: { active: e.target.checked } })} />
              <span className="text-sm text-neutral-300">{page.active ? "Pagina activă" : "Pagina inactivă"}</span>
            </label>

            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Titlu</label>
              <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:border-amber-500 outline-none" value={page.title} onChange={(e) => dispatch({ type: "PATCH_EDITING", patch: { title: e.target.value } })} placeholder="Fotografie & Videografie Nuntă" />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Subtitlu</label>
              <textarea className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:border-amber-500 outline-none resize-none" rows={2} value={page.subtitle} onChange={(e) => dispatch({ type: "PATCH_EDITING", patch: { subtitle: e.target.value } })} placeholder="Momente unice, amintiri pentru o viață" />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Text buton CTA</label>
              <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:border-amber-500 outline-none" value={page.ctaText} onChange={(e) => dispatch({ type: "PATCH_EDITING", patch: { ctaText: e.target.value } })} placeholder="Scrie pe WhatsApp" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">WhatsApp</label>
                <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:border-amber-500 outline-none" value={page.whatsappNumber} onChange={(e) => dispatch({ type: "PATCH_EDITING", patch: { whatsappNumber: e.target.value } })} placeholder="+40745469907" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Telefon</label>
                <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:border-amber-500 outline-none" value={page.phoneNumber} onChange={(e) => dispatch({ type: "PATCH_EDITING", patch: { phoneNumber: e.target.value } })} placeholder="+40745469907" />
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs text-neutral-400 uppercase tracking-wider">Media Hero</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-neutral-500 mb-2">Imagine hero</p>
                <input type="file" accept="image/*" className="hidden" id="hero-img-input" onChange={(e) => { if (e.target.files?.[0]) handleHeroImageUpload(e.target.files[0]); }} />
                <label htmlFor="hero-img-input" className="block cursor-pointer">
                  {page.heroImageUrl ? (
                    <img src={page.heroImageUrl} alt="Hero" className="w-full h-24 object-cover rounded-lg" />
                  ) : (
                    <div className="w-full h-24 border-2 border-dashed border-neutral-700 rounded-lg flex items-center justify-center text-neutral-600 text-xs hover:border-neutral-500 transition-colors">
                      {state.uploadingHeroImage ? "Se uploadează..." : "Alege imagine"}
                    </div>
                  )}
                </label>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-2">Video hero</p>
                <input type="file" accept="video/mp4,video/*" className="hidden" id="hero-vid-input" onChange={(e) => { if (e.target.files?.[0]) handleHeroVideoUpload(e.target.files[0]); }} />
                <label htmlFor="hero-vid-input" className="block cursor-pointer">
                  {page.heroVideoUrl ? (
                    <video src={page.heroVideoUrl} className="w-full h-24 object-cover rounded-lg" muted />
                  ) : (
                    <div className="w-full h-24 border-2 border-dashed border-neutral-700 rounded-lg flex items-center justify-center text-neutral-600 text-xs hover:border-neutral-500 transition-colors">
                      {state.uploadingHeroVideo ? "Se uploadează..." : "Alege video"}
                    </div>
                  )}
                </label>
              </div>
            </div>
            <p className="text-xs text-neutral-600">Videoul are prioritate față de imagine dacă ambele sunt setate.</p>
          </div>
        </div>

        {/* ── Right: Gallery + Packages + Testimonials ── */}
        <div className="space-y-5">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs text-neutral-400 uppercase tracking-wider">Galerie ({page.gallery.length})</h3>
              <div>
                <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleGalleryUpload(e.target.files)} />
                <button onClick={() => galleryInputRef.current?.click()} disabled={state.uploadingGallery} className="text-xs text-amber-500 hover:text-amber-400 transition-colors disabled:opacity-50">
                  {state.uploadingGallery ? "Se uploadează..." : "+ Adaugă poze"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {page.gallery.map((item) => (
                <div key={item.url} className="relative group aspect-square">
                  <img src={item.url} alt="" className="w-full h-full object-cover rounded-lg" loading="lazy" />
                  <button
                    onClick={() => handleDeleteGalleryItem(item.url, item.bunnyPath)}
                    disabled={state.deletingGalleryUrl === item.url}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-600 text-white rounded-full text-xs items-center justify-center hidden group-hover:flex"
                  >
                    ×
                  </button>
                </div>
              ))}
              {page.gallery.length === 0 && (
                <div className="col-span-4 py-6 text-center text-neutral-600 text-xs">Nicio poză adăugată</div>
              )}
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs text-neutral-400 uppercase tracking-wider">Pachete ({page.packages.length})</h3>
              <button onClick={() => dispatch({ type: "SET_SHOW_ADD_PACKAGE", value: true })} className="text-xs text-amber-500 hover:text-amber-400 transition-colors">+ Adaugă</button>
            </div>
            <div className="space-y-2">
              {page.packages.map((pkg) => (
                <div key={pkg.id} className="flex items-start justify-between gap-2 bg-neutral-800 rounded-lg p-3">
                  <div>
                    <span className="text-white text-xs font-medium">{pkg.name}</span>
                    {pkg.highlighted && <span className="ml-2 text-[10px] text-amber-400">Popular</span>}
                    <p className="text-amber-400 text-xs mt-0.5">{pkg.price}</p>
                    <p className="text-neutral-500 text-xs mt-1">{pkg.features.length} item-uri</p>
                  </div>
                  <button onClick={() => handleDeletePackage(pkg.id)} className="text-xs text-red-500 hover:text-red-400 flex-shrink-0">Șterge</button>
                </div>
              ))}
              {page.packages.length === 0 && <p className="text-neutral-600 text-xs text-center py-4">Niciun pachet</p>}
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs text-neutral-400 uppercase tracking-wider">Testimoniale ({page.testimonials.length})</h3>
              <button onClick={() => dispatch({ type: "SET_SHOW_ADD_TESTIMONIAL", value: true })} className="text-xs text-amber-500 hover:text-amber-400 transition-colors">+ Adaugă</button>
            </div>
            <div className="space-y-2">
              {page.testimonials.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 bg-neutral-800 rounded-lg p-3">
                  <div>
                    <span className="text-white text-xs font-medium">{item.name}</span>
                    <span className="text-neutral-500 text-xs ml-2">{item.eventType}</span>
                    <p className="text-neutral-400 text-xs mt-1 line-clamp-2">{item.text}</p>
                  </div>
                  <button onClick={() => handleDeleteTestimonial(item.id)} className="text-xs text-red-500 hover:text-red-400 flex-shrink-0">Șterge</button>
                </div>
              ))}
              {page.testimonials.length === 0 && <p className="text-neutral-600 text-xs text-center py-4">Niciun testimonial</p>}
            </div>
          </div>
        </div>
      </div>

      {state.showAddPackage && (
        <AddPackageModal
          onClose={() => dispatch({ type: "SET_SHOW_ADD_PACKAGE", value: false })}
          onSaved={async (pkg) => {
            await apiPost(`/api/campaign/${page.slug}/packages`, pkg);
            dispatch({ type: "PATCH_EDITING", patch: { packages: [...page.packages, pkg] } });
            dispatch({ type: "SET_SHOW_ADD_PACKAGE", value: false });
          }}
        />
      )}

      {state.showAddTestimonial && (
        <AddTestimonialModal
          onClose={() => dispatch({ type: "SET_SHOW_ADD_TESTIMONIAL", value: false })}
          onSaved={async (testimonial) => {
            await apiPost(`/api/campaign/${page.slug}/testimonials`, testimonial);
            dispatch({ type: "PATCH_EDITING", patch: { testimonials: [...page.testimonials, testimonial] } });
            dispatch({ type: "SET_SHOW_ADD_TESTIMONIAL", value: false });
          }}
        />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CampaignAdminPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showCreate, setShowCreate] = React.useState(false);

  const loadPages = useCallback(async () => {
    dispatch({ type: "SET_LOADING", value: true });
    try {
      const data = await apiGet<{ pages: CampaignPage[] }>("/api/campaign");
      dispatch({ type: "SET_PAGES", pages: data.pages });
    } catch {
      dispatch({ type: "SET_LOADING", value: false });
    }
  }, []);

  useEffect(() => { void loadPages(); }, [loadPages]);

  async function handleSave() {
    if (!state.editingPage) return;
    dispatch({ type: "SET_SAVING", value: true });
    try {
      await apiPut(`/api/campaign/${state.editingPage.slug}`, {
        title: state.editingPage.title,
        subtitle: state.editingPage.subtitle,
        ctaText: state.editingPage.ctaText,
        whatsappNumber: state.editingPage.whatsappNumber,
        phoneNumber: state.editingPage.phoneNumber,
        active: state.editingPage.active,
      });
      dispatch({ type: "SET_PAGES", pages: state.pages.map((page) => page.slug === state.editingPage!.slug ? state.editingPage! : page) });
    } finally {
      dispatch({ type: "SET_SAVING", value: false });
    }
  }

  async function handleDelete() {
    if (!state.editingPage) return;
    if (!confirm(`Ștergi campania "${state.editingPage.slug}"? Acțiunea este ireversibilă.`)) return;
    await apiDelete(`/api/campaign/${state.editingPage.slug}`);
    dispatch({ type: "SET_PAGES", pages: state.pages.filter((page) => page.slug !== state.editingPage!.slug) });
    dispatch({ type: "CLOSE_EDIT" });
  }

  async function handleToggleActive(page: CampaignPage) {
    await apiPut(`/api/campaign/${page.slug}`, { active: !page.active });
    dispatch({ type: "SET_PAGES", pages: state.pages.map((item) => item.slug === page.slug ? { ...item, active: !item.active } : item) });
  }

  if (state.view === "edit" && state.editingPage) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white">
        <div className="max-w-[1400px] mx-auto px-4 py-6">
          <Breadcrumb />
          <EditView page={state.editingPage} state={state} dispatch={dispatch} onSave={handleSave} onDelete={handleDelete} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <Breadcrumb />
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold">Campanii Landing Page</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
          >
            + Campanie nouă
          </button>
        </div>

        {state.loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />
          </div>
        ) : state.pages.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-600 text-sm">Nicio campanie. Creează prima pagină.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.pages.map((page) => (
              <div key={page.slug} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                {page.heroImageUrl ? (
                  <img src={page.heroImageUrl} alt={page.title} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 bg-neutral-800 flex items-center justify-center">
                    <span className="text-neutral-600 text-xs">Fără imagine</span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-white font-medium text-sm">{page.title || page.slug}</h3>
                    <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${page.active ? "bg-green-900/40 text-green-400" : "bg-neutral-800 text-neutral-500"}`}>
                      {page.active ? "Activ" : "Inactiv"}
                    </span>
                  </div>
                  <p className="text-neutral-500 text-xs mb-3">/oferta/{page.slug}</p>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mb-4">
                    <span>{page.gallery?.length ?? 0} poze</span>
                    <span>·</span>
                    <span>{page.packages?.length ?? 0} pachete</span>
                    <span>·</span>
                    <span>{page.testimonials?.length ?? 0} recenzii</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => dispatch({ type: "OPEN_EDIT", page })}
                      className="flex-1 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                    >
                      Editează
                    </button>
                    <button
                      onClick={() => handleToggleActive(page)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${page.active ? "border border-neutral-700 text-neutral-400 hover:text-white" : "bg-green-900/30 text-green-400 hover:bg-green-900/50"}`}
                    >
                      {page.active ? "Dezactivează" : "Activează"}
                    </button>
                    <a href={`/oferta/${page.slug}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs border border-neutral-700 text-amber-500 hover:text-amber-400 rounded-lg transition-colors">
                      ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await loadPages();
          }}
        />
      )}
    </div>
  );
}
