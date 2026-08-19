import React, { useEffect, useRef, useState } from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import AncaLoader from "../../../components/UI/AncaLoader";
import { OFFER_SERVICES, type OfferAssetKind } from "../../../../shared/offers/offerServices";

type OfferMediaAsset = {
  id: string;
  serviceId: string;
  kind: OfferAssetKind;
  url: string;
  label: string;
  createdAt?: string;
  sourceAlbumSlug?: string;
  sourceProposalId?: string;
  displayUrl?: string;
};

type ProposalItem = {
  id: string;
  photoUrl: string;
  fileName: string;
  albumSlug: string;
  status: string;
};

type AlbumItem = { url: string; fileName: string; kind: "image" | "video" };

type ImportModal = {
  serviceId: string;
  tab: "proposals" | "album";
  proposals: ProposalItem[];
  albumSlugs: string[];
  activeAlbumSlug: string;
  albumPhotos: AlbumItem[];
  selected: Map<string, string>; // url → fileName
  loadingProposals: boolean;
  loadingAlbum: boolean;
  importing: boolean;
  importError: string | null;
} | null;

const DIRECT_SOURCE = "__direct__";

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error(`Serverul a raspuns gol (${response.status}).`);
  return JSON.parse(text) as T;
}

function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").pop()?.split("?")[0] ?? "photo.jpg";
  } catch {
    return url.split("/").pop()?.split("?")[0] ?? "photo.jpg";
  }
}

function groupBySource(assets: OfferMediaAsset[]): Map<string, OfferMediaAsset[]> {
  const groups = new Map<string, OfferMediaAsset[]>();
  for (const asset of assets) {
    const key = asset.sourceAlbumSlug || DIRECT_SOURCE;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(asset);
  }
  return groups;
}

function assetUrl(asset: OfferMediaAsset): string {
  return asset.displayUrl ?? asset.url;
}

export default function MediaAssetsAdminPage() {
  const { auth } = useAuth();
  const [assets, setAssets] = useState<OfferMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingServiceId, setUploadingServiceId] = useState<string | null>(null);
  const [importModal, setImportModal] = useState<ImportModal>(null);
  const [lightbox, setLightbox] = useState<OfferMediaAsset | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [deleteGroupModal, setDeleteGroupModal] = useState<{ serviceId: string; sourceAlbumSlug: string; label: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessSummary, setReprocessSummary] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!auth.accessToken) return;
    void loadAssets();
    void fetch("/api/admin/ui-state", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then(r => r.json())
      .then((data: { mediaAssetsCollapsed?: string[] }) => {
        if (Array.isArray(data.mediaAssetsCollapsed)) {
          setCollapsed(new Set(data.mediaAssetsCollapsed));
        }
      })
      .catch(() => {});
  }, [auth.accessToken]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  async function loadAssets() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/oferte/admin/media-assets", {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await readJsonResponse<{ assets?: OfferMediaAsset[]; error?: string }>(response);
      if (!response.ok || !data.assets) throw new Error(data.error ?? "Nu am putut incarca asset-urile.");
      setAssets(data.assets);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles(serviceId: string, files: File[]) {
    if (files.length === 0) return;
    setUploadingServiceId(serviceId);
    setError(null);
    try {
      const formData = new FormData();
      files.forEach(file => formData.append("files", file));
      const response = await fetch(`/api/oferte/admin/media-assets/upload/${serviceId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        body: formData,
      });
      const data = await readJsonResponse<{ assets?: OfferMediaAsset[]; error?: string }>(response);
      if (!response.ok || !data.assets) throw new Error(data.error ?? "Upload esuat.");
      setAssets(current => [...data.assets!, ...current]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setUploadingServiceId(null);
    }
  }

  async function deleteAsset(assetId: string) {
    if (!confirm("Stergi asset-ul din biblioteca globala?")) return;
    setError(null);
    try {
      const response = await fetch(`/api/oferte/admin/media-assets/${assetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await readJsonResponse<{ ok?: boolean; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Stergerea a esuat.");
      setAssets(current => current.filter(asset => asset.id !== assetId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  }

  async function handleDeleteGroup() {
    if (!deleteGroupModal || deleteConfirmText !== deleteGroupModal.label) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/oferte/admin/media-assets/by-source", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({
          sourceAlbumSlug: deleteGroupModal.sourceAlbumSlug,
          serviceId: deleteGroupModal.serviceId,
        }),
      });
      const data = await readJsonResponse<{ ok?: boolean; deleted?: number; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Eroare la stergere.");
      setAssets(current => current.filter(asset =>
        !(asset.sourceAlbumSlug === deleteGroupModal.sourceAlbumSlug && asset.serviceId === deleteGroupModal.serviceId)
      ));
      setDeleteGroupModal(null);
      setDeleteConfirmText("");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setDeleting(false);
    }
  }

  function toggleCollapse(key: string) {
    setCollapsed(current => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      void fetch("/api/admin/ui-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ mediaAssetsCollapsed: Array.from(next) }),
      }).catch(() => {});
      return next;
    });
  }

  async function openImportModal(serviceId: string) {
    const isVideo = serviceId === "video";
    setImportModal({
      serviceId,
      tab: isVideo ? "album" : "proposals",
      proposals: [],
      albumSlugs: [],
      activeAlbumSlug: "",
      albumPhotos: [],
      selected: new Map(),
      loadingProposals: !isVideo,
      loadingAlbum: false,
      importing: false,
      importError: null,
    });

    try {
      const albumsUrl = isVideo
        ? "/api/album/admin/list?hasShortVideo=true"
        : "/api/album/admin/list";

      if (isVideo) {
        const albumsResponse = await fetch(albumsUrl, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
        const albumsData = await readJsonResponse<{ slugs?: string[] }>(albumsResponse);
        setImportModal(current => current ? { ...current, albumSlugs: albumsData.slugs ?? [] } : null);
      } else {
        const [proposalsResponse, albumsResponse] = await Promise.all([
          fetch("/api/instagram-proposals/admin/all", { headers: { Authorization: `Bearer ${auth.accessToken}` } }),
          fetch(albumsUrl, { headers: { Authorization: `Bearer ${auth.accessToken}` } }),
        ]);
        const proposalsData = await readJsonResponse<{ proposals?: ProposalItem[] }>(proposalsResponse);
        const albumsData = await readJsonResponse<{ slugs?: string[] }>(albumsResponse);
        setImportModal(current => current ? {
          ...current,
          proposals: (proposalsData.proposals ?? []).filter(p => p.status === "accepted" || p.status === "pending"),
          albumSlugs: albumsData.slugs ?? [],
          loadingProposals: false,
        } : null);
      }
    } catch {
      setImportModal(current => current ? { ...current, loadingProposals: false } : null);
    }
  }

  async function loadAlbumPhotos(slug: string) {
    if (!slug) return;
    setImportModal(current => current ? { ...current, activeAlbumSlug: slug, loadingAlbum: true, albumPhotos: [] } : null);
    try {
      const response = await fetch(`/api/album/${slug}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await readJsonResponse<{ photos?: string[]; shortvideo?: string | null }>(response);
      // `photos` este lista de `photos_preview` (WebP), cu fallback la originale doar pentru albumele vechi.
      const source = data.photos ?? [];
      const albumPhotos: AlbumItem[] = [
        ...source.map(url => ({ url, fileName: fileNameFromUrl(url), kind: "image" as const })),
        ...(data.shortvideo ? [{ url: data.shortvideo, fileName: fileNameFromUrl(data.shortvideo), kind: "video" as const }] : []),
      ];
      setImportModal(current => current ? { ...current, albumPhotos, loadingAlbum: false } : null);
    } catch {
      setImportModal(current => current ? { ...current, loadingAlbum: false } : null);
    }
  }

  async function reprocessAlbumImports() {
    setReprocessing(true);
    setError(null);
    setReprocessSummary(null);
    try {
      const response = await fetch("/api/oferte/admin/media-assets/reprocess-originals", {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await readJsonResponse<{ fixed?: number; skipped?: number; total?: number; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Nu am putut optimiza importurile.");
      setReprocessSummary(`${data.fixed ?? 0} din ${data.total ?? 0} asset-uri importate au fost actualizate la preview WebP.${data.skipped ? ` ${data.skipped} au fost sarite.` : ""}`);
      await loadAssets();
    } catch (reprocessError) {
      setError(reprocessError instanceof Error ? reprocessError.message : String(reprocessError));
    } finally {
      setReprocessing(false);
    }
  }

  function toggleImportItem(url: string, fileName: string) {
    setImportModal(current => {
      if (!current) return null;
      const next = new Map(current.selected);
      next.has(url) ? next.delete(url) : next.set(url, fileName);
      return { ...current, selected: next };
    });
  }

  async function submitImport() {
    if (!importModal || importModal.selected.size === 0) return;
    setImportModal(current => current ? { ...current, importing: true, importError: null } : null);
    try {
      const items = Array.from(importModal.selected.entries()).map(([url, fileName]) => ({ url, fileName }));
      const body: Record<string, unknown> = { items, serviceId: importModal.serviceId };
      if (importModal.tab === "album" && importModal.activeAlbumSlug) {
        body.sourceAlbumSlug = importModal.activeAlbumSlug;
      }
      const response = await fetch("/api/oferte/admin/media-assets/import-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await readJsonResponse<{ assets?: OfferMediaAsset[]; error?: string }>(response);
      if (!response.ok || !data.assets) throw new Error(data.error ?? "Import esuat.");
      setAssets(current => [...data.assets!, ...current]);
      setImportModal(null);
    } catch (importError) {
      setImportModal(current => current ? {
        ...current,
        importing: false,
        importError: importError instanceof Error ? importError.message : String(importError),
      } : null);
    }
  }

  if (loading) return <AncaLoader />;

  return (
    <div>
      <Breadcrumb />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-light text-white">Media Assets</h1>
            <p className="text-sm text-neutral-500">
              Biblioteca globala pentru poze si video folosite in oferte. Fisierele sunt urcate in Bunny sub <code className="text-neutral-400">offers-assets/</code>, independent de galeriile de album.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void reprocessAlbumImports()}
            disabled={reprocessing}
            className="shrink-0 rounded-lg border border-teal-800 px-4 py-2 text-sm text-teal-300 transition-colors hover:border-teal-600 hover:text-teal-200 disabled:border-neutral-800 disabled:text-neutral-600"
          >
            {reprocessing ? "Se optimizeaza..." : "Optimizeaza importurile din albume"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {reprocessSummary && (
          <div className="rounded-xl border border-teal-900 bg-teal-950/30 px-4 py-3 text-sm text-teal-200">
            {reprocessSummary}
          </div>
        )}

        <div className="space-y-5">
          {OFFER_SERVICES.map(service => {
            const serviceAssets = assets.filter(asset => asset.serviceId === service.id);
            const groups = groupBySource(serviceAssets);
            const groupKeys = [
              ...(groups.has(DIRECT_SOURCE) ? [DIRECT_SOURCE] : []),
              ...[...groups.keys()].filter(k => k !== DIRECT_SOURCE).sort(),
            ];

            return (
              <section key={service.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-white text-lg font-medium">{service.label}</h2>
                    <p className="mt-1 text-sm text-neutral-500 max-w-2xl">{service.description}</p>
                  </div>
                  <div className="text-xs text-neutral-500 shrink-0">{serviceAssets.length} asset-uri</div>
                </div>

                {/* Upload zone */}
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const files = Array.from(event.dataTransfer.files).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
                    void uploadFiles(service.id, files);
                  }}
                  className="mt-5 rounded-2xl border border-dashed border-neutral-700 bg-neutral-950/70 p-6 text-center"
                >
                  <input
                    ref={(node) => { fileInputs.current[service.id] = node; }}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      void uploadFiles(service.id, files);
                      event.currentTarget.value = "";
                    }}
                  />
                  <p className="text-sm text-white">Drag & drop poze sau video aici</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {"sau "}
                    <button type="button" onClick={() => fileInputs.current[service.id]?.click()} className="text-violet-400 hover:text-violet-300 transition-colors">
                      selecteaza fisiere
                    </button>
                    {" · "}
                    <button type="button" onClick={() => void openImportModal(service.id)} className="text-teal-400 hover:text-teal-300 transition-colors">
                      importa din propuneri sau album
                    </button>
                  </p>
                  {uploadingServiceId === service.id && (
                    <p className="mt-3 text-xs text-amber-400">Se uploadeaza asset-urile...</p>
                  )}
                </div>

                {/* Grouped assets */}
                {groupKeys.length > 0 && (
                  <div className="mt-5 space-y-3">
                    {groupKeys.map(groupKey => {
                      const groupAssets = groups.get(groupKey) ?? [];
                      const collapseKey = `${service.id}:${groupKey}`;
                      const isCollapsed = collapsed.has(collapseKey);
                      const label = groupKey === DIRECT_SOURCE ? "De pe computer / mobil" : groupKey;

                      return (
                        <div key={groupKey} className="rounded-xl border border-neutral-800 bg-neutral-950/40">
                          <button
                            type="button"
                            onClick={() => toggleCollapse(collapseKey)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <svg
                                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                strokeLinecap="round" strokeLinejoin="round"
                                className={`shrink-0 text-neutral-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                              <span className={`truncate text-sm font-medium ${groupKey === DIRECT_SOURCE ? "text-neutral-400" : "text-teal-400"}`}>
                                {label}
                              </span>
                              {groupKey !== DIRECT_SOURCE && (
                                <span className="shrink-0 text-[10px] text-neutral-600 border border-neutral-800 rounded px-1.5 py-0.5">album</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-neutral-600">{groupAssets.length}</span>
                              {groupKey !== DIRECT_SOURCE && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteGroupModal({ serviceId: service.id, sourceAlbumSlug: groupKey, label });
                                    setDeleteConfirmText("");
                                    setDeleteError(null);
                                  }}
                                  className="rounded-md border border-red-900 px-2 py-0.5 text-[11px] text-red-500 hover:border-red-700 hover:text-red-400 transition-colors"
                                >
                                  Șterge
                                </button>
                              )}
                            </div>
                          </button>

                          {!isCollapsed && (
                            <div className="columns-2 gap-3 px-4 pb-4 sm:columns-3 lg:columns-4 xl:columns-5">
                              {groupAssets.map(asset => (
                                <article key={asset.id} className="group mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
                                  <div className="relative bg-neutral-900 cursor-zoom-in" onClick={() => setLightbox(asset)}>
                                    {asset.kind === "video" ? (
                                      <video src={assetUrl(asset)} className="w-full" muted draggable={false} />
                                    ) : (
                                      <img src={assetUrl(asset)} alt={asset.label} className="w-full" loading="lazy" draggable={false} />
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); void deleteAsset(asset.id); }}
                                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-sm text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                                      aria-label="Sterge asset"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {serviceAssets.length === 0 && (
                  <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-6 text-sm text-neutral-600">
                    Nu exista inca asset-uri pentru acest serviciu.
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Delete group modal */}
      {deleteGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-900/60 bg-neutral-950 p-6 space-y-5">
            <div>
              <h2 className="text-white font-medium text-base">Șterge toate pozele din album</h2>
              <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                Această acțiune va șterge permanent toate pozele din{" "}
                <span className="text-white font-medium">"{deleteGroupModal.label}"</span>{" "}
                din serviciul{" "}
                <span className="text-white font-medium">{OFFER_SERVICES.find(s => s.id === deleteGroupModal.serviceId)?.label}</span>.{" "}
                Fișierele vor fi eliminate și din Bunny. Acțiunea este ireversibilă.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-neutral-500">
                Scrie <span className="font-mono text-neutral-300 select-all">{deleteGroupModal.label}</span> pentru a confirma:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && deleteConfirmText === deleteGroupModal.label) void handleDeleteGroup(); }}
                placeholder={deleteGroupModal.label}
                autoFocus
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm text-white placeholder-neutral-700 focus:border-red-800 outline-none font-mono"
              />
            </div>
            {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setDeleteGroupModal(null); setDeleteConfirmText(""); setDeleteError(null); }}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
              >
                Anulează
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== deleteGroupModal.label || deleting}
                onClick={() => void handleDeleteGroup()}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:bg-neutral-800 disabled:text-neutral-600 transition-colors"
              >
                {deleting ? "Se șterge..." : "Șterge definitiv"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 text-lg"
          >
            ×
          </button>
          {lightbox.kind === "video" ? (
            <video
              src={assetUrl(lightbox)}
              controls
              autoPlay
              className="max-h-[90vh] max-w-full rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={assetUrl(lightbox)}
              alt={lightbox.label}
              className="max-h-[90vh] max-w-full rounded-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {lightbox.sourceAlbumSlug && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs text-neutral-300">
              {lightbox.sourceAlbumSlug}
            </div>
          )}
        </div>
      )}

      {/* Import modal */}
      {importModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(event) => { if (event.target === event.currentTarget) setImportModal(null); }}
        >
          <div className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950">
            <div className="flex items-center justify-between gap-4 border-b border-neutral-800 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Import in</p>
                <h2 className="text-lg font-medium text-white">
                  {OFFER_SERVICES.find(s => s.id === importModal.serviceId)?.label}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setImportModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="flex border-b border-neutral-800 px-6">
              {(["proposals", "album"] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setImportModal(current => current ? { ...current, tab, selected: new Map() } : null)}
                  className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    importModal.tab === tab ? "border-violet-500 text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {tab === "proposals" ? "Propuneri acceptate" : "Din album"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {importModal.tab === "proposals" && (
                importModal.loadingProposals ? (
                  <div className="flex items-center justify-center py-12 text-sm text-neutral-500">Se incarca propunerile...</div>
                ) : importModal.proposals.length === 0 ? (
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-8 text-center text-sm text-neutral-600">
                    Nu exista propuneri acceptate sau in asteptare.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {importModal.proposals.map(proposal => {
                      const isSelected = importModal.selected.has(proposal.photoUrl);
                      return (
                        <button
                          key={proposal.id}
                          type="button"
                          onClick={() => toggleImportItem(proposal.photoUrl, proposal.fileName)}
                          className={`group relative overflow-hidden rounded-2xl border transition-colors ${isSelected ? "border-violet-500" : "border-neutral-800 hover:border-neutral-600"}`}
                        >
                          <div className="h-32 bg-neutral-900">
                            <img src={proposal.photoUrl} alt={proposal.fileName} className="h-full w-full object-cover" loading="lazy" />
                          </div>
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-violet-500/30">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-sm text-white font-bold">✓</span>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                            <p className="truncate text-[10px] text-neutral-300">{proposal.albumSlug}</p>
                            <p className={`text-[10px] ${proposal.status === "accepted" ? "text-green-400" : "text-amber-400"}`}>
                              {proposal.status === "accepted" ? "Acceptat" : "In asteptare"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              )}

              {importModal.tab === "album" && (
                <div className="space-y-4">
                  <select
                    value={importModal.activeAlbumSlug}
                    onChange={(event) => void loadAlbumPhotos(event.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm text-white"
                  >
                    <option value="">Alege un album...</option>
                    {importModal.albumSlugs.map(slug => (
                      <option key={slug} value={slug}>{slug}</option>
                    ))}
                  </select>

                  {importModal.loadingAlbum && (
                    <div className="flex items-center justify-center py-12 text-sm text-neutral-500">Se incarca albumul...</div>
                  )}

                  {!importModal.loadingAlbum && importModal.albumPhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {importModal.albumPhotos.map(item => {
                        const isSelected = importModal.selected.has(item.url);
                        return (
                          <button
                            key={item.url}
                            type="button"
                            onClick={() => toggleImportItem(item.url, item.fileName)}
                            className={`group relative overflow-hidden rounded-2xl border transition-colors ${isSelected ? "border-violet-500" : "border-neutral-800 hover:border-neutral-600"}`}
                          >
                            <div className="h-32 bg-neutral-900">
                              {item.kind === "video" ? (
                                <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                              ) : (
                                <img src={item.url} alt={item.fileName} className="h-full w-full object-cover" loading="lazy" />
                              )}
                            </div>
                            {item.kind === "video" && !isSelected && (
                              <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-teal-300 pointer-events-none">
                                Video
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 flex items-center justify-center bg-violet-500/30">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-sm text-white font-bold">✓</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-neutral-800 px-6 py-4">
              <div className="text-sm text-neutral-500">
                {importModal.selected.size > 0
                  ? `${importModal.selected.size} ${importModal.selected.size === 1 ? "poza selectata" : "poze selectate"}`
                  : "Selecteaza pozele pe care vrei sa le importi"}
              </div>
              <div className="flex items-center gap-3">
                {importModal.importError && <p className="text-xs text-red-400">{importModal.importError}</p>}
                <button type="button" onClick={() => setImportModal(null)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500">
                  Anuleaza
                </button>
                <button
                  type="button"
                  onClick={() => void submitImport()}
                  disabled={importModal.selected.size === 0 || importModal.importing}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:bg-neutral-700 disabled:text-neutral-500"
                >
                  {importModal.importing ? "Se importa..." : `Import (${importModal.selected.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
