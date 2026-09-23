import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import AncaLoader from "../../../components/UI/AncaLoader";
import { type OfferAssetKind } from "../../../../shared/offers/offerServices";

type OfferMediaAsset = {
  id: string;
  serviceId: string;
  kind: OfferAssetKind;
  url: string;
  label: string;
  displayUrl?: string;
  sourceAlbumSlug?: string;
};

const NO_ALBUM_GROUP = "Alte poze";

type ShowcaseService = {
  id: string;
  label: string;
  description: string;
  assets: OfferMediaAsset[];
  assetsMobile: OfferMediaAsset[];
};

type Device = "desktop" | "mobile";

function DesktopIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="13" rx="1.5" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  );
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error(`Serverul a raspuns gol (${response.status}).`);
  return JSON.parse(text) as T;
}

export default function OfferTemplateOrganizerPage() {
  const { auth } = useAuth();
  const { serviceId = "" } = useParams<{ serviceId: string }>();
  const [services, setServices] = useState<ShowcaseService[]>([]);
  const [library, setLibrary] = useState<OfferMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggingIds, setDraggingIds] = useState<string[]>([]);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [activeDevice, setActiveDevice] = useState<Device>("desktop");
  const draggingIdsRef = useRef<string[]>([]);
  const dragOverIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auth.accessToken) return;
    void Promise.all([loadShowcase(), loadLibrary()]);
  }, [auth.accessToken, serviceId]);

  const service = useMemo(
    () => services.find(item => item.id === serviceId) ?? null,
    [services, serviceId],
  );

  const activeAssets = activeDevice === "desktop" ? service?.assets ?? [] : service?.assetsMobile ?? [];
  const selectedIds = new Set(activeAssets.map(asset => asset.id));
  const availableAssets = library.filter(asset => !selectedIds.has(asset.id));

  const availableAssetGroupsMap = new Map<string, OfferMediaAsset[]>();
  for (const asset of availableAssets) {
    const key = asset.sourceAlbumSlug || NO_ALBUM_GROUP;
    const list = availableAssetGroupsMap.get(key);
    if (list) list.push(asset);
    else availableAssetGroupsMap.set(key, [asset]);
  }
  const availableAssetGroups = Array.from(availableAssetGroupsMap.entries()).sort(([a], [b]) => {
    if (a === NO_ALBUM_GROUP) return 1;
    if (b === NO_ALBUM_GROUP) return -1;
    return b.localeCompare(a);
  });
  const assetUrl = (asset: OfferMediaAsset) => asset.displayUrl ?? asset.url;

  async function loadShowcase() {
    try {
      const response = await fetch("/api/oferte/admin/template-showcase", {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await readJsonResponse<{ services?: ShowcaseService[]; error?: string }>(response);
      if (!response.ok || !data.services) throw new Error(data.error ?? "Nu am putut incarca template-ul.");
      setServices(data.services);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  async function loadLibrary() {
    try {
      const response = await fetch(`/api/oferte/admin/media-assets?serviceId=${encodeURIComponent(serviceId)}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await readJsonResponse<{ assets?: OfferMediaAsset[]; error?: string }>(response);
      if (!response.ok || !data.assets) throw new Error(data.error ?? "Nu am putut incarca biblioteca.");
      setLibrary(data.assets);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }

  function replaceActiveAssets(nextAssets: OfferMediaAsset[]) {
    const field = activeDevice === "desktop" ? "assets" : "assetsMobile";
    setServices(current => current.map(item => (
      item.id === serviceId ? { ...item, [field]: nextAssets } : item
    )));
  }

  function addAsset(asset: OfferMediaAsset) {
    if (selectedIds.has(asset.id)) return;
    replaceActiveAssets([...activeAssets, asset]);
  }

  function removeAsset(assetId: string) {
    replaceActiveAssets(activeAssets.filter(asset => asset.id !== assetId));
    setMultiSelected(current => {
      if (!current.has(assetId)) return current;
      const next = new Set(current);
      next.delete(assetId);
      return next;
    });
  }

  function moveAssetGroup(movingIds: string[], targetId: string) {
    if (movingIds.includes(targetId) || movingIds.length === 0) return;
    const movingSet = new Set(movingIds);
    const assets = [...activeAssets];
    const moving = assets.filter(asset => movingSet.has(asset.id));
    const rest = assets.filter(asset => !movingSet.has(asset.id));
    const targetIndex = rest.findIndex(asset => asset.id === targetId);
    if (targetIndex === -1) return;
    rest.splice(targetIndex, 0, ...moving);
    replaceActiveAssets(rest);
  }

  function toggleMultiSelect(assetId: string) {
    setMultiSelected(current => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  // Pointer-based drag (not native HTML5 drag-and-drop) so this works with
  // touch as well as mouse. A short hold without movement toggles the card
  // into the multi-select set; movement past a small threshold starts a
  // drag instead — of the whole multi-selection if the dragged card is part
  // of it, otherwise just that one card.
  function handleCardPointerDown(event: React.PointerEvent, assetId: string) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    const longPressTimer = window.setTimeout(() => {
      toggleMultiSelect(assetId);
    }, 450);

    function onMove(moveEvent: PointerEvent) {
      if (!moved) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.hypot(dx, dy) < 6) return;
        moved = true;
        window.clearTimeout(longPressTimer);
        const group = multiSelected.has(assetId) && multiSelected.size > 1
          ? activeAssets.filter(asset => multiSelected.has(asset.id)).map(asset => asset.id)
          : [assetId];
        draggingIdsRef.current = group;
        setDraggingIds(group);
      }
      const overEl = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const cardEl = overEl?.closest<HTMLElement>("[data-asset-id]");
      const overId = cardEl?.dataset.assetId;
      const nextOverId = overId && !draggingIdsRef.current.includes(overId) ? overId : null;
      dragOverIdRef.current = nextOverId;
      setDragOverId(nextOverId);
    }

    function onUp() {
      window.clearTimeout(longPressTimer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (moved && draggingIdsRef.current.length > 0 && dragOverIdRef.current) {
        moveAssetGroup(draggingIdsRef.current, dragOverIdRef.current);
      }
      draggingIdsRef.current = [];
      dragOverIdRef.current = null;
      setDraggingIds([]);
      setDragOverId(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function renderEditableCard(asset: OfferMediaAsset, index: number, variant: "desktop" | "mobile") {
    const rounded = variant === "desktop" ? "rounded-2xl" : "rounded-xl";
    const marginBottom = variant === "desktop" ? "mb-3" : "mb-2";
    const isSelected = multiSelected.has(asset.id);
    const isDragging = draggingIds.includes(asset.id);
    return (
      <article
        key={asset.id}
        data-asset-id={asset.id}
        onPointerDown={(event) => handleCardPointerDown(event, asset.id)}
        style={{ touchAction: "none" }}
        className={`group ${marginBottom} break-inside-avoid overflow-hidden ${rounded} border bg-neutral-950 cursor-grab select-none active:cursor-grabbing transition-opacity ${
          isDragging ? "opacity-40 border-violet-700"
          : dragOverId === asset.id ? "border-violet-500 ring-1 ring-violet-500"
          : isSelected ? "border-violet-500"
          : "border-neutral-800"
        }`}
      >
        <div className="relative bg-neutral-900">
          {asset.kind === "video" ? (
            <video src={assetUrl(asset)} className="block aspect-video w-full object-cover" muted draggable={false} />
          ) : (
            <img src={assetUrl(asset)} alt={asset.label} className="block h-auto w-full" loading="lazy" draggable={false} />
          )}
          <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white pointer-events-none">
            #{index + 1}
          </div>
          {isSelected && (
            <div className="absolute left-2 bottom-2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white pointer-events-none">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
          <button
            type="button"
            onClick={() => removeAsset(asset.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-2 top-2 rounded-full bg-red-900/80 px-2 py-0.5 text-[10px] text-red-300 opacity-0 transition-opacity group-hover:opacity-100"
          >
            ✕
          </button>
        </div>
      </article>
    );
  }

  async function saveSelection() {
    if (!service) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/oferte/admin/template-showcase/${service.id}/order`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({
          desktop: service.assets.map(asset => asset.id),
          mobile: service.assetsMobile.map(asset => asset.id),
        }),
      });
      const data = await readJsonResponse<{ assets?: OfferMediaAsset[]; assetsMobile?: OfferMediaAsset[]; error?: string }>(response);
      if (!response.ok || !data.assets || !data.assetsMobile) throw new Error(data.error ?? "Nu am putut salva selectia.");
      setServices(current => current.map(item => (
        item.id === serviceId ? { ...item, assets: data.assets!, assetsMobile: data.assetsMobile! } : item
      )));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AncaLoader />;

  if (!service) {
    return (
      <div>
        <Breadcrumb />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 text-neutral-400">
            Serviciul nu a fost gasit.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Template Oferte</p>
            <h1 className="text-2xl font-light text-white">{service.label}</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              Alege asset-urile din biblioteca globala si pune-le in ordinea in care vrei sa le vada clientul.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/media-assets"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
            >
              Media Assets
            </Link>
            <button
              type="button"
              onClick={() => void saveSelection()}
              disabled={saving}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:bg-neutral-700 disabled:text-neutral-500"
            >
              {saving ? "Se salveaza..." : "Salveaza selectia"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-white text-lg font-medium">Ordinea pentru client</h2>
              <p className="mt-1 text-sm text-neutral-500">Trage cardurile pentru reordonare. Tine apasat pe o poza ca sa selectezi mai multe, apoi trage-le pe toate odata.</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-neutral-600">
                {activeAssets.length} selectate
                {multiSelected.size > 0 && (
                  <>
                    {" · "}
                    <span className="text-violet-400">{multiSelected.size} marcate</span>
                    {" · "}
                    <button type="button" onClick={() => setMultiSelected(new Set())} className="normal-case tracking-normal text-neutral-500 underline hover:text-neutral-300">
                      deselecteaza
                    </button>
                  </>
                )}
              </p>
            </div>
            <div className="flex rounded-lg border border-neutral-700 p-1">
              <button
                type="button"
                onClick={() => { setActiveDevice("desktop"); setMultiSelected(new Set()); }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeDevice === "desktop" ? "bg-violet-600 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                <DesktopIcon /> Desktop
              </button>
              <button
                type="button"
                onClick={() => { setActiveDevice("mobile"); setMultiSelected(new Set()); }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeDevice === "mobile" ? "bg-violet-600 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                <MobileIcon /> Mobil
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-600">
            {activeDevice === "desktop"
              ? "Aceasta ordine e vazuta de vizitatorii de pe desktop."
              : "Aceasta ordine e vazuta de vizitatorii de pe mobil."}
          </p>

          {activeAssets.length > 0 ? (
            <div
              className={
                activeDevice === "desktop"
                  // Same breakpoints as the public offer gallery (OfertaPage.tsx),
                  // so what you arrange here matches exactly what the client sees.
                  ? "mt-5 columns-2 gap-3 sm:columns-3 lg:columns-4"
                  : "mt-5 mx-auto max-w-[340px] columns-2 gap-2"
              }
            >
              {activeAssets.map((asset, index) => renderEditableCard(asset, index, activeDevice))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-6 text-sm text-neutral-600">
              Nu ai selectat inca asset-uri pentru {activeDevice === "desktop" ? "desktop" : "mobil"}.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-white text-lg font-medium">Biblioteca pentru {service.label}</h2>
              <p className="mt-1 text-sm text-neutral-500">Alege rapid din asset-urile deja urcate in Bunny.</p>
            </div>
            <div className="text-xs text-neutral-500">{availableAssets.length} disponibile</div>
          </div>

          {availableAssetGroups.length > 0 ? (
            <div className="mt-5 space-y-6">
              {availableAssetGroups.map(([albumSlug, assets]) => (
                <div key={albumSlug}>
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-neutral-300">
                      {albumSlug === NO_ALBUM_GROUP ? albumSlug : `Album ${albumSlug}`}
                      <span className="ml-2 text-xs font-normal text-neutral-600">{assets.length}</span>
                    </h3>
                    {albumSlug !== NO_ALBUM_GROUP && (
                      <button
                        type="button"
                        onClick={() => replaceActiveAssets([...activeAssets, ...assets])}
                        className="text-xs font-medium text-violet-400 transition-colors hover:text-violet-300"
                      >
                        + Adauga tot albumul
                      </button>
                    )}
                  </div>
                  <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
                    {assets.map(asset => (
                      <article key={asset.id} className="group mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
                        <div className="relative bg-neutral-900">
                          {asset.kind === "video" ? (
                            <video src={assetUrl(asset)} className="block aspect-video w-full object-cover" muted />
                          ) : (
                            <img src={assetUrl(asset)} alt={asset.label} className="block h-auto w-full" loading="lazy" />
                          )}
                          <button
                            type="button"
                            onClick={() => addAsset(asset)}
                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 text-white text-xs font-semibold"
                          >
                            + Adauga
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-6 text-sm text-neutral-600">
              Nu mai exista alte asset-uri disponibile pentru acest serviciu. Daca ai nevoie de mai multe, urca-le in Media Assets.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
