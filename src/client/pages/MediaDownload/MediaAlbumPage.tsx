import { useEffect, useMemo, useReducer, useRef, useState, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import useAuth from "../../features/admin/auth/useAuth";
import BunnyPhotoGallery from "../Portfolio/BunnyPhotoGallery";
import BurstPhotosNotice from "../../components/Media/BurstPhotosNotice";
import ProposalLinksPanel from "./ProposalLinksPanel";
import PrintSelectionGuide from "./PrintSelectionGuide";
import PrintSelectionLink from "./PrintSelectionLink";
import type { PhotoVote } from "../../../shared/media/proposalConsensus";
import styles from "./MediaAlbumPage.module.scss";
import type { Album } from "./AlbumTypes";
import AlbumNotFound from "./AlbumNotFound";
import EmptyAlbumNotice from "./EmptyAlbumNotice";
import AlbumPager from "../Portfolio/AlbumPager";
import DeliveryForm from './DeliveryForm';
import DeliveryAddressModal, { type DeliveryAddress } from "../DeliveryAddress/AddressList";
import PortfolioLightbox from "../Portfolio/PortfolioLightbox";
import OnboardingWizard, { ONBOARDING_STORAGE_KEY } from "./Onboardingwizard";
import MediaConsentModal, { MediaRetentionReminder } from "./MediaConsentModal";
import AncaLoader from "../../components/UI/AncaLoader";
import AncaVisualsPromo from "./AncaVisualsPromo";
import { OFFER_SERVICES } from "../../../shared/offers/offerServices";
import { sendLiveEvent } from "../../utils/liveEvent";
import { NOTIFICATION_SOURCE_PARAM, parseNotificationSource } from "../../../shared/albumNotificationSource";
import ShareManagerPanel from "./ShareManagerPanel";
import AlbumUpdatesSection, { OPEN_ALBUM_UPDATES_EVENT } from "./AlbumUpdatesSection";
import AlbumActionHub from "./AlbumActionHub";
import AlbumVideoLinksSection from "./AlbumVideoLinksSection";
import MediaAdminPhotoUpload from "./MediaAdminPhotoUpload";
import ShortVideoPlayer from "./ShortVideoPlayer";
import AlbumShortVideoManager from "../../features/admin/components/AlbumShortVideoManager";
import PrintReminderPanel from "./PrintReminderPanel";
import ShareReviewModal from "./ShareReviewModal";
import SmsSendList from "./SmsSendList";
import ResetPrintModal from "./ResetPrintModal";
import { whatsappShareUrl } from "./whatsappShare";
import { coupleKeyHeaders, useCoupleAccess } from "./coupleAccess";

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

const mediaKeyFromUrl = (src: string) => {
  const fileName = fileNameFromUrl(src);
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
};

type DeliveryAddressData = {
  swissLink?: string;
  deliveryAddress?: { fullName?: string };
};

const getDeliveryData = async (slug: string): Promise<DeliveryAddressData> => {
  const response = await fetch(`/api/album/${slug}/delivery-address`);
  if (response.ok) {
    const json = await response.json() as { data?: DeliveryAddressData };
    return json.data ?? {};
  }
  return {};
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


const whatsappButtonStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
  padding: "14px 20px", background: "#25D366", color: "#fff", border: "none", borderRadius: "8px",
  fontSize: "15px", fontWeight: 800, cursor: "pointer", width: "100%", letterSpacing: "0.04em",
};

/** Tells the couple, before sending, exactly what guests will (and won't) see. */
function ShareAnonymityNote() {
  return (
    <div style={{ padding: "10px 12px", border: "1px solid #166534", background: "#0d1f0d", borderRadius: "8px", color: "#bbf7d0", fontSize: "13px", lineHeight: 1.5 }}>
      🔒 <strong>Invitații primesc un link anonim.</strong> Văd <strong>doar pozele alese de tine</strong> și{" "}
      <strong>nu au acces la albumul vostru</strong>: nu văd restul pozelor, numele albumului sau alte date.
    </div>
  );
}

export default function MediaAlbumPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPrintInvitation = searchParams.get("select") === "print";
  const { coupleKey, isCouple, keyRejected } = useCoupleAccess(slug, searchParams, setSearchParams);
  const { auth, clientPreview, signedInAsAdmin, setClientPreview } = useAuth();

  const [moderationMode, setModerationMode] = useState(false);
  const isModerationMode = moderationMode;

  const pageFromUrl = Number(searchParams.get("page") ?? "1");

  const [album, setAlbum] = useState<AlbumWithPrint | null>(null);
  const [albumExpired, setAlbumExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [gallery, dispatch] = useReducer(galleryReducer, initialGalleryState);

  const [savingPrint, setSavingPrint] = useState(false);
  const [printSaveError, setPrintSaveError] = useState<string | null>(null);
  const [printSaved, setPrintSaved] = useState(false);
  const [notifyingPrint, setNotifyingPrint] = useState(false);
  const [printNotified, setPrintNotified] = useState(false);
  /** The photographer was told in the last 24 h: "Am terminat" unlocks again at this time (ms). */
  const [printNotifyUntil, setPrintNotifyUntil] = useState<number | null>(null);
  const [creatingShare, setCreatingShare] = useState(false);

  const [adminKeyMode, setIsAdmin] = useState(false);
  // "👁 Client" view (AdminBar) hides the per-album admin mode too.
  const isAdmin = adminKeyMode && !clientPreview;
  const [consentGiven, setConsentGiven] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [showAdminButton, setShowAdminButton] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [swissLink, setSwissLink] = useState<string | null>(null);
  const [hasDeliveryAddress, setHasDeliveryAddress] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryEditInitial, setDeliveryEditInitial] = useState<DeliveryAddress | null>(null);
  const [zipRequest, setZipRequest] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  /** Channel whose "check the photos first" overview is open (null = closed). */
  const [shareReview, setShareReview] = useState<"whatsapp" | "sms" | null>(null);
  /** Anonymous link whose "send by SMS, one person at a time" list is open. */
  const [smsListUrl, setSmsListUrl] = useState<string | null>(null);
  const [showResetPrint, setShowResetPrint] = useState(false);
  const [shareMode, setShareMode] = useState<"selected" | "all">("selected");
  const [shareListVersion, setShareListVersion] = useState(0);
  const [shareIntent, setShareIntent] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mobileColumns, setMobileColumns] = useState<1 | 2>(2);
  const [printExpanded, setPrintExpanded] = useState(false);

  const [selectedModeration, setSelectedModeration] = useState<Set<string>>(new Set());
  const [showModerationSubmitModal, setShowModerationSubmitModal] = useState(false);
  const [moderationNote, setModerationNote] = useState("");
  const [submittingModeration, setSubmittingModeration] = useState(false);
  const [moderationSubmitResult, setModerationSubmitResult] = useState<string | null>(null);

  type InstagramProposal = Omit<PhotoVote, "albumSlug"> & {
    id: string;
    photoUrl: string;
    fileName: string;
    proposedBy: string;
    proposedAt: string;
    status: "pending" | "accepted" | "rejected" | "archived";
    destinations?: string[];
    mediaAssetServiceIds?: string[];
  };
  const [subscribers, setSubscribers] = useState<{ email: string; subscribedAt?: string }[]>([]);
  const [igProposals, setIgProposals] = useState<InstagramProposal[]>([]);
  const [igProposeMode, setIgProposeMode] = useState(false);
  const [selectedIgPropose, setSelectedIgPropose] = useState<Set<string>>(new Set());
  const [proposalDestinations, setProposalDestinations] = useState<Set<"instagram" | "media_assets">>(new Set(["instagram", "media_assets"]));
  const [proposalMediaServices, setProposalMediaServices] = useState<Set<string>>(new Set(["photo"]));
  const [submittingIgPropose, setSubmittingIgPropose] = useState(false);
  const [igProposeResult, setIgProposeResult] = useState<string | null>(null);
  const [igUpdatingId, setIgUpdatingId] = useState<string | null>(null);
  const [videoImportOpen, setVideoImportOpen] = useState(false);
  const [videoImportServices, setVideoImportServices] = useState<Set<string>>(new Set(["video"]));
  const [videoImporting, setVideoImporting] = useState(false);
  const [videoImportResult, setVideoImportResult] = useState<string | null>(null);
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  // The "a terminat de ales poze" email links to /media/:slug#proposal-invites: open the panel there.
  useEffect(() => {
    if (!album || !auth.authorise || window.location.hash !== "#proposal-invites") return;
    setInvitePanelOpen(true);
    requestAnimationFrame(() => document.getElementById("proposal-invites")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [album?.slug, auth.authorise]); // eslint-disable-line react-hooks/exhaustive-deps


  const [showSaveWarning, setShowSaveWarning] = useState(false);
  const saveWarningTimerRef = useRef<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tutorialPrintPhotos, setTutorialPrintPhotos] = useState<string[]>([]);

  const photosTopRef = useRef<HTMLDivElement | null>(null);
  const shareBoxRef = useRef<HTMLDivElement | null>(null);
  const hydratedRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const dimTapCountRef = useRef(0);
  const dimTapTimerRef = useRef<number | null>(null);

  const [imageLoadError, setImageLoadError] = useState<string | null>(null);

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

  const [photobooth, setPhotobooth] = useState<{
    photos: string[];
    galleryUrl?: string | null;
  } | null>(null);

  // ── DERIVED STATE ──────────────────────────────────────────────────────────

  const { mode, browsePage, printPage, downloadPage, selectedPrint, selectedDownload, shareUrl, shareError } = gallery;
  const selectingPhotos = mode !== "none" || igProposeMode || moderationMode;

  const totalPhotos = album?.photos?.length ?? 0;
  const hasPhotos = totalPhotos > 0;
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

  const originalByMediaKey = useMemo(() => {
    const map = new Map<string, string>();
    (album?.originalPhoto ?? []).forEach((url) => map.set(mediaKeyFromUrl(url), url));
    return map;
  }, [album?.originalPhoto]);

  const previewByName = useMemo(() => {
    const map = new Map<string, string>();
    (album?.photos ?? []).forEach((url) => map.set(fileNameFromUrl(url), url));
    return map;
  }, [album?.photos]);

  const shareReviewPhotos = useMemo(
    () => Array.from(selectedDownload).map((fileName) => ({ fileName, src: previewByName.get(fileName) ?? "" })).filter((photo) => photo.src),
    [selectedDownload, previewByName],
  );

  const resolveOriginalPhoto = useCallback((url: string) => {
    return originalByName.get(fileNameFromUrl(url)) ?? originalByMediaKey.get(mediaKeyFromUrl(url)) ?? url;
  }, [originalByName, originalByMediaKey]);

  const galleryOrgPhotos = useMemo(() => {
    if (!galleryPhotos.length) return [];
    if (!album?.originalPhoto?.length) return galleryPhotos;
    return galleryPhotos.map(resolveOriginalPhoto);
  }, [galleryPhotos, album?.originalPhoto, resolveOriginalPhoto]);

  const featuredOrgPhotos = useMemo(() => {
    const featured = album?.featured ?? [];
    if (!featured.length) return [];
    if (!album?.originalPhoto?.length) return featured;
    return featured.map(resolveOriginalPhoto);
  }, [album?.featured, album?.originalPhoto, resolveOriginalPhoto]);

  const lightboxPhotos = useMemo(() => {
    const photos = album?.photos ?? [];
    if (!photos.length) return [];
    if (!album?.originalPhoto?.length) return photos;
    return photos.map(resolveOriginalPhoto);
  }, [album?.photos, album?.originalPhoto, resolveOriginalPhoto]);

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

  // Opened from one of our notifications (`?s=sms-nou`…): tell /admin/live and Activitate which one.
  // Once per tab per link, so refreshing the page does not report it again. The admin is not tracked.
  useEffect(() => {
    if (!slug || auth.authorise) return;
    const source = parseNotificationSource(new URLSearchParams(window.location.search).get(NOTIFICATION_SOURCE_PARAM));
    if (!source) return;
    const key = `av_notification_open_${slug}_${source.channel}-${source.kind}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* still report */ }
    sendLiveEvent("album_notification_opened", {
      priority: "high",
      label: source.label,
      meta: { slug, channel: source.channel, kind: source.kind },
    });
  }, [slug, auth.authorise]);

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

  // Verifică dacă primul URL de imagine e accesibil după ce albumul se încarcă
  useEffect(() => {
    if (!album?.photos?.length) return;
    const firstUrl = album.photos[0];
    const img = new window.Image();
    img.onload = () => setImageLoadError(null);
    img.onerror = () => {
      const msg = `URL inaccesibil: ${firstUrl.slice(0, 80)}...`;
      console.error("[album] Prima imagine nu s-a putut încărca:", firstUrl);
      setImageLoadError(msg);
    };
    img.src = firstUrl;
  }, [album?.photos]);

  // Trimite email admin automat când diagnosticul apare
  useEffect(() => {
    if (!slug || !album) return;
    // Nu raporta dacă cel care vede ecranul e chiar adminul logat (test propriu)
    if (isAdmin || auth.authorise) return;
    const photosEmpty = !album.photos?.length;
    if (!photosEmpty && !imageLoadError) return;
    fetch(`/api/album/${slug}/report-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photosCount: album.photos?.length ?? 0,
        errorMessage: imageLoadError ?? "Array photos gol (0 poze)",
        pageUrl: typeof window !== "undefined" ? window.location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        timestamp: new Date().toLocaleString("ro-RO"),
      }),
    }).catch(() => {});
  }, [album, imageLoadError, slug, isAdmin, auth.authorise]);

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
    fetch(`/api/album/${slug}/photobooth`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPhotobooth(data))
      .catch(() => setPhotobooth(null));
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getDeliveryData(slug);
        if (!cancelled) {
          setSwissLink(data.swissLink || null);
          setHasDeliveryAddress(!!data.deliveryAddress?.fullName);
        }
      } catch (error) {
        console.error("Failed to load delivery data", error);
        if (!cancelled) { setSwissLink(null); setHasDeliveryAddress(false); }
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
    if (mode !== "download") {
      setSharePanelOpen(false);
      setShareMode("selected");
    }
  }, [mode]);

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

  // Arată mesaj după 8s dacă tot se încarcă
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setLoadingSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  // Trimite raport admin dacă albumul durează >8s să se încarce
  useEffect(() => {
    if (!loadingSlow || !slug) return;
    // Nu raporta dacă cel care vede ecranul e chiar adminul logat (test propriu)
    if (isAdmin || auth.authorise) return;
    fetch(`/api/album/${slug}/report-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        errorMessage: "Albumul durează mai mult de 8 secunde să se încarce",
        pageUrl: typeof window !== "undefined" ? window.location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        timestamp: new Date().toLocaleString("ro-RO"),
      }),
    }).catch(() => {});
  }, [loadingSlow, slug, isAdmin, auth.authorise]);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      console.log(`[album] fetch /api/album/${slug}`);
      try {
        const response = await fetch(`/api/album/${slug}`);
        console.log(`[album] status: ${response.status}`);
        if (!response.ok) {
          console.warn(`[album] răspuns non-ok (${response.status}) pentru slug="${slug}"`);
          if (response.status === 410) setAlbumExpired(true);
          setAlbum(null); setLoading(false); return;
        }
        const data = await response.json();
        console.log(`[album] date primite:`, {
          title: data?.title,
          photos: data?.photos?.length ?? 0,
          featured: data?.featured?.length ?? 0,
          albumSlug: data?.albumSlug,
          zipReady: data?.zipReady,
        });
        if (!data?.photos?.length) {
          console.warn(`[album] ⚠ pozele sunt goale (photos=[]) pentru slug="${slug}". Verifică folderul Bunny: ${slug}/photos/ sau ${slug}/photos_preview/`);
        }
        setAlbum(data);
        setLoading(false);
      } catch (error) {
        console.error(`[album] eroare fetch:`, error);
        setAlbum(null); setLoading(false);
      }
    })();
  }, [slug]);

  // After an admin upload from this page (photos / short video): the server already dropped its album cache.
  const reloadAlbum = () => {
    if (!slug) return;
    fetch(`/api/album/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setAlbum(data); })
      .catch(() => {});
  };

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
    setPrintSaveError(null);
    setPrintSaved(false);
    const initial = new Set<string>((album?.print ?? []).map(fileNameFromUrl));
    dispatch({ type: "OPEN_PRINT_MODE", initial, currentPage: safePage });
  };

  const openDownloadMode = () => dispatch({ type: "OPEN_DOWNLOAD_MODE", currentPage: safePage });
  const scrollToPhotos = () => requestAnimationFrame(() => photosTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const closeMode = () => { setShareIntent(false); dispatch({ type: "CLOSE_MODE", currentPage: safePage }); };

  const togglePhoto = (src: string) => {
    if (mode !== "print" && mode !== "download") return;
    if (mode === "print") setPrintSaved(false);
    dispatch({ type: "TOGGLE_PHOTO", mode, name: fileNameFromUrl(src) });
  };

  const onDimmedTap = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== "print") return;
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

  const requestZip = async () => {
    if (!slug || zipRequest === "sending" || zipRequest === "sent") return;
    setZipRequest("sending");
    try {
      const response = await fetch(`/api/album/${encodeURIComponent(slug)}/zip-request`, { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      setZipRequest("sent");
    } catch {
      setZipRequest("error");
    }
  };

  const savePrintSelection = async () => {
    if (!slug || savingPrint) return;
    setSavingPrint(true);
    setPrintSaveError(null);
    setPrintSaved(false);
    try {
      const response = await fetch(`/api/album/${slug}/print-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: Array.from(selectedPrint) }),
      });
      if (!response.ok) throw new Error("Nu am putut salva selecția. Încearcă din nou; pozele bifate sunt păstrate.");
      const refreshResponse = await fetch(`/api/album/${slug}`);
      if (!refreshResponse.ok) throw new Error("Selecția a fost trimisă, dar nu am putut verifica salvarea. Încearcă din nou.");
      const refreshed = await refreshResponse.json();
      setAlbum(refreshed);
      dispatch({ type: "SET_MODE", payload: "none" });
      setPrintSaved(true);
    } catch (error) {
      setPrintSaveError(error instanceof Error ? error.message : "Nu am putut salva selecția. Încearcă din nou.");
    } finally {
      setSavingPrint(false);
    }
  };

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/album/${slug}/print-selection/notify`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { nextAllowedAt?: number | null } | null) => setPrintNotifyUntil(data?.nextAllowedAt ?? null))
      .catch(() => undefined);
  }, [slug]);

  const notifyPrintSelection = async () => {
    if (!slug || notifyingPrint || printCount === 0) return;
    setNotifyingPrint(true);
    try {
      const response = await fetch(`/api/album/${slug}/print-selection/notify`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { nextAllowedAt?: number };
      if (response.status === 429) {
        setPrintNotifyUntil(data.nextAllowedAt ?? null);
        return;
      }
      if (!response.ok) throw new Error("Nu am putut trimite notificarea.");
      setPrintNotified(true);
      setPrintNotifyUntil(data.nextAllowedAt ?? Date.now() + 24 * 60 * 60 * 1000);
    } catch {
      setPrintSaveError("Nu am putut trimite notificarea. Încearcă din nou.");
    } finally {
      setNotifyingPrint(false);
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
    // Confirmed in ResetPrintModal (the client typed "resetez toată selecția").
    if (!album || !slug) return;
    setShowResetPrint(false);
    setAlbum((prev) => (prev ? { ...prev, print: [] } : null));
    try {
      const response = await fetch(`/api/album/${slug}/print-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      const refreshed = await fetch(`/api/album/${slug}`).then((res) => res.json());
      setAlbum(refreshed);
    }
  };

  const deletePhoto = async (signedUrl: string) => {
    if (!slug || !isAdmin) return;
    const fileName = fileNameFromUrl(signedUrl);
    if (!window.confirm(`ȘTERGI DEFINITIV POZA:\n\n"${fileName}"\n\n• Se șterge de pe server și din photos_preview, și din photos (originalul)\n• Va dispărea din toate secțiunile\n• Acțiunea este IREVERSEBILĂ!\n\nConfirmi?`)) return;
    try {
      const response = await fetch(`/api/album/${slug}/delete-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
        body: JSON.stringify({ filename: fileName }),
      });
      if (response.ok) {
        setAlbum(await response.json());
      } else if (response.status === 401 || response.status === 403) {
        alert("Acces interzis: intră în cont ca admin ca să ștergi poze.");
        setIsAdmin(false);
        setAdminKey("");
        localStorage.removeItem(`adminKey_${slug}`);
      } else {
        // Any other failure keeps the admin mode: the photo can be tried again.
        const error = await response.json().catch(() => ({})) as { error?: string };
        const reasons: Record<string, string> = {
          photo_not_found: "Poza nu mai există pe server (poate a fost ștearsă deja). Reîncarcă pagina.",
          failed_to_delete_file: "Bunny nu a putut șterge poza. Încearcă din nou.",
          failed_to_reload_album: "Poza s-a șters, dar albumul nu s-a putut reîncărca. Reîncarcă pagina.",
        };
        alert(reasons[error.error ?? ""] ?? `Eroare la ștergere (${error.error ?? response.status}).`);
      }
    } catch {
      alert("Eroare de conexiune.");
    }
  };

  const createShareLink = async (mode: "selected" | "all" = "selected"): Promise<string | null> => {
    if (!slug || selectedDownload.size === 0) return null;
    setCreatingShare(true);
    dispatch({ type: "SET_SHARE_URL", url: null, error: null });
    try {
      const priorityItems = Array.from(selectedDownload);
      const allItems = mode === "all" ? (album?.photos ?? []).map(fileNameFromUrl) : undefined;
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...coupleKeyHeaders(coupleKey) },
        body: JSON.stringify({
          slug,
          items: priorityItems,
          ...(mode === "all" && allItems ? { allItems, showAll: true } : {}),
        }),
      });
      const text = await response.text().catch(() => "");
      if (!response.ok) {
        const error = response.status === 413
          ? "Prea multe poze într-un singur link (maximum 2000). Debifează câteva și încearcă din nou."
          : `Share failed (${response.status})`;
        dispatch({ type: "SET_SHARE_URL", url: null, error });
        return null;
      }
      let data: ShareCreateResponse;
      try { data = JSON.parse(text); } catch {
        dispatch({ type: "SET_SHARE_URL", url: null, error: "Invalid response" });
        return null;
      }
      if (!data?.id) {
        dispatch({ type: "SET_SHARE_URL", url: null, error: "Missing id" });
        return null;
      }
      const url = `${window.location.origin}/share/${data.id}`;
      dispatch({ type: "SET_SHARE_URL", url, error: null });
      setShareListVersion((v) => v + 1);
      return url;
    } finally {
      setCreatingShare(false);
    }
  };

  // One tap: create the anonymous link (if needed) and open WhatsApp with it already written.
  // The tab is opened during the click, otherwise browsers block it after the await.
  // `reuse` keeps the link already shown in the panel; the main button always makes a fresh
  // link, so a changed selection never sends the old photos.
  const sendShare = async (channel: "whatsapp" | "sms", reuse = false) => {
    const existing = reuse ? shareUrl : null;
    if (channel === "sms") {
      const url = existing ?? await createShareLink(shareMode);
      if (url) setSmsListUrl(url);
      return;
    }
    const popup = existing ? null : window.open("", "_blank");
    const url = existing ?? await createShareLink(shareMode);
    if (!url) { popup?.close(); return; }
    const target = whatsappShareUrl(url);
    if (popup) popup.location.href = target;
    else window.open(target, "_blank", "noopener");
  };

  const closeShareReview = useCallback(() => setShareReview(null), []);
  const closeSmsList = useCallback(() => setSmsListUrl(null), []);
  const closeResetPrint = useCallback(() => setShowResetPrint(false), []);

  useEffect(() => {
    if (!auth.authorise || !auth.accessToken || !slug) return;
    fetch(`/api/instagram-proposals/album/${slug}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((response) => response.json())
      .then((data) => { if (data.proposals) setIgProposals(data.proposals); })
      .catch(() => {});
    fetch(`/api/album-subscriptions/list/${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((response) => response.json())
      .then((data: { subscribers?: { email: string; subscribedAt?: string }[] }) => {
        if (data.subscribers) setSubscribers(data.subscribers);
      })
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
    if (proposalDestinations.has("media_assets") && proposalMediaServices.size === 0) return;
    setSubmittingIgPropose(true);
    try {
      const previews = album.photos ?? [];
      const originals = album.originalPhoto ?? [];
      const originalByMediaKey = new Map(originals.map(url => [mediaKeyFromUrl(url), url]));
      const toPropose = previews
        .filter(url => selectedIgPropose.has(fileNameFromUrl(url)))
        .map(previewUrl => originalByMediaKey.get(mediaKeyFromUrl(previewUrl)) ?? previewUrl);
      const results = await Promise.all(
        toPropose.map((photoUrl) =>
          fetch("/api/instagram-proposals", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
            body: JSON.stringify({
              albumSlug: slug,
              photoUrl,
              fileName: fileNameFromUrl(photoUrl),
              destinations: Array.from(proposalDestinations),
              mediaAssetServiceIds: Array.from(proposalMediaServices),
            }),
          }).then((r) => r.json())
        )
      );
      const failed = results.filter(result => !result.ok);
      const refreshed = await fetch(`/api/instagram-proposals/album/${encodeURIComponent(slug)}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      if (!refreshed.ok) throw new Error("Nu am putut actualiza voturile. Reîncarcă pagina.");
      const refreshedData = await refreshed.json();
      setIgProposals(refreshedData.proposals ?? []);
      if (failed.length) throw new Error(`${failed.length} propuneri nu au fost salvate. Încearcă din nou.`);
      const destinationLabel =
        proposalDestinations.size === 2
          ? "Instagram + Media Assets"
          : proposalDestinations.has("media_assets")
            ? "Media Assets"
            : "Instagram";
      setIgProposeResult(`${results.length} ${results.length === 1 ? "poză propusă" : "poze propuse"} pentru ${destinationLabel}.`);
      setSelectedIgPropose(new Set());
      setIgProposeMode(false);
    } catch (error) {
      setIgProposeResult(error instanceof Error ? error.message : "Nu am putut salva propunerile.");
    } finally {
      setSubmittingIgPropose(false);
    }
  };

  const submitVideoImport = async () => {
    if (!album?.shortvideo || !auth.accessToken || videoImportServices.size === 0) return;
    setVideoImporting(true);
    setVideoImportResult(null);
    try {
      const videoUrl = album.shortvideo;
      const fileName = fileNameFromUrl(videoUrl);
      await Promise.all(Array.from(videoImportServices).map(serviceId =>
        fetch("/api/oferte/admin/media-assets/import-from-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
          body: JSON.stringify({ items: [{ url: videoUrl, fileName }], serviceId, sourceAlbumSlug: slug }),
        })
      ));
      setVideoImportResult(`Video importat în ${videoImportServices.size === 1 ? "1 serviciu" : `${videoImportServices.size} servicii`}.`);
      setVideoImportOpen(false);
    } catch {
      setVideoImportResult("Eroare la import.");
    } finally {
      setVideoImporting(false);
    }
  };

  const updateIgStatus = async (id: string, status: "accepted" | "rejected") => {
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


  const showImageSaveWarning = () => {
    setShowSaveWarning(true);
    if (saveWarningTimerRef.current) window.clearTimeout(saveWarningTimerRef.current);
    saveWarningTimerRef.current = window.setTimeout(() => setShowSaveWarning(false), 5000);
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

  if (loading) return (
    <div style={{ minHeight: "calc(var(--stable-vh, 1vh) * 100)", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <AncaLoader />
      {loadingSlow && (
        <div style={{ textAlign: "center", padding: "0 24px" }}>
          <p style={{ color: "#555", fontSize: 14, margin: "0 0 6px" }}>
            Se încarcă albumul... câteva secunde
          </p>
          <p style={{ color: "#333", fontSize: 12, margin: 0 }}>
            Serverul procesează un număr mare de fotografii
          </p>
        </div>
      )}
    </div>
  );
  if (!album) {
    return albumExpired
      ? <AlbumNotFound heading="Link-ul a expirat" message="Acest link nu mai este disponibil momentan. Scrie-ne dacă ai nevoie de el și îl retrimitem." />
      : <AlbumNotFound />;
  }

  // Nothing in the album yet (owner, 2026-10-28): visitors get a plain explanation — photos not
  // uploaded yet, or a wrong link — with no consent pop-up. A signed-in admin sees the page, to upload.
  const isEmptyAlbum = !album.photos?.length && !album.featured?.length && !album.shortvideo && !album.longvideo;
  if (isEmptyAlbum && !isAdmin && !auth.authorise) return <EmptyAlbumNotice slug={slug ?? ""} />;

  // ── DIAGNOSTIC PANEL — the album has photos but they fail to load ─────────
  const showDiagnostic = !!imageLoadError;
  const DiagnosticPanel = showDiagnostic ? (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "#0a0a0a",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px", textAlign: "center",
    }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
      <p style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>
        Pozele nu se pot încărca momentan
      </p>
      <p style={{ color: "#aaa", fontSize: 14, margin: 0, lineHeight: 1.6, maxWidth: 380 }}>
        Am fost anunțați automat și ne uităm. Reîncărcați pagina peste câteva minute.
      </p>
    </div>
  ) : null;

  return (
    <>
    {DiagnosticPanel}
    {showSaveWarning && (
      <div
        onClick={() => setShowSaveWarning(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.94)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "32px", textAlign: "center", cursor: "pointer",
        }}
      >
        <div style={{ fontSize: "44px", marginBottom: "18px" }}>📷</div>
        <p style={{ color: "#facc15", fontSize: "21px", fontWeight: 700, margin: "0 0 14px", lineHeight: 1.4, maxWidth: "480px", letterSpacing: "0.01em" }}>
          Pozele afișate sunt de <strong>calitate mai slabă</strong>
        </p>
        <p style={{ color: "#bbb", fontSize: "15px", margin: "0 0 26px", maxWidth: "460px", lineHeight: 1.7 }}>
          Descărcarea directă a imaginii este dezactivată pentru a nu salva varianta WebP optimizată pentru browser.<br />
          Pentru pozele la <strong style={{ color: "#fff" }}>calitate completă</strong>, folosește{" "}
          <strong style={{ color: "#facc15" }}>butonul de download de pe fiecare fotografie</strong> sau{" "}
          <strong style={{ color: "#facc15" }}>„Descarcă toate pozele”</strong>.
        </p>
        <span style={{ color: "#555", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Atinge oriunde pentru a închide</span>
      </div>
    )}
    <div className={styles.page}>
      <div className={styles.container}>

        {slug && !isEmptyAlbum && typeof window !== "undefined" && window.location.hostname !== "localhost" && (
          <MediaConsentModal
            slug={slug}
            retention={album?.retention ?? null}
            isAdmin={isAdmin || auth.authorise}
            onAccepted={() => {
              setConsentGiven(true);
              if (!isPrintInvitation && hasPhotos && !isAdmin && !auth.authorise && !localStorage.getItem(ONBOARDING_STORAGE_KEY)) {
                setTimeout(() => setShowOnboarding(true), 500);
              }
            }}
          />
        )}

        <OnboardingWizard
          forceShow={showOnboarding}
          onStart={() => {
            if (!album?.photos?.length) return;
            const candidates = [...album.photos].sort(() => Math.random() - 0.5).slice(0, 15);
            Promise.all(
              candidates.map(url => new Promise<{ url: string; landscape: boolean }>(resolve => {
                const img = new Image();
                const timer = setTimeout(() => resolve({ url, landscape: false }), 3000);
                img.onload = () => { clearTimeout(timer); resolve({ url, landscape: img.naturalWidth > img.naturalHeight }); };
                img.onerror = () => { clearTimeout(timer); resolve({ url, landscape: false }); };
                img.src = url;
              }))
            ).then(results => {
              const landscape = results.filter(r => r.landscape).map(r => r.url);
              setTutorialPrintPhotos(landscape.length >= 3 ? landscape.slice(0, 3) : candidates.slice(0, 3));
            });
          }}
          onClose={() => { setShowOnboarding(false); setTutorialPrintPhotos([]); }}
        />


        {lightboxIndex !== null && lightboxPhotos.length > 0 && album?.photos && (
          <PortfolioLightbox
            open={lightboxIndex !== null}
            index={lightboxIndex}
            close={closeLightbox}
            slides={lightboxPhotos.map((src) => ({ src }))}
            glows={album.photos}
            isMobile={typeof window !== "undefined" && window.innerWidth < 640}
            swipeHint={true}
            downloadHint={true}
            selectedPrint={selectedPrint}
            onTogglePrint={(fileName) => dispatch({ type: "TOGGLE_PHOTO", mode: "print", name: fileName })}
            getFileName={(src, index) => fileNameFromUrl(album.photos[index] ?? src)}
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
              onClick={() => { window.location.href = `/login?redirect=${encodeURIComponent(`/media/${slug}`)}`; }}
            >
              🔑 Acces administrare
            </button>
          </div>
        )}

        {/* AncaVisuals wordmark, centred at the very top (same lettering as the site / login). */}
        {/* Signed in: the floating Admin / Client / Log out bar sits at the top right, so the
            logo moves down below it instead of hiding under it. */}
        <a href="/" className={`mb-6 block text-center no-underline ${signedInAsAdmin ? "mt-12" : "mt-2"}`} aria-label="AncaVisuals — pagina principală">
          <span className="text-xl uppercase tracking-[0.3em] sm:text-2xl">
            <span className="font-bold text-white">Anca</span>
            <span className="font-light text-neutral-300">Visuals</span>
          </span>
        </a>

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

        {slug && (
          <div id="album-updates">
            <AlbumUpdatesSection
              slug={slug}
              isAdmin={auth.authorise}
              accessToken={auth.accessToken ?? null}
              adminPreviewHidden={signedInAsAdmin && clientPreview}
              onExitClientPreview={() => setClientPreview(false)}
            />
          </div>
        )}

        {auth.authorise && slug && <PrintSelectionLink key={slug} albumSlug={slug} />}
        {auth.authorise && slug && <PrintReminderPanel key={`reminder-${slug}`} slug={slug} accessToken={auth.accessToken ?? null} />}

        {/* Admin view (🛠 Admin in the top bar): admin shortcuts come first. In 👁 Client view
            auth.authorise is false, so this disappears and the page looks exactly like the client's.
            The full tools sit next to the photos, where you pick them. */}
        {auth.authorise && !isModerationMode && (
          <nav aria-label="Unelte admin" className="mb-5 border border-neutral-700 bg-neutral-950 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">🛠 Unelte admin <span className="normal-case tracking-normal text-neutral-600">(doar tu le vezi)</span></p>
              <a href="/admin/image-optimizer" target="_blank" rel="noreferrer" className="text-xs text-[#4ade80] underline underline-offset-4 hover:text-[#86efac]">🖼️ Optimizare poze ↗</a>
            </div>
            {(igProposeResult || moderationSubmitResult) && (
              <p role="status" className="mb-2 text-xs text-[#4ade80]">{igProposeResult || moderationSubmitResult}</p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => { if (slug) window.location.href = `/admin/instagram-proposals?album=${encodeURIComponent(slug)}`; }}
                className="border border-[#dd2a7b] px-3 py-2.5 text-left text-sm font-bold text-[#f9a8d4] hover:bg-[#2a0a1a]"
              >
                👀 Vezi pozele propuse ({igProposals.length})
                <span className="block text-[11px] font-normal text-neutral-400">
                  {igProposals.length === 0
                    ? "Nicio poză propusă încă · deschide Propuneri Media"
                    : `${igProposals.filter((p) => p.status === "pending").length} în așteptare · în Propuneri Media`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => { closeMode(); setIgProposeMode(true); setIgProposeResult(null); setProposalDestinations(new Set(["instagram", "media_assets"])); setProposalMediaServices(new Set(["photo"])); scrollToPhotos(); }}
                className="bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-3 py-2.5 text-left text-sm font-bold text-white"
              >
                📸 Propune Instagram / Media Assets
                {igProposals.filter((p) => p.status === "pending").length > 0 && <span className="ml-1.5 bg-black/30 px-1.5 text-xs">{igProposals.filter((p) => p.status === "pending").length}</span>}
              </button>
              <button
                type="button"
                onClick={() => { closeMode(); setInvitePanelOpen(true); requestAnimationFrame(() => scrollToId("proposal-invites")); }}
                className="border border-neutral-600 px-3 py-2.5 text-left text-sm font-bold text-white hover:border-white"
              >
                🔗 Invită pe cineva să aleagă poze
                <span className="block text-[11px] font-normal text-neutral-400">Link unic pentru soție, Salomeea…</span>
              </button>
              {/* The client's "Trimite poze invitaților", here too: no switching to 👁 Client to send photos. */}
              <button
                type="button"
                onClick={() => { closeMode(); openDownloadMode(); setShareIntent(true); scrollToPhotos(); }}
                className="border border-[#166534] px-3 py-2.5 text-left text-sm font-bold text-[#4ade80] hover:border-[#4ade80]"
              >
                📤 Trimite poze cuiva
                <span className="block text-[11px] font-normal text-neutral-400">Bifezi pozele → link anonim pe WhatsApp / SMS</span>
              </button>
              <button
                type="button"
                onClick={() => { closeMode(); setModerationMode(true); scrollToPhotos(); }}
                className="border border-amber-800 px-3 py-2.5 text-left text-sm font-bold text-amber-300 hover:border-amber-500"
              >
                🗑️ Propune ștergere
              </button>
            </div>
          </nav>
        )}

        {auth.authorise && !isModerationMode && slug && auth.accessToken && (
          <MediaAdminPhotoUpload slug={slug} accessToken={auth.accessToken} onUploaded={reloadAlbum} />
        )}

        {/* "Ce poți face aici" is the client's menu: not shown in the 🛠 Admin view. */}
        {!isModerationMode && !auth.authorise && (
          <AlbumActionHub
            hasPhotos={hasPhotos}
            printCount={printCount}
            hasDeliveryAddress={hasDeliveryAddress}
            zipReady={Boolean(album.zipReady)}
            zipRequest={zipRequest}
            onRequestZip={() => void requestZip()}
            isCouple={isCouple}
            onPickAlbumPhotos={() => { openPrintMode(); scrollToPhotos(); }}
            onShare={() => { openDownloadMode(); setShareIntent(true); scrollToPhotos(); }}
            onDelivery={() => (hasDeliveryAddress ? setShowDeliveryModal(true) : setIsFormOpen(true))}
            onDownloadAll={() => (album.zipReady ? downloadAllPhotos() : scrollToPhotos())}
            onUpdates={() => { window.dispatchEvent(new Event(OPEN_ALBUM_UPDATES_EVENT)); scrollToId("album-updates"); }}
            onSentPhotos={() => scrollToId("share-manager")}
            onTutorial={() => { localStorage.removeItem(ONBOARDING_STORAGE_KEY); setShowOnboarding(true); }}
          />
        )}


        {/* The big white "how to pick your album photos" guide is for the client only. */}
        {(isPrintInvitation || !isModerationMode) && !auth.authorise && (
          <PrintSelectionGuide
            selecting={mode === "print"} count={selectedPrint.size} savedCount={printCount}
            hasPhotos={hasPhotos} saving={savingPrint} saved={printSaved} error={printSaveError}
            onStart={() => {
              openPrintMode();
              photosTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            onSave={() => void savePrintSelection()} onDelivery={() => setIsFormOpen(true)}
            notifying={notifyingPrint} notified={printNotified} notifiedUntil={printNotifyUntil} onNotify={() => void notifyPrintSelection()}
          />
        )}

        {isAdmin && (
          <div className={styles.actionButtons}>
            {printCount > 0 && (
              <button type="button" className={styles.pickBtn} onClick={downloadPrintDynamic}>
                ⬇ Descarcă selecția de imprimat ({printCount})
              </button>
            )}
          </div>
        )}

        {shareReview && mode === "download" && (
          <ShareReviewModal
            photos={shareReviewPhotos}
            channel={shareReview}
            sending={creatingShare}
            onRemove={(name) => dispatch({ type: "TOGGLE_PHOTO", mode: "download", name })}
            onClose={closeShareReview}
            onConfirm={() => {
              // sendShare opens the WhatsApp tab synchronously inside this click, then fills it.
              const channel = shareReview;
              void sendShare(channel).finally(() => setShareReview(null));
            }}
          />
        )}

        {showResetPrint && <ResetPrintModal count={printCount} onCancel={closeResetPrint} onConfirm={() => void resetAllPrint()} />}
        {smsListUrl && <SmsSendList shareUrl={smsListUrl} onClose={closeSmsList} />}

        {isFormOpen && (
          <DeliveryForm
            albumId={slug || "hello"}
            initial={deliveryEditInitial ?? undefined}
            onClose={() => { setIsFormOpen(false); setDeliveryEditInitial(null); }}
            onSuccess={() => { setIsFormOpen(false); setDeliveryEditInitial(null); }}
          />
        )}

        {showDeliveryModal && (
          <DeliveryAddressModal
            slug={slug || ""}
            isOpen={showDeliveryModal}
            onClose={() => setShowDeliveryModal(false)}
            onEdit={(address) => { setDeliveryEditInitial(address); setShowDeliveryModal(false); setIsFormOpen(true); }}
          />
        )}

        <div className={styles.divider} />

        {keyRejected && (
          <p role="status" style={{ margin: "0 0 16px", padding: "10px 14px", border: "1px solid #5a4a1c", borderRadius: "8px", color: "#e8d4a2", fontSize: "13px" }}>
            Linkul de miri a fost înlocuit. Cereți-ne pe WhatsApp linkul nou ca să vedeți pozele trimise.
          </p>
        )}

        {/* Sending photos to guests is a client thing: hidden in the 🛠 Admin view. */}
        {isCouple && coupleKey && slug && mode !== "print" && !auth.authorise && (
          <div id="share-manager">
            <ShareManagerPanel slug={slug} coupleKey={coupleKey} refreshToken={shareListVersion} />
          </div>
        )}

        {album.featured?.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Selectate</h2>
            <BunnyPhotoGallery orgPhoto={featuredOrgPhotos} photos={album.featured} variant="plain" protectImages={true} onProtectedContextMenu={showImageSaveWarning} />
          </>
        )}

        {auth.authorise && mode === "none" && !igProposeMode && !moderationMode && (
          <div id="proposal-invites" style={{ margin: "0 0 14px", padding: "14px 16px", background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setInvitePanelOpen((prev) => !prev)}
              style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center", background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
            >
              <div>
                <p style={{ color: "#fff", fontSize: "13px", fontWeight: 700, margin: 0 }}>Link unic de selecție poze</p>
                {!isMobile && (
                  <p style={{ color: "#777", fontSize: "12px", margin: "4px 0 0" }}>
                    Persoana își scrie numele și alege pozele pentru Instagram / Media Assets, fără cont. Se creează automat un task cu progres.
                  </p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ color: "#555", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Album: {slug}</span>
                <span style={{ color: "#888", fontSize: "16px", lineHeight: 1 }}>{invitePanelOpen ? "−" : "+"}</span>
              </div>
            </button>

            {invitePanelOpen && slug && auth.accessToken && <ProposalLinksPanel slug={slug} accessToken={auth.accessToken} />}
          </div>
        )}

        {auth.authorise && mode === "none" && igProposeMode && (
          <div style={{ margin: "0 0 12px", padding: "12px 14px", background: "#0d0d1f", border: "1px solid #3730a3", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <BurstPhotosNotice />
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: "#a5b4fc", fontSize: "12px", fontWeight: 600, marginRight: "4px" }}>Destinație:</span>
              {(["instagram", "media_assets"] as const).map((destination) => {
                const active = proposalDestinations.has(destination);
                return (
                  <button key={destination} type="button"
                    onClick={() => setProposalDestinations((prev) => { const next = new Set(prev); next.has(destination) ? next.delete(destination) : next.add(destination); if (next.size === 0) next.add("instagram"); return next; })}
                    style={{ padding: "4px 12px", background: active ? "#312e81" : "transparent", border: "1px solid #3730a3", borderRadius: "999px", color: active ? "#c7d2fe" : "#818cf8", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    {destination === "instagram" ? "Instagram" : "Media Assets"}
                  </button>
                );
              })}
            </div>
            {proposalDestinations.has("media_assets") && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: "#5eead4", fontSize: "12px", fontWeight: 600, marginRight: "4px" }}>Serviciu:</span>
                {OFFER_SERVICES.map((service) => {
                  const active = proposalMediaServices.has(service.id);
                  return (
                    <button key={service.id} type="button"
                      onClick={() => setProposalMediaServices((prev) => { const next = new Set(prev); next.has(service.id) ? next.delete(service.id) : next.add(service.id); return next; })}
                      style={{ padding: "4px 10px", background: active ? "#0f766e" : "transparent", border: "1px solid #134e4a", borderRadius: "999px", color: active ? "#99f6e4" : "#5eead4", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                    >
                      {service.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={submitIgProposals}
                disabled={submittingIgPropose || selectedIgPropose.size === 0 || (proposalDestinations.has("media_assets") && proposalMediaServices.size === 0)}
                style={{ padding: "6px 14px", background: selectedIgPropose.size > 0 ? "linear-gradient(135deg,#f58529,#dd2a7b,#8134af)" : "#1e1b4b", border: "none", borderRadius: "6px", color: selectedIgPropose.size > 0 ? "#fff" : "#4338ca", fontSize: "13px", fontWeight: 600, cursor: selectedIgPropose.size > 0 ? "pointer" : "not-allowed" }}
              >
                {submittingIgPropose ? "Se trimite..." : `Trimite propunere (${selectedIgPropose.size})`}
              </button>
              <button onClick={() => { setIgProposeMode(false); setSelectedIgPropose(new Set()); setProposalDestinations(new Set(["instagram", "media_assets"])); setProposalMediaServices(new Set(["photo"])); }}
                style={{ padding: "6px 12px", background: "none", border: "1px solid #3730a3", borderRadius: "6px", color: "#6366f1", fontSize: "13px", cursor: "pointer" }}
              >
                Anulează
              </button>
              {igProposeResult && <span style={{ color: "#4ade80", fontSize: "12px" }}>{igProposeResult}</span>}
            </div>
          </div>
        )}

        {auth.authorise && mode === "none" && moderationMode && (
          <div style={{ margin: "0 0 12px", padding: "10px 14px", background: "#1c1200", border: "1px solid #92400e", borderRadius: "8px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={() => setShowModerationSubmitModal(true)}
              disabled={selectedModeration.size === 0}
              style={{ padding: "6px 14px", background: selectedModeration.size > 0 ? "#d97706" : "#374151", border: "none", borderRadius: "6px", color: selectedModeration.size > 0 ? "#fff" : "#6b7280", fontSize: "13px", fontWeight: 600, cursor: selectedModeration.size > 0 ? "pointer" : "not-allowed" }}
            >
              {`Trimite spre moderare (${selectedModeration.size})`}
            </button>
            <button onClick={() => { setModerationMode(false); setSelectedModeration(new Set()); }}
              style={{ padding: "6px 12px", background: "none", border: "1px solid #92400e", borderRadius: "6px", color: "#d97706", fontSize: "13px", cursor: "pointer" }}
            >
              Anulează
            </button>
            {moderationSubmitResult && <span style={{ color: "#4ade80", fontSize: "12px" }}>{moderationSubmitResult}</span>}
          </div>
        )}

        {album.photos?.length > 0 && (
          <>
            <div className={styles.sectionRow} ref={photosTopRef}>
              <h2 className={styles.sectionTitle}>Fotografii ({album.photos.length})</h2>

              {mode === "none" ? (
                <div className={styles.rowActions}>
                  {!isModerationMode && (
                    album.zipReady ? (
                      <button className={styles.downloadAllPulse} type="button" onClick={downloadAllPhotos} data-onboarding="download-btn">
                        {"DESCARCĂ TOATE POZELE" + (stats ? ` (${fmtBytes(stats.photosBytesTotal)})` : "")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-onboarding="download-btn"
                        className={styles.pickBtnSecondary}
                        onClick={() => void requestZip()}
                        disabled={zipRequest === "sending" || zipRequest === "sent"}
                      >
                        {zipRequest === "sent"
                          ? "✓ Fotograful a fost anunțat că lipsește arhiva"
                          : zipRequest === "sending"
                            ? "Se trimite…"
                            : zipRequest === "error"
                              ? "Nu am putut trimite — încearcă din nou"
                              : "Arhiva cu toate pozele nu e gata · Anunță fotograful"}
                      </button>
                    )
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
                      <button
                        className={styles.shareGreenBtn}
                        type="button"
                        disabled={downloadCount === 0 || creatingShare}
                        onClick={() => setShareReview("whatsapp")}
                      >
                        {creatingShare ? "Se pregătește..." : `🟢 Trimite-le pe WhatsApp (${downloadCount})`}
                      </button>
                      <button
                        className={styles.pickBtnSecondary}
                        type="button"
                        disabled={downloadCount === 0 || creatingShare}
                        onClick={() => setShareReview("sms")}
                      >
                        💬 Prin SMS
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {isPrintInvitation && mode === "print" && (
              <p role="status" style={{ color: "#fef3c7", margin: "8px 0 16px" }}>
                {selectedPrint.size} / 100 poze selectate · Atinge pozele pentru bifare/debifare, apoi apasă „Salvează selecția”.
              </p>
            )}
            {!isPrintInvitation && printSaveError && <p role="alert">{printSaveError}</p>}
            {/* The how-to steps only until the first photo is ticked; after that they'd just push the photos down. */}
            {mode === "download" && shareIntent && downloadCount === 0 && !sharePanelOpen && !shareUrl && (
              <p role="status" style={{ margin: "8px 0 16px", padding: "10px 14px", background: "#0d1f0d", border: "1px solid #166534", borderRadius: "8px", color: "#bbf7d0", fontSize: "13px" }}>
                📤 <strong>1.</strong> Bifează pozele pe care vrei să le trimiți. <strong>2.</strong> Apasă butonul verde care pulsează, <strong>„Trimite-le pe WhatsApp”</strong> (sau „Prin SMS”) și verifici toate pozele alese; poți scoate oricare. <strong>3.</strong> Confirmi, se deschide WhatsApp: alegi oamenii cărora le trimiți și apeși Trimite. 🔒 Ei primesc un link anonim, doar cu pozele alese, fără acces la albumul vostru.
              </p>
            )}

            {mode === "download" && (sharePanelOpen || shareUrl || shareError) && (
              <div ref={shareBoxRef} className={styles.shareBox}>
                <div className={styles.shareTitle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Trimite pozele</span>
                  <button
                    type="button"
                    onClick={() => { setSharePanelOpen(false); dispatch({ type: "SET_SHARE_URL", url: null, error: null }); }}
                    style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "0 2px" }}
                    aria-label="Închide"
                  >×</button>
                </div>

                {shareError && <div className={styles.shareError}>{shareError}</div>}

                {shareUrl && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <ShareAnonymityNote />
                    <button type="button" onClick={() => void sendShare("whatsapp", true)} style={whatsappButtonStyle}>
                      🟢 TRIMITE-LE PE WHATSAPP
                    </button>
                    <p style={{ margin: 0, fontSize: "12px", color: "#86efac" }}>
                      Se deschide WhatsApp cu mesajul și linkul deja scrise — tu alegi doar persoanele cărora le trimiți.
                    </p>
                    <div className={styles.shareRow}>
                      <input className={styles.shareInput} value={shareUrl} readOnly aria-label="Linkul anonim cu pozele alese" />
                      <button className={styles.shareBtn} type="button" onClick={() => navigator.clipboard.writeText(shareUrl!)}>Copiază</button>
                    </div>
                    <button
                      type="button"
                      className={styles.pickBtnSecondary}
                      onClick={() => void sendShare("sms", true)}
                      style={{ width: "fit-content" }}
                    >
                      💬 Trimite prin SMS
                    </button>
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
                  protectImages={true}
                  onProtectedContextMenu={showImageSaveWarning}
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
                  protectImages={true}
                  onProtectedContextMenu={showImageSaveWarning}
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
                          style={{ cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                          draggable={false}
                          onContextMenu={(e) => { e.preventDefault(); showImageSaveWarning(); }}
                          onDragStart={(e) => e.preventDefault()}
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
                  protectImages={true}
                  onProtectedContextMenu={showImageSaveWarning}
                />
              )}
            </div>

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
              mobileColumns={mobileColumns}
              onMobileColumnsChange={setMobileColumns}
            />

            {/* Same blinking download button as above the photos, for whoever scrolled to the end. */}
            {mode === "none" && !isModerationMode && album.zipReady && (
              <div className="mb-8 mt-2 flex justify-center">
                <button className={styles.downloadAllPulse} type="button" onClick={downloadAllPhotos}>
                  {"DESCARCĂ TOATE POZELE" + (stats ? ` (${fmtBytes(stats.photosBytesTotal)})` : "")}
                </button>
              </div>
            )}
          </>
        )}

        {/* Dimmed only while editing the print selection: during "select for download/share" the
            saved print photos stay usable (download, reset, remove one). */}
        {!isModerationMode && <div className={mode === "print" ? styles.dimmedArea : undefined} onPointerDown={onDimmedTap}>
          <div data-onboarding="print-section">
            {/* One card in the album-photos colour (sky, like its tile in "Ce poți face aici"):
                count + progress, the two main actions side by side, show/hide as a full-width
                toggle, and reset as a quiet link so it is never pressed by mistake. */}
            <div className="mb-4 border border-[#0c4a6e] bg-[#06141d] p-3 sm:p-4" data-onboarding="print-zone">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-bold text-[#7dd3fc] sm:text-lg">🖼️ Pozele pentru album</h2>
                <span className="shrink-0 font-mono text-sm text-[#bae6fd]">
                  <strong className="text-white">{printCount}</strong> / 100
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-[#0c2a3a]" aria-hidden>
                <div className="h-full bg-[#38bdf8]" style={{ width: `${Math.min(100, printCount)}%` }} />
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                {printCount === 0
                  ? "Nu ai ales încă poze pentru imprimare."
                  : printCount < 100
                    ? `Mai poți alege ${100 - printCount}. Le poți schimba oricând.`
                    : "Selecția e completă. O poți schimba oricând."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {totalPhotos > 0 && (
                  <button
                    type="button"
                    onClick={openPrintMode}
                    className={`${printCount > 0 ? "" : "col-span-2 "}bg-[#0284c7] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#0ea5e9]`}
                  >
                    {printCount > 0 ? "✎ Modifică" : "Alege pozele"}
                  </button>
                )}
                {printCount > 0 && (
                  <button type="button" onClick={downloadPrintDynamic} className="whitespace-nowrap border border-[#38bdf8] px-3 py-2.5 text-sm font-bold text-[#7dd3fc] hover:bg-[#0c2a3a]">
                    ⬇ Descarcă tot
                  </button>
                )}
                {(printCount > 0 || tutorialPrintPhotos.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setPrintExpanded(value => !value)}
                    aria-expanded={printExpanded}
                    aria-controls="print-photos-content"
                    className="col-span-2 flex items-center justify-center gap-2 border border-[#0c4a6e] px-3 py-2 text-sm text-[#bae6fd] hover:border-[#38bdf8]"
                  >
                    {printExpanded ? "Ascunde pozele" : "Vezi pozele alese"} <span aria-hidden="true">{printExpanded ? "▲" : "▼"}</span>
                  </button>
                )}
              </div>
              {printCount > 0 && (
                <div className="mt-2 text-right">
                  <button type="button" onClick={() => setShowResetPrint(true)} className="text-xs text-red-400/80 underline underline-offset-4 hover:text-red-300">
                    Resetează toată selecția
                  </button>
                </div>
              )}
            </div>

            <div id="print-photos-content" hidden={!printExpanded}>
            {printCount > 0 ? (
              <>
                <MobileColumnsToggle mobileColumns={mobileColumns} onMobileColumnsChange={setMobileColumns} />
                <div className={styles.printPhotosGrid} data-columns={mobileColumns}>
                  {printPhotos.map(({ fileName, src }) => (
                    <div key={fileName} className={styles.printPhotoWrapper}>
                      <img
                        src={src}
                        alt={`Poză pentru imprimare: ${fileName}`}
                        className={styles.printPhotoImg}
                        loading="lazy"
                        draggable={false}
                        onContextMenu={(e) => { e.preventDefault(); showImageSaveWarning(); }}
                        onDragStart={(e) => e.preventDefault()}
                        style={{
                          WebkitTouchCallout: "none" as React.CSSProperties["WebkitTouchCallout"],
                          userSelect: "none",
                          pointerEvents: "none",
                        }}
                      />
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
            ) : tutorialPrintPhotos.length > 0 ? (
              <>
                <div style={{ margin: "0 0 10px", padding: "8px 14px", background: "#1a1000", border: "1px solid #ca8a04", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px" }}>🎓</span>
                  <p style={{ color: "#fbbf24", fontSize: "12px", margin: 0 }}>Exemplu tutorial — pozele tale selectate vor apărea aici</p>
                </div>
                <div className={styles.printPhotosGrid} data-columns={mobileColumns}>
                  {tutorialPrintPhotos.map((src) => (
                    <div key={src} className={styles.printPhotoWrapper} style={{ opacity: 0.6 }}>
                      <img src={src} alt="Exemplu poză imprimare" className={styles.printPhotoImg} loading="lazy" />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.emptyPrint}>Nu ai selectat încă poze pentru imprimat.</p>
            )}
            </div>
          </div>

          {(album.shortvideo || auth.authorise) && (
            <>
              {album.shortvideo ? (
                <ShortVideoPlayer slug={album.slug} fallbackSrc={album.shortvideo} />
              ) : (
                <h2 className={styles.sectionTitle}>Video scurt</h2>
              )}
              {auth.authorise && slug && (
                <div className="mb-6 mt-3">
                  <AlbumShortVideoManager
                    slug={slug}
                    accessToken={auth.accessToken}
                    onChanged={reloadAlbum}
                  />
                </div>
              )}
              {auth.authorise && album.shortvideo && (
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" }}>
                  {videoImportResult && (
                    <span style={{ fontSize: "12px", color: "#6ee7b7" }}>{videoImportResult}</span>
                  )}
                  {videoImportOpen ? (
                    <>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {OFFER_SERVICES.map(service => {
                          const active = videoImportServices.has(service.id);
                          return (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => setVideoImportServices(prev => {
                                const next = new Set(prev);
                                next.has(service.id) ? next.delete(service.id) : next.add(service.id);
                                return next;
                              })}
                              style={{ padding: "5px 10px", background: active ? "#0f766e" : "transparent", border: "1px solid #134e4a", borderRadius: "999px", color: active ? "#99f6e4" : "#5eead4", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                            >
                              {service.label}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={submitVideoImport}
                          disabled={videoImporting || videoImportServices.size === 0}
                          style={{ padding: "6px 14px", background: "#0f766e", border: "none", borderRadius: "6px", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                        >
                          {videoImporting ? "Se importă..." : "Importă în Media Assets"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoImportOpen(false)}
                          style={{ padding: "6px 12px", background: "none", border: "1px solid #374151", borderRadius: "6px", color: "#9ca3af", fontSize: "12px", cursor: "pointer" }}
                        >
                          Anulează
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setVideoImportOpen(true); setVideoImportResult(null); setVideoImportServices(new Set(["video"])); }}
                      style={{ padding: "6px 14px", background: "#134e4a", border: "1px solid #0f766e", borderRadius: "6px", color: "#5eead4", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                    >
                      Adaugă în Media Assets
                    </button>
                  )}
                </div>
              )}
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

          {slug && <AlbumVideoLinksSection slug={slug} isAdmin={auth.authorise} accessToken={auth.accessToken ?? null} hasUploadedShort={Boolean(album.shortvideo)} />}

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

          {photobooth && photobooth.photos.length > 0 && (
            <>
              <h2 className={styles.sectionTitle}>
                Poze fotocabină ({photobooth.photos.length})
              </h2>

              {photobooth.galleryUrl && (
                <div style={{ margin: "0 0 16px", padding: "14px 16px", background: "#111111", border: "1px solid #2f2f2f", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ color: "#f5f5f5", fontWeight: 600, fontSize: "13px", margin: 0 }}>Galeria de la fotocabină</p>
                    <p style={{ color: "#8b8b8b", fontSize: "12px", margin: "4px 0 0" }}>
                      Toate pozele făcute la fotocabină în timpul evenimentului.
                    </p>
                  </div>
                  <a
                    href={photobooth.galleryUrl}
                    className={styles.downloadBtn}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    DESCHIDE GALERIA FOTOCABINĂ
                  </a>
                </div>
              )}

              <div className={styles.printPhotosGrid} data-columns={mobileColumns}>
                {photobooth.photos.map((src) => (
                  <div key={src} className={styles.printPhotoWrapper}>
                    <img src={src} alt="Poză fotocabină" className={styles.printPhotoImg} loading="lazy" />
                    <a
                      href={src}
                      download
                      className={styles.pickBtnSecondary}
                      style={{ position: "absolute", bottom: 6, right: 6, fontSize: "12px", padding: "4px 10px" }}
                      aria-label="Descarcă poza"
                    >
                      ↓
                    </a>
                  </div>
                ))}
              </div>
            </>
          )}

          <MediaRetentionReminder slug={slug || ""} retention={album?.retention ?? null} />
        </div>}
      </div>
    </div>

    {/* While picking photos (album, download, Instagram / Media Assets, deletion) the portfolio
        photos below would look like part of the album and get in the way: hide them. */}
    {!selectingPhotos && <AncaVisualsPromo />}


    {auth.authorise && igProposals.length > 0 && (
      <div id="album-proposals" style={{ background: "#0a0a0a", borderTop: "1px solid #1a1a1a", padding: "32px 32px 48px", marginTop: "16px" }}>
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
                    background: proposal.status === "accepted" ? "#14532d" : proposal.status === "rejected" ? "#450a0a" : "#1e1b4b",
                    color: proposal.status === "accepted" ? "#4ade80" : proposal.status === "rejected" ? "#f87171" : "#a5b4fc",
                  }}>
                    {proposal.status === "accepted" ? "Acceptat" : proposal.status === "rejected" ? "Respins" : proposal.status === "archived" ? "Arhivat" : "În așteptare"}
                  </span>
                  {proposal.destinations && proposal.destinations.length > 0 && (
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                      {proposal.destinations.map((destination) => (
                        <span
                          key={destination}
                          style={{
                            display: "inline-block",
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "999px",
                            background: destination === "media_assets" ? "#0f3d3a" : "#3b1d4d",
                            color: destination === "media_assets" ? "#99f6e4" : "#f5b3ff",
                          }}
                        >
                          {destination === "media_assets" ? "Media Assets" : "Instagram"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {auth.user?.email === "ancadaniel1994@gmail.com" && (
                  <div style={{ display: "flex", gap: "4px", padding: "0 10px 10px" }}>
                    {proposal.status !== "accepted" && (
                      <button
                        onClick={() => updateIgStatus(proposal.id, "accepted")}
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

    {auth.authorise && subscribers.length > 0 && (
      <div style={{ background: "#0a0a0a", borderTop: "1px solid #1a1a1a", padding: "24px 32px 36px", marginTop: "8px" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <span style={{ fontSize: "16px" }}>🔔</span>
            <h2 style={{ color: "#fff", fontSize: "15px", fontWeight: 500, margin: 0 }}>
              Abonați la notificări
            </h2>
            <span style={{ background: "#1e3a5f", color: "#93c5fd", fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "999px" }}>
              {subscribers.length}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {subscribers.map((subscriber) => (
              <a
                key={subscriber.email}
                href={`mailto:${subscriber.email}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#111827", border: "1px solid #1f2937", borderRadius: "999px", padding: "5px 12px", color: "#93c5fd", fontSize: "12px", textDecoration: "none" }}
              >
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
                {subscriber.email}
              </a>
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
