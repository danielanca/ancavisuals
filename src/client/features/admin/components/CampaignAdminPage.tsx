import React, { useReducer, useEffect, useCallback, useState } from "react";
import Breadcrumb from "./Breadcrumb";
import type { CampaignPage, CampaignPackage } from "../../../pages/CampaignLanding/CampaignLandingPage";

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
  showStreamPicker: boolean;
  showAddPackage: boolean;
  showTestimonialPicker: boolean;
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
  | { type: "SET_SHOW_STREAM_PICKER"; value: boolean }
  | { type: "SET_SHOW_ADD_PACKAGE"; value: boolean }
  | { type: "SET_SHOW_TESTIMONIAL_PICKER"; value: boolean }
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
    case "SET_SHOW_STREAM_PICKER": return { ...state, showStreamPicker: action.value };
    case "SET_SHOW_ADD_PACKAGE": return { ...state, showAddPackage: action.value };
    case "SET_SHOW_TESTIMONIAL_PICKER": return { ...state, showTestimonialPicker: action.value };
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
  showStreamPicker: false,
  showAddPackage: false,
  showTestimonialPicker: false,
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

// ─── Stream Video Picker Modal ────────────────────────────────────────────────

interface StreamVideo {
  guid: string;
  title: string;
  thumbnailUrl: string;
  embedUrl: string;
  length: number;
}

interface StreamVideoPickerModalProps {
  onClose: () => void;
  onSelect: (video: StreamVideo) => void;
}

function StreamVideoPickerModal({ onClose, onSelect }: StreamVideoPickerModalProps) {
  const [videos, setVideos] = React.useState<StreamVideo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    apiGet<{ videos: StreamVideo[] }>("/api/campaign/stream-videos")
      .then((data) => setVideos(data.videos))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  function formatDuration(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 flex-shrink-0">
          <div>
            <h3 className="text-white font-semibold">Bunny Stream — bibliotecă</h3>
            <p className="text-neutral-500 text-xs mt-0.5">{videos.length} videoclipuri</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-red-400 text-sm text-center py-12">{error}</p>
          ) : videos.length === 0 ? (
            <p className="text-neutral-600 text-sm text-center py-12">Niciun videoclip în bibliotecă.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {videos.map((video) => (
                <button
                  key={video.guid}
                  onClick={() => { onSelect(video); onClose(); }}
                  className="group text-left rounded-xl overflow-hidden border border-neutral-800 hover:border-amber-600 transition-all bg-neutral-800/50"
                >
                  <div className="relative aspect-video bg-neutral-800 overflow-hidden">
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <svg className="w-8 h-8 text-neutral-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">{formatDuration(video.length)}</span>
                  </div>
                  <div className="p-2">
                    <p className="text-white text-xs font-medium line-clamp-2 leading-tight">{video.title}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-800 flex-shrink-0">
          <button onClick={onClose} className="w-full px-4 py-2 text-sm border border-neutral-700 text-neutral-400 rounded-lg hover:text-white transition-colors">Închide</button>
        </div>
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

type MediaSource = { id: string; url: string; label: string; kind: "asset" | "proposal" };

function EditView({ page, state, dispatch, onSave, onDelete }: EditViewProps) {
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState<"gallery" | "heroImage" | "heroVideo" | null>(null);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [collections, setCollections] = useState<Array<{ id: string; name: string; items: Array<{ url: string; sourceType: string }> }> | null>(null);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [pickerTab, setPickerTab] = useState<"assets" | "proposals">("assets");
  const [pickerSources, setPickerSources] = useState<MediaSource[] | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  const loadPickerSources = async () => {
    if (pickerSources !== null) return;
    setPickerLoading(true);
    try {
      const res = await apiFetch("/api/showcase-zones/media_footer/sources");
      if (!res.ok) return;
      const data = await res.json() as { proposals?: { id: string; photoUrl: string; fileName: string }[]; assets?: { id: string; url: string; label: string }[] };
      setPickerSources([
        ...(data.assets ?? []).map((a) => ({ id: a.id, url: a.url, label: a.label, kind: "asset" as const })),
        ...(data.proposals ?? []).map((p) => ({ id: p.id, url: p.photoUrl, label: p.fileName, kind: "proposal" as const })),
      ]);
    } finally {
      setPickerLoading(false);
    }
  };

  const openCollectionPicker = async () => {
    setShowCollectionPicker(true);
    if (collections !== null) return;
    setCollectionsLoading(true);
    try {
      const res = await apiFetch("/api/admin/photo-collections");
      const data = await res.json() as { collections: Array<{ id: string; name: string; items: Array<{ url: string; sourceType: string }> }> };
      setCollections(data.collections ?? []);
    } finally {
      setCollectionsLoading(false);
    }
  };

  const addCollection = (col: { id: string; name: string; items: Array<{ url: string; sourceType: string }> }) => {
    const existing = new Set(page.gallery.map((g) => g.url));
    const newItems = col.items.filter((i) => !existing.has(i.url)).map((i) => ({ url: i.url, bunnyPath: "" }));
    dispatch({ type: "PATCH_EDITING", patch: { gallery: [...page.gallery, ...newItems] } });
    setShowCollectionPicker(false);
  };

  const openPicker = (mode: "gallery" | "heroImage" | "heroVideo") => {
    setShowPicker(mode);
    setPickerTab(mode === "heroVideo" ? "assets" : "assets");
    loadPickerSources();
  };

  const isVideo = (url: string) => /\.(mp4|mov|webm|avi)(\?|$)/i.test(url);

  const handlePickerSelect = (item: MediaSource) => {
    if (showPicker === "gallery") {
      if (!page.gallery.some((g) => g.url === item.url)) {
        dispatch({ type: "PATCH_EDITING", patch: { gallery: [...page.gallery, { url: item.url, bunnyPath: "" }] } });
      }
    } else if (showPicker === "heroImage") {
      dispatch({ type: "PATCH_EDITING", patch: { heroImageUrl: item.url } });
      setShowPicker(null);
    } else if (showPicker === "heroVideo") {
      dispatch({ type: "PATCH_EDITING", patch: { heroVideoUrl: item.url } });
      setShowPicker(null);
    }
  };

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
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-neutral-500">Imagine hero</p>
                  <button onClick={() => openPicker("heroImage")} className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
                    {page.heroImageUrl ? "Schimbă" : "+ Alege"}
                  </button>
                </div>
                {page.heroImageUrl ? (
                  <div className="relative group">
                    <img src={page.heroImageUrl} alt="Hero" className="w-full h-24 object-cover rounded-lg" />
                    <button onClick={() => dispatch({ type: "PATCH_EDITING", patch: { heroImageUrl: "" } })}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center">×</button>
                  </div>
                ) : (
                  <div onClick={() => openPicker("heroImage")} className="w-full h-24 border-2 border-dashed border-neutral-700 rounded-lg flex items-center justify-center text-neutral-600 text-xs hover:border-amber-600 hover:text-amber-600 transition-colors cursor-pointer">
                    Din Media Assets
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-neutral-500">Video hero</p>
                  <button onClick={() => openPicker("heroVideo")} className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
                    {page.heroVideoUrl ? "Schimbă" : "+ Alege"}
                  </button>
                </div>
                {page.heroVideoUrl ? (
                  <div className="relative group">
                    <video src={page.heroVideoUrl} className="w-full h-24 object-cover rounded-lg" muted />
                    <button onClick={() => dispatch({ type: "PATCH_EDITING", patch: { heroVideoUrl: "" } })}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center">×</button>
                  </div>
                ) : (
                  <div onClick={() => openPicker("heroVideo")} className="w-full h-24 border-2 border-dashed border-neutral-700 rounded-lg flex items-center justify-center text-neutral-600 text-xs hover:border-amber-600 hover:text-amber-600 transition-colors cursor-pointer">
                    Din Media Assets
                  </div>
                )}
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
              <div className="flex items-center gap-3">
                <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleGalleryUpload(e.target.files)} />
                <button onClick={() => galleryInputRef.current?.click()} disabled={state.uploadingGallery} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50">
                  {state.uploadingGallery ? "Se uploadează..." : "↑ Upload"}
                </button>
                <button onClick={openCollectionPicker} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  📁 Colecție
                </button>
                <button onClick={() => openPicker("gallery")} className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
                  + Media Assets
                </button>
              </div>
            </div>

            {/* Media Assets / Proposals picker modal */}
            {showPicker && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowPicker(null)}>
                <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                    <h3 className="text-sm font-semibold text-white">
                      {showPicker === "heroImage" ? "Alege imagine hero" : showPicker === "heroVideo" ? "Alege video hero" : "Adaugă în galerie"}
                    </h3>
                    <button onClick={() => setShowPicker(null)} className="text-neutral-500 hover:text-white text-lg leading-none">×</button>
                  </div>
                  <div className="flex gap-0 border-b border-neutral-800">
                    {(["assets", "proposals"] as const).map((tab) => (
                      <button key={tab} onClick={() => setPickerTab(tab)} className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${pickerTab === tab ? "border-amber-500 text-amber-400" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}>
                        {tab === "assets" ? "Media Assets" : "Propuneri Instagram"}
                      </button>
                    ))}
                  </div>
                  <div className="overflow-y-auto flex-1 p-3">
                    {pickerLoading ? (
                      <p className="text-neutral-500 text-xs text-center py-8">Se încarcă...</p>
                    ) : (() => {
                      const allItems = (pickerSources ?? []).filter((s) => s.kind === (pickerTab === "assets" ? "asset" : "proposal"));
                      const items = showPicker === "heroVideo"
                        ? allItems.filter((s) => isVideo(s.url))
                        : showPicker === "heroImage"
                          ? allItems.filter((s) => !isVideo(s.url))
                          : allItems.filter((s) => !isVideo(s.url));
                      return items.length === 0 ? (
                        <p className="col-span-5 text-neutral-600 text-xs text-center py-8">
                          {showPicker === "heroVideo" ? "Niciun video găsit în Media Assets" : "Nicio sursă disponibilă"}
                        </p>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                          {items.map((item) => {
                            const already = showPicker === "gallery" && page.gallery.some((g) => g.url === item.url);
                            const isSelectedHero = (showPicker === "heroImage" && page.heroImageUrl === item.url) || (showPicker === "heroVideo" && page.heroVideoUrl === item.url);
                            return (
                              <div key={item.id} onClick={() => !already && handlePickerSelect(item)} title={item.label}
                                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${already || isSelectedHero ? "border-amber-500 opacity-60 cursor-not-allowed" : "border-transparent hover:border-amber-500"}`}
                              >
                                {isVideo(item.url) ? (
                                  <video src={item.url} className="w-full h-full object-cover" muted />
                                ) : (
                                  <img src={item.url} alt={item.label} className="w-full h-full object-cover" loading="lazy" />
                                )}
                                {(already || isSelectedHero) && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><span className="text-amber-400 text-lg">✓</span></div>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="p-3 border-t border-neutral-800 flex items-center justify-between">
                    <span className="text-xs text-neutral-600">
                      {showPicker === "gallery" ? `${page.gallery.length} poze selectate` : showPicker === "heroVideo" ? "Click pentru a selecta" : "Click pentru a selecta"}
                    </span>
                    <button onClick={() => setShowPicker(null)} className="text-sm text-white bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-lg transition-colors">
                      Gata
                    </button>
                  </div>
                </div>
              </div>
            )}
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
              <h3 className="text-xs text-neutral-400 uppercase tracking-wider">Video prezentare</h3>
              <button onClick={() => dispatch({ type: "SET_SHOW_STREAM_PICKER", value: true })} className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
                {page.videoUrl ? "Schimbă" : "+ Alege din Stream"}
              </button>
            </div>
            {page.videoUrl ? (
              <div className="space-y-2">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-neutral-800 group">
                  {/* Thumbnail static — fără autoplay */}
                  {page.videoThumbnailUrl ? (
                    <img src={page.videoThumbnailUrl} alt="Video thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-neutral-700 flex items-center justify-center">
                      <svg className="w-8 h-8 text-neutral-500" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  )}
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                    <a href={page.videoUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                      className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 border border-white/40 flex items-center justify-center transition-colors backdrop-blur-sm"
                    >
                      <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </a>
                  </div>
                </div>
                <button
                  onClick={() => dispatch({ type: "PATCH_EDITING", patch: { videoUrl: "", videoThumbnailUrl: "" } })}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors"
                >
                  Elimină video
                </button>
              </div>
            ) : (
              <p className="text-neutral-600 text-xs text-center py-4">Niciun video selectat.</p>
            )}
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

      {/* Collection picker modal */}
      {showCollectionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowCollectionPicker(false)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <h3 className="text-sm font-semibold text-white">Alege colecție</h3>
              <button onClick={() => setShowCollectionPicker(false)} className="text-neutral-500 hover:text-white text-lg">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {collectionsLoading ? (
                <p className="text-center text-neutral-500 text-sm py-8">Se încarcă...</p>
              ) : !collections?.length ? (
                <div className="text-center py-10">
                  <p className="text-neutral-600 text-sm mb-2">Nicio colecție creată</p>
                  <a href="/admin/colectii" target="_blank" rel="noreferrer" className="text-xs text-violet-400 hover:text-violet-300">Creează colecții →</a>
                </div>
              ) : (
                <div className="space-y-2">
                  {collections.map((col) => (
                    <button key={col.id} onClick={() => addCollection(col)}
                      className="w-full text-left bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-violet-600 rounded-xl p-3 transition-all"
                    >
                      <p className="text-white text-sm font-medium">{col.name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-neutral-500 text-xs">{col.items.length} poze</span>
                        <div className="flex gap-1 overflow-hidden">
                          {col.items.slice(0, 6).map((item) => (
                            <img key={item.url} src={item.url} alt="" className="w-6 h-6 object-cover rounded" />
                          ))}
                          {col.items.length > 6 && <span className="text-neutral-600 text-xs self-center">+{col.items.length - 6}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CampaignTemplate {
  id: string;
  name: string;
  title?: string;
  subtitle?: string;
  packages?: CampaignPackage[];
  gallery?: { url: string; bunnyPath: string }[];
}

export default function CampaignAdminPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showCreate, setShowCreate] = React.useState(false);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [newSlugFromTemplate, setNewSlugFromTemplate] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false);
  const [duplicatingSlug, setDuplicatingSlug] = useState<string | null>(null);
  const [duplicateNewSlug, setDuplicateNewSlug] = useState("");
  const [showDuplicateFor, setShowDuplicateFor] = useState<string | null>(null);
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

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
        heroImageUrl: state.editingPage.heroImageUrl,
        heroVideoUrl: state.editingPage.heroVideoUrl,
        videoUrl: state.editingPage.videoUrl,
        videoThumbnailUrl: state.editingPage.videoThumbnailUrl ?? "",
        gallery: state.editingPage.gallery,
      });
      dispatch({ type: "SET_PAGES", pages: state.pages.map((page) => page.slug === state.editingPage!.slug ? state.editingPage! : page) });
    } finally {
      dispatch({ type: "SET_SAVING", value: false });
    }
  }

  const loadTemplates = useCallback(async () => {
    try {
      const data = await apiGet<{ templates: CampaignTemplate[] }>("/api/campaign/templates");
      setTemplates(data.templates ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  const saveAsTemplate = async () => {
    if (!state.editingPage || !templateName.trim()) return;
    setSavingAsTemplate(true);
    try {
      const { slug: _s, active: _a, viewCount: _v, createdAt: _c, updatedAt: _u, ...pageData } = state.editingPage as unknown as Record<string, unknown>;
      await apiPost("/api/campaign/templates", { name: templateName.trim(), ...pageData });
      setTemplateName("");
      await loadTemplates();
    } finally {
      setSavingAsTemplate(false);
    }
  };

  const createFromTemplate = async () => {
    if (!selectedTemplate || !newSlugFromTemplate.trim()) return;
    setCreatingFromTemplate(true);
    try {
      const res = await apiFetch(`/api/campaign/from-template/${selectedTemplate.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: newSlugFromTemplate.trim() }),
      });
      const data = await res.json() as { slug?: string; error?: string };
      if (!res.ok) { alert(data.error ?? "Eroare"); return; }
      await loadPages();
      setShowTemplatePicker(false);
      setSelectedTemplate(null);
      setNewSlugFromTemplate("");
      const created = state.pages.find((p) => p.slug === data.slug);
      if (created) dispatch({ type: "OPEN_EDIT", page: created });
    } finally {
      setCreatingFromTemplate(false);
    }
  };

  const duplicateCampaign = async (slug: string, newSlug: string) => {
    if (!newSlug.trim()) return;
    setDuplicatingSlug(slug);
    try {
      const res = await apiFetch(`/api/campaign/${slug}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSlug: newSlug.trim() }),
      });
      const data = await res.json() as { slug?: string; error?: string };
      if (!res.ok) { alert(data.error ?? "Eroare"); return; }
      await loadPages();
      setShowDuplicateFor(null);
      setDuplicateNewSlug("");
    } finally {
      setDuplicatingSlug(null);
    }
  };

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
        {state.showStreamPicker && (
          <StreamVideoPickerModal
            onClose={() => dispatch({ type: "SET_SHOW_STREAM_PICKER", value: false })}
            onSelect={(video) => dispatch({ type: "PATCH_EDITING", patch: { videoUrl: video.embedUrl, videoThumbnailUrl: video.thumbnailUrl } })}
          />
        )}

        {/* Save as template */}
        <div className="mt-4 bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-neutral-500">Salvează această campanie ca template reutilizabil:</span>
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Nume template (ex: Nuntă Instagram)"
            className="flex-1 min-w-[200px] bg-neutral-800 text-white text-xs border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-violet-500"
            onKeyDown={(e) => { if (e.key === "Enter") saveAsTemplate(); }}
          />
          <button onClick={saveAsTemplate} disabled={savingAsTemplate || !templateName.trim()}
            className="text-xs px-4 py-2 border border-violet-700 text-violet-400 hover:bg-violet-900/20 rounded-lg transition-colors disabled:opacity-40"
          >
            {savingAsTemplate ? "Se salvează..." : "📋 Salvează ca template"}
          </button>
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
          <div className="flex gap-2">
            <button
              onClick={() => { setShowTemplatePicker(true); }}
              className="px-4 py-2 text-sm border border-violet-700 text-violet-400 hover:bg-violet-900/20 rounded-lg font-medium transition-colors"
            >
              📋 Din template
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
            >
              + Campanie nouă
            </button>
          </div>
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
                {(() => {
                  const thumb = page.heroImageUrl || page.gallery?.[0]?.url;
                  return thumb ? (
                    <img src={thumb} alt={page.title} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-neutral-800 flex items-center justify-center">
                      <span className="text-neutral-600 text-xs">Fără imagine</span>
                    </div>
                  );
                })()}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-white font-medium text-sm">{page.title || page.slug}</h3>
                    <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${page.active ? "bg-green-900/40 text-green-400" : "bg-neutral-800 text-neutral-500"}`}>
                      {page.active ? "Activ" : "Inactiv"}
                    </span>
                  </div>
                  <p className="text-neutral-500 text-xs mb-3">/oferta/{page.slug}</p>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mb-4 flex-wrap">
                    <span>{page.gallery?.length ?? 0} poze</span>
                    <span>·</span>
                    <span>{page.packages?.length ?? 0} pachete</span>
                    <span>·</span>
                    <span>{page.testimonials?.length ?? 0} recenzii</span>
                    <span>·</span>
                    <span className={`flex items-center gap-1 font-medium ${(page.viewCount ?? 0) > 0 ? "text-amber-500" : "text-neutral-600"}`}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      {page.viewCount ?? 0} vizualizări
                    </span>
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
                    <button
                      onClick={() => { setShowDuplicateFor(page.slug); setDuplicateNewSlug(`${page.slug}-2`); }}
                      className="px-3 py-1.5 text-xs border border-neutral-700 text-neutral-400 hover:text-white rounded-lg transition-colors"
                      title="Duplică campania"
                    >
                      ⎘
                    </button>
                    <a href={`/oferta/${page.slug}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs border border-neutral-700 text-amber-500 hover:text-amber-400 rounded-lg transition-colors">
                      ↗
                    </a>
                  </div>

                  {/* Duplicate inline form */}
                  {showDuplicateFor === page.slug && (
                    <div className="mt-3 p-3 bg-neutral-800 rounded-lg border border-neutral-700 flex gap-2">
                      <input
                        value={duplicateNewSlug}
                        onChange={(e) => setDuplicateNewSlug(e.target.value)}
                        placeholder="slug-nou"
                        className="flex-1 bg-neutral-900 text-white text-xs border border-neutral-600 rounded px-2 py-1.5 outline-none focus:border-amber-500"
                        onKeyDown={(e) => { if (e.key === "Enter") duplicateCampaign(page.slug, duplicateNewSlug); if (e.key === "Escape") setShowDuplicateFor(null); }}
                        autoFocus
                      />
                      <button onClick={() => duplicateCampaign(page.slug, duplicateNewSlug)} disabled={duplicatingSlug === page.slug}
                        className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                      >
                        {duplicatingSlug === page.slug ? "..." : "Duplică"}
                      </button>
                      <button onClick={() => setShowDuplicateFor(null)} className="text-xs text-neutral-500 hover:text-white px-2">✕</button>
                    </div>
                  )}
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

      {/* Template picker modal */}
      {showTemplatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowTemplatePicker(false)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-neutral-800">
              <div>
                <h3 className="text-white font-semibold">Creează din template</h3>
                <p className="text-neutral-500 text-xs mt-0.5">Alege un template și introduce slug-ul campaniei</p>
              </div>
              <button onClick={() => setShowTemplatePicker(false)} className="text-neutral-500 hover:text-white text-xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {templates.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-neutral-500 text-sm mb-1">Niciun template salvat</p>
                  <p className="text-neutral-600 text-xs">Deschide o campanie existentă → "Salvează ca template"</p>
                </div>
              ) : templates.map((tmpl) => (
                <button key={tmpl.id} onClick={() => setSelectedTemplate(tmpl)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${selectedTemplate?.id === tmpl.id ? "border-violet-600 bg-violet-900/20" : "border-neutral-800 bg-neutral-800/50 hover:border-neutral-600"}`}
                >
                  <p className="text-white text-sm font-medium">{tmpl.name}</p>
                  <p className="text-neutral-500 text-xs mt-1">
                    {tmpl.packages?.length ?? 0} pachete · {tmpl.gallery?.length ?? 0} poze
                  </p>
                </button>
              ))}
            </div>

            {selectedTemplate && (
              <div className="p-4 border-t border-neutral-800 space-y-3">
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Slug pentru campania nouă</label>
                  <input
                    value={newSlugFromTemplate}
                    onChange={(e) => setNewSlugFromTemplate(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="ex: nunta-instagram-2026"
                    className="w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-violet-500"
                    onKeyDown={(e) => { if (e.key === "Enter") createFromTemplate(); }}
                  />
                </div>
                <button onClick={createFromTemplate} disabled={creatingFromTemplate || !newSlugFromTemplate.trim()}
                  className="w-full py-2.5 bg-violet-700 hover:bg-violet-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {creatingFromTemplate ? "Se creează..." : `Creează din „${selectedTemplate.name}"`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
