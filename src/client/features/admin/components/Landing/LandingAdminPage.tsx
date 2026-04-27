import React, { useReducer, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../auth/useAuth";
import Breadcrumb from "../Breadcrumb";

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTab = "hero" | "gallery" | "reviews" | "services" | "stats" | "faq";

interface HeroData {
  videoUrl: string;
  tagline: string;
  subtitlu: string;
  ctaText: string;
}

interface GalleryImage {
  id: string;
  url: string;
  altText: string;
  order: number;
}

interface Review {
  id: string;
  autor: string;
  tipEveniment: string;
  text: string;
  rating: number;
  pinned: boolean;
  visible: boolean;
}

interface Service {
  id: string;
  slug: string;
  titlu: string;
  descriere: string;
  includes: string[];
  videoUrl: string;
  imageUrl: string;
  order: number;
  visible: boolean;
}

interface Stats {
  evenimente: number;
  aniExperienta: number;
  ratingGoogle: number;
}

interface FaqItem {
  id: string;
  intrebare: string;
  raspuns: string;
  order: number;
}

interface State {
  activeTab: ActiveTab;
  hero: Partial<HeroData>;
  gallery: GalleryImage[];
  reviews: Review[];
  services: Service[];
  stats: Partial<Stats>;
  faqItems: FaqItem[];
  loadingHero: boolean;
  loadingGallery: boolean;
  loadingReviews: boolean;
  loadingServices: boolean;
  loadingStats: boolean;
  loadingFaq: boolean;
  savingHero: boolean;
  savingStats: boolean;
  showAddReview: boolean;
  showAddService: boolean;
  showAddFaq: boolean;
  uploadingGallery: boolean;
  uploadingVideo: string | null;
  deletingId: string | null;
}

type Action =
  | { type: "SET_TAB"; tab: ActiveTab }
  | { type: "SET_HERO"; hero: Partial<HeroData> }
  | { type: "SET_HERO_FIELD"; key: keyof HeroData; value: string }
  | { type: "SET_GALLERY"; gallery: GalleryImage[] }
  | { type: "SET_REVIEWS"; reviews: Review[] }
  | { type: "SET_SERVICES"; services: Service[] }
  | { type: "SET_STATS"; stats: Partial<Stats> }
  | { type: "SET_STATS_FIELD"; key: keyof Stats; value: number }
  | { type: "SET_FAQ"; faqItems: FaqItem[] }
  | { type: "SET_LOADING"; key: keyof State; value: boolean }
  | { type: "SET_SAVING_HERO"; value: boolean }
  | { type: "SET_SAVING_STATS"; value: boolean }
  | { type: "SET_SHOW_ADD_REVIEW"; value: boolean }
  | { type: "SET_SHOW_ADD_SERVICE"; value: boolean }
  | { type: "SET_SHOW_ADD_FAQ"; value: boolean }
  | { type: "SET_UPLOADING_GALLERY"; value: boolean }
  | { type: "SET_UPLOADING_VIDEO"; id: string | null }
  | { type: "SET_DELETING"; id: string | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TAB": return { ...state, activeTab: action.tab };
    case "SET_HERO": return { ...state, hero: action.hero, loadingHero: false };
    case "SET_HERO_FIELD": return { ...state, hero: { ...state.hero, [action.key]: action.value } };
    case "SET_GALLERY": return { ...state, gallery: action.gallery, loadingGallery: false };
    case "SET_REVIEWS": return { ...state, reviews: action.reviews, loadingReviews: false };
    case "SET_SERVICES": return { ...state, services: action.services, loadingServices: false };
    case "SET_STATS": return { ...state, stats: action.stats, loadingStats: false };
    case "SET_STATS_FIELD": return { ...state, stats: { ...state.stats, [action.key]: action.value } };
    case "SET_FAQ": return { ...state, faqItems: action.faqItems, loadingFaq: false };
    case "SET_LOADING": return { ...state, [action.key]: action.value };
    case "SET_SAVING_HERO": return { ...state, savingHero: action.value };
    case "SET_SAVING_STATS": return { ...state, savingStats: action.value };
    case "SET_SHOW_ADD_REVIEW": return { ...state, showAddReview: action.value };
    case "SET_SHOW_ADD_SERVICE": return { ...state, showAddService: action.value };
    case "SET_SHOW_ADD_FAQ": return { ...state, showAddFaq: action.value };
    case "SET_UPLOADING_GALLERY": return { ...state, uploadingGallery: action.value };
    case "SET_UPLOADING_VIDEO": return { ...state, uploadingVideo: action.id };
    case "SET_DELETING": return { ...state, deletingId: action.id };
    default: return state;
  }
}

const initialState: State = {
  activeTab: "hero",
  hero: {},
  gallery: [],
  reviews: [],
  services: [],
  stats: {},
  faqItems: [],
  loadingHero: true,
  loadingGallery: false,
  loadingReviews: false,
  loadingServices: false,
  loadingStats: false,
  loadingFaq: false,
  savingHero: false,
  savingStats: false,
  showAddReview: false,
  showAddService: false,
  showAddFaq: false,
  uploadingGallery: false,
  uploadingVideo: null,
  deletingId: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

async function apiPut(path: string, body: unknown) {
  const response = await apiFetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
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

async function apiDelete(path: string) {
  const response = await apiFetch(path, { method: "DELETE" });
  if (!response.ok) throw new Error(await response.text());
}

async function apiUploadFile(path: string, file: File, extraFields?: Record<string, string>) {
  const { getAuth } = await import("firebase/auth");
  const token = await getAuth().currentUser?.getIdToken();
  const formData = new FormData();
  formData.append("file", file);
  if (extraFields) {
    Object.entries(extraFields).forEach(([key, value]) => formData.append(key, value));
  }
  const response = await fetch(path, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{ url: string }>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface AddReviewModalProps {
  onClose: () => void;
  onSaved: (review: Review) => void;
}

function AddReviewModal({ onClose, onSaved }: AddReviewModalProps) {
  const [form, setForm] = React.useState({ autor: "", tipEveniment: "nunta", text: "", rating: 5, pinned: false, visible: true });
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiPost("/api/landing/reviews", form);
      onSaved({ ...form, id: result.id as string });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md p-6">
        <h3 className="text-white font-semibold mb-4">Adaugă recenzie</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm" placeholder="Autor" value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} required />
          <select className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm" value={form.tipEveniment} onChange={(e) => setForm({ ...form, tipEveniment: e.target.value })}>
            <option value="nunta">Nuntă</option>
            <option value="botez">Botez</option>
            <option value="corporate">Corporate</option>
            <option value="petrecere">Petrecere</option>
            <option value="altele">Altele</option>
          </select>
          <textarea className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm resize-none" rows={4} placeholder="Textul recenziei" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} required />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-neutral-400 mb-1 block">Rating (1-5)</label>
              <input type="number" min={1} max={5} className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} />
            </div>
            <div className="flex items-end gap-3 pb-2">
              <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
                Pinned
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />
                Vizibil
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-neutral-700 text-neutral-400 rounded-lg hover:text-white transition-colors">Anulează</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
              {saving ? "Se salvează..." : "Salvează"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddFaqModalProps {
  onClose: () => void;
  onSaved: (item: FaqItem) => void;
  nextOrder: number;
}

function AddFaqModal({ onClose, onSaved, nextOrder }: AddFaqModalProps) {
  const [form, setForm] = React.useState({ intrebare: "", raspuns: "" });
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiPost("/api/landing/faq", form);
      onSaved({ ...form, id: result.id as string, order: nextOrder });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md p-6">
        <h3 className="text-white font-semibold mb-4">Adaugă întrebare FAQ</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm" placeholder="Întrebarea" value={form.intrebare} onChange={(e) => setForm({ ...form, intrebare: e.target.value })} required />
          <textarea className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm resize-none" rows={4} placeholder="Răspunsul" value={form.raspuns} onChange={(e) => setForm({ ...form, raspuns: e.target.value })} required />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-neutral-700 text-neutral-400 rounded-lg hover:text-white transition-colors">Anulează</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
              {saving ? "Se salvează..." : "Salvează"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddServiceModalProps {
  onClose: () => void;
  onSaved: (service: Service) => void;
  nextOrder: number;
}

function AddServiceModal({ onClose, onSaved, nextOrder }: AddServiceModalProps) {
  const [form, setForm] = React.useState({ slug: "", titlu: "", descriere: "", includes: "", order: nextOrder, visible: true });
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const includesArray = form.includes.split("\n").map((line) => line.trim()).filter(Boolean);
      const payload = { ...form, includes: includesArray, videoUrl: "", imageUrl: "" };
      const result = await apiPost("/api/landing/services", payload);
      onSaved({ ...payload, id: result.id as string });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md p-6">
        <h3 className="text-white font-semibold mb-4">Adaugă serviciu</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm" placeholder="Slug (ex: nunta-foto-video)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
          <input className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm" placeholder="Titlu" value={form.titlu} onChange={(e) => setForm({ ...form, titlu: e.target.value })} required />
          <textarea className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm resize-none" rows={3} placeholder="Descriere" value={form.descriere} onChange={(e) => setForm({ ...form, descriere: e.target.value })} />
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Ce include (câte un item pe rând)</label>
            <textarea className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm resize-none" rows={4} placeholder="Fotografie\nFilmare\nAlbum online" value={form.includes} onChange={(e) => setForm({ ...form, includes: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />
            Vizibil pe landing
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-neutral-700 text-neutral-400 rounded-lg hover:text-white transition-colors">Anulează</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
              {saving ? "Se salvează..." : "Salvează"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Preview panel ────────────────────────────────────────────────────────────

interface PreviewPanelProps {
  activeTab: ActiveTab;
  hero: Partial<HeroData>;
  gallery: GalleryImage[];
  reviews: Review[];
  services: Service[];
  stats: Partial<Stats>;
  faqItems: FaqItem[];
}

function PreviewPanel({ activeTab, hero, gallery, reviews, services, stats, faqItems }: PreviewPanelProps) {
  const previewContent = useMemo(() => {
    switch (activeTab) {
      case "hero":
        return (
          <div className="relative bg-neutral-900 rounded-lg overflow-hidden aspect-video flex items-end">
            {hero.videoUrl ? (
              <video src={hero.videoUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" muted autoPlay loop playsInline />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center">
                <span className="text-neutral-600 text-xs">Niciun video</span>
              </div>
            )}
            <div className="relative z-10 p-4 w-full bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-amber-400 text-xs font-medium mb-1">{hero.tagline || "Tagline..."}</p>
              <p className="text-white text-sm font-light mb-3">{hero.subtitlu || "Subtitlu..."}</p>
              <button className="px-4 py-1.5 bg-amber-500 text-black text-xs font-semibold rounded">{hero.ctaText || "CTA..."}</button>
            </div>
          </div>
        );

      case "gallery":
        return (
          <div className="columns-2 gap-2">
            {gallery.slice(0, 12).map((image) => (
              <div key={image.id} className="mb-2 break-inside-avoid">
                <img src={image.url} alt={image.altText} className="w-full rounded object-cover" loading="lazy" />
              </div>
            ))}
            {gallery.length === 0 && <p className="text-neutral-500 text-xs text-center py-8">Nicio imagine</p>}
          </div>
        );

      case "reviews":
        return (
          <div className="space-y-3">
            {reviews.filter((review) => review.visible).slice(0, 3).map((review) => (
              <div key={review.id} className="bg-neutral-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-xs font-medium">{review.autor}</span>
                  <span className="text-amber-400 text-xs">{"★".repeat(review.rating)}</span>
                </div>
                <span className="text-neutral-400 text-xs capitalize">{review.tipEveniment}</span>
                <p className="text-neutral-300 text-xs mt-1 line-clamp-2">{review.text}</p>
              </div>
            ))}
            {reviews.length === 0 && <p className="text-neutral-500 text-xs text-center py-8">Nicio recenzie</p>}
          </div>
        );

      case "services":
        return (
          <div className="space-y-3">
            {services.filter((service) => service.visible).slice(0, 3).map((service) => (
              <div key={service.id} className="bg-neutral-800 rounded-lg overflow-hidden">
                {service.imageUrl && <img src={service.imageUrl} alt={service.titlu} className="w-full h-24 object-cover" />}
                <div className="p-3">
                  <h4 className="text-white text-xs font-semibold">{service.titlu}</h4>
                  <p className="text-neutral-400 text-xs mt-1 line-clamp-2">{service.descriere}</p>
                </div>
              </div>
            ))}
            {services.length === 0 && <p className="text-neutral-500 text-xs text-center py-8">Niciun serviciu</p>}
          </div>
        );

      case "stats":
        return (
          <div className="flex gap-4 justify-center py-6">
            {[
              { label: "Evenimente", value: stats.evenimente ?? "—" },
              { label: "Ani experiență", value: stats.aniExperienta ?? "—" },
              { label: "Rating Google", value: stats.ratingGoogle ? `${stats.ratingGoogle}★` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-amber-400 text-2xl font-bold">{value}</div>
                <div className="text-neutral-400 text-xs mt-1">{label}</div>
              </div>
            ))}
          </div>
        );

      case "faq":
        return (
          <div className="space-y-2">
            {faqItems.map((item) => (
              <div key={item.id} className="bg-neutral-800 rounded-lg p-3">
                <p className="text-white text-xs font-medium">{item.intrebare}</p>
                <p className="text-neutral-400 text-xs mt-1">{item.raspuns}</p>
              </div>
            ))}
            {faqItems.length === 0 && <p className="text-neutral-500 text-xs text-center py-8">Nicio întrebare</p>}
          </div>
        );
    }
  }, [activeTab, hero, gallery, reviews, services, stats, faqItems]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-neutral-500 uppercase tracking-widest">Preview</span>
        <a href="/" target="_blank" rel="noreferrer" className="text-xs text-amber-500 hover:text-amber-400 transition-colors">Deschide landing →</a>
      </div>
      <div className="flex-1 overflow-y-auto bg-neutral-950 rounded-xl border border-neutral-800 p-4 text-sm">
        {previewContent}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const TABS: { key: ActiveTab; label: string }[] = [
  { key: "hero", label: "Hero" },
  { key: "gallery", label: "Galerie" },
  { key: "reviews", label: "Recenzii" },
  { key: "services", label: "Servicii" },
  { key: "stats", label: "Statistici" },
  { key: "faq", label: "FAQ" },
];

export default function LandingAdminPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHero();
    loadStats();
  }, []);

  useEffect(() => {
    if (state.activeTab === "gallery" && state.gallery.length === 0 && state.loadingGallery === false) loadGallery();
    if (state.activeTab === "reviews" && state.reviews.length === 0 && state.loadingReviews === false) loadReviews();
    if (state.activeTab === "services" && state.services.length === 0 && state.loadingServices === false) loadServices();
    if (state.activeTab === "faq" && state.faqItems.length === 0 && state.loadingFaq === false) loadFaq();
  }, [state.activeTab]);

  async function loadHero() {
    dispatch({ type: "SET_LOADING", key: "loadingHero", value: true });
    try {
      const data = await apiGet<Partial<HeroData>>("/api/landing/hero");
      dispatch({ type: "SET_HERO", hero: data });
    } catch {
      dispatch({ type: "SET_LOADING", key: "loadingHero", value: false });
    }
  }

  async function loadGallery() {
    dispatch({ type: "SET_LOADING", key: "loadingGallery", value: true });
    try {
      const data = await apiGet<{ images: GalleryImage[] }>("/api/landing/gallery");
      dispatch({ type: "SET_GALLERY", gallery: data.images });
    } catch {
      dispatch({ type: "SET_LOADING", key: "loadingGallery", value: false });
    }
  }

  async function loadReviews() {
    dispatch({ type: "SET_LOADING", key: "loadingReviews", value: true });
    try {
      const data = await apiGet<{ reviews: Review[] }>("/api/landing/reviews");
      dispatch({ type: "SET_REVIEWS", reviews: data.reviews });
    } catch {
      dispatch({ type: "SET_LOADING", key: "loadingReviews", value: false });
    }
  }

  async function loadServices() {
    dispatch({ type: "SET_LOADING", key: "loadingServices", value: true });
    try {
      const data = await apiGet<{ services: Service[] }>("/api/landing/services");
      dispatch({ type: "SET_SERVICES", services: data.services });
    } catch {
      dispatch({ type: "SET_LOADING", key: "loadingServices", value: false });
    }
  }

  async function loadStats() {
    dispatch({ type: "SET_LOADING", key: "loadingStats", value: true });
    try {
      const data = await apiGet<Partial<Stats>>("/api/landing/stats");
      dispatch({ type: "SET_STATS", stats: data });
    } catch {
      dispatch({ type: "SET_LOADING", key: "loadingStats", value: false });
    }
  }

  async function loadFaq() {
    dispatch({ type: "SET_LOADING", key: "loadingFaq", value: true });
    try {
      const data = await apiGet<{ items: FaqItem[] }>("/api/landing/faq");
      dispatch({ type: "SET_FAQ", faqItems: data.items });
    } catch {
      dispatch({ type: "SET_LOADING", key: "loadingFaq", value: false });
    }
  }

  async function saveHero() {
    dispatch({ type: "SET_SAVING_HERO", value: true });
    try {
      await apiPut("/api/landing/hero", state.hero);
    } finally {
      dispatch({ type: "SET_SAVING_HERO", value: false });
    }
  }

  async function saveStats() {
    dispatch({ type: "SET_SAVING_STATS", value: true });
    try {
      await apiPut("/api/landing/stats", state.stats);
    } finally {
      dispatch({ type: "SET_SAVING_STATS", value: false });
    }
  }

  async function handleGalleryUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    dispatch({ type: "SET_UPLOADING_GALLERY", value: true });
    try {
      const uploadPromises = Array.from(files).map((file) =>
        apiUploadFile("/api/landing/gallery/upload", file, { altText: file.name.replace(/\.[^.]+$/, "") })
      );
      await Promise.all(uploadPromises);
      await loadGallery();
    } finally {
      dispatch({ type: "SET_UPLOADING_GALLERY", value: false });
    }
  }

  async function handleDeleteGalleryImage(id: string) {
    dispatch({ type: "SET_DELETING", id });
    try {
      await apiDelete(`/api/landing/gallery/${id}`);
      dispatch({ type: "SET_GALLERY", gallery: state.gallery.filter((image) => image.id !== id) });
    } finally {
      dispatch({ type: "SET_DELETING", id: null });
    }
  }

  async function handleDeleteReview(id: string) {
    dispatch({ type: "SET_DELETING", id });
    try {
      await apiDelete(`/api/landing/reviews/${id}`);
      dispatch({ type: "SET_REVIEWS", reviews: state.reviews.filter((review) => review.id !== id) });
    } finally {
      dispatch({ type: "SET_DELETING", id: null });
    }
  }

  async function handleToggleReviewVisible(review: Review) {
    await apiPut(`/api/landing/reviews/${review.id}`, { visible: !review.visible });
    dispatch({ type: "SET_REVIEWS", reviews: state.reviews.map((reviewItem) => reviewItem.id === review.id ? { ...reviewItem, visible: !reviewItem.visible } : reviewItem) });
  }

  async function handleToggleReviewPinned(review: Review) {
    await apiPut(`/api/landing/reviews/${review.id}`, { pinned: !review.pinned });
    dispatch({ type: "SET_REVIEWS", reviews: state.reviews.map((reviewItem) => reviewItem.id === review.id ? { ...reviewItem, pinned: !reviewItem.pinned } : reviewItem) });
  }

  async function handleDeleteService(id: string) {
    dispatch({ type: "SET_DELETING", id });
    try {
      await apiDelete(`/api/landing/services/${id}`);
      dispatch({ type: "SET_SERVICES", services: state.services.filter((service) => service.id !== id) });
    } finally {
      dispatch({ type: "SET_DELETING", id: null });
    }
  }

  async function handleServiceVideoUpload(serviceId: string, slug: string, file: File) {
    dispatch({ type: "SET_UPLOADING_VIDEO", id: serviceId });
    try {
      const result = await apiUploadFile(`/api/landing/services/${serviceId}/upload-video`, file, { slug });
      dispatch({
        type: "SET_SERVICES",
        services: state.services.map((service) => service.id === serviceId ? { ...service, videoUrl: result.url } : service),
      });
    } finally {
      dispatch({ type: "SET_UPLOADING_VIDEO", id: null });
    }
  }

  async function handleServiceImageUpload(serviceId: string, file: File) {
    dispatch({ type: "SET_UPLOADING_VIDEO", id: `img-${serviceId}` });
    try {
      const result = await apiUploadFile(`/api/landing/services/${serviceId}/upload-image`, file);
      dispatch({
        type: "SET_SERVICES",
        services: state.services.map((service) => service.id === serviceId ? { ...service, imageUrl: result.url } : service),
      });
    } finally {
      dispatch({ type: "SET_UPLOADING_VIDEO", id: null });
    }
  }

  async function handleHeroVideoUpload(file: File) {
    dispatch({ type: "SET_UPLOADING_VIDEO", id: "hero" });
    try {
      const result = await apiUploadFile("/api/landing/hero/upload-video", file);
      dispatch({ type: "SET_HERO_FIELD", key: "videoUrl", value: result.url });
    } finally {
      dispatch({ type: "SET_UPLOADING_VIDEO", id: null });
    }
  }

  async function handleDeleteFaq(id: string) {
    dispatch({ type: "SET_DELETING", id });
    try {
      await apiDelete(`/api/landing/faq/${id}`);
      dispatch({ type: "SET_FAQ", faqItems: state.faqItems.filter((item) => item.id !== id) });
    } finally {
      dispatch({ type: "SET_DELETING", id: null });
    }
  }

  const renderEditPanel = useMemo(() => {
    switch (state.activeTab) {
      case "hero":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Video Hero (MP4)</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="video/mp4,video/*"
                  className="hidden"
                  id="hero-video-input"
                  onChange={(event) => { if (event.target.files?.[0]) handleHeroVideoUpload(event.target.files[0]); }}
                />
                <label htmlFor="hero-video-input" className="px-3 py-2 text-xs border border-neutral-700 text-neutral-400 rounded-lg hover:border-neutral-500 hover:text-white transition-colors cursor-pointer">
                  {state.uploadingVideo === "hero" ? "Se uploadează..." : "Alege video"}
                </label>
                {state.hero.videoUrl && (
                  <a href={state.hero.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-amber-500 hover:underline truncate max-w-[200px]">Video curent</a>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Tagline</label>
              <input
                className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:border-amber-500 outline-none transition-colors"
                value={state.hero.tagline ?? ""}
                onChange={(event) => dispatch({ type: "SET_HERO_FIELD", key: "tagline", value: event.target.value })}
                placeholder="Momente care rămân pentru totdeauna"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Subtitlu</label>
              <input
                className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:border-amber-500 outline-none transition-colors"
                value={state.hero.subtitlu ?? ""}
                onChange={(event) => dispatch({ type: "SET_HERO_FIELD", key: "subtitlu", value: event.target.value })}
                placeholder="Fotografie și videografie pentru nunți, botezuri și evenimente corporate"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Text CTA</label>
              <input
                className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:border-amber-500 outline-none transition-colors"
                value={state.hero.ctaText ?? ""}
                onChange={(event) => dispatch({ type: "SET_HERO_FIELD", key: "ctaText", value: event.target.value })}
                placeholder="Solicită ofertă"
              />
            </div>
            <button
              onClick={saveHero}
              disabled={state.savingHero}
              className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {state.savingHero ? "Se salvează..." : "Salvează Hero"}
            </button>
          </div>
        );

      case "gallery":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">{state.gallery.length} imagini</span>
              <div className="flex gap-2">
                <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => handleGalleryUpload(event.target.files)} />
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={state.uploadingGallery}
                  className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {state.uploadingGallery ? "Se uploadează..." : "Adaugă imagini"}
                </button>
              </div>
            </div>
            {state.loadingGallery ? (
              <p className="text-neutral-500 text-xs text-center py-8">Se încarcă...</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {state.gallery.map((image) => (
                  <div key={image.id} className="relative group aspect-square">
                    <img src={image.url} alt={image.altText} className="w-full h-full object-cover rounded-lg" loading="lazy" />
                    <button
                      onClick={() => handleDeleteGalleryImage(image.id)}
                      disabled={state.deletingId === image.id}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full text-xs items-center justify-center hidden group-hover:flex"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "reviews":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">{state.reviews.length} recenzii</span>
              <button
                onClick={() => dispatch({ type: "SET_SHOW_ADD_REVIEW", value: true })}
                className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
              >
                Adaugă
              </button>
            </div>
            {state.loadingReviews ? (
              <p className="text-neutral-500 text-xs text-center py-8">Se încarcă...</p>
            ) : (
              <div className="space-y-2">
                {state.reviews.map((review) => (
                  <div key={review.id} className="bg-neutral-800 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-xs font-medium">{review.autor}</span>
                          <span className="text-amber-400 text-xs">{"★".repeat(review.rating)}</span>
                          {review.pinned && <span className="text-xs text-amber-600 font-medium">📌</span>}
                          {!review.visible && <span className="text-xs text-neutral-500">Ascuns</span>}
                        </div>
                        <span className="text-neutral-500 text-xs capitalize">{review.tipEveniment}</span>
                        <p className="text-neutral-400 text-xs mt-1 line-clamp-2">{review.text}</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => handleToggleReviewPinned(review)} className="text-xs text-neutral-400 hover:text-amber-400 transition-colors" title={review.pinned ? "Desprinde" : "Fixează"}>📌</button>
                        <button onClick={() => handleToggleReviewVisible(review)} className="text-xs text-neutral-400 hover:text-white transition-colors" title={review.visible ? "Ascunde" : "Arată"}>
                          {review.visible ? "👁" : "🙈"}
                        </button>
                        <button
                          onClick={() => handleDeleteReview(review.id)}
                          disabled={state.deletingId === review.id}
                          className="text-xs text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          Șterge
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "services":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">{state.services.length} servicii</span>
              <button
                onClick={() => dispatch({ type: "SET_SHOW_ADD_SERVICE", value: true })}
                className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
              >
                Adaugă
              </button>
            </div>
            {state.loadingServices ? (
              <p className="text-neutral-500 text-xs text-center py-8">Se încarcă...</p>
            ) : (
              <div className="space-y-3">
                {state.services.map((service) => (
                  <div key={service.id} className="bg-neutral-800 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white text-xs font-medium">{service.titlu}</span>
                          <span className="text-neutral-500 text-xs">/{service.slug}</span>
                          {!service.visible && <span className="text-xs text-neutral-500">Ascuns</span>}
                        </div>
                        <p className="text-neutral-400 text-xs line-clamp-2">{service.descriere}</p>
                        <div className="flex gap-2 mt-2">
                          <div>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id={`img-upload-${service.id}`}
                              onChange={(event) => { if (event.target.files?.[0]) handleServiceImageUpload(service.id, event.target.files[0]); }}
                            />
                            <label htmlFor={`img-upload-${service.id}`} className="text-xs text-neutral-400 hover:text-white cursor-pointer transition-colors">
                              {state.uploadingVideo === `img-${service.id}` ? "Se uploadează..." : service.imageUrl ? "Schimbă imagine" : "Adaugă imagine"}
                            </label>
                          </div>
                          <span className="text-neutral-600">·</span>
                          <div>
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              id={`vid-upload-${service.id}`}
                              onChange={(event) => { if (event.target.files?.[0]) handleServiceVideoUpload(service.id, service.slug, event.target.files[0]); }}
                            />
                            <label htmlFor={`vid-upload-${service.id}`} className="text-xs text-neutral-400 hover:text-white cursor-pointer transition-colors">
                              {state.uploadingVideo === service.id ? "Se uploadează..." : service.videoUrl ? "Schimbă video" : "Adaugă video"}
                            </label>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteService(service.id)}
                        disabled={state.deletingId === service.id}
                        className="text-xs text-red-500 hover:text-red-400 transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        Șterge
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "stats":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Număr evenimente</label>
              <input
                type="number"
                className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:border-amber-500 outline-none transition-colors"
                value={state.stats.evenimente ?? ""}
                onChange={(event) => dispatch({ type: "SET_STATS_FIELD", key: "evenimente", value: Number(event.target.value) })}
                placeholder="150"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Ani experiență</label>
              <input
                type="number"
                className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:border-amber-500 outline-none transition-colors"
                value={state.stats.aniExperienta ?? ""}
                onChange={(event) => dispatch({ type: "SET_STATS_FIELD", key: "aniExperienta", value: Number(event.target.value) })}
                placeholder="8"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Rating Google</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:border-amber-500 outline-none transition-colors"
                value={state.stats.ratingGoogle ?? ""}
                onChange={(event) => dispatch({ type: "SET_STATS_FIELD", key: "ratingGoogle", value: Number(event.target.value) })}
                placeholder="5.0"
              />
            </div>
            <button
              onClick={saveStats}
              disabled={state.savingStats}
              className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {state.savingStats ? "Se salvează..." : "Salvează Statistici"}
            </button>
          </div>
        );

      case "faq":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">{state.faqItems.length} întrebări</span>
              <button
                onClick={() => dispatch({ type: "SET_SHOW_ADD_FAQ", value: true })}
                className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
              >
                Adaugă
              </button>
            </div>
            {state.loadingFaq ? (
              <p className="text-neutral-500 text-xs text-center py-8">Se încarcă...</p>
            ) : (
              <div className="space-y-2">
                {state.faqItems.map((item) => (
                  <div key={item.id} className="bg-neutral-800 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium">{item.intrebare}</p>
                        <p className="text-neutral-400 text-xs mt-1 line-clamp-2">{item.raspuns}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteFaq(item.id)}
                        disabled={state.deletingId === item.id}
                        className="text-xs text-red-500 hover:text-red-400 transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        Șterge
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
    }
  }, [state]);

  if (!auth.authorise) return null;

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <Breadcrumb />
        <h1 className="text-lg font-semibold mb-6">CMS Landing Page</h1>

        <div className="flex gap-1 mb-6 border-b border-neutral-800 pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => dispatch({ type: "SET_TAB", tab: tab.key })}
              className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
                state.activeTab === tab.key
                  ? "text-amber-400 border-b-2 border-amber-400"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:min-h-[600px]">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 overflow-y-auto">
            {renderEditPanel}
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <PreviewPanel
              activeTab={state.activeTab}
              hero={state.hero}
              gallery={state.gallery}
              reviews={state.reviews}
              services={state.services}
              stats={state.stats}
              faqItems={state.faqItems}
            />
          </div>
        </div>
      </div>

      {state.showAddReview && (
        <AddReviewModal
          onClose={() => dispatch({ type: "SET_SHOW_ADD_REVIEW", value: false })}
          onSaved={(review) => {
            dispatch({ type: "SET_REVIEWS", reviews: [...state.reviews, review] });
            dispatch({ type: "SET_SHOW_ADD_REVIEW", value: false });
          }}
        />
      )}

      {state.showAddService && (
        <AddServiceModal
          onClose={() => dispatch({ type: "SET_SHOW_ADD_SERVICE", value: false })}
          onSaved={(service) => {
            dispatch({ type: "SET_SERVICES", services: [...state.services, service] });
            dispatch({ type: "SET_SHOW_ADD_SERVICE", value: false });
          }}
          nextOrder={state.services.length}
        />
      )}

      {state.showAddFaq && (
        <AddFaqModal
          onClose={() => dispatch({ type: "SET_SHOW_ADD_FAQ", value: false })}
          onSaved={(item) => {
            dispatch({ type: "SET_FAQ", faqItems: [...state.faqItems, item] });
            dispatch({ type: "SET_SHOW_ADD_FAQ", value: false });
          }}
          nextOrder={state.faqItems.length}
        />
      )}
    </div>
  );
}
