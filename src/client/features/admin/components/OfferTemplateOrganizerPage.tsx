import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import AncaLoader from "../../../components/UI/AncaLoader";
import { type OfferAssetKind } from "../../../../shared/offers/offerServices";
import { MAX_PHOTO_BYTES, formatPhotoWeight, isHeavyPhoto } from "../../../../shared/media/photoWeight";
import {
  NO_EVENT, addBesideEvent, adoptOrder, eventKey, eventSwitches, eventsInOrder, formatEventLabel, groupByEvent, missingFrom, moveBeside, moveEvent, moveToEdge, replaceAt, swapSelected,
} from "./offerOrganizerOrder";
import { GALLERY_REVEAL_DESKTOP, GALLERY_REVEAL_MOBILE } from "../../../pages/Portfolio/galleryLimits";
import { galleryBlocks } from "../../../pages/Portfolio/galleryLayout";

type OfferMediaAsset = {
  id: string;
  serviceId: string;
  kind: OfferAssetKind;
  url: string;
  label: string;
  displayUrl?: string;
  sourceAlbumSlug?: string;
  // Doar în lista template-ului: mărimea fișierului afișat (pozele grele sunt ascunse vizitatorilor).
  sizeBytes?: number;
  // Dimensiunile fișierului afișat: așezarea masonry pe mobil (pozele foarte late pe tot rândul).
  width?: number;
  height?: number;
};

type ShowcaseService = {
  id: string;
  label: string;
  description: string;
  assets: OfferMediaAsset[];
  assetsMobile: OfferMediaAsset[];
};

type Device = "desktop" | "mobile";
type DropTarget = { id: string; place: "before" | "after" };

// One color per event (album), the same in the order, the event bar and the library.
// Neighbours in this list are far apart in hue, so events next to each other never look alike.
const EVENT_COLORS = ["#f59e0b", "#38bdf8", "#f472b6", "#22c55e", "#a78bfa", "#ef4444", "#2dd4bf", "#e5e5e5", "#a3e635", "#fb923c", "#6366f1", "#fde047"];
const NO_EVENT_COLOR = "#737373";
// While dragging near the top/bottom of the window, the page scrolls by itself.
const AUTO_SCROLL_EDGE = 90;
const AUTO_SCROLL_STEP = 14;

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
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  // Selected photos, in the order they were clicked (swap and replace follow this order).
  const [selected, setSelected] = useState<string[]>([]);
  // Replace mode: the selected photos wait for as many photos picked from the library.
  const [replacing, setReplacing] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<OfferMediaAsset[]>([]);
  const [focusEvent, setFocusEvent] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Array<{ device: Device; assets: OfferMediaAsset[] }>>([]);
  // The order as last loaded/saved, per device: "unsaved" = the current order differs from it.
  const [savedOrder, setSavedOrder] = useState<{ desktop: string; mobile: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // `?device=mobile` vine din butonul de admin de pe pagina publică (deschis de pe telefon).
  const [searchParams] = useSearchParams();
  const [activeDevice, setActiveDevice] = useState<Device>(() => searchParams.get("device") === "mobile" ? "mobile" : "desktop");
  const draggingIdsRef = useRef<string[]>([]);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const pointerYRef = useRef(0);

  useEffect(() => {
    if (!auth.accessToken) return;
    void Promise.all([loadShowcase(), loadLibrary()]);
  }, [auth.accessToken, serviceId]);

  const service = useMemo(
    () => services.find(item => item.id === serviceId) ?? null,
    [services, serviceId],
  );
  const dirty = Boolean(service && savedOrder && (
    service.assets.map(asset => asset.id).join() !== savedOrder.desktop
    || service.assetsMobile.map(asset => asset.id).join() !== savedOrder.mobile
  ));

  // Unsaved order: the browser asks before leaving the page.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const activeAssets = activeDevice === "desktop" ? service?.assets ?? [] : service?.assetsMobile ?? [];
  const selectedIds = new Set(activeAssets.map(asset => asset.id));
  const availableAssets = library.filter(asset => !selectedIds.has(asset.id));

  const eventColor = useMemo(() => {
    const keys = [...new Set([...library, ...(service?.assets ?? []), ...(service?.assetsMobile ?? [])].map(eventKey))]
      .filter(key => key !== NO_EVENT)
      .sort();
    const colors = new Map(keys.map((key, index) => [key, EVENT_COLORS[index % EVENT_COLORS.length]]));
    return (key: string) => colors.get(key) ?? NO_EVENT_COLOR;
  }, [library, service]);

  const availableAssetGroupsMap = new Map<string, OfferMediaAsset[]>();
  for (const asset of availableAssets) {
    const key = eventKey(asset);
    const list = availableAssetGroupsMap.get(key);
    if (list) list.push(asset);
    else availableAssetGroupsMap.set(key, [asset]);
  }
  const availableAssetGroups = Array.from(availableAssetGroupsMap.entries()).sort(([a], [b]) => {
    if (a === NO_EVENT) return 1;
    if (b === NO_EVENT) return -1;
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
      const loaded = data.services.find(item => item.id === serviceId);
      if (loaded) setSavedOrder({ desktop: loaded.assets.map(asset => asset.id).join(), mobile: loaded.assetsMobile.map(asset => asset.id).join() });
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

  /** Every change of the order goes through here: it can be undone and marks the page unsaved. */
  function replaceActiveAssets(nextAssets: OfferMediaAsset[]) {
    const field = activeDevice === "desktop" ? "assets" : "assetsMobile";
    setUndoStack(stack => [...stack.slice(-49), { device: activeDevice, assets: activeAssets }]);
    setServices(current => current.map(item => (
      item.id === serviceId ? { ...item, [field]: nextAssets } : item
    )));
  }

  function undo() {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    const field = last.device === "desktop" ? "assets" : "assetsMobile";
    setUndoStack(stack => stack.slice(0, -1));
    setActiveDevice(last.device);
    setServices(current => current.map(item => (item.id === serviceId ? { ...item, [field]: last.assets } : item)));
    setSelected([]);
  }

  function switchDevice(device: Device) {
    setActiveDevice(device);
    setSelected([]);
    setReplacing(null);
    setPicked([]);
  }

  function addAsset(asset: OfferMediaAsset) {
    if (selectedIds.has(asset.id)) return;
    replaceActiveAssets(addBesideEvent(activeAssets, [asset]));
  }

  function removeAssets(ids: string[]) {
    replaceActiveAssets(activeAssets.filter(asset => !ids.includes(asset.id)));
    setSelected(current => current.filter(id => !ids.includes(id)));
  }

  function toggleSelected(assetId: string) {
    setSelected(current => (current.includes(assetId) ? current.filter(id => id !== assetId) : [...current, assetId]));
  }

  function startReplace() {
    setReplacing(selected);
    setPicked([]);
  }

  function pickForReplace(asset: OfferMediaAsset) {
    if (!replacing || picked.some(item => item.id === asset.id)) return;
    const nextPicked = [...picked, asset];
    if (nextPicked.length < replacing.length) { setPicked(nextPicked); return; }
    replaceActiveAssets(replaceAt(activeAssets, replacing, nextPicked));
    setReplacing(null);
    setPicked([]);
    setSelected([]);
  }

  // Ctrl/Cmd+Z undoes, Escape clears the selection (or leaves replace mode).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
      if (event.key === "Escape") { setSelected([]); setReplacing(null); setPicked([]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Pointer-based drag (not native HTML5 drag-and-drop) so it works with touch as well as mouse.
  // Mouse: a click selects the photo, moving it drags. Touch: a short hold selects.
  // Dragging a selected photo moves the whole selection; the drop goes before or after the card
  // under the pointer depending on which half of it the pointer is over.
  function handleCardPointerDown(event: React.PointerEvent, assetId: string) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (replacing) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const isMouse = event.pointerType === "mouse";
    let moved = false;
    let frame = 0;

    const longPressTimer = isMouse ? 0 : window.setTimeout(() => toggleSelected(assetId), 450);

    const autoScroll = () => {
      const y = pointerYRef.current;
      if (y < AUTO_SCROLL_EDGE) window.scrollBy(0, -AUTO_SCROLL_STEP);
      else if (y > window.innerHeight - AUTO_SCROLL_EDGE) window.scrollBy(0, AUTO_SCROLL_STEP);
      frame = window.requestAnimationFrame(autoScroll);
    };

    function onMove(moveEvent: PointerEvent) {
      pointerYRef.current = moveEvent.clientY;
      if (!moved) {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;
        moved = true;
        window.clearTimeout(longPressTimer);
        const group = selected.includes(assetId) && selected.length > 1
          ? activeAssets.filter(asset => selected.includes(asset.id)).map(asset => asset.id)
          : [assetId];
        draggingIdsRef.current = group;
        setDraggingIds(group);
        frame = window.requestAnimationFrame(autoScroll);
      }
      setGhost({ x: moveEvent.clientX, y: moveEvent.clientY });
      const cardEl = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest<HTMLElement>("[data-asset-id]");
      const overId = cardEl?.dataset.assetId;
      let next: DropTarget | null = null;
      if (cardEl && overId && !draggingIdsRef.current.includes(overId)) {
        const rect = cardEl.getBoundingClientRect();
        next = { id: overId, place: moveEvent.clientX < rect.left + rect.width / 2 ? "before" : "after" };
      }
      dropTargetRef.current = next;
      setDropTarget(next);
    }

    function onUp() {
      window.clearTimeout(longPressTimer);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (moved && draggingIdsRef.current.length > 0 && dropTargetRef.current) {
        const { id, place } = dropTargetRef.current;
        replaceActiveAssets(moveBeside(activeAssets, draggingIdsRef.current, id, place));
      } else if (!moved && isMouse) {
        toggleSelected(assetId);
      }
      draggingIdsRef.current = [];
      dropTargetRef.current = null;
      setDraggingIds([]);
      setDropTarget(null);
      setGhost(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  const previewColumns = activeDevice === "desktop" ? 4 : 2;
  // Ce vede vizitatorul: pozele grele lipsesc, iar restul urcă pe pozițiile lor.
  const isHiddenFromVisitors = (asset: OfferMediaAsset) => asset.kind === "image" && isHeavyPhoto(asset.sizeBytes);
  const visitorAssets = activeAssets.filter(asset => !isHiddenFromVisitors(asset));
  const hiddenAssets = activeAssets.filter(isHiddenFromVisitors);
  const events = eventsInOrder(activeAssets);
  const mixedCount = eventSwitches(activeAssets);
  const replaceTarget = replacing?.length ?? 0;
  // On the mobile tab: the desktop photos the mobile list does not have yet, per event.
  const desktopOnly = activeDevice === "mobile" && service ? missingFrom(service.assets, service.assetsMobile) : [];
  const desktopOnlyEvents = eventsInOrder(desktopOnly);
  const revealCount = activeDevice === "desktop" ? GALLERY_REVEAL_DESKTOP : GALLERY_REVEAL_MOBILE;
  // What a position means on /oferta/olx: seen at once, or after (one more click of) "Vezi mai multe poze".
  const positionTone = (position: number) => (position <= revealCount ? "bg-emerald-600/90" : "bg-black/75");

  function renderEditableCard(asset: OfferMediaAsset, badge: string, variant: Device, position = 0) {
    const rounded = variant === "desktop" ? "rounded-2xl" : "rounded-xl";
    const marginBottom = variant === "desktop" ? "mb-3" : "mb-2";
    const selectionNumber = selected.indexOf(asset.id) + 1;
    const replaceNumber = replacing ? replacing.indexOf(asset.id) + 1 : 0;
    const isDragging = draggingIds.includes(asset.id);
    const key = eventKey(asset);
    const dimmed = (focusEvent !== null && focusEvent !== key) || (replacing !== null && replaceNumber === 0);
    const drop = dropTarget?.id === asset.id ? dropTarget.place : null;
    return (
      <article
        key={asset.id}
        data-asset-id={asset.id}
        onPointerDown={(event) => handleCardPointerDown(event, asset.id)}
        style={{ touchAction: "none", borderTopColor: eventColor(key) }}
        className={`group relative ${marginBottom} overflow-visible ${rounded} border border-t-4 bg-neutral-950 cursor-grab select-none active:cursor-grabbing transition-opacity ${
          isDragging ? "opacity-30" : dimmed ? "opacity-25" : ""
        } ${selectionNumber || replaceNumber ? "border-violet-500 ring-2 ring-violet-500" : "border-neutral-800"}`}
      >
        {drop && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 z-10 w-1 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.9)] ${drop === "before" ? "-left-2" : "-right-2"}`}
          />
        )}
        <div className={`relative overflow-hidden bg-neutral-900 ${variant === "desktop" ? "rounded-b-2xl" : "rounded-b-xl"}`}>
          {asset.kind === "video" ? (
            <video src={assetUrl(asset)} className="block aspect-video w-full object-cover" muted draggable={false} />
          ) : (
            <img src={assetUrl(asset)} alt={asset.label} className="block h-auto w-full" loading="lazy" draggable={false} />
          )}
          <div className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white pointer-events-none ${position ? positionTone(position) : "bg-black/75"}`}>
            {badge}
          </div>
          <div className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-black/75 px-2 py-0.5 text-[10px] pointer-events-none" style={{ color: eventColor(key) }}>
            {formatEventLabel(key)}
          </div>
          {(selectionNumber > 0 || replaceNumber > 0) && (
            <div className="absolute right-2 bottom-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[11px] font-bold text-white pointer-events-none">
              {replaceNumber || selectionNumber}
            </div>
          )}
          <button
            type="button"
            onClick={() => removeAssets([asset.id])}
            onPointerDown={(e) => e.stopPropagation()}
            title="Scoate din ordine"
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
      setSavedOrder({ desktop: data.assets.map(asset => asset.id).join(), mobile: data.assetsMobile.map(asset => asset.id).join() });
      setSavedAt(Date.now());
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

  const toolButton = "rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white disabled:opacity-40";

  return (
    <div>
      <Breadcrumb />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Template Oferte</p>
            <h1 className="text-2xl font-light text-white">{service.label}</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              Pune primele cele mai frumoase poze: pe site apar pe rânduri, în ordinea de aici — #1–#4 primul rând pe desktop, #1–#2 pe mobil.
            </p>
            <p className="mt-1 text-xs text-neutral-600 lg:hidden">Organizatorul e gândit pentru laptop: pe ecran mic poți doar trage pozele (ține apăsat ca să selectezi).</p>
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
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:bg-neutral-700 disabled:text-neutral-500 ${dirty ? "bg-violet-600 hover:bg-violet-500 ring-2 ring-violet-400/50" : "bg-neutral-700 hover:bg-neutral-600"}`}
            >
              {saving ? "Se salveaza..." : dirty ? "Salvează ordinea •" : "Salveaza selectia"}
            </button>
          </div>
        </div>

        {dirty && <p className="-mt-3 text-right text-xs text-amber-300">Ai modificări nesalvate (desktop și mobil se salvează împreună).</p>}
        {!dirty && savedAt && <p className="-mt-3 text-right text-xs text-emerald-400">Salvat. Pagina /oferta/olx folosește noua ordine.</p>}

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-white text-lg font-medium">Ordinea pentru client</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Click pe o poză = o selectezi (numărul arată ordinea în care le-ai ales). Trage o poză (sau toată selecția) pe altă poză:
                linia mov arată dacă ajunge înainte sau după ea. Esc deselectează, Ctrl/⌘+Z anulează.
              </p>
            </div>
            <div className="flex shrink-0 rounded-lg border border-neutral-700 p-1">
              <button
                type="button"
                onClick={() => switchDevice("desktop")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeDevice === "desktop" ? "bg-violet-600 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                <DesktopIcon /> Desktop ({service.assets.length})
              </button>
              <button
                type="button"
                onClick={() => switchDevice("mobile")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeDevice === "mobile" ? "bg-violet-600 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                <MobileIcon /> Mobil ({service.assetsMobile.length})
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-600">
            {activeDevice === "desktop"
              ? "Așa văd vizitatorii de pe laptop/calculator (4 coloane; pe tabletă 3)."
              : "Așa văd vizitatorii de pe telefon (2 coloane)."}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600 align-middle" />#1–#{revealCount}: se văd direct pe /oferta/olx</span>
            {visitorAssets.length > revealCount && (
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-neutral-600 align-middle" />#{revealCount + 1}–#{visitorAssets.length}: câte {revealCount} la fiecare „Vezi mai multe poze”</span>
            )}
          </p>

          {/* Mobile: what is on desktop but not here yet — one click adds it at the end. */}
          {desktopOnly.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-amber-100">
                  Pe desktop mai sunt <strong>{desktopOnly.length}</strong> poze care lipsesc de pe mobil.
                  <span className="ml-1 text-xs text-amber-100/60">Se adaugă la sfârșit, în ordinea de pe desktop; apoi le muți unde vrei.</span>
                </p>
                <button
                  type="button"
                  onClick={() => replaceActiveAssets([...activeAssets, ...desktopOnly])}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-amber-400"
                >
                  + Adaugă-le pe toate pe mobil
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {desktopOnlyEvents.map((key) => {
                  const photos = desktopOnly.filter(asset => eventKey(asset) === key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => replaceActiveAssets([...activeAssets, ...photos])}
                      className="flex items-center gap-1.5 rounded-full border border-amber-500/40 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-500/10"
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: eventColor(key) }} />
                      + {formatEventLabel(key)} <span className="text-amber-100/50">{photos.length}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Events: in the order their first photo appears; move a whole event, or focus on one. */}
          {events.length > 0 && (
            <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-neutral-400">
                  Evenimente în ordinea de pe site
                  {mixedCount > 0
                    ? <span className="ml-2 normal-case tracking-normal text-amber-300">· amestecate ({mixedCount} întreruperi)</span>
                    : <span className="ml-2 normal-case tracking-normal text-emerald-400">· fiecare eveniment e împreună</span>}
                </p>
                <span className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => replaceActiveAssets(adoptOrder(activeAssets, activeDevice === "mobile" ? service.assets : service.assetsMobile))}
                  className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-neutral-400 hover:text-white"
                  title="Aranjează albumele și pozele ca pe celălalt dispozitiv. Nu adaugă și nu scoate poze: cele care sunt doar aici rămân, după celelalte."
                >
                  {activeDevice === "mobile" ? "⇆ Preia ordinea de pe desktop" : "⇆ Preia ordinea de pe mobil"}
                </button>
                <button
                  type="button"
                  disabled={mixedCount === 0}
                  onClick={() => replaceActiveAssets(groupByEvent(activeAssets))}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-500"
                  title="Pune pozele fiecărui eveniment una după alta; evenimentul cu prima poză rămâne primul, ordinea din interiorul evenimentului se păstrează."
                >
                  Ține pozele fiecărui eveniment împreună
                </button>
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {events.map((key, index) => {
                  const count = activeAssets.filter(asset => eventKey(asset) === key).length;
                  const focused = focusEvent === key;
                  return (
                    <div key={key} className={`flex items-center overflow-hidden rounded-full border text-xs ${focused ? "border-white" : "border-neutral-700"}`}>
                      <button type="button" disabled={index === 0} onClick={() => replaceActiveAssets(moveEvent(activeAssets, key, -1))} className="px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30" title="Mută tot evenimentul mai sus">←</button>
                      <button
                        type="button"
                        onClick={() => setFocusEvent(focused ? null : key)}
                        className="flex items-center gap-1.5 px-2 py-1 text-neutral-200 hover:bg-neutral-800"
                        title="Evidențiază pozele acestui eveniment"
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: eventColor(key) }} />
                        {formatEventLabel(key)} <span className="text-neutral-500">{count}</span>
                      </button>
                      <button type="button" disabled={index === events.length - 1} onClick={() => replaceActiveAssets(moveEvent(activeAssets, key, 1))} className="px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30" title="Mută tot evenimentul mai jos">→</button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-neutral-600">← → mută tot evenimentul (pozele lui rămân grupate). Click pe nume = vezi doar pozele lui pe ecran.</p>
            </div>
          )}

          {/* Actions for the selection — stays on screen while scrolling. */}
          <div className="sticky top-2 z-20 mt-4">
            {replacing ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-500 bg-violet-950/95 px-3 py-2 text-sm text-violet-100 shadow-lg backdrop-blur">
                <span>Alege din bibliotecă (jos) <strong>{replaceTarget}</strong> {replaceTarget === 1 ? "poză" : "poze"} — ai ales {picked.length}/{replaceTarget}. Intră pe pozițiile numerotate, în ordine.</span>
                <button type="button" onClick={() => { setReplacing(null); setPicked([]); }} className={toolButton}>Renunță</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950/95 px-3 py-2 shadow-lg backdrop-blur">
                <span className="mr-1 text-xs text-neutral-400">
                  {selected.length > 0 ? <span className="text-violet-300">{selected.length} selectate</span> : "Nicio poză selectată"}
                </span>
                <button
                  type="button"
                  disabled={selected.length < 2 || selected.length % 2 !== 0}
                  onClick={() => { replaceActiveAssets(swapSelected(activeAssets, selected)); setSelected([]); }}
                  className={toolButton}
                  title="2 poze: își iau locul. 4, 6…: primele jumătate (în ordinea selectării) iau locul celorlalte."
                >
                  ⇄ Schimbă între ele
                </button>
                <button type="button" disabled={selected.length === 0} onClick={() => replaceActiveAssets(moveToEdge(activeAssets, selected, "start"))} className={toolButton}>⤒ Mută la început</button>
                <button type="button" disabled={selected.length === 0} onClick={() => replaceActiveAssets(moveToEdge(activeAssets, selected, "end"))} className={toolButton}>⤓ Mută la sfârșit</button>
                <button type="button" disabled={selected.length === 0 || availableAssets.length === 0} onClick={startReplace} className={toolButton}>↻ Înlocuiește din bibliotecă</button>
                <button type="button" disabled={selected.length === 0} onClick={() => removeAssets(selected)} className={`${toolButton} text-red-300`}>✕ Scoate</button>
                <button type="button" disabled={selected.length === 0} onClick={() => setSelected([])} className={toolButton}>Deselectează</button>
                <span className="flex-1" />
                <button type="button" disabled={undoStack.length === 0} onClick={undo} className={toolButton} title="Ctrl/⌘+Z">↶ Anulează</button>
              </div>
            )}
          </div>

          {visitorAssets.length > 0 ? (
            // Pozele sunt împărțite PE RÂNDURI în coloane (#1, #2, #3, #4 pe primul rând…), exact ca
            // galeria publică (PortfolioParallaxGallery: index % coloane): 4 coloane = ce vede un
            // vizitator pe laptop/monitor, 2 = telefon. CSS `columns` le-ar fi pus pe coloane
            // (#1, #2, #3 una sub alta), deci altă ordine vizuală decât pe site.
            // Același calcul ca galeria publică (galleryBlocks): pe mobil, pozele foarte late (≥ 1,7×)
            // ocupă tot rândul, iar coloanele de deasupra lor sunt egalizate.
            <div className={activeDevice === "desktop" ? "mt-5 flex flex-col gap-4" : "mt-5 mx-auto flex max-w-[360px] flex-col gap-3"}>
              {galleryBlocks(visitorAssets.map(asset => (asset.width && asset.height ? asset.width / asset.height : undefined)), previewColumns).map((block, blockIndex) => (
                block.kind === "wide" ? (
                  <div key={`wide-${visitorAssets[block.index].id}`} className="min-w-0">
                    {renderEditableCard(visitorAssets[block.index], `#${block.index + 1} · tot rândul`, activeDevice, block.index + 1)}
                  </div>
                ) : (
                  <div key={`block-${blockIndex}`} className={activeDevice === "desktop" ? "grid grid-cols-4 gap-4" : "grid grid-cols-2 gap-3"}>
                    {block.columns.map((column, columnIndex) => (
                      <div key={columnIndex} className="min-w-0">
                        {column.map(index => renderEditableCard(visitorAssets[index], `#${index + 1}`, activeDevice, index + 1))}
                      </div>
                    ))}
                  </div>
                )
              ))}
            </div>
          ) : null}
          {hiddenAssets.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm font-medium text-amber-200">Nu apar pe site — prea grele (peste {MAX_PHOTO_BYTES / 1024} KB)</p>
              <p className="mt-1 text-xs text-amber-100/70">Vizitatorii nu le primesc, iar pozele de mai sus le iau locul. Înlocuiește-le cu o variantă mai ușoară în Media Assets sau scoate-le (✕).</p>
              <div className={`mt-3 grid gap-3 ${activeDevice === "desktop" ? "grid-cols-4" : "grid-cols-2"}`}>
                {hiddenAssets.map(asset => <div key={asset.id} className="min-w-0">{renderEditableCard(asset, `ascunsă · ${formatPhotoWeight(asset.sizeBytes ?? 0)}`, activeDevice)}</div>)}
              </div>
            </div>
          )}
          {activeAssets.length === 0 && (
            <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-6 text-sm text-neutral-600">
              Nu ai selectat inca asset-uri pentru {activeDevice === "desktop" ? "desktop" : "mobil"}.
            </div>
          )}
        </section>

        <section className={`rounded-3xl border bg-neutral-900/80 p-5 ${replacing ? "border-violet-500" : "border-neutral-800"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-white text-lg font-medium">Biblioteca pentru {service.label}</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {replacing ? "Click pe pozele care intră în locul celor selectate, în ordine." : "Pozele care nu sunt în ordine, pe evenimente. Click pe „+ Adauga” o pune lângă celelalte poze din albumul ei (album nou = la sfârșit)."}
              </p>
            </div>
            <div className="text-xs text-neutral-500">{availableAssets.length} disponibile</div>
          </div>

          {availableAssetGroups.length > 0 ? (
            <div className="mt-5 space-y-6">
              {availableAssetGroups.map(([albumSlug, assets]) => (
                <div key={albumSlug}>
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: eventColor(albumSlug) }} />
                      {albumSlug === NO_EVENT ? albumSlug : `Album ${formatEventLabel(albumSlug)}`}
                      <span className="text-xs font-normal text-neutral-600">{assets.length}</span>
                    </h3>
                    {albumSlug !== NO_EVENT && !replacing && (
                      <button
                        type="button"
                        onClick={() => replaceActiveAssets(addBesideEvent(activeAssets, assets))}
                        className="text-xs font-medium text-violet-400 transition-colors hover:text-violet-300"
                      >
                        + Adauga tot albumul
                      </button>
                    )}
                  </div>
                  <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
                    {assets.map(asset => {
                      const pickNumber = picked.findIndex(item => item.id === asset.id) + 1;
                      return (
                        <article
                          key={asset.id}
                          className={`group mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-t-4 bg-neutral-950 ${pickNumber ? "ring-2 ring-violet-500" : ""}`}
                          style={{ borderColor: pickNumber ? undefined : "#262626", borderTopColor: eventColor(albumSlug) }}
                        >
                          <div className="relative bg-neutral-900">
                            {asset.kind === "video" ? (
                              <video src={assetUrl(asset)} className="block aspect-video w-full object-cover" muted />
                            ) : (
                              <img src={assetUrl(asset)} alt={asset.label} className="block h-auto w-full" loading="lazy" />
                            )}
                            {pickNumber > 0 && (
                              <div className="absolute right-2 bottom-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[11px] font-bold text-white">{pickNumber}</div>
                            )}
                            <button
                              type="button"
                              onClick={() => (replacing ? pickForReplace(asset) : addAsset(asset))}
                              className={`absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs font-semibold transition-opacity ${replacing ? "opacity-0 hover:opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                            >
                              {replacing ? (pickNumber ? `Aleasă #${pickNumber}` : `Pune pe poziția #${picked.length + 1}`) : "+ Adauga"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
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

      {/* What is being dragged, next to the pointer. */}
      {ghost && draggingIds.length > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white shadow-xl"
          style={{ left: ghost.x + 14, top: ghost.y + 14 }}
        >
          Muți {draggingIds.length} {draggingIds.length === 1 ? "poză" : "poze"}
        </div>
      )}
    </div>
  );
}
