import { useEffect, useMemo, useReducer, useRef, useState, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import useAuth from "../../features/admin/auth/useAuth";
import BunnyPhotoGallery from "../Portfolio/BunnyPhotoGallery";
import styles from "./MediaAlbumPage.module.scss";
import type { Album } from "./AlbumTypes";
import AlbumNotFound from "./AlbumNotFound";
import AlbumPager from "../Portfolio/AlbumPager";
import DeliveryForm from './DeliveryForm';
import DeliveryAddressModal from "../DeliveryAddress/AddressList";
import PhotoLightbox from "./PhotoLightbox";
import OnboardingWizard from "./Onboardingwizard";
import MediaConsentModal from "./MediaConsentModal";
import AncaLoader from "../../components/UI/AncaLoader";

// ── TYPES ────────────────────────────────────────────────────────────────────

type AlbumWithPrint = Album & {
  print?: string[];
};

type GalleryMode = "none" | "print" | "download";

type GalleryState = {
  mode: GalleryMode;
  browsePage: number;
  printPage: number;
  downloadPage: number;
  selectedPrint: Set<string>;
  selectedDownload: Set<string>;
  shareUrl: string | null;
  shareError: string | null;
};

type GalleryAction =
  | { type: "SET_MODE"; payload: GalleryMode }
  | { type: "SET_PAGE"; mode: GalleryMode; page: number }
  | { type: "TOGGLE_PHOTO"; mode: "print" | "download"; name: string }
  | { type: "SELECT_PAGE"; mode: "print" | "download"; names: string[]; selectAll: boolean }
  | { type: "SET_SELECTED_PRINT"; payload: Set<string> }
  | { type: "SET_SHARE_URL"; url: string | null; error: string | null }
  | { type: "CLOSE_MODE"; currentPage: number }
  | { type: "OPEN_PRINT_MODE"; initial: Set<string>; currentPage: number }
  | { type: "OPEN_DOWNLOAD_MODE"; currentPage: number }
  | { type: "HYDRATE"; payload: Partial<GalleryState> };

type PersistedStateV3 = {
  v: 3;
  mode: GalleryMode;
  browsePage: number;
  printPage: number;
  downloadPage: number;
  selectedPrint: string[];
  selectedDownload: string[];
};

type ShareCreateResponse = {
  id?: string;
};

type AdminWindow = Window & {
  adminClickCount?: number;
  adminClickTimeout?: number | null;
};

// ── REDUCER ──────────────────────────────────────────────────────────────────

const initialGalleryState: GalleryState = {
  mode: "none",
  browsePage: 1,
  printPage: 1,
  downloadPage: 1,
  selectedPrint: new Set(),
  selectedDownload: new Set(),
  shareUrl: null,
  shareError: null,
};

function galleryReducer(state: GalleryState, action: GalleryAction): GalleryState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.payload };

    case "SET_PAGE": {
      if (action.mode === "download") return { ...state, downloadPage: action.page };
      if (action.mode === "print") return { ...state, printPage: action.page };
      return { ...state, browsePage: action.page };
    }

    case "TOGGLE_PHOTO": {
      const setKey = action.mode === "print" ? "selectedPrint" : "selectedDownload";
      const next = new Set(state[setKey]);
      next.has(action.name) ? next.delete(action.name) : next.add(action.name);
      return { ...state, [setKey]: next };
    }

    case "SELECT_PAGE": {
      const setKey = action.mode === "print" ? "selectedPrint" : "selectedDownload";
      const next = new Set(state[setKey]);
      if (action.selectAll) action.names.forEach((name) => next.delete(name));
      else action.names.forEach((name) => next.add(name));
      return { ...state, [setKey]: next };
    }

    case "SET_SELECTED_PRINT":
      return { ...state, selectedPrint: action.payload };

    case "SET_SHARE_URL":
      return { ...state, shareUrl: action.url, shareError: action.error };

    case "CLOSE_MODE":
      return { ...state, mode: "none", browsePage: action.currentPage, shareUrl: null, shareError: null };

    case "OPEN_PRINT_MODE":
      return { ...state, mode: "print", selectedPrint: action.initial, printPage: action.currentPage, shareUrl: null, shareError: null };

    case "OPEN_DOWNLOAD_MODE":
      return { ...state, mode: "download", selectedDownload: new Set(), downloadPage: action.currentPage, shareUrl: null, shareError: null };

    case "HYDRATE":
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

const isMobileNow = () => (typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false);

const storageKeyFor = (slug: string) => `av:album:${slug}:state`;

const safeParse = (raw: string | null): PersistedStateV3 | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedStateV3;
  } catch {
    return null;
  }
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const fmtBytes = (n: number) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let value = n;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
};

const fileNameFromUrl = (src: string) => {
  try {
    const pathname = new URL(src).pathname;
    const last = pathname.split("/").pop() || "";
    return decodeURIComponent(last);
  } catch {
    const clean = src.split("?")[0].split("#")[0];
    const last = clean.split("/").pop() || clean;
    return decodeURIComponent(last);
  }
};

const getSwissUrl = async (slug: string) => {
  const response = await fetch(`/api/album/${slug}/delivery-address`);
  if (response.ok) {
    const json = await response.json();
    return json.data.swissLink;
  }
  return "";
};

// ── MOBILE COLUMNS TOGGLE ────────────────────────────────────────────────────

function MobileColumnsToggle({
  mobileColumns,
  onMobileColumnsChange,
}: {
  mobileColumns: 1 | 2;
  onMobileColumnsChange: (columns: 1 | 2) => void;
}) {
  return (
    <div className={styles.gridToggle}>
      <button
        className={`${styles.gridBtn} ${mobileColumns === 1 ? styles.gridBtnActive : ""}`}
        type="button"
        onClick={() => onMobileColumnsChange(1)}
        aria-label="1 coloană"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      </button>
      <button
        className={`${styles.gridBtn} ${mobileColumns === 2 ? styles.gridBtnActive : ""}`}
        type="button"
        onClick={() => onMobileColumnsChange(2)}
        aria-label="2 coloane"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="4" width="8" height="16" rx="2" />
          <rect x="13" y="4" width="8" height="16" rx="2" />
        </svg>
      </button>
    </div>
  );
}

// ── COMPONENT ────────────────────────────────────────────────────────────────

export default function MediaAlbumPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { auth } = useAuth();

  const [moderationMode, setModerationMode] = useState(false);
  const isModerationMode = moderationMode;

  const pageFromUrl = Number(searchParams.get("page") ?? "1");

  const [album, setAlbum] = useState<AlbumWithPrint | null>(null);
  const [loading, setLoading] = useState(true);
  const [gallery, dispatch] = useReducer(galleryReducer, initialGalleryState);

  const [savingPrint, setSavingPrint] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [showAdminButton, setShowAdminButton] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [swissLink, setSwissLink] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mobileColumns, setMobileColumns] = useState<1 | 2>(2);

  const [selectedModeration, setSelectedModeration] = useState<Set<string>>(new Set());
  const [showModerationSubmitModal, setShowModerationSubmitModal] = useState(false);
  const [moderationNote, setModerationNote] = useState("");
  const [submittingModeration, setSubmittingModeration] = useState(false);
  const [moderationSubmitResult, setModerationSubmitResult] = useState<string | null>(null);

  type InstagramProposal = {
    id: string;
    photoUrl: string;
    fileName: string;
    proposedBy: string;
    proposedAt: string;
    status: "pending" | "posted" | "rejected";
  };
  const [igProposals, setIgProposals] = useState<InstagramProposal[]>([]);
  const [igProposeMode, setIgProposeMode] = useState(false);
  const [selectedIgPropose, setSelectedIgPropose] = useState<Set<string>>(new Set());
  const [submittingIgPropose, setSubmittingIgPropose] = useState(false);
  const [igProposeResult, setIgProposeResult] = useState<string | null>(null);
  const [igUpdatingId, setIgUpdatingId] = useState<string | null>(null);

  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribeStatus, setSubscribeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const photosTopRef = useRef<HTMLDivElement | null>(null);
  const shareBoxRef = useRef<HTMLDivElement | null>(null);
  const hydratedRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const dimTapCountRef = useRef(0);
  const dimTapTimerRef = useRef<number | null>(null);

  const [stats, setStats] = useState<null | {
    photosCount: number;
    photosBytesTotal: number;
    shortVideoBytes: number;
    longVideoBytes: number;
    bytesTotalAll: number;
  }>(null);

  const [qrMoments, setQrMoments] = useState<{
    photos: string[];
    videos: string[];
    audio: string[];
    eventSlug?: string | null;
    galleryUrl?: string | null;
  } | null>(null);

  // ── DERIVED STATE ──────────────────────────────────────────────────────────

  const { mode, browsePage, printPage, downloadPage, selectedPrint, selectedDownload, shareUrl, shareError } = gallery;

  const totalPhotos = album?.photos?.length ?? 0;
  const pageSize = isMobile ? 20 : 30;
  const totalPages = Math.max(1, Math.ceil(totalPhotos / pageSize));

  const activePage = mode === "download" ? downloadPage : mode === "print" ? printPage : pageFromUrl;
  const safePage = clamp(activePage, 1, totalPages);

  const emptySelected = useMemo(() => new Set<string>(), []);
  const activeSelected = mode === "print" ? selectedPrint : mode === "download" ? selectedDownload : emptySelected;

  const pagePhotos = useMemo(() => {
    if (!album?.photos?.length) return [];
    const start = (safePage - 1) * pageSize;
    return album.photos.slice(start, start + pageSize);
  }, [album?.photos, safePage, pageSize]);

  const galleryPhotos = pagePhotos;

  const originalByName = useMemo(() => {
    const map = new Map<string, string>();
    (album?.originalPhoto ?? []).forEach((url) => map.set(fileNameFromUrl(url), url));
    return map;
  }, [album?.originalPhoto]);

  const previewByName = useMemo(() => {
    const map = new Map<string, string>();
    (album?.photos ?? []).forEach((url) => map.set(fileNameFromUrl(url), url));
    return map;
  }, [album?.photos]);

  const galleryOrgPhotos = useMemo(() => {
    if (!galleryPhotos.length) return [];
    if (!album?.originalPhoto?.length) return galleryPhotos;
    return galleryPhotos.map((url) => originalByName.get(fileNameFromUrl(url)) ?? url);
  }, [galleryPhotos, album?.originalPhoto, originalByName]);

  const featuredOrgPhotos = useMemo(() => {
    const featured = album?.featured ?? [];
    if (!featured.length) return [];
    if (!album?.originalPhoto?.length) return featured;
    return featured.map((url) => originalByName.get(fileNameFromUrl(url)) ?? url);
  }, [album?.featured, album?.originalPhoto, originalByName]);

  const printPhotos = useMemo(() => {
    return (album?.print ?? []).map((item) => {
      const fileName = fileNameFromUrl(item);
      return { fileName, src: previewByName.get(fileName) ?? item };
    });
  }, [album?.print, previewByName]);

  const pageNames = useMemo(() => pagePhotos.map(fileNameFromUrl), [pagePhotos]);
  const allOnPageSelected = mode !== "none" && pageNames.length > 0 && pageNames.every((name) => activeSelected.has(name));
  const printCount = useMemo(() => album?.print?.length ?? 0, [album?.print]);
  const downloadCount = selectedDownload.size;

  // ── EFFECTS ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!slug) return;
    const savedKey = localStorage.getItem(`adminKey_${slug}`);
    if (savedKey) { setAdminKey(savedKey); setIsAdmin(true); }
  }, [slug]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const onChange = () => setIsMobile(mediaQuery.matches);
    onChange();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/album/${slug}/stats`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setStats(data))
      .catch(() => setStats(null));
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/album/${slug}/qr-moments`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setQrMoments(data))
      .catch(() => setQrMoments(null));
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const url = await getSwissUrl(slug);
        if (!cancelled) setSwissLink(url || null);
      } catch (error) {
        console.error("Failed to load swiss link", error);
        if (!cancelled) setSwissLink(null);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    photosTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [safePage]);

  useEffect(() => {
    if (shareUrl) shareBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [shareUrl]);

  useEffect(() => {
    if (mode === "download") dispatch({ type: "SET_PAGE", mode: "download", page: safePage });
    else if (mode === "print") dispatch({ type: "SET_PAGE", mode: "print", page: safePage });
    else dispatch({ type: "SET_PAGE", mode: "none", page: safePage });
  }, [mode, safePage]);

  useEffect(() => {
    if (!slug || typeof window === "undefined") return;
    hydratedRef.current = false;
    const raw = window.localStorage.getItem(storageKeyFor(slug));
    const data = safeParse(raw);
    if (data?.v === 3) {
      dispatch({
        type: "HYDRATE",
        payload: {
          mode: data.mode,
          browsePage: data.browsePage,
          printPage: data.printPage,
          downloadPage: data.downloadPage,
          selectedPrint: new Set(data.selectedPrint),
          selectedDownload: new Set(data.selectedDownload),
          shareUrl: null,
          shareError: null,
        },
      });
    }
    hydratedRef.current = true;
  }, [slug]);

  useEffect(() => {
    if (!slug || typeof window === "undefined" || !hydratedRef.current) return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      const payload: PersistedStateV3 = {
        v: 3, mode, browsePage, printPage, downloadPage,
        selectedPrint: Array.from(selectedPrint),
        selectedDownload: Array.from(selectedDownload),
      };
      try { window.localStorage.setItem(storageKeyFor(slug), JSON.stringify(payload)); } catch {}
    }, 120);
  }, [slug, mode, browsePage, printPage, downloadPage, selectedPrint, selectedDownload]);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const response = await fetch(`/api/album/${slug}`);
      if (!response.ok) { setAlbum(null); setLoading(false); return; }
      const data = await response.json();
      setAlbum(data);
      setLoading(false);
    })();
  }, [slug]);

  // ── HANDLERS ───────────────────────────────────────────────────────────────

  const setPage = (updater: (p: number) => number) => {
    const nextPage = updater(safePage);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("page", String(nextPage));
      return params;
    }, { replace: false });
    if (mode === "download") dispatch({ type: "SET_PAGE", mode: "download", page: nextPage });
    else if (mode === "print") dispatch({ type: "SET_PAGE", mode: "print", page: nextPage });
  };

  const toggleSelectPage = () => {
    if (mode !== "print" && mode !== "download") return;
    dispatch({ type: "SELECT_PAGE", mode, names: pageNames, selectAll: allOnPageSelected });
  };

  const openPrintMode = () => {
    const initial = new Set<string>((album?.print ?? []).map(fileNameFromUrl));
    dispatch({ type: "OPEN_PRINT_MODE", initial, currentPage: safePage });
  };

  const openDownloadMode = () => dispatch({ type: "OPEN_DOWNLOAD_MODE", currentPage: safePage });
  const closeMode = () => dispatch({ type: "CLOSE_MODE", currentPage: safePage });

  const togglePhoto = (src: string) => {
    if (mode !== "print" && mode !== "download") return;
    dispatch({ type: "TOGGLE_PHOTO", mode, name: fileNameFromUrl(src) });
  };

  const onDimmedTap = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode === "none") return;
    const element = event.target as HTMLElement | null;
    if (!element) return;
    dimTapCountRef.current += 1;
    if (dimTapTimerRef.current) window.clearTimeout(dimTapTimerRef.current);
    dimTapTimerRef.current = window.setTimeout(() => {
      dimTapCountRef.current = 0;
      dimTapTimerRef.current = null;
    }, 1200);
    if (dimTapCountRef.current >= 3) {
      dimTapCountRef.current = 0;
      if (dimTapTimerRef.current) window.clearTimeout(dimTapTimerRef.current);
      dimTapTimerRef.current = null;
      closeMode();
    }
  };

  const scrollToPhoto = useCallback((src: string) => {
    const photoElement = document.querySelector<HTMLElement>(`[data-photo-src="${CSS.escape(src)}"]`);
    if (photoElement) {
      photoElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const openLightbox = useCallback((src: string) => {
    if (mode !== "none") return;
    const index = album?.photos?.indexOf(src) ?? -1;
    if (index !== -1) setLightboxIndex(index);
  }, [mode, album?.photos]);

  const closeLightbox = useCallback(() => {
    if (lightboxIndex === null || !album?.photos) return;

    const absoluteIndex = lightboxIndex;
    const targetPage = Math.ceil((absoluteIndex + 1) / pageSize);
    const targetSrc = album.photos[absoluteIndex];

    setLightboxIndex(null);

    if (targetPage !== safePage) {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set("page", String(targetPage));
        return params;
      }, { replace: false });
    }

    setTimeout(() => scrollToPhoto(targetSrc), 120);
  }, [lightboxIndex, album?.photos, pageSize, safePage, setSearchParams, scrollToPhoto]);

  const downloadAllPhotos = () => {
    if (!slug || !album?.photos?.length) return;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/api/album/${slug}/download-all`;
    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  const downloadSelected = () => {
    if (!slug || selectedDownload.size === 0) return;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/api/album/${slug}/download-selected`;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "items";
    input.value = JSON.stringify(Array.from(selectedDownload));
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  const downloadPrintDynamic = () => {
    if (!slug || !printCount) return;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/api/album/${slug}/download-print-dynamic`;
    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  const savePrintSelection = async () => {
    if (!slug) return;
    setSavingPrint(true);
    try {
      const response = await fetch(`/api/album/${slug}/print-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: Array.from(selectedPrint) }),
      });
      if (response.ok) {
        const refreshed = await fetch(`/api/album/${slug}`).then((res) => res.json());
        setAlbum(refreshed);
        dispatch({ type: "SET_MODE", payload: "none" });
      }
    } finally {
      setSavingPrint(false);
    }
  };

  const removeFromPrint = async (fileName: string) => {
    if (!album || !slug) return;
    const newPrintUrls = (album.print ?? []).filter((url) => fileNameFromUrl(url) !== fileName);
    setAlbum((prev) => (prev ? { ...prev, print: newPrintUrls } : null));
    try {
      await fetch(`/api/album/${slug}/print-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: newPrintUrls.map(fileNameFromUrl) }),
      });
    } catch {
      const refreshed = await fetch(`/api/album/${slug}`).then((res) => res.json());
      setAlbum(refreshed);
    }
  };

  const resetAllPrint = async () => {
    if (!album || !slug || !window.confirm("Sigur vrei să elimini TOATE pozele din selecția de imprimare?")) return;
    setAlbum((prev) => (prev ? { ...prev, print: [] } : null));
    try {
      await fetch(`/api/album/${slug}/print-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      });
    } catch {
      const refreshed = await fetch(`/api/album/${slug}`).then((res) => res.json());
      setAlbum(refreshed);
    }
  };

  const deletePhoto = async (signedUrl: string) => {
    if (!slug || !isAdmin) return;
    const fileName = fileNameFromUrl(signedUrl);
    if (!window.confirm(`ȘTERGI DEFINITIV POZA:\n\n"${fileName}"\n\n• Fișierul va fi șters fizic de pe server\n• Va dispărea din toate secțiunile\n• Acțiunea este IREVERSEBILĂ!\n\nConfirmi?`)) return;
    try {
      const response = await fetch(`/api/album/${slug}/delete-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
        body: JSON.stringify({ filename: fileName }),
      });
      if (response.ok) {
        setAlbum(await response.json());
      } else {
        const error = await response.json().catch(() => ({}));
        alert(error.error || "Acces interzis sau eroare la ștergere.");
        setIsAdmin(false);
        setAdminKey("");
        localStorage.removeItem(`adminKey_${slug}`);
      }
    } catch {
      alert("Eroare de conexiune.");
    }
  };

  const createShareLink = async () => {
    if (!slug || selectedDownload.size === 0) return;
    setCreatingShare(true);
    dispatch({ type: "SET_SHARE_URL", url: null, error: null });
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, items: Array.from(selectedDownload) }),
      });
      const text = await response.text().catch(() => "");
      if (!response.ok) {
        dispatch({ type: "SET_SHARE_URL", url: null, error: `Share failed (${response.status})` });
        return;
      }
      let data: ShareCreateResponse;
      try { data = JSON.parse(text); } catch {
        dispatch({ type: "SET_SHARE_URL", url: null, error: "Invalid response" });
        return;
      }
      if (!data?.id) {
        dispatch({ type: "SET_SHARE_URL", url: null, error: "Missing id" });
        return;
      }
      const url = `${window.location.origin}/share/${data.id}`;
      dispatch({ type: "SET_SHARE_URL", url, error: null });
      await navigator.clipboard.writeText(url).catch(() => {});
    } finally {
      setCreatingShare(false);
    }
  };

  const saveLink = async () => {
    const url = customUrl.trim();
    try {
      const response = await fetch(`/api/album/${slug}/swisslink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: url }),
      });
      if (response.ok) setShowUrlModal(false);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!auth.authorise || !auth.accessToken || !slug) return;
    fetch(`/api/instagram-proposals/album/${slug}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((response) => response.json())
      .then((data) => { if (data.proposals) setIgProposals(data.proposals); })
      .catch(() => {});
  }, [auth.authorise, auth.accessToken, slug]);

  const toggleIgPhoto = (src: string) => {
    const fileName = fileNameFromUrl(src);
    setSelectedIgPropose((prev) => {
      const next = new Set(prev);
      next.has(fileName) ? next.delete(fileName) : next.add(fileName);
      return next;
    });
  };

  const submitIgProposals = async () => {
    if (!slug || !auth.accessToken || selectedIgPropose.size === 0 || !album) return;
    setSubmittingIgPropose(true);
    try {
      const photos = album.photos ?? [];
      const toPropose = photos.filter((url) => selectedIgPropose.has(fileNameFromUrl(url)));
      const results = await Promise.all(
        toPropose.map((photoUrl) =>
          fetch("/api/instagram-proposals", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
            body: JSON.stringify({ albumSlug: slug, photoUrl, fileName: fileNameFromUrl(photoUrl) }),
          }).then((r) => r.json())
        )
      );
      const added = results.filter((r) => r.ok && !r.alreadyProposed);
      setIgProposals((prev) => [
        ...added.map((r, i) => ({
          id: r.id,
          photoUrl: toPropose[i],
          fileName: fileNameFromUrl(toPropose[i]),
          proposedBy: auth.user?.email ?? "",
          proposedAt: new Date().toISOString(),
          status: "pending" as const,
        })),
        ...prev,
      ]);
      setIgProposeResult(`${added.length} ${added.length === 1 ? "poză propusă" : "poze propuse"} pentru Instagram.`);
      setSelectedIgPropose(new Set());
      setIgProposeMode(false);
    } catch {
    } finally {
      setSubmittingIgPropose(false);
    }
  };

  const updateIgStatus = async (id: string, status: "posted" | "rejected") => {
    if (!auth.accessToken) return;
    setIgUpdatingId(id);
    try {
      await fetch(`/api/instagram-proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ status }),
      });
      setIgProposals((previous) => previous.map((proposal) => proposal.id === id ? { ...proposal, status } : proposal));
    } catch {
    } finally {
      setIgUpdatingId(null);
    }
  };

  const deleteIgProposal = async (id: string) => {
    if (!auth.accessToken) return;
    setIgUpdatingId(id);
    try {
      await fetch(`/api/instagram-proposals/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setIgProposals((previous) => previous.filter((proposal) => proposal.id !== id));
    } catch {
    } finally {
      setIgUpdatingId(null);
    }
  };


  const handleSubscribe = async () => {
    if (!subscribeEmail.trim()) return;
    setSubscribeStatus("loading");
    try {
      const response = await fetch("/api/album-subscriptions/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumSlug: slug, email: subscribeEmail.trim() }),
      });
      const data = await response.json() as { ok?: boolean };
      setSubscribeStatus(data.ok ? "success" : "error");
    } catch {
      setSubscribeStatus("error");
    }
  };

  const toggleModerationPhoto = (src: string) => {
    const filename = fileNameFromUrl(src);
    setSelectedModeration((previous) => {
      const next = new Set(previous);
      next.has(filename) ? next.delete(filename) : next.add(filename);
      return next;
    });
  };

  const submitModeration = async () => {
    if (!slug || selectedModeration.size === 0) return;
    setSubmittingModeration(true);
    try {
      const response = await fetch("/api/moderare/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({
          albumSlug: slug,
          photos: Array.from(selectedModeration),
          note: moderationNote.trim(),
        }),
      });
      const data = await response.json() as { ok?: boolean; submitted?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Eroare server");
      setModerationSubmitResult(`${data.submitted} poze trimise spre moderare. Administratorul a fost notificat.`);
      setSelectedModeration(new Set());
      setModerationNote("");
      setShowModerationSubmitModal(false);
    } catch (err) {
      alert(`Eroare: ${(err as Error).message}`);
    } finally {
      setSubmittingModeration(false);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────

  if (loading) return <AncaLoader />;
  if (!album) return <AlbumNotFound />;

  return (
    <>
    <div className={styles.page}>
      <div className={styles.container}>

        {slug && typeof window !== "undefined" && window.location.hostname !== "localhost" && (
          <MediaConsentModal
            slug={slug}
            retention={album?.retention ?? null}
            isAdmin={isAdmin || auth.authorise}
            onAccepted={() => setConsentGiven(true)}
          />
        )}

        <OnboardingWizard />


        {lightboxIndex !== null && album?.photos && (
          <PhotoLightbox
            photos={album.photos}
            currentIndex={lightboxIndex}
            onClose={closeLightbox}
            onNext={() => setLightboxIndex((prev) => (prev !== null ? Math.min(album.photos!.length - 1, prev + 1) : 0))}
            onPrev={() => setLightboxIndex((prev) => (prev !== null ? Math.max(0, prev - 1) : 0))}
            selectedPrint={selectedPrint}
            onTogglePrint={(fileName) => dispatch({ type: "TOGGLE_PHOTO", mode: "print", name: fileName })}
            getFileName={fileNameFromUrl}
          />
        )}

        {isAdmin && (
          <button
            className={styles.adminExitBtn}
            onClick={() => {
              setIsAdmin(false);
              setAdminKey("");
              localStorage.removeItem(`adminKey_${slug}`);
              window.location.reload();
            }}
            aria-label="Ieși din modul admin"
            title="Ieși din modul admin"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {showAdminButton && !isAdmin && !auth.authorise && (
          <div className={styles.adminTempButton}>
            <button
              className={styles.adminTempBtn}
              onClick={() => { window.location.href = `/login?redirect=/media/${slug}`; }}
            >
              🔑 Acces administrare
            </button>
          </div>
        )}

        <h1
          className={styles.title}
          style={{ cursor: "pointer" }}
          onClick={() => {
            const adminWindow = window as AdminWindow;
            if (!adminWindow.adminClickCount) {
              adminWindow.adminClickCount = 0;
              adminWindow.adminClickTimeout = null;
            }
            adminWindow.adminClickCount += 1;
            if (adminWindow.adminClickTimeout) clearTimeout(adminWindow.adminClickTimeout);
            adminWindow.adminClickTimeout = window.setTimeout(() => {
              adminWindow.adminClickCount = 0;
            }, 3000);
            if (adminWindow.adminClickCount >= 10) {
              if (isAdmin) {
                setIsAdmin(false);
                setAdminKey("");
                localStorage.removeItem(`adminKey_${slug}`);
                window.location.reload();
              } else if (auth.authorise) {
                setIsAdmin(true);
                localStorage.setItem(`adminKey_${slug}`, "firebase");
                window.location.reload();
              } else {
                setShowAdminButton(true);
              }
              adminWindow.adminClickCount = 0;
            }
          }}
        >
          {album.title}
        </h1>

        <p className={styles.meta}>
          {album.photos?.length ?? 0} fotografii
          {album.shortvideo ? " · video scurt" : ""}
          {album.longvideo ? " · film complet" : ""}
        </p>

        {!isModerationMode && (
          <div className={styles.actionButtons}>
            <button className={styles.fillAction} onClick={() => setIsFormOpen(true)}>
              Completează adresa de livrare
            </button>
            <button className={styles.viewAction} onClick={() => setShowDeliveryModal(true)}>
              Vezi adresa de livrare
            </button>
          </div>
        )}

        {isAdmin && (
          <div className={styles.actionButtons}>
            <button type="button" className={styles.viewAction} onClick={() => setShowUrlModal(true)}>
              Adaugă link Swiss Transfer
            </button>
          </div>
        )}

        {isFormOpen && (
          <DeliveryForm albumId={slug || "hello"} onClose={() => setIsFormOpen(false)} onSuccess={() => setIsFormOpen(false)} />
        )}

        {showDeliveryModal && (
          <DeliveryAddressModal slug={slug || ""} isOpen={showDeliveryModal} onClose={() => setShowDeliveryModal(false)} />
        )}

        {showUrlModal && (
          <div className={styles.modalOverlay} onClick={() => setShowUrlModal(false)}>
            <div className={styles.urlModal} onClick={(event) => event.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Link descărcare</h3>
                <button className={styles.closeBtn} onClick={() => setShowUrlModal(false)} aria-label="Închide">×</button>
              </div>
              <div className={styles.modalBody}>
                <p className={styles.modalHint}>Lipește sau editează link-ul direct de descărcare:</p>
                <input
                  type="url"
                  value={customUrl}
                  onChange={(event) => setCustomUrl(event.target.value)}
                  placeholder="https://example.com/file.mp4"
                  className={styles.urlInput}
                  autoFocus
                />
                <div className={styles.modalFooter}>
                  <button className={styles.btnSecondary} onClick={() => setShowUrlModal(false)}>Anulează</button>
                  <button className={styles.btnPrimary} onClick={saveLink} disabled={!customUrl.trim()}>Salvează link</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={styles.divider} />

        {album.featured?.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Selectate</h2>
            <BunnyPhotoGallery orgPhoto={featuredOrgPhotos} photos={album.featured} variant="plain" />
          </>
        )}

        {mode === "none" && subscribeStatus !== "success" && (
          <div style={{ margin: "0 0 16px", padding: "12px 16px", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <p style={{ color: "#888", fontSize: "13px", margin: 0, whiteSpace: "nowrap" }}>
              🔔 Notifică-mă când fotograful adaugă poze noi
            </p>
            <div style={{ display: "flex", gap: "8px", flex: 1, minWidth: "220px" }}>
              <input
                type="email"
                value={subscribeEmail}
                onChange={(event) => setSubscribeEmail(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") handleSubscribe(); }}
                placeholder="adresa@email.com"
                style={{ flex: 1, padding: "6px 12px", background: "#111", border: "1px solid #333", borderRadius: "6px", color: "#ccc", fontSize: "13px", outline: "none" }}
              />
              <button
                onClick={handleSubscribe}
                disabled={subscribeStatus === "loading" || !subscribeEmail.trim()}
                style={{ padding: "6px 14px", background: subscribeEmail.trim() ? "#fff" : "#222", color: subscribeEmail.trim() ? "#000" : "#555", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: subscribeEmail.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
              >
                {subscribeStatus === "loading" ? "..." : "Abonează-te"}
              </button>
            </div>
            {subscribeStatus === "error" && (
              <p style={{ color: "#f87171", fontSize: "12px", margin: 0, width: "100%" }}>A apărut o eroare. Încearcă din nou.</p>
            )}
          </div>
        )}

        {mode === "none" && subscribeStatus === "success" && (
          <div style={{ margin: "0 0 16px", padding: "12px 16px", background: "#052e16", border: "1px solid #166534", borderRadius: "8px" }}>
            <p style={{ color: "#4ade80", fontSize: "13px", fontWeight: 600, margin: 0 }}>✓ Te-ai abonat! Vei primi un email când fotograful adaugă poze noi.</p>
          </div>
        )}

        {auth.authorise && mode === "none" && (
          <div style={{ margin: "0 0 16px", padding: "12px 16px", background: "#0d0d1f", border: "1px solid #3730a3", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <p style={{ color: "#a5b4fc", fontWeight: 600, fontSize: "13px", margin: 0 }}>📸 Propune poze pentru Instagram</p>
              {igProposeResult && <p style={{ color: "#4ade80", fontSize: "12px", margin: "2px 0 0" }}>{igProposeResult}</p>}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {igProposals.filter((p) => p.status === "pending").length > 0 && (
                <span style={{ background: "#312e81", color: "#a5b4fc", fontSize: "12px", fontWeight: 600, padding: "4px 12px", borderRadius: "999px", whiteSpace: "nowrap" }}>
                  {igProposals.filter((p) => p.status === "pending").length} propuse
                </span>
              )}
              {igProposeMode ? (
                <>
                  <button
                    onClick={submitIgProposals}
                    disabled={submittingIgPropose || selectedIgPropose.size === 0}
                    style={{ padding: "6px 14px", background: selectedIgPropose.size > 0 ? "linear-gradient(135deg,#f58529,#dd2a7b,#8134af)" : "#1e1b4b", border: "none", borderRadius: "6px", color: selectedIgPropose.size > 0 ? "#fff" : "#4338ca", fontSize: "13px", fontWeight: 600, cursor: selectedIgPropose.size > 0 ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
                  >
                    {submittingIgPropose ? "Se trimite..." : `Trimite propunere (${selectedIgPropose.size})`}
                  </button>
                  <button
                    onClick={() => { setIgProposeMode(false); setSelectedIgPropose(new Set()); }}
                    style={{ padding: "6px 12px", background: "none", border: "1px solid #3730a3", borderRadius: "6px", color: "#6366f1", fontSize: "13px", cursor: "pointer" }}
                  >
                    Anulează
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setIgProposeMode(true); setIgProposeResult(null); setModerationMode(false); setSelectedModeration(new Set()); }}
                  style={{ padding: "6px 14px", background: "linear-gradient(135deg,#f58529,#dd2a7b,#8134af)", border: "none", borderRadius: "6px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Selectează poze
                </button>
              )}
            </div>
          </div>
        )}

        {auth.authorise && mode === "none" && (
          <div style={{ margin: "0 0 16px", padding: "12px 16px", background: "#1c1200", border: "1px solid #92400e", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <p style={{ color: "#fbbf24", fontWeight: 600, fontSize: "13px", margin: 0 }}>🗑️ Propune poze pentru ștergere</p>
              {moderationSubmitResult && <p style={{ color: "#4ade80", fontSize: "12px", margin: "2px 0 0" }}>{moderationSubmitResult}</p>}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {moderationMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowModerationSubmitModal(true)}
                    disabled={selectedModeration.size === 0}
                    style={{ padding: "6px 14px", background: selectedModeration.size > 0 ? "#d97706" : "#374151", border: "none", borderRadius: "6px", color: selectedModeration.size > 0 ? "#fff" : "#6b7280", fontSize: "13px", fontWeight: 600, cursor: selectedModeration.size > 0 ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
                  >
                    {`Trimite spre moderare (${selectedModeration.size})`}
                  </button>
                  <button
                    onClick={() => { setModerationMode(false); setSelectedModeration(new Set()); }}
                    style={{ padding: "6px 12px", background: "none", border: "1px solid #92400e", borderRadius: "6px", color: "#d97706", fontSize: "13px", cursor: "pointer" }}
                  >
                    Anulează
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setModerationMode(true); setIgProposeMode(false); setSelectedIgPropose(new Set()); }}
                  style={{ padding: "6px 14px", background: "#d97706", border: "none", borderRadius: "6px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Selectează poze
                </button>
              )}
            </div>
          </div>
        )}

        {album.photos?.length > 0 && (
          <>
            <div className={styles.sectionRow} ref={photosTopRef}>
              <h2 className={styles.sectionTitle}>Fotografii ({album.photos.length})</h2>

              {mode === "none" ? (
                <div className={styles.rowActions}>
                  {totalPhotos > 0 && !isModerationMode && (
                    <button className={styles.pickBtn} type="button" onClick={openPrintMode}>
                      Modifică selecția pentru imprimare
                    </button>
                  )}
                  {!isModerationMode && (
                    <button className={styles.pickBtnSecondary} type="button" onClick={openDownloadMode}>
                      Selectează poze pentru descărcare
                    </button>
                  )}
                  {!isModerationMode && (
                    <button className={styles.pickBtnSecondary} type="button" onClick={downloadAllPhotos} data-onboarding="download-btn">
                      {"DESCARCĂ TOATE POZELE" + (stats ? ` (${fmtBytes(stats.photosBytesTotal)})` : "")}
                    </button>
                  )}
                </div>
              ) : (
                <div className={styles.rowActions}>
                  <button className={styles.pickBtnSecondary} type="button" onClick={closeMode}>Închide</button>
                  {mode === "print" ? (
                    <button className={styles.pickBtn} type="button" onClick={savePrintSelection} disabled={savingPrint}>
                      {savingPrint ? "Se salvează..." : `Salvează selecția (${selectedPrint.size})`}
                    </button>
                  ) : (
                    <>
                      <button className={styles.pickBtn} type="button" onClick={downloadSelected} disabled={downloadCount === 0}>
                        Descarcă selecția
                      </button>
                      <button className={styles.pickBtnSecondary} type="button" onClick={createShareLink} disabled={creatingShare || downloadCount === 0}>
                        {creatingShare ? "Se creează..." : `Creează link share (${downloadCount})`}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {mode === "download" && (shareUrl || shareError) && (
              <div ref={shareBoxRef} className={styles.shareBox}>
                <div className={styles.shareTitle}>Link de share</div>
                {shareError ? (
                  <div className={styles.shareError}>{shareError}</div>
                ) : (
                  <div className={styles.shareRow}>
                    <input className={styles.shareInput} value={shareUrl ?? ""} readOnly />
                    <button className={styles.shareBtn} type="button" onClick={() => navigator.clipboard.writeText(shareUrl!)}>Copy</button>
                    <button className={styles.shareBtn} type="button" onClick={() => navigator.share?.({ url: shareUrl ?? undefined })}>Share</button>
                  </div>
                )}
              </div>
            )}

            <AlbumPager
              mode={mode}
              currentPage={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalPhotos}
              shownCount={galleryPhotos.length}
              allOnPageSelected={allOnPageSelected}
              onFirst={() => setPage(() => 1)}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              onLast={() => setPage(() => totalPages)}
              onGoTo={(p) => setPage(() => p)}
              onToggleSelectPage={toggleSelectPage}
              data-onboarding="pager"
              mobileColumns={mobileColumns}
              onMobileColumnsChange={setMobileColumns}
            />

            <div className={styles.photosScroller}>
              {igProposeMode && mode === "none" ? (
                <BunnyPhotoGallery
                  key={`${slug}:${safePage}:ig`}
                  photos={galleryPhotos}
                  orgPhoto={galleryOrgPhotos}
                  variant="plain"
                  selectable={true}
                  selected={selectedIgPropose}
                  getKey={fileNameFromUrl}
                  onToggle={toggleIgPhoto}
                  mobileColumns={mobileColumns}
                />
              ) : isModerationMode && mode === "none" ? (
                <BunnyPhotoGallery
                  key={`${slug}:${safePage}:mod`}
                  photos={galleryPhotos}
                  orgPhoto={galleryOrgPhotos}
                  variant="plain"
                  selectable={true}
                  selected={selectedModeration}
                  getKey={fileNameFromUrl}
                  onToggle={toggleModerationPhoto}
                  mobileColumns={mobileColumns}
                />
              ) : isAdmin && mode === "none" ? (
                <div className={styles.adminGalleryGrid} data-columns={mobileColumns}>
                  {galleryPhotos.map((src) => {
                    const fileName = fileNameFromUrl(src);
                    return (
                      <div key={src} className={styles.adminPhotoWrapper}>
                        <img
                          src={src}
                          alt={fileName}
                          className={styles.adminPhotoImg}
                          loading="lazy"
                          onClick={() => openLightbox(src)}
                          style={{ cursor: 'pointer' }}
                          data-photo-src={src}
                          {...(galleryPhotos.indexOf(src) === 0 ? { 'data-onboarding': 'photo' } : {})}
                        />
                        <button
                          className={styles.deletePhotoBtn}
                          onClick={() => deletePhoto(src)}
                          aria-label="Șterge definitiv"
                          title="Șterge definitiv din album"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <BunnyPhotoGallery
                  key={`${slug}:${safePage}`}
                  photos={galleryPhotos}
                  orgPhoto={galleryOrgPhotos}
                  variant="plain"
                  selectable={mode !== "none"}
                  selected={activeSelected}
                  getKey={fileNameFromUrl}
                  onToggle={togglePhoto}
                  onPhotoClick={mode === "none" ? openLightbox : undefined}
                  mobileColumns={mobileColumns}
                />
              )}
            </div>
          </>
        )}

        {!isModerationMode && <div className={mode !== "none" ? styles.dimmedArea : undefined} onPointerDown={onDimmedTap}>
          <div className={styles.sectionRow}>
            <h2 className={styles.sectionTitle}>Poze de imprimat{printCount ? ` (${printCount})` : ""}</h2>
            <div className={styles.rowActions}>
              {totalPhotos > 0 && (
                <button className={styles.pickBtn} type="button" onClick={openPrintMode}>
                  Modifică selecția pentru imprimare
                </button>
              )}
              {printCount > 0 && (
                <button type="button" className={styles.resetAllPrintBtn} onClick={resetAllPrint}>
                  Resetează toate pozele pentru imprimare
                </button>
              )}
            </div>
          </div>

          {printCount > 0 ? (
            <>
              <MobileColumnsToggle mobileColumns={mobileColumns} onMobileColumnsChange={setMobileColumns} />
              <div className={styles.printPhotosGrid} data-columns={mobileColumns}>
                {printPhotos.map(({ fileName, src }) => (
                  <div key={fileName} className={styles.printPhotoWrapper}>
                    <img src={src} alt={`Poză pentru imprimare: ${fileName}`} className={styles.printPhotoImg} loading="lazy" />
                    <button
                      className={styles.removePrintBtn}
                      onClick={() => removeFromPrint(fileName)}
                      aria-label={`Elimină ${fileName} din lista de imprimare`}
                      title="Elimină din lista de imprimare"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <MobileColumnsToggle mobileColumns={mobileColumns} onMobileColumnsChange={setMobileColumns} />
            </>
          ) : (
            <p className={styles.emptyPrint}>Nu ai selectat încă poze pentru imprimat.</p>
          )}

          {printCount > 0 && (
            <button type="button" className={styles.pickBtnSecondary} onClick={downloadPrintDynamic}>
              Descarcă pozele pentru imprimare
            </button>
          )}

          {album.shortvideo && (
            <>
              <h2 className={styles.sectionTitle}>Video scurt</h2>
              <div className={styles.mediaCenter}>
                <div className={styles.videoWrap}>
                  <video className={styles.video} controls playsInline preload="metadata" src={album.shortvideo} />
                </div>
              </div>
              <div className={styles.actions}>
                <a className={styles.downloadBtn} href={swissLink!}>
                  {"DESCARCĂ VIDEO" + (stats?.shortVideoBytes ? ` (${fmtBytes(stats.shortVideoBytes)})` : "")}
                </a>
              </div>
            </>
          )}

          {swissLink && (
            <>
              <h2 className={styles.sectionTitle}>Film complet</h2>
              <div className={styles.mediaCenter}>
                <div className={styles.videoWrap}>
                  <img src="https://img.youtube.com/vi/sA8VXDYePwA/maxresdefault.jpg" alt="Static video frame" className={styles.video} />
                </div>
              </div>
              <div className={styles.actions}>
                <a className={styles.downloadBtn} href={swissLink!}>
                  {"DESCARCĂ FILMUL COMPLET" + (stats?.longVideoBytes ? ` (${fmtBytes(stats.longVideoBytes)})` : "")}
                </a>
              </div>
            </>
          )}

          {qrMoments && (qrMoments.photos.length > 0 || qrMoments.videos.length > 0 || qrMoments.audio.length > 0) && (
            <>
              <h2 className={styles.sectionTitle}>
                QR Moments ({qrMoments.photos.length + qrMoments.videos.length + qrMoments.audio.length})
              </h2>

              {qrMoments.galleryUrl && (
                <div style={{ margin: "0 0 16px", padding: "14px 16px", background: "#111111", border: "1px solid #2f2f2f", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ color: "#f5f5f5", fontWeight: 600, fontSize: "13px", margin: 0 }}>Mirii pot comenta direct la upload-uri</p>
                    <p style={{ color: "#8b8b8b", fontSize: "12px", margin: "4px 0 0" }}>
                      Deschide galeria QR Moments pentru comentarii la poze, video și mesaje vocale.
                    </p>
                  </div>
                  <a
                    href={qrMoments.galleryUrl}
                    className={styles.downloadBtn}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    COMENTEAZĂ ÎN QR MOMENTS
                  </a>
                </div>
              )}

              {qrMoments.photos.length > 0 && (
                <>
                  <p className={styles.meta}>Poze de la invitați ({qrMoments.photos.length})</p>
                  <div className={styles.printPhotosGrid} data-columns={mobileColumns}>
                    {qrMoments.photos.map((src) => (
                      <div key={src} className={styles.printPhotoWrapper}>
                        <img src={src} alt="QR Moment" className={styles.printPhotoImg} loading="lazy" />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {qrMoments.videos.length > 0 && (
                <>
                  <p className={styles.meta}>Video-uri de la invitați ({qrMoments.videos.length})</p>
                  <div className={styles.mediaCenter} style={{ flexDirection: "column", gap: "16px" }}>
                    {qrMoments.videos.map((src) => (
                      <div key={src} className={styles.videoWrap}>
                        <video className={styles.video} controls playsInline preload="metadata" src={src} />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {qrMoments.audio.length > 0 && (
                <>
                  <p className={styles.meta}>Mesaje vocale de la invitați ({qrMoments.audio.length})</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "0 0 12px" }}>
                    {qrMoments.audio.map((src, i) => (
                      <div key={src} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <audio controls src={src} style={{ height: "36px", flex: 1, minWidth: 0 }} aria-label={`Mesaj vocal ${i + 1}`} />
                        <a
                          href={src}
                          download
                          className={styles.pickBtnSecondary}
                          style={{ fontSize: "12px", padding: "4px 10px", whiteSpace: "nowrap" }}
                          aria-label={`Descarcă mesajul vocal ${i + 1}`}
                        >
                          ↓
                        </a>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <button
                      type="button"
                      className={styles.pickBtnSecondary}
                      onClick={() => {
                        qrMoments.audio.forEach((src, i) => {
                          const a = document.createElement("a");
                          a.href = src;
                          a.download = `mesaj-vocal-${i + 1}`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                        });
                      }}
                    >
                      Descarcă toate mesajele vocale ({qrMoments.audio.length})
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>}
      </div>
    </div>

    {auth.authorise && igProposals.length > 0 && (
      <div style={{ background: "#0a0a0a", borderTop: "1px solid #1a1a1a", padding: "32px 32px 48px", marginTop: "16px" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <span style={{ fontSize: "18px" }}>📸</span>
            <h2 style={{ color: "#fff", fontSize: "16px", fontWeight: 500, margin: 0 }}>
              Propuneri Instagram
            </h2>
            <span style={{ background: "#831843", color: "#fda4af", fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "999px" }}>
              {igProposals.filter((proposal) => proposal.status === "pending").length} în așteptare
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
            {igProposals.map((proposal) => (
              <div key={proposal.id} style={{ position: "relative", borderRadius: "10px", overflow: "hidden", border: "1px solid #222", background: "#111" }}>
                <img
                  src={proposal.photoUrl}
                  alt={proposal.fileName}
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                  loading="lazy"
                />
                <div style={{ padding: "8px 10px" }}>
                  <p style={{ color: "#aaa", fontSize: "11px", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {proposal.proposedBy}
                  </p>
                  <span style={{
                    display: "inline-block",
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: "999px",
                    background: proposal.status === "posted" ? "#14532d" : proposal.status === "rejected" ? "#450a0a" : "#1e1b4b",
                    color: proposal.status === "posted" ? "#4ade80" : proposal.status === "rejected" ? "#f87171" : "#a5b4fc",
                  }}>
                    {proposal.status === "posted" ? "Acceptat" : proposal.status === "rejected" ? "Respins" : "În așteptare"}
                  </span>
                </div>
                {auth.user?.email === "ancadaniel1994@gmail.com" && (
                  <div style={{ display: "flex", gap: "4px", padding: "0 10px 10px" }}>
                    {proposal.status !== "posted" && (
                      <button
                        onClick={() => updateIgStatus(proposal.id, "posted")}
                        disabled={igUpdatingId === proposal.id}
                        style={{ flex: 1, padding: "4px 0", fontSize: "10px", background: "#166534", color: "#4ade80", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
                      >
                        Acceptă
                      </button>
                    )}
                    {proposal.status !== "rejected" && (
                      <button
                        onClick={() => updateIgStatus(proposal.id, "rejected")}
                        disabled={igUpdatingId === proposal.id}
                        style={{ flex: 1, padding: "4px 0", fontSize: "10px", background: "#450a0a", color: "#f87171", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
                      >
                        Respins
                      </button>
                    )}
                    <button
                      onClick={() => deleteIgProposal(proposal.id)}
                      disabled={igUpdatingId === proposal.id}
                      style={{ padding: "4px 8px", fontSize: "10px", background: "#1a1a1a", color: "#555", border: "none", borderRadius: "6px", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {showModerationSubmitModal && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "16px" }}>
        <div style={{ background: "#111", borderRadius: "12px", padding: "24px", maxWidth: "440px", width: "100%", border: "1px solid #222" }}>
          <h2 style={{ color: "#fff", fontSize: "17px", fontWeight: 400, margin: "0 0 6px" }}>Trimite spre moderare</h2>
          <p style={{ color: "#666", fontSize: "13px", margin: "0 0 16px" }}>
            {selectedModeration.size} poze selectate din albumul <strong style={{ color: "#999" }}>{slug}</strong>
          </p>
          <textarea
            value={moderationNote}
            onChange={(event) => setModerationNote(event.target.value)}
            placeholder="Notă opțională pentru administrator..."
            rows={3}
            style={{ width: "100%", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: "6px", color: "#ccc", fontSize: "13px", padding: "10px 12px", resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
            <button
              onClick={() => setShowModerationSubmitModal(false)}
              disabled={submittingModeration}
              style={{ padding: "8px 16px", border: "1px solid #2a2a2a", borderRadius: "6px", background: "none", color: "#888", fontSize: "13px", cursor: "pointer" }}
            >
              Anulează
            </button>
            <button
              onClick={submitModeration}
              disabled={submittingModeration}
              style={{ padding: "8px 16px", background: "#d97706", border: "none", borderRadius: "6px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: submittingModeration ? "not-allowed" : "pointer" }}
            >
              {submittingModeration ? "Se trimite..." : "Confirmă trimiterea"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
