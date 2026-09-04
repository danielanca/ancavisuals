import React, { useEffect, useRef, useState } from "react";
import useAuth from "../auth/useAuth";
import { CITIES } from "../../../pages/LocationSEO/locationData";
import ConfirmModal from "./ConfirmModal";

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}
interface ArticlePlan {
  targetKeyword: string;
  secondaryKeywords: string[];
}

interface Result {
  position: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
}
interface HistoryItem {
  id: string;
  capturedAt: string;
  ownDomainPosition: number | null;
  ownDomainUrl: string | null;
  positionChange: number | null;
  localPack: boolean;
  organicResults?: Result[];
}
interface LinkedPost {
  id: string;
  queryKey: string;
  slug: string;
  title: string;
  url: string;
  date?: string;
  linkedAt: string | null;
  status: "ranked" | "own_other" | "pending";
  rankedPosition: number | null;
}
interface Analysis {
  queryKey: string;
  keyword: string;
  city: string;
  provider: "serpapi" | "dataforseo";
  scanCount: number;
  firstScanAt: string;
  lastScanAt: string;
  firstPosition: number | null;
  latestPosition: number | null;
  positionTrend: number | null;
  latestOwnUrl: string | null;
  localPack: boolean;
  linkedPosts: LinkedPost[];
  positionHistory: PositionPoint[];
}
interface KeywordSuggestion {
  keyword: string;
  volume: number | null;
  trendScore: number | null;
  rising: boolean;
}
interface AdsInsight {
  keyword: string;
  volume: number | null;
  cpc: number | null;
  competition: "LOW" | "MEDIUM" | "HIGH" | null;
  competitionIndex: number | null;
  lowBid: number | null;
  highBid: number | null;
  intent: string | null;
  intentProbability: number | null;
}
interface AdsBudgetEstimate {
  bid: number;
  clicks: number | null;
  cost: number | null;
  avgCpc: number | null;
  impressions: number | null;
}
interface PositionPoint {
  capturedAt: string;
  position: number | null;
  change: number | null;
}
interface SearchResult {
  keyword: string;
  city: string;
  capturedAt: string;
  source: "serpapi" | "dataforseo";
  organicResults: Result[];
  ads: Result[];
  localPack: boolean;
  ownDomainPosition: number | null;
  ownDomainUrl: string | null;
  previousPosition: number | null;
  positionChange: number | null;
  history: HistoryItem[];
  linkedPosts: LinkedPost[];
}
interface ProviderStats {
  provider: "serpapi" | "dataforseo";
  planName?: string | null;
  searchesLeft?: number | null;
  searchesUsed?: number | null;
  searchesLimit?: number | null;
  thisMonthUsage?: number | null;
  balance?: number | null;
  capturedAt: string;
}
interface PostVariant {
  title: string;
  slug: string;
  canonicalUrl: string;
  metaDescription: string;
  seoTitle: string;
  tags: string[];
  category: string;
  angle: string;
  bodyHtml: string;
  faq: { question: string; answer: string }[];
  internalLinks: string[];
  priority: string;
}

const SEO_RADAR_DRAFT_KEY = "ancavisuals:seo-radar:draft";

const daysAgoLabel = (iso: string | null): string => {
  if (!iso) return "";
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return "azi";
  if (days === 1) return "de o zi";
  return `de ${days} zile`;
};

const sameBlogSlug = (url: string, slug: string): boolean => {
  if (!url || !slug) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "ancavisuals.ro" && !host.endsWith(".ancavisuals.ro")) return false;
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.length > 0 && segments[segments.length - 1] === slug;
  } catch {
    return false;
  }
};

const normalizeText = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const SEO_RADAR_COVERAGE_KEY = "ancavisuals:seo-radar:coverage-cities";
const OTHER_SERVICE_ID = "other";
const SEO_RADAR_COLUMNS_KEY = "ancavisuals:seo-radar:columns";

interface CoverageService {
  id: string;
  label: string;
  query: string; // keyword prefix used when scanning a never-scanned combo
  terms: string[];
}
interface CustomColumn {
  id: string;
  label: string;
  query: string;
}
// Order matters: multi-word / compound services are checked before "fotograf" / "videograf".
const SEO_RADAR_SERVICES: CoverageService[] = [
  { id: "foto-video", label: "Foto-video", query: "foto video", terms: ["foto-video", "foto video", "fotograf si videograf", "fotograf videograf"] },
  { id: "fotocabina", label: "Fotocabină", query: "fotocabina", terms: ["fotocabina", "cabina foto", "photo booth", "photobooth", "photo-booth"] },
  { id: "video-booth-360", label: "Video Booth 360", query: "video booth 360", terms: ["video booth", "videobooth", "360", "platforma 360", "cabina 360", "photo booth 360"] },
  { id: "videograf", label: "Videograf", query: "videograf", terms: ["videograf", "cameraman", "filmare", "video nunta"] },
  { id: "fotograf", label: "Fotograf", query: "fotograf", terms: ["fotograf", "fotografie de nunta", "fotografie nunta"] },
];

const customToService = (column: CustomColumn): CoverageService => ({
  id: column.id,
  label: column.label,
  query: column.query,
  terms: [normalizeText(column.query)],
});
// Custom columns first (more specific: "fotograf nunta" wins over the generic "fotograf").
const mergeColumns = (custom: CustomColumn[]): CoverageService[] => [...custom.map(customToService), ...SEO_RADAR_SERVICES];

const serviceQuery = (id: string, columns: CoverageService[] = SEO_RADAR_SERVICES): string =>
  columns.find(service => service.id === id)?.query ?? "";

const detectService = (keyword: string, columns: CoverageService[] = SEO_RADAR_SERVICES): string | null => {
  const normalized = normalizeText(keyword);
  for (const service of columns) {
    if (service.terms.some(term => term && normalized.includes(term))) return service.id;
  }
  return null;
};

const serviceLabel = (id: string | null, columns: CoverageService[] = SEO_RADAR_SERVICES): string =>
  columns.find(service => service.id === id)?.label ?? "Alt serviciu";

const ARDEAL_COUNTIES = new Set([
  "Alba", "Arad", "Bihor", "Bistrița-Năsăud", "Brașov", "Cluj", "Covasna", "Harghita",
  "Hunedoara", "Maramureș", "Mureș", "Sălaj", "Satu Mare", "Sibiu",
]);
const ARDEAL_POPULATION_2021: Record<string, number> = {
  "Cluj-Napoca": 286598, Brașov: 237589, Oradea: 183105, Arad: 145078, Sibiu: 134308,
  "Târgu Mureș": 116033, "Baia Mare": 108759, "Satu Mare": 91056, Bistrița: 78877,
  "Alba Iulia": 64359, Turda: 55401, Deva: 53011, Zalău: 52238, Hunedoara: 50457,
  "Sfântu Gheorghe": 50080, "Câmpia Turzii": 20895, Mediaș: 39780, Reghin: 29115,
  Aiud: 21822, Sebeș: 27019, Luduș: 15000, Sighișoara: 23087, Cugir: 21762, Gherla: 20765,
  Blaj: 17800, Avrig: 12624, Făgăraș: 30488, Predeal: 4186, Sovata: 11000,
};
const ARDEAL_CITIES = CITIES
  .filter(cityData => ARDEAL_COUNTIES.has(cityData.county))
  .map(cityData => ({ ...cityData, population: ARDEAL_POPULATION_2021[cityData.name] ?? 0 }))
  .sort((a, b) => b.population - a.population || a.name.localeCompare(b.name, "ro"));

// Longest CITIES name whose normalized form appears in the text ("" if none).
const cityInKeyword = (text: string): string => {
  const normalized = normalizeText(text);
  let best = "";
  for (const cityData of CITIES) {
    const cityNorm = normalizeText(cityData.name);
    if (cityNorm && normalized.includes(cityNorm) && cityData.name.length > best.length) best = cityData.name;
  }
  return best;
};

// The keyword is the source of truth: if it names a city, use that. The `city` field is only
// a geo hint and is often stale ("fotocabina huedin" scanned with Locație "Bacău").
const detectCity = (keyword: string, explicitCity: string): string =>
  cityInKeyword(keyword) || explicitCity.trim();

interface ScanJob {
  key: string;
  label: string;
  keyword: string;
  city: string;
  provider: "serpapi" | "dataforseo";
}
interface ScanOutcome {
  position?: number | null;
  error?: boolean;
  message?: string;
}

type CoverageStatus = "pos1" | "top3" | "top10" | "absent";
const coverageStatus = (latestPosition: number | null): CoverageStatus => {
  if (latestPosition === null || latestPosition === undefined) return "absent";
  if (latestPosition <= 1) return "pos1";
  if (latestPosition <= 3) return "top3";
  return "top10";
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string; isFinal: boolean }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

const emptyPostVariant = (): PostVariant => ({
  title: "",
  slug: "",
  canonicalUrl: "",
  metaDescription: "",
  seoTitle: "",
  tags: [],
  category: "",
  angle: "",
  bodyHtml: "",
  faq: [],
  internalLinks: [],
  priority: "medium",
});

const SeoRadarPage: React.FC = () => {
  const { auth } = useAuth();
  const [keyword, setKeyword] = useState("fotocabina Gilău");
  const [city, setCity] = useState("Gilău");
  const [provider, setProvider] = useState<"serpapi" | "dataforseo">("serpapi");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [statsError, setStatsError] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState("Pregătesc analiza SEO…");
  const [publishing, setPublishing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [postVariants, setPostVariants] = useState<PostVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [analysesQuery, setAnalysesQuery] = useState("");
  const [analysesProvider, setAnalysesProvider] = useState<"all" | "serpapi" | "dataforseo">("all");
  const [expandedScan, setExpandedScan] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [viewingSavedAt, setViewingSavedAt] = useState<string | null>(null);
  const [coverageView, setCoverageView] = useState<"grid" | "list">("grid");
  const [coverageService, setCoverageService] = useState<string>("all");
  const [coverageStatusFilter, setCoverageStatusFilter] = useState<"all" | CoverageStatus | "unscanned" | "gaps">("all");
  const [planCities, setPlanCities] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SEO_RADAR_COVERAGE_KEY) || "null");
      return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [planCitiesSeeded, setPlanCitiesSeeded] = useState(false);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SEO_RADAR_COLUMNS_KEY) || "null");
      return Array.isArray(saved)
        ? saved.filter((item): item is CustomColumn => item && typeof item.id === "string" && typeof item.query === "string")
        : [];
    } catch {
      return [];
    }
  });
  const allColumns = React.useMemo(() => mergeColumns(customColumns), [customColumns]);
  const [scanQueueView, setScanQueueView] = useState<ScanJob[]>([]);
  const [activeScanKey, setActiveScanKey] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<Record<string, ScanOutcome>>({});
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [articlePlan, setArticlePlan] = useState<ArticlePlan | null>(null);
  const [planStatus, setPlanStatus] = useState<"idle" | "saving" | "saved">("idle");
  const scanQueueRef = useRef<ScanJob[]>([]);
  const scanPumpingRef = useRef(false);
  const planSkipSaveRef = useRef(false);
  const planSaveTimerRef = useRef<number | null>(null);
  const creatorRef = useRef<HTMLElement>(null);
  const keywordBuilderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(SEO_RADAR_COVERAGE_KEY, JSON.stringify(planCities));
  }, [planCities]);
  useEffect(() => {
    localStorage.setItem(SEO_RADAR_COLUMNS_KEY, JSON.stringify(customColumns));
  }, [customColumns]);
  // First load with an empty plan: seed from cities already present in the analyses.
  useEffect(() => {
    if (planCitiesSeeded || analysesLoading) return;
    setPlanCitiesSeeded(true);
    if (planCities.length || !analyses.length) return;
    const detected = Array.from(
      new Set(analyses.map(item => detectCity(item.keyword, item.city)).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "ro"));
    if (detected.length) setPlanCities(detected);
  }, [analyses, analysesLoading, planCities.length, planCitiesSeeded]);

  const loadAnalyses = React.useCallback(() => {
    if (!auth.accessToken) return;
    // Reîmprospătare silențioasă: grila rămâne pe ecran cu datele vechi cât timp reîncărcăm
    // (guard-ul de render folosește `loading && analyses.length === 0`), ca pagina să nu „sară".
    setAnalysesLoading(true);
    fetch("/api/admin/seo-radar/analyses", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Analizele nu au putut fi încărcate.");
        setAnalyses(Array.isArray(data.analyses) ? data.analyses : []);
      })
      .catch(() => { /* păstrăm datele existente la eșec de refresh */ })
      .finally(() => setAnalysesLoading(false));
  }, [auth.accessToken]);
  useEffect(() => { loadAnalyses(); }, [loadAnalyses]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SEO_RADAR_DRAFT_KEY) || "null") as {
        result?: SearchResult | null;
        postVariants?: PostVariant[];
        selectedVariant?: number;
      } | null;
      if (saved?.result) setResult({ ...saved.result, linkedPosts: saved.result.linkedPosts ?? [] });
      if (Array.isArray(saved?.postVariants) && saved.postVariants.length === 3) setPostVariants(saved.postVariants);
      if (typeof saved?.selectedVariant === "number") setSelectedVariant(Math.max(0, Math.min(2, saved.selectedVariant)));
    } catch {
      localStorage.removeItem(SEO_RADAR_DRAFT_KEY);
    } finally {
      setDraftLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!draftLoaded || !postVariants.length) return;
    localStorage.setItem(SEO_RADAR_DRAFT_KEY, JSON.stringify({ result, postVariants, selectedVariant }));
  }, [draftLoaded, postVariants, result, selectedVariant]);
  useEffect(() => {
    setStats(null);
    setStatsError("");
    fetch(`/api/admin/seo-radar/stats?provider=${provider}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Statisticile nu sunt disponibile.");
        setStats(data);
      })
      .catch(err => setStatsError(err instanceof Error ? err.message : "Statisticile nu sunt disponibile."));
  }, [auth.accessToken, provider]);

  const runScanRequest = async (payload: { keyword: string; city: string; provider: "serpapi" | "dataforseo" }): Promise<SearchResult> => {
    const response = await fetch("/api/admin/seo-radar/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Căutarea a eșuat.");
    return data as SearchResult;
  };

  const discoverKeywords = async (baseKeyword: string, cityHint?: string): Promise<KeywordSuggestion[]> => {
    const response = await fetch("/api/admin/seo-radar/keyword-alternatives", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
      body: JSON.stringify({ baseKeyword, city: cityHint }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Nu am putut găsi sugestii.");
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  };

  const requestConfirm = (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => {
    setConfirmDialog({ title, message, confirmLabel, onConfirm });
  };

  const fetchAdsInsight = async (keywordValue: string): Promise<AdsInsight> => {
    const response = await fetch("/api/admin/seo-radar/ads-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
      body: JSON.stringify({ keyword: keywordValue }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Nu am putut încărca datele de Ads.");
    return data.insight as AdsInsight;
  };

  const fetchAdsBudget = async (keywordValue: string, bid: number): Promise<AdsBudgetEstimate> => {
    const response = await fetch("/api/admin/seo-radar/ads-budget", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
      body: JSON.stringify({ keyword: keywordValue, bid }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Nu am putut estima bugetul.");
    return data.estimate as AdsBudgetEstimate;
  };

  // Încarcă planul de articol (keyword țintă + secundare) al combinației curente.
  useEffect(() => {
    if (!result || !auth.accessToken) {
      setArticlePlan(null);
      return;
    }
    let cancelled = false;
    planSkipSaveRef.current = true;
    fetch(`/api/admin/seo-radar/article-plan?keyword=${encodeURIComponent(result.keyword)}&city=${encodeURIComponent(result.city)}&provider=${result.source}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error();
        if (!cancelled) setArticlePlan(data.plan ?? { targetKeyword: result.keyword, secondaryKeywords: [] });
      })
      .catch(() => { if (!cancelled) setArticlePlan({ targetKeyword: result.keyword, secondaryKeywords: [] }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.keyword, result?.city, result?.source, auth.accessToken]);

  // Auto-salvează planul (debounced) — sărit imediat după încărcare, ca să nu rescriem cu ce tocmai am citit.
  useEffect(() => {
    if (!articlePlan || !result) return;
    if (planSkipSaveRef.current) { planSkipSaveRef.current = false; return; }
    if (planSaveTimerRef.current) window.clearTimeout(planSaveTimerRef.current);
    const { keyword, city, source } = result;
    planSaveTimerRef.current = window.setTimeout(() => {
      setPlanStatus("saving");
      fetch("/api/admin/seo-radar/article-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ keyword, city, provider: source, targetKeyword: articlePlan.targetKeyword, secondaryKeywords: articlePlan.secondaryKeywords }),
      })
        .then(() => {
          setPlanStatus("saved");
          window.setTimeout(() => setPlanStatus(current => (current === "saved" ? "idle" : current)), 1500);
        })
        .catch(() => setPlanStatus("idle"));
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articlePlan]);

  const search = async (override?: { keyword: string; city: string; provider: "serpapi" | "dataforseo" }) => {
    setLoading(true);
    setError("");
    try {
      const data = await runScanRequest({
        keyword: override?.keyword ?? keyword,
        city: override?.city ?? city,
        provider: override?.provider ?? provider,
      });
      setResult(data);
      setPostVariants([]);
      setExpandedScan(null);
      setViewingSavedAt(null);
      localStorage.removeItem(SEO_RADAR_DRAFT_KEY);
      setAnalysisError("");
      loadAnalyses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Căutarea a eșuat.");
    } finally {
      setLoading(false);
    }
  };

  // Doar afișează ce a arătat analiza în trecut — nu consumă credite, nu adaugă o captură nouă.
  const viewAnalysis = async (analysis: Analysis, scroll = true): Promise<SearchResult | null> => {
    setKeyword(analysis.keyword);
    setCity(analysis.city);
    setProvider(analysis.provider);
    setLoading(true);
    setError("");
    let built: SearchResult | null = null;
    try {
      const response = await fetch(
        `/api/admin/seo-radar/history?keyword=${encodeURIComponent(analysis.keyword)}&city=${encodeURIComponent(analysis.city)}&provider=${analysis.provider}`,
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analiza nu a putut fi încărcată.");
      const history: HistoryItem[] = Array.isArray(data.history) ? data.history : [];
      const latest = history[history.length - 1];
      if (!latest) {
        setError("Această analiză nu are capturi salvate.");
        return null;
      }
      built = {
        keyword: analysis.keyword,
        city: analysis.city,
        capturedAt: latest.capturedAt,
        source: analysis.provider,
        organicResults: latest.organicResults ?? [],
        ads: [],
        localPack: latest.localPack,
        ownDomainPosition: latest.ownDomainPosition,
        ownDomainUrl: latest.ownDomainUrl,
        previousPosition: null,
        positionChange: latest.positionChange,
        history,
        linkedPosts: Array.isArray(data.linkedPosts) ? data.linkedPosts : [],
      };
      setResult(built);
      setPostVariants([]);
      setExpandedScan(latest.id);
      setViewingSavedAt(latest.capturedAt);
      localStorage.removeItem(SEO_RADAR_DRAFT_KEY);
      setAnalysisError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analiza nu a putut fi încărcată.");
    } finally {
      setLoading(false);
    }
    if (scroll && typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    return built;
  };

  // Coadă de scanări non-blocantă: pui joburi în coadă și rulează în fundal, unul câte unul.
  // Utilizatorul poate continua să lucreze (verifica alte celule) în timp ce rulează.
  const syncScanQueue = () => setScanQueueView([...scanQueueRef.current]);
  const pumpScanQueue = async () => {
    if (scanPumpingRef.current) return;
    scanPumpingRef.current = true;
    try {
      while (scanQueueRef.current.length > 0) {
        const job = scanQueueRef.current[0];
        setActiveScanKey(job.key);
        setScanResults(prev => { const { [job.key]: _omit, ...rest } = prev; return rest; });
        try {
          const data = await runScanRequest({ keyword: job.keyword, city: job.city, provider: job.provider });
          setScanResults(prev => ({ ...prev, [job.key]: { position: data.ownDomainPosition ?? null } }));
        } catch (err) {
          setScanResults(prev => ({ ...prev, [job.key]: { error: true, message: err instanceof Error ? err.message : "Scanarea a eșuat." } }));
        }
        scanQueueRef.current = scanQueueRef.current.slice(1);
        syncScanQueue();
        setActiveScanKey(null);
        loadAnalyses();
        if (scanQueueRef.current.length > 0) await new Promise(resolve => setTimeout(resolve, 400));
      }
    } finally {
      scanPumpingRef.current = false;
    }
  };
  const enqueueScans = (jobs: ScanJob[]) => {
    const known = new Set([...scanQueueRef.current.map(job => job.key), activeScanKey]);
    const fresh = jobs.filter(job => !known.has(job.key));
    if (!fresh.length) return;
    scanQueueRef.current = [...scanQueueRef.current, ...fresh];
    syncScanQueue();
    void pumpScanQueue();
  };
  const stopScanQueue = () => { scanQueueRef.current = []; syncScanQueue(); };
  const clearScanResult = (key: string) => setScanResults(prev => { const { [key]: _omit, ...rest } = prev; return rest; });

  const providerName = (value: "serpapi" | "dataforseo") => (value === "dataforseo" ? "DataForSEO" : "SerpApi");

  const rescanAnalysis = (analysis: Analysis) => {
    setConfirmDialog({
      title: "Rescanare",
      message: `Rulez o căutare nouă pentru „${analysis.keyword}". Consumă un credit ${providerName(analysis.provider)} și adaugă o captură nouă.`,
      confirmLabel: "Scanează",
      onConfirm: () => enqueueScans([
        { key: analysis.queryKey, label: analysis.keyword, keyword: analysis.keyword, city: analysis.city, provider: analysis.provider },
      ]),
    });
  };

  // Scanează o singură combinație (buton „+"). Confirmare custom, apoi rulează în fundal.
  const scanOneCombo = (serviceId: string, cityName: string) => {
    const term = serviceQuery(serviceId, allColumns);
    if (!term) {
      setKeyword(cityName);
      setCity(cityName);
      setResult(null);
      setViewingSavedAt(null);
      keywordBuilderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const scanKeyword = `${term} ${cityName}`;
    setConfirmDialog({
      title: "Scanare",
      message: `Scanez „${scanKeyword}" cu ${providerName(provider)}. Consumă un credit.`,
      confirmLabel: "Scanează",
      onConfirm: () => enqueueScans([
        { key: `${serviceId}|${cityName}`, label: scanKeyword, keyword: scanKeyword, city: cityName, provider },
      ]),
    });
  };

  const runManyScans = (jobs: ScanJob[], providerToUse: "serpapi" | "dataforseo") => {
    if (!jobs.length) return;
    const withProvider = jobs.map(job => ({ ...job, provider: providerToUse }));
    setConfirmDialog({
      title: "Scanare în masă",
      message: `Scanez ${jobs.length} ${jobs.length === 1 ? "combinație" : "combinații"} cu ${providerName(providerToUse)}, una după alta. Consumă aproximativ ${jobs.length} ${jobs.length === 1 ? "credit" : "credite"}.`,
      confirmLabel: `Scanează ${jobs.length}`,
      onConfirm: () => enqueueScans(withProvider),
    });
  };

  const createArticleFor = async (analysis: Analysis) => {
    const loaded = await viewAnalysis(analysis, false);
    if (!loaded) return;
    setPostVariants([emptyPostVariant(), emptyPostVariant(), emptyPostVariant()]);
    setSelectedVariant(0);
    setAnalysisError("");
    window.setTimeout(() => creatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const unlinkPost = async (post: LinkedPost) => {
    setUnlinking(post.id);
    try {
      const response = await fetch(
        `/api/admin/seo-radar/linked-posts?queryKey=${encodeURIComponent(post.queryKey)}&slug=${encodeURIComponent(post.slug)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      if (!response.ok) throw new Error();
      setResult(current => current ? { ...current, linkedPosts: current.linkedPosts.filter(item => item.id !== post.id) } : current);
      loadAnalyses();
    } catch {
      setAnalysisError("Nu am putut dezlega articolul.");
    } finally {
      setUnlinking(null);
    }
  };

  const deleteAnalysisGroups = async (groups: { keyword: string; provider: "serpapi" | "dataforseo" }[], onDone?: () => void) => {
    if (!groups.length) return;
    try {
      const response = await fetch("/api/admin/seo-radar/analyses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ groups }),
      });
      if (!response.ok) throw new Error();
      loadAnalyses();
      onDone?.();
    } catch {
      setError("Nu am putut șterge analiza.");
    }
  };

  const askDeleteAnalyses = (
    groups: { keyword: string; provider: "serpapi" | "dataforseo" }[],
    message: string,
    onDone?: () => void,
  ) => {
    if (!groups.length) { onDone?.(); return; }
    setConfirmDialog({
      title: "Ștergere",
      message,
      confirmLabel: "Șterge definitiv",
      onConfirm: () => void deleteAnalysisGroups(groups, onDone),
    });
  };

  const analyze = async () => {
    if (!result) return;
    setAnalysisError("");
    setPostVariants(current => current.length === 3 ? current : [emptyPostVariant(), emptyPostVariant(), emptyPostVariant()]);
    setSelectedVariant(0);
  };

  const generateVariant = async (index: number) => {
    if (!result) return;
    setAnalysisLoading(true);
    setAnalysisProgress(`Claude generează varianta ${index + 1}…`);
    setAnalysisError("");
    try {
      const response = await fetch("/api/admin/seo-radar/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({
          keyword: result.keyword,
          city: result.city,
          source: result.source,
          organicResults: result.organicResults,
          variantIndex: index,
          targetKeyword: articlePlan?.targetKeyword ?? "",
          secondaryKeywords: articlePlan?.secondaryKeywords ?? [],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generarea variantei a eșuat.");
      const generatedVariant = data.variants[0] as PostVariant;
      const normalizedVariant = {
        ...generatedVariant,
        tags: Array.from(new Set([...(generatedVariant.tags ?? []), ...(articlePlan?.secondaryKeywords ?? [])])),
        canonicalUrl: generatedVariant.slug ? `https://ancavisuals.ro/blog/${generatedVariant.slug}` : generatedVariant.canonicalUrl,
      };
      setPostVariants(current => current.map((item, itemIndex) => itemIndex === index ? normalizedVariant : item));
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Generarea variantei a eșuat.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const publishVariant = async (variant: PostVariant) => {
    if (!variant.title.trim() || !variant.slug.trim() || !variant.bodyHtml.trim()) {
      setAnalysisError("Completează titlul, slug-ul și body-ul înainte de publicare.");
      return;
    }
    setPublishing(true);
    setAnalysisError("");
    try {
      const response = await fetch(`/api/blog/admin/posts/${encodeURIComponent(variant.slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({
          slug: variant.slug,
          title: variant.title,
          description: variant.metaDescription,
          category: variant.category || "general",
          tags: variant.tags,
          city,
          content: variant.bodyHtml,
          status: "published",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Publicarea a eșuat.");

      if (result) {
        const savedSlug = data.post?.slug ?? variant.slug;
        try {
          const linkResponse = await fetch("/api/admin/seo-radar/linked-posts", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
            body: JSON.stringify({
              keyword: result.keyword,
              city: result.city,
              provider: result.source,
              slug: savedSlug,
              title: data.post?.title ?? variant.title,
              url: `https://ancavisuals.ro/blog/${savedSlug}`,
              date: data.post?.date,
            }),
          });
          if (!linkResponse.ok) throw new Error();
          const historyResponse = await fetch(
            `/api/admin/seo-radar/history?keyword=${encodeURIComponent(result.keyword)}&city=${encodeURIComponent(result.city)}&provider=${result.source}`,
            { headers: { Authorization: `Bearer ${auth.accessToken}` } },
          );
          const historyData = await historyResponse.json();
          if (historyResponse.ok) {
            setResult(current => current ? {
              ...current,
              linkedPosts: Array.isArray(historyData.linkedPosts) ? historyData.linkedPosts : current.linkedPosts,
              history: Array.isArray(historyData.history) ? historyData.history : current.history,
            } : current);
          }
          loadAnalyses();
          setAnalysisError("Articolul a fost publicat și legat de analiză.");
        } catch {
          setAnalysisError("Articolul a fost publicat, dar legarea de analiză a eșuat.");
        }
      } else {
        setAnalysisError("Articolul a fost publicat cu succes.");
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Publicarea a eșuat.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black px-6 py-10 text-white md:px-10">
      {analysisLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-amber-200/30 bg-neutral-950 p-7 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 animate-pulse rounded-full bg-amber-200" />
              <p className="text-xs uppercase tracking-[0.25em] text-amber-200/80">Claude · creare postare SEO</p>
            </div>
            <h2 className="mt-5 text-2xl font-light">Lucrez la cele 3 variante</h2>
            <p className="mt-4 min-h-12 text-sm leading-6 text-gray-300">{analysisProgress}</p>
            <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-amber-200" />
            </div>
            <p className="mt-4 text-xs text-gray-500">Generarea unui articol complet poate dura câteva zeci de secunde.</p>
          </div>
        </div>
      )}
      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel ?? "Confirmă"}
          variant="warning"
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            const action = confirmDialog.onConfirm;
            setConfirmDialog(null);
            action();
          }}
        />
      )}
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">AncaVisuals · SEO Radar</p>
            <h1 className="mt-4 text-4xl font-light md:text-6xl">Caută și analizează SERP</h1>
          </div>
          <div className="min-w-[280px] rounded-2xl border border-amber-200/20 bg-amber-200/10 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">
              {provider === "dataforseo" ? "DataForSEO · sold" : "SerpApi · credite"}
            </p>
            {stats ? (
              <div className="mt-2 flex items-end justify-between gap-5">
                <strong className="text-3xl font-light">
                  {provider === "dataforseo"
                    ? stats.balance === null || stats.balance === undefined
                      ? "—"
                      : stats.balance.toFixed(2)
                    : stats.searchesLeft ?? "—"}
                </strong>
                <span className="pb-1 text-right text-xs text-gray-300">
                  {provider === "dataforseo" ? (
                    <>
                      USD
                      <br />
                      disponibili
                    </>
                  ) : (
                    <>
                      căutări
                      <br />
                      rămase
                    </>
                  )}
                </span>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-400">{statsError || "Se încarcă…"}</p>
            )}
            {stats && provider === "serpapi" && (
              <p className="mt-2 text-xs text-gray-400">
                {stats.planName || "Plan SerpApi"} · folosite: {stats.searchesUsed ?? stats.thisMonthUsage ?? "—"}
                {stats.searchesLimit !== null ? ` / ${stats.searchesLimit}` : ""}
              </p>
            )}
          </div>
        </div>
        <div ref={keywordBuilderRef}>
          <KeywordBuilder
            keyword={keyword}
            setKeyword={setKeyword}
            city={city}
            setCity={setCity}
            provider={provider}
            setProvider={setProvider}
            loading={loading}
            search={search}
            token={auth.accessToken}
          />
        </div>
        <DiacriticsCorrector token={auth.accessToken} />
        <CoverageReport
          analyses={analyses}
          loading={analysesLoading}
          query={analysesQuery}
          setQuery={setAnalysesQuery}
          providerFilter={analysesProvider}
          setProviderFilter={setAnalysesProvider}
          view={coverageView}
          setView={setCoverageView}
          serviceFilter={coverageService}
          setServiceFilter={setCoverageService}
          statusFilter={coverageStatusFilter}
          setStatusFilter={setCoverageStatusFilter}
          planCities={planCities}
          setPlanCities={setPlanCities}
          columns={allColumns}
          customColumns={customColumns}
          setCustomColumns={setCustomColumns}
          onView={viewAnalysis}
          onRescan={rescanAnalysis}
          onScanOne={scanOneCombo}
          onRunManyScans={runManyScans}
          onCreateArticle={createArticleFor}
          onDeleteAnalyses={askDeleteAnalyses}
          onDiscoverKeywords={discoverKeywords}
          onDiscoverAdsInsight={fetchAdsInsight}
          onDiscoverAdsBudget={fetchAdsBudget}
          requestConfirm={requestConfirm}
          defaultProvider={provider}
          activeScanKey={activeScanKey}
          queuedKeys={scanQueueView}
          scanResults={scanResults}
          onStopQueue={stopScanQueue}
          onClearScanResult={clearScanResult}
          disabled={loading}
        />
        {error && <p className="mt-5 text-red-300">{error}</p>}
        {result && (
          <>
            {viewingSavedAt && (
              <div className="mt-6 flex flex-col gap-1 rounded-2xl border border-amber-200/30 bg-amber-200/10 px-4 py-3 text-sm text-amber-100">
                <span>
                  Vezi o analiză salvată — ultima captură din{" "}
                  {new Date(viewingSavedAt).toLocaleString("ro-RO")}. Datele nu au fost reîncărcate acum.
                </span>
                <span className="text-xs text-amber-200/70">
                  Deschide capturile din tabelul de istoric pentru a compara. Apasă „Capturează" sau „Rescanează" pentru date noi.
                </span>
              </div>
            )}
            <p className="mt-6 text-xs uppercase tracking-[0.2em] text-gray-500">
              Rezultate prin {result.source === "dataforseo" ? "DataForSEO" : "SerpApi"}
            </p>
            <div className="mt-8 grid gap-3 md:grid-cols-4">
              <Metric
                value={result.ownDomainPosition ? `#${result.ownDomainPosition}` : "—"}
                label="Poziție AncaVisuals"
              />
              <Metric
                value={
                  result.positionChange === null
                    ? "—"
                    : result.positionChange > 0
                      ? `↑ ${result.positionChange}`
                      : result.positionChange < 0
                        ? `↓ ${Math.abs(result.positionChange)}`
                        : "= 0"
                }
                label="Față de ultima căutare"
              />
              <Metric value={result.localPack ? "Da" : "Nu"} label="Local Pack" />
              <Metric value={String(result.history.length)} label="Capturi salvate" />
            </div>
            <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-amber-200/70">
                Istoric · {result.keyword}
                {result.city ? ` · ${result.city}` : ""}
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-3">Data</th>
                      <th className="px-3 py-3">Poziție</th>
                      <th className="px-3 py-3">Evoluție</th>
                      <th className="px-3 py-3">Local Pack</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {[...result.history].reverse().map(item => {
                      const linkedSlugs = result.linkedPosts.map(post => post.slug);
                      const snapshot = item.organicResults ?? [];
                      const isExpanded = expandedScan === item.id;
                      return (
                        <React.Fragment key={item.id}>
                          <tr>
                            <td className="px-3 py-3 text-gray-300">
                              <button
                                type="button"
                                onClick={() => setExpandedScan(current => (current === item.id ? null : item.id))}
                                disabled={!snapshot.length}
                                className="flex items-center gap-2 text-left disabled:opacity-40"
                              >
                                <span className={`text-amber-200 transition-transform ${isExpanded ? "rotate-90" : ""}`}>›</span>
                                {new Date(item.capturedAt).toLocaleString("ro-RO")}
                              </button>
                            </td>
                            <td className="px-3 py-3 font-medium text-amber-200">
                              {item.ownDomainPosition ? `#${item.ownDomainPosition}` : "Nu apare în top 10"}
                            </td>
                            <td
                              className={`px-3 py-3 ${item.positionChange === null ? "text-gray-500" : item.positionChange > 0 ? "text-emerald-300" : item.positionChange < 0 ? "text-red-300" : "text-gray-400"}`}
                            >
                              {item.positionChange === null
                                ? "Prima captură"
                                : item.positionChange > 0
                                  ? `↑ ${item.positionChange}`
                                  : item.positionChange < 0
                                    ? `↓ ${Math.abs(item.positionChange)}`
                                    : "Fără schimbare"}
                            </td>
                            <td className="px-3 py-3 text-gray-400">{item.localPack ? "Da" : "Nu"}</td>
                          </tr>
                          {isExpanded && snapshot.length > 0 && (
                            <tr>
                              <td colSpan={4} className="px-3 pb-4">
                                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-gray-500">
                                  Top 10 la {new Date(item.capturedAt).toLocaleDateString("ro-RO")}
                                </p>
                                <ol className="space-y-1">
                                  {snapshot.map(entry => {
                                    const mine = entry.domain.includes("ancavisuals.ro");
                                    const isLinked = linkedSlugs.some(slug => sameBlogSlug(entry.url, slug));
                                    return (
                                      <li
                                        key={`${entry.position}-${entry.url}`}
                                        className={`flex gap-2 text-xs ${isLinked ? "text-amber-200" : mine ? "text-emerald-300" : "text-gray-300"}`}
                                      >
                                        <span className="w-6 shrink-0 text-gray-500">#{entry.position}</span>
                                        <span className="shrink-0 text-gray-400">{entry.domain}</span>
                                        <span className="truncate">{entry.title}</span>
                                      </li>
                                    );
                                  })}
                                </ol>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 px-6 py-5">
                <p className="text-xs uppercase tracking-[0.25em] text-amber-200/70">Rezultate organice</p>
                <h2 className="mt-2 text-2xl font-light">Top 10 · {result.keyword}</h2>
              </div>
              <div className="divide-y divide-white/10">
                {result.organicResults.map(item => (
                  <a
                    key={`${item.position}-${item.url}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`block px-6 py-2.5 hover:bg-white/5 ${item.domain.includes("ancavisuals.ro") ? "text-emerald-300" : ""}`}
                  >
                    <div className="flex gap-3">
                      <strong className="w-6 text-sm text-amber-200">{item.position}</strong>
                      <div>
                        <h3 className="text-sm font-medium">{item.title}</h3>
                        <p className="mt-0.5 text-[11px] text-gray-400">{item.domain}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-300">{item.snippet}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
            {result.linkedPosts.length > 0 && (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.25em] text-amber-200/70">Articole pornite din această analiză</p>
                <h2 className="mt-2 text-2xl font-light">Pe drum spre top 10</h2>
                <div className="mt-5 space-y-3">
                  {result.linkedPosts.map(post => (
                    <div
                      key={post.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <a href={post.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-white hover:text-amber-200">
                          {post.title}
                        </a>
                        <p className="mt-1 text-xs text-gray-500">
                          Legat {daysAgoLabel(post.linkedAt)}
                          {post.linkedAt ? ` · ${new Date(post.linkedAt).toLocaleDateString("ro-RO")}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {post.status === "ranked" ? (
                          <span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-300">
                            Intrat în top 10{post.rankedPosition ? ` · #${post.rankedPosition}` : ""}
                          </span>
                        ) : post.status === "own_other" ? (
                          <span className="rounded-full border border-amber-200/40 bg-amber-200/10 px-3 py-1 text-xs text-amber-200">
                            AncaVisuals în top 10 (altă pagină){post.rankedPosition ? ` · #${post.rankedPosition}` : ""}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 rounded-full border border-amber-200/40 bg-amber-200/10 px-3 py-1 text-xs text-amber-200">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-200" />
                            În curs de indexare
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void unlinkPost(post)}
                          disabled={unlinking === post.id}
                          className="rounded-lg border border-red-300/50 px-3 py-1.5 text-xs text-red-300 disabled:opacity-40"
                        >
                          {unlinking === post.id ? "…" : "Dezleagă"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section ref={creatorRef} className="mt-8 rounded-3xl border border-amber-200/20 bg-amber-200/5 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-amber-200/70">Creator postare SEO · Claude</p>
                  <h2 className="mt-2 text-2xl font-light">Creează postare SEO</h2>
                  <p className="mt-2 max-w-3xl text-sm text-gray-400">
                    Lucrează pe rând la cele 3 variante. Generează cu Claude doar când alegi tu.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (postVariants.length) {
                      setPostVariants([]);
                      setSelectedVariant(0);
                      localStorage.removeItem(SEO_RADAR_DRAFT_KEY);
                    } else {
                      analyze();
                    }
                  }}
                  disabled={analysisLoading}
                  className="shrink-0 rounded-xl bg-amber-200 px-5 py-3 font-medium text-black disabled:opacity-50"
                >
                  {postVariants.length ? "Resetează cele 3 schelete" : "Creează postare SEO"}
                </button>
              </div>
              {articlePlan && (
                <ArticlePlanEditor
                  plan={articlePlan}
                  status={planStatus}
                  onChange={setArticlePlan}
                  city={result.city}
                  onDiscoverKeywords={discoverKeywords}
                  requestConfirm={requestConfirm}
                />
              )}
              {analysisError && <p className="mt-5 text-red-300">{analysisError}</p>}
              {postVariants.length > 0 && (
                <div className="mt-7">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <button type="button" aria-label="Varianta anterioară" onClick={() => setSelectedVariant(index => (index + 2) % 3)} className="rounded-xl border border-white/10 px-4 py-2 text-xl text-gray-200">←</button>
                    <span className="text-sm text-gray-300">Varianta {selectedVariant + 1} din 3</span>
                    <button type="button" aria-label="Varianta următoare" onClick={() => setSelectedVariant(index => (index + 1) % 3)} className="rounded-xl border border-white/10 px-4 py-2 text-xl text-gray-200">→</button>
                  </div>
                  <PostVariantEditor
                    variant={postVariants[selectedVariant]}
                    token={auth.accessToken}
                    generating={analysisLoading}
                    publishing={publishing}
                    onGenerate={() => {
                      const selected = postVariants[selectedVariant];
                      const nextEmpty = postVariants.findIndex(item => !item.title.trim() && !item.bodyHtml.trim());
                      const target = selected && (selected.title.trim() || selected.bodyHtml.trim()) ? selectedVariant : nextEmpty;
                      if (target >= 0) void generateVariant(target);
                    }}
                    onPublish={() => void publishVariant(postVariants[selectedVariant])}
                    onChange={updated =>
                      setPostVariants(current =>
                        current.map((item, index) => (index === selectedVariant ? updated : item)),
                      )
                    }
                  />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

const KeywordBuilder = ({
  keyword,
  setKeyword,
  city,
  setCity,
  provider,
  setProvider,
  loading,
  search,
  token,
}: {
  keyword: string;
  setKeyword: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  provider: "serpapi" | "dataforseo";
  setProvider: (value: "serpapi" | "dataforseo") => void;
  loading: boolean;
  search: () => void;
  token: string;
}) => {
  const [parts, setParts] = useState(["", "", "", ""]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = [
    "nuntă",
    "botez",
    "majorat",
    "evenimente",
    "cununie civilă",
    "logodnă",
    "corporate",
    "înmormântare",
    "trash the dress",
    "save the date",
  ];
  const ardealCities = ARDEAL_CITIES;
  // Keep Locație in sync with the keyword so a stale city never geo-targets the wrong town.
  const applyKeyword = (value: string) => {
    setKeyword(value);
    const detected = cityInKeyword(value);
    if (detected && normalizeText(detected) !== normalizeText(city)) setCity(detected);
  };
  const build = () => {
    const values = parts.map(value => value.trim()).filter(Boolean);
    if (!values.length) {
      setError("Completează cel puțin unul dintre cele 4 câmpuri.");
      return;
    }
    setError("");
    const joined = values.join(" ");
    setKeyword(joined);
    if (parts[3].trim()) setCity(parts[3].trim());
    else {
      const detected = cityInKeyword(joined);
      if (detected) setCity(detected);
    }
  };
  const generate = async (similar: boolean) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/seo-radar/keyword-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          serviceOne: parts[0],
          serviceTwo: parts[1],
          event: parts[2],
          custom: parts[3],
          similar,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generarea a eșuat.");
      setSuggestions(data.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generarea a eșuat.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="grid gap-4 md:grid-cols-[1fr_220px_180px_auto]">
        <label className="text-sm text-gray-300">
          Keyword
          <input
            value={keyword}
            onChange={event => applyKeyword(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white"
          />
        </label>
        <label className="text-sm text-gray-300">
          Locație
          <input
            value={city}
            onChange={event => setCity(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white"
          />
        </label>
        <label className="text-sm text-gray-300">
          Sursă
          <select
            value={provider}
            onChange={event => setProvider(event.target.value as "serpapi" | "dataforseo")}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white"
          >
            <option value="serpapi">SerpApi</option>
            <option value="dataforseo">DataForSEO</option>
          </select>
        </label>
        <button
          onClick={() => search()}
          disabled={loading}
          className="self-end rounded-xl bg-white px-6 py-3 font-medium text-black disabled:opacity-50"
        >
          {loading ? "Caut…" : "Capturează"}
        </button>
      </div>
      <div className="mt-5 border-t border-white/10 pt-5">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Construiește keyword recomandat</p>
        <p className="mt-1 text-xs text-gray-500">
          Câmpurile sunt opționale. Poți combina serviciile, evenimentul și orașul.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr]">
          <input
            value={parts[0]}
            onChange={event =>
              setParts(current => current.map((part, index) => (index === 0 ? event.target.value : part)))
            }
            placeholder="Serviciu 1"
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
          />
          <input
            value={parts[1]}
            onChange={event =>
              setParts(current => current.map((part, index) => (index === 1 ? event.target.value : part)))
            }
            placeholder="Serviciu 2"
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
          />
          <select
            value={parts[2]}
            onChange={event =>
              setParts(current => current.map((part, index) => (index === 2 ? event.target.value : part)))
            }
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
          >
            <option value="">Eveniment</option>
            {options.map(option => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <input
            list="seo-ardeal-cities"
            value={parts[3]}
            onChange={event =>
              setParts(current => current.map((part, index) => (index === 3 ? event.target.value : part)))
            }
            placeholder="Caută oraș din Ardeal"
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
          />
          <datalist id="seo-ardeal-cities">
            {ardealCities.map(cityData => (
              <option key={`${cityData.county}-${cityData.name}`} value={cityData.name} label={`${cityData.county} · ${cityData.population ? `${cityData.population.toLocaleString("ro-RO")} loc.` : "populație n/a"}`} />
            ))}
          </datalist>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={build}
            className="rounded-xl border border-amber-200/50 px-4 py-2 text-sm text-amber-200"
          >
            Folosește keyword
          </button>
          <button
            type="button"
            onClick={() => void generate(false)}
            disabled={busy}
            className="rounded-xl border border-violet-300/50 px-4 py-2 text-sm text-violet-200 disabled:opacity-50"
          >
            {busy ? "Claude generează…" : "Generează sugestii cu Claude"}
          </button>
          <button
            type="button"
            onClick={() => void generate(true)}
            disabled={busy}
            className="rounded-xl border border-violet-300/50 px-4 py-2 text-sm text-violet-200 disabled:opacity-50"
          >
            Generează asemănătoare
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        {suggestions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map(suggestion => (
              <button
                key={suggestion}
                type="button"
                onClick={() => applyKeyword(suggestion)}
                className={`rounded-xl border px-3 py-2 text-sm ${keyword === suggestion ? "border-amber-200 text-amber-200" : "border-white/10 text-gray-300"}`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const DiacriticsCorrector = ({ token }: { token: string }) => {
  const [input, setInput] = useState("");
  const [variants, setVariants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const correct = async () => {
    setLoading(true);
    setError("");
    setCopied(null);
    try {
      const response = await fetch("/api/admin/seo-radar/diacritics", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Corectarea a eșuat.");
      setVariants(data.variants);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Corectarea a eșuat.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="mt-8 rounded-3xl border border-violet-300/20 bg-violet-300/5 p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-violet-200/80">Corector diacritice · Claude</p>
      <p className="mt-1 text-sm text-gray-400">Introdu un cuvânt sau o expresie și primești variantele posibile.</p>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") void correct();
          }}
          placeholder="Ex.: fotograf nunta targu mures"
          className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white"
        />
        <button
          type="button"
          onClick={correct}
          disabled={loading || !input.trim()}
          className="rounded-xl bg-violet-200 px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
        >
          {loading ? "Verific…" : "DIACRITICE"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {variants.length > 0 && (
        <div className="mt-5 space-y-2">
          {variants.map((variant, index) => (
            <div
              key={`${variant}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
            >
              <span className="break-words text-sm text-gray-200">{variant}</span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(variant);
                  setCopied(index);
                }}
                className="shrink-0 rounded-lg border border-violet-300/40 px-3 py-1.5 text-xs text-violet-200"
              >
                {copied === index ? "Copiat" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const PostVariantEditor = ({
  variant,
  token,
  onChange,
  generating: postGenerating,
  onGenerate,
  publishing,
  onPublish,
}: {
  variant: PostVariant;
  token: string;
  onChange: (variant: PostVariant) => void;
  generating: boolean;
  onGenerate: () => void;
  publishing: boolean;
  onPublish: () => void;
}) => {
  const [instruction, setInstruction] = useState("");
  const [bodyOptions, setBodyOptions] = useState<{ title: string; html: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [bodyError, setBodyError] = useState("");
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voicePreview, setVoicePreview] = useState("");
  const voiceBaseTextRef = useRef("");
  const voiceSessionTextRef = useRef("");
  const voiceActiveRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const voiceAnalyserRef = useRef<AnalyserNode | null>(null);
  const voiceFrameRef = useRef<number | null>(null);
  const voiceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canonicalCheck, setCanonicalCheck] = useState<{ exists: boolean; status: number | null; message?: string } | null>(null);
  const [checkingCanonical, setCheckingCanonical] = useState(false);
  const inputClass = "mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white";
  const update = <K extends keyof PostVariant>(key: K, value: PostVariant[K]) => onChange({ ...variant, [key]: value });
  const format = (command: string) => document.execCommand(command, false);
  const stopVoiceWaveform = () => {
    if (voiceFrameRef.current !== null) window.cancelAnimationFrame(voiceFrameRef.current);
    voiceFrameRef.current = null;
    voiceAnalyserRef.current = null;
    voiceStreamRef.current?.getTracks().forEach(track => track.stop());
    voiceStreamRef.current = null;
    voiceAudioContextRef.current?.close().catch(() => {});
    voiceAudioContextRef.current = null;
  };
  const commitVoicePreview = () => {
    setVoicePreview(preview => {
      const text = preview.trim();
      if (text) setInstruction(current => `${current}${current.trim() ? " " : ""}${text}`);
      return "";
    });
  };
  const startVoiceWaveform = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const canvas = voiceCanvasRef.current;
    if (!canvas) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    voiceStreamRef.current = stream;
    const context = new AudioContext();
    voiceAudioContextRef.current = context;
    if (context.state === "suspended") await context.resume().catch(() => {});
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.82;
    context.createMediaStreamSource(stream).connect(analyser);
    voiceAnalyserRef.current = analyser;
    const data = new Uint8Array(analyser.fftSize);
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.floor(canvas.clientWidth * dpr);
      const height = Math.floor(canvas.clientHeight * dpr);
      if (!width || !height) { voiceFrameRef.current = requestAnimationFrame(draw); return; }
      canvas.width = width;
      canvas.height = height;
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(38, 38, 38, 0.92)";
      ctx.fillRect(0, 0, width, height);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(253, 230, 138, 0.95)";
      ctx.lineWidth = 2 * dpr;
      data.forEach((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = ((value / 255) * height);
        index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      voiceFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
  };
  const toggleVoiceInput = async () => {
    if (voiceRecording) {
      voiceActiveRef.current = false;
      recognitionRef.current?.stop();
      stopVoiceWaveform();
      setVoiceRecording(false);
      commitVoicePreview();
      return;
    }
    const speechWindow = window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setBodyError("Dictarea vocală nu este disponibilă în acest browser. Încearcă Google Chrome.");
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ro-RO";
    recognition.onresult = event => {
      const results = Array.from({ length: event.results.length }, (_, index) => event.results[index]);
      const sessionText = results.map(result => result?.[0]?.transcript || "").join(" ").trim();
      voiceSessionTextRef.current = sessionText;
      setInstruction(`${voiceBaseTextRef.current}${voiceBaseTextRef.current && sessionText ? " " : ""}${sessionText}`);
      setVoicePreview(results.filter(result => !result?.[0]?.isFinal).map(result => result?.[0]?.transcript || "").join(" ").trim());
    };
    recognition.onend = () => {
      if (voiceActiveRef.current) {
        voiceBaseTextRef.current = `${voiceBaseTextRef.current}${voiceBaseTextRef.current && voiceSessionTextRef.current ? " " : ""}${voiceSessionTextRef.current}`.trim();
        voiceSessionTextRef.current = "";
        try { recognition.start(); } catch { /* browserul poate fi încă în tranziție */ }
      }
      else { setVoiceRecording(false); commitVoicePreview(); }
    };
    recognition.onerror = () => { if (!voiceActiveRef.current) { setVoiceRecording(false); commitVoicePreview(); } setBodyError("Nu am putut prelua vocea. Verifică permisiunea microfonului."); };
    recognitionRef.current = recognition;
    setBodyError("");
    voiceActiveRef.current = true;
    voiceBaseTextRef.current = instruction.trim();
    voiceSessionTextRef.current = "";
    setVoiceRecording(true);
    try {
      await startVoiceWaveform();
      recognition.start();
    } catch {
      voiceActiveRef.current = false;
      setVoiceRecording(false);
      stopVoiceWaveform();
      setBodyError("Nu am putut accesa microfonul. Verifică permisiunea browserului.");
    }
  };
  const checkCanonical = async () => {
    setCheckingCanonical(true);
    setCanonicalCheck(null);
    try {
      const response = await fetch("/api/admin/seo-radar/check-canonical", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: variant.canonicalUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "URL invalid.");
      setCanonicalCheck({ exists: data.exists === true, status: typeof data.status === "number" ? data.status : null, message: data.error });
    } catch (error) {
      setCanonicalCheck({ exists: false, status: null, message: error instanceof Error ? error.message : "Verificarea a eșuat." });
    } finally {
      setCheckingCanonical(false);
    }
  };
  useEffect(() => () => {
    voiceActiveRef.current = false;
    recognitionRef.current?.stop();
    stopVoiceWaveform();
  }, []);
  const generateBody = async () => {
    setGenerating(true);
    setBodyError("");
    try {
      const response = await fetch("/api/admin/seo-radar/generate-body", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ instruction, context: variant.title }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generarea a eșuat.");
      setBodyOptions(data.variants);
    } catch (error) {
      setBodyError(error instanceof Error ? error.message : "Generarea a eșuat.");
    } finally {
      setGenerating(false);
    }
  };
  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/20 bg-amber-200/5 p-4">
        <div>
          <p className="text-sm text-amber-100">Varianta aceasta este independentă</p>
          <p className="mt-1 text-xs text-gray-500">Poți edita manual sau poți cere lui Claude să o completeze.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onGenerate} disabled={postGenerating} className="rounded-xl bg-amber-200 px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
            {postGenerating ? "Claude generează…" : variant.title ? "Regenerează cu Claude" : "Generează cu Claude"}
          </button>
          <button type="button" onClick={onPublish} disabled={publishing || !variant.title.trim() || !variant.slug.trim() || !variant.bodyHtml.trim()} className="rounded-xl border border-emerald-300/50 px-4 py-2 text-sm font-medium text-emerald-200 disabled:opacity-40">
            {publishing ? "Se publică…" : "Publică articolul"}
          </button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs uppercase tracking-wider text-gray-500">
          Titlu SEO
          <input className={inputClass} value={variant.title} onChange={e => update("title", e.target.value)} />
        </label>
        <label className="text-xs uppercase tracking-wider text-gray-500">
          SEO title
          <input className={inputClass} value={variant.seoTitle} onChange={e => update("seoTitle", e.target.value)} />
        </label>
        <label className="text-xs uppercase tracking-wider text-gray-500">
          Slug
          <input className={inputClass} value={variant.slug} onChange={e => update("slug", e.target.value)} />
        </label>
        <label className="text-xs uppercase tracking-wider text-gray-500">
          URL canonic
          <div className="mt-1 flex gap-2">
            <input className={inputClass.replace("mt-1 ", "")} value={variant.canonicalUrl} onChange={e => { update("canonicalUrl", e.target.value); setCanonicalCheck(null); }} />
            <button type="button" onClick={checkCanonical} disabled={checkingCanonical || !variant.canonicalUrl.trim()} className="shrink-0 rounded-xl border border-amber-200/40 px-3 text-xs text-amber-200 disabled:opacity-50">
              {checkingCanonical ? "Verific…" : "Verifică"}
            </button>
          </div>
          {canonicalCheck && <p className={`mt-1 text-xs ${canonicalCheck.exists ? "text-emerald-300" : "text-red-300"}`}>
            {canonicalCheck.exists ? `Link accesibil (HTTP ${canonicalCheck.status})` : canonicalCheck.message || `Link inaccesibil${canonicalCheck.status ? ` (HTTP ${canonicalCheck.status})` : ""}`}
          </p>}
        </label>
        <label className="text-xs uppercase tracking-wider text-gray-500 md:col-span-2">
          Meta description
          <textarea
            className={inputClass}
            rows={2}
            value={variant.metaDescription}
            onChange={e => update("metaDescription", e.target.value)}
          />
        </label>
        <label className="text-xs uppercase tracking-wider text-gray-500">
          Tag-uri SEO
          <input
            className={inputClass}
            value={variant.tags.join(", ")}
            onChange={e =>
              update(
                "tags",
                e.target.value
                  .split(",")
                  .map(item => item.trim())
                  .filter(Boolean),
              )
            }
          />
        </label>
        <label className="text-xs uppercase tracking-wider text-gray-500">
          Categorie
          <input className={inputClass} value={variant.category} onChange={e => update("category", e.target.value)} />
        </label>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="mb-5 border-b border-white/10 pb-4">
          <p className="text-xs uppercase tracking-wider text-amber-200/70">Context pentru body</p>
          <p className="mt-1 text-xs text-gray-500">Body-ul se generează numai după ce introduci contextul și apeși butonul.</p>
          <div className="mt-2 flex flex-col gap-2 md:flex-row">
            <textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              rows={2}
              placeholder="Ex.: Vorbește despre fotocabina în Gilău, prețul este X, oferim magneți…"
              className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
            />
            <button type="button" onClick={toggleVoiceInput} className={`rounded-xl border px-4 py-2 text-sm ${voiceRecording ? "border-red-400 bg-red-400/10 text-red-300" : "border-white/10 text-gray-200"}`} title="Dictare vocală">
              {voiceRecording ? "⏹ Oprește" : "🎙 Microfon"}
            </button>
            <canvas ref={voiceCanvasRef} className={`${voiceRecording ? "block" : "hidden"} h-12 w-full rounded-xl border border-amber-200/20 bg-neutral-900 md:w-64`} aria-label="Waveform live microfon" />
            <button
              type="button"
              onClick={generateBody}
              disabled={generating || !instruction.trim()}
              className="rounded-xl bg-violet-300 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {generating ? "Generez…" : "Generează conținut"}
            </button>
          </div>
          {voiceRecording && <p className="mt-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs italic text-amber-100/80">{voicePreview || "Ascult… vorbește în microfon."}</p>}
          {bodyError && <p className="mt-2 text-sm text-red-300">{bodyError}</p>}
        </div>
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
          <button
            type="button"
            onClick={() => format("bold")}
            className="rounded-lg border border-white/10 px-3 py-1 font-bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => format("italic")}
            className="rounded-lg border border-white/10 px-3 py-1 italic"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => format("insertUnorderedList")}
            className="rounded-lg border border-white/10 px-3 py-1"
          >
            • Listă
          </button>
          <span className="ml-2 self-center text-xs text-gray-500">Body articol · editare vizuală</span>
        </div>
        <div
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: variant.bodyHtml }}
          onInput={event => update("bodyHtml", event.currentTarget.innerHTML)}
          className="blog-article mt-4 min-h-[360px] rounded-xl border border-white/10 bg-black p-4 text-sm leading-7 text-gray-200 outline-none focus:border-amber-200/50"
        />
        <div className="mt-5 border-t border-white/10 pt-4">
          {bodyOptions.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {bodyOptions.map((option, index) => (
                <div key={index} className="rounded-xl border border-white/10 p-3">
                  <p className="text-xs text-gray-500">
                    Varianta {index + 1} · {option.title}
                  </p>
                  <div className="mt-2 text-sm text-gray-300" dangerouslySetInnerHTML={{ __html: option.html }} />
                  <button
                    type="button"
                    onClick={() => {
                      update("bodyHtml", `${variant.bodyHtml}<p>${option.html}</p>`);
                      setBodyOptions([]);
                    }}
                    className="mt-3 rounded-lg border border-amber-200/30 px-3 py-1.5 text-xs text-amber-200"
                  >
                    Inserează în body
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Unghi: {variant.angle} · Prioritate: {variant.priority} · Linkuri interne: {variant.internalLinks.join(", ")}
      </p>
    </div>
  );
};

const Metric = ({ value, label }: { value: string; label: string }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
    <strong className="block text-2xl font-light">{value}</strong>
    <span className="text-xs text-gray-400">{label}</span>
  </div>
);

type CoverageCellStatus = CoverageStatus | "unscanned";
interface CoverageCell {
  serviceId: string;
  serviceLabel: string;
  city: string;
  analysis: Analysis | null;
  status: CoverageCellStatus;
  articleCount: number;
  articleRanked: boolean;
}

const cityRank = (name: string): number => {
  const index = ARDEAL_CITIES.findIndex(cityData => cityData.name === name);
  return index === -1 ? ARDEAL_CITIES.length + 1 : index;
};

const cellChipClass = (status: CoverageCellStatus): string => {
  switch (status) {
    case "pos1": return "border-emerald-400/60 bg-emerald-400/20 text-emerald-200";
    case "top3": return "border-emerald-300/40 bg-emerald-300/10 text-emerald-300";
    case "top10": return "border-amber-200/40 bg-amber-200/10 text-amber-200";
    case "absent": return "border-red-400/40 bg-red-400/10 text-red-300";
    default: return "border-dashed border-white/15 text-gray-600";
  }
};
const cellLabel = (cell: CoverageCell): string => {
  if (cell.status === "unscanned") return "+";
  if (cell.status === "absent") return "—";
  return `#${cell.analysis?.latestPosition ?? ""}`;
};
const statusText = (status: CoverageCellStatus): string => ({
  pos1: "Poziția 1", top3: "Top 3", top10: "Top 4–10", absent: "Absent (nu apărem)", unscanned: "Nescanat",
}[status]);

type TrendDelta = { dir: "up" | "down" | "flat" | "new"; amount: number } | null;
// Δ față de scanarea precedentă, din positionHistory (+ = am urcat).
const historyDelta = (history: PositionPoint[]): TrendDelta => {
  if (history.length < 2) return null;
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  if (last.position === null) return null;
  if (prev.position === null) return { dir: "new", amount: 0 };
  const diff = prev.position - last.position;
  if (diff > 0) return { dir: "up", amount: diff };
  if (diff < 0) return { dir: "down", amount: -diff };
  return { dir: "flat", amount: 0 };
};
const deltaText = (delta: TrendDelta): string => {
  if (!delta) return "—";
  if (delta.dir === "new") return "nou în top 10";
  if (delta.dir === "flat") return "fără schimbare";
  return delta.dir === "up" ? `↑ ${delta.amount}` : `↓ ${delta.amount}`;
};
const deltaTone = (delta: TrendDelta): string => {
  if (!delta || delta.dir === "flat") return "text-gray-400";
  return delta.dir === "down" ? "text-red-300" : "text-emerald-300";
};
const positionLabel = (position: number | null): string => (position === null ? "peste 10" : `#${position}`);

// Grafic inline de evoluție a poziției — o singură serie (amber), Y inversat, bandă „peste 10".
const PositionTimeline = ({ history }: { history: PositionPoint[] }) => {
  const [hover, setHover] = useState<number | null>(null);
  const scans = history.filter(point => Boolean(point.capturedAt));
  if (scans.length < 2) {
    return (
      <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-6 text-center text-sm text-gray-400">
        O singură captură. Rescanează peste ~o lună pentru comparație.
      </p>
    );
  }

  const width = 560;
  const height = 200;
  const padL = 34;
  const padR = 44;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const times = scans.map(point => new Date(point.capturedAt).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const worst = Math.max(10, ...scans.map(point => point.position ?? 0));
  const beyond = worst + 2; // banda „peste 10"

  const x = (time: number) => (tMax === tMin ? padL + plotW / 2 : padL + ((time - tMin) / (tMax - tMin)) * plotW);
  const y = (pos: number) => padT + ((pos - 1) / (beyond - 1)) * plotH;

  const points = scans.map((point, index) => ({
    ...point,
    cx: x(times[index]),
    cy: y(point.position ?? beyond),
    ranked: point.position !== null,
  }));
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.cx.toFixed(1)} ${point.cy.toFixed(1)}`).join(" ");
  const gridLines = [1, 3, 10].filter(pos => pos <= worst);
  const active = hover !== null ? points[hover] : points[points.length - 1];
  const endDelta = historyDelta(scans);

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-gray-500">Evoluție poziție</p>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-48 w-full min-w-[420px]"
          onMouseLeave={() => setHover(null)}
        >
          {/* banda „peste 10" */}
          <rect x={padL} y={y(10)} width={plotW} height={padT + plotH - y(10)} fill="rgba(248,113,113,0.06)" />
          <text x={padL + 2} y={y(10) + 12} className="fill-gray-600 text-[9px]">peste 10</text>
          {gridLines.map(pos => (
            <g key={pos}>
              <line x1={padL} x2={padL + plotW} y1={y(pos)} y2={y(pos)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
              <text x={padL - 6} y={y(pos) + 3} textAnchor="end" className="fill-gray-500 text-[9px]">#{pos}</text>
            </g>
          ))}
          <path d={linePath} fill="none" stroke="#fde68a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <g key={index}>
              <circle cx={point.cx} cy={point.cy} r={index === hover ? 6 : 4.5} fill={point.ranked ? "#fde68a" : "#0a0a0a"} stroke={point.ranked ? "#0a0a0a" : "#f87171"} strokeWidth={2} />
              <rect
                x={point.cx - 14}
                y={padT}
                width={28}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
              />
            </g>
          ))}
          {active && (
            <>
              <line x1={active.cx} x2={active.cx} y1={padT} y2={padT + plotH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
              <text x={Math.min(active.cx + 8, width - padR)} y={padT + 10} className="fill-gray-200 text-[10px]" textAnchor={active.cx > width - padR - 60 ? "end" : "start"}>
                {positionLabel(active.position)}
              </text>
            </>
          )}
          <text x={padL} y={height - 8} className="fill-gray-500 text-[9px]">
            {new Date(tMin).toLocaleDateString("ro-RO")}
          </text>
          <text x={padL + plotW} y={height - 8} textAnchor="end" className="fill-gray-500 text-[9px]">
            {new Date(tMax).toLocaleDateString("ro-RO")}
          </text>
        </svg>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {hover !== null
          ? `${new Date(scans[hover].capturedAt).toLocaleString("ro-RO")} · ${positionLabel(scans[hover].position)}`
          : (
            <>
              Acum: <span className="text-amber-200">{positionLabel(scans[scans.length - 1].position)}</span>
              {endDelta && endDelta.dir !== "flat" && (
                <span className={`ml-2 ${deltaTone(endDelta)}`}>
                  {endDelta.dir === "new" ? "nou în top 10" : endDelta.dir === "up" ? `▲ ${endDelta.amount} față de scanarea precedentă` : `▼ ${endDelta.amount} față de scanarea precedentă`}
                </span>
              )}
            </>
          )}
      </p>
    </div>
  );
};

const PositionHistoryTable = ({ history }: { history: PositionPoint[] }) => (
  <div className="mt-3 overflow-x-auto">
    <table className="w-full text-left text-xs">
      <thead className="text-[10px] uppercase text-gray-500">
        <tr><th className="py-1 pr-3">Data</th><th className="py-1 pr-3">Poziție</th><th className="py-1">Δ</th></tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {[...history].reverse().map((point, index, reversed) => {
          const older = reversed[index + 1];
          const delta: TrendDelta = !older
            ? null
            : point.position === null
              ? null
              : older.position === null
                ? { dir: "new", amount: 0 }
                : (() => {
                    const diff = older.position - point.position;
                    return diff > 0 ? { dir: "up" as const, amount: diff } : diff < 0 ? { dir: "down" as const, amount: -diff } : { dir: "flat" as const, amount: 0 };
                  })();
          return (
            <tr key={point.capturedAt}>
              <td className="py-1.5 pr-3 text-gray-300">{new Date(point.capturedAt).toLocaleString("ro-RO")}</td>
              <td className="py-1.5 pr-3 font-medium text-amber-200">{positionLabel(point.position)}</td>
              <td className={`py-1.5 ${deltaTone(delta)}`}>{index === history.length - 1 ? "Prima captură" : deltaText(delta)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const suggestionMetric = (item: KeywordSuggestion): string => {
  if (item.volume !== null) return `${item.volume.toLocaleString("ro-RO")}/lună`;
  if (item.trendScore !== null) return `interes ${item.trendScore}${item.rising ? " ↑" : ""}`;
  return "—";
};

const KeywordSuggestionsPanel = ({
  baseKeyword,
  baseLabel,
  city,
  existingQueries,
  onDiscover,
  onAdd,
  requestConfirm,
  addLabel = "+ coloană",
}: {
  baseKeyword: string;
  baseLabel: string;
  city?: string;
  existingQueries: Set<string>;
  onDiscover: (baseKeyword: string, city?: string) => Promise<KeywordSuggestion[]>;
  onAdd: (keyword: string) => void;
  requestConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
  addLabel?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<KeywordSuggestion[] | null>(null);
  if (!baseKeyword) return null;

  const seedLabel = city ? `${baseLabel} ${city}` : baseLabel;
  const run = () => {
    requestConfirm(
      "Sugestii keyword-uri",
      `Caut alternative pentru „${seedLabel}" (Trends + DataForSEO Labs, ~$0.03). Continui?`,
      () => {
        setOpen(true);
        setLoading(true);
        setError("");
        onDiscover(baseKeyword, city)
          .then(setItems)
          .catch(err => setError(err instanceof Error ? err.message : "Nu am putut găsi sugestii."))
          .finally(() => setLoading(false));
      },
      "Caută",
    );
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => (items === null ? run() : setOpen(value => !value))}
        className="rounded-xl border border-violet-300/40 px-3 py-1.5 text-xs font-medium text-violet-200"
      >
        {items === null ? "Sugerează alternative" : open ? "Ascunde sugestiile" : `Arată sugestiile (${items.length})`}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3">
          {loading ? (
            <p className="text-xs text-gray-400">Caut alternative pentru „{seedLabel}"…</p>
          ) : error ? (
            <p className="text-xs text-red-300">{error}</p>
          ) : items && items.length === 0 ? (
            <p className="text-xs text-gray-400">Fără sugestii pentru acest termen — încearcă alt keyword de bază.</p>
          ) : items ? (
            <ul className="space-y-1.5">
              {items.map(item => {
                const norm = normalizeText(item.keyword);
                const added = existingQueries.has(norm);
                return (
                  <li key={item.keyword} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 flex-1 truncate text-gray-200">{item.keyword}</span>
                    <span className="shrink-0 text-gray-500">{suggestionMetric(item)}</span>
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => onAdd(item.keyword)}
                      className="shrink-0 rounded-lg border border-amber-200/40 px-2 py-0.5 text-amber-200 disabled:border-white/10 disabled:text-gray-600"
                    >
                      {added ? "adăugat" : addLabel}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
};

const planStatusLabel = (status: "idle" | "saving" | "saved"): string =>
  status === "saving" ? "se salvează…" : status === "saved" ? "salvat ✓" : "se salvează automat";

const ArticlePlanEditor = ({
  plan,
  status,
  onChange,
  city,
  onDiscoverKeywords,
  requestConfirm,
}: {
  plan: ArticlePlan;
  status: "idle" | "saving" | "saved";
  onChange: (plan: ArticlePlan) => void;
  city: string;
  onDiscoverKeywords: (baseKeyword: string, city?: string) => Promise<KeywordSuggestion[]>;
  requestConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
}) => {
  const [newKeyword, setNewKeyword] = useState("");
  const addSecondary = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const norm = normalizeText(value);
    if (plan.secondaryKeywords.some(item => normalizeText(item) === norm)) return;
    onChange({ ...plan, secondaryKeywords: [...plan.secondaryKeywords, value] });
  };
  const removeSecondary = (value: string) =>
    onChange({ ...plan, secondaryKeywords: plan.secondaryKeywords.filter(item => item !== value) });

  return (
    <div className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-300/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-200/80">Plan articol</p>
        <span className="text-[11px] text-gray-500">{planStatusLabel(status)}</span>
      </div>
      <label className="mt-3 block text-xs uppercase tracking-wider text-gray-500">
        Keyword țintă
        <input
          value={plan.targetKeyword}
          onChange={event => onChange({ ...plan, targetKeyword: event.target.value })}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
        />
      </label>
      <div className="mt-3">
        <p className="text-xs uppercase tracking-wider text-gray-500">Keyword-uri secundare</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {plan.secondaryKeywords.map(keyword => (
            <span key={keyword} className="flex items-center gap-1 rounded-full border border-violet-300/30 px-2.5 py-1 text-xs text-violet-100">
              {keyword}
              <button type="button" onClick={() => removeSecondary(keyword)} className="text-violet-200/60 hover:text-red-300">×</button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={newKeyword}
            onChange={event => setNewKeyword(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addSecondary(newKeyword);
                setNewKeyword("");
              }
            }}
            placeholder="ex: fotograf botez pret — Enter adaugă"
            className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
          />
        </div>
      </div>
      <div className="mt-3">
        <KeywordSuggestionsPanel
          baseKeyword={plan.targetKeyword}
          baseLabel={plan.targetKeyword}
          city={city}
          existingQueries={new Set(plan.secondaryKeywords.map(normalizeText))}
          onDiscover={onDiscoverKeywords}
          onAdd={keyword => { addSecondary(keyword); }}
          requestConfirm={requestConfirm}
          addLabel="+ keyword"
        />
      </div>
      <p className="mt-3 text-[11px] leading-4 text-gray-500">
        Claude va viza precis keyword-ul țintă și va țese natural keyword-urile secundare în
        articol; ele devin automat Tag-uri SEO pe postare.
      </p>
    </div>
  );
};

const competitionTone = (competition: string | null): string => {
  if (competition === "LOW") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-300";
  if (competition === "MEDIUM") return "border-amber-200/40 bg-amber-200/10 text-amber-200";
  if (competition === "HIGH") return "border-red-400/40 bg-red-400/10 text-red-300";
  return "border-white/10 text-gray-400";
};
const competitionLabel = (competition: string | null): string =>
  competition === "LOW" ? "Concurență scăzută" : competition === "MEDIUM" ? "Concurență medie" : competition === "HIGH" ? "Concurență ridicată" : "Concurență necunoscută";
const intentTone = (intent: string | null): string =>
  intent === "transactional" || intent === "commercial" ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-300" : "border-white/10 text-gray-400";
const intentLabel = (intent: string | null, probability: number | null): string => {
  const pct = probability !== null ? ` (${Math.round(probability * 100)}%)` : "";
  if (intent === "transactional" || intent === "commercial") return `Gata să cumpere${pct}`;
  if (intent === "informational") return `Se documentează${pct} — mai potrivit pentru articol`;
  if (intent === "navigational") return `Caută un brand anume${pct}`;
  return "Intenție necunoscută";
};

const AdsInsightPanel = ({
  keyword,
  onDiscoverInsight,
  onDiscoverBudget,
  requestConfirm,
}: {
  keyword: string;
  onDiscoverInsight: (keyword: string) => Promise<AdsInsight>;
  onDiscoverBudget: (keyword: string, bid: number) => Promise<AdsBudgetEstimate>;
  requestConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
}) => {
  const [insight, setInsight] = useState<AdsInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [insightError, setInsightError] = useState("");
  const [bid, setBid] = useState("3");
  const [budget, setBudget] = useState<AdsBudgetEstimate | null>(null);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [budgetError, setBudgetError] = useState("");

  const runInsight = () => {
    requestConfirm(
      "Analiză Ads",
      `CPC, concurență și intenție de căutare pentru „${keyword}" (Google Ads + DataForSEO, ~$0,10). Continui?`,
      () => {
        setLoadingInsight(true);
        setInsightError("");
        onDiscoverInsight(keyword)
          .then(data => { setInsight(data); if (data.highBid !== null) setBid(String(data.highBid.toFixed(2))); })
          .catch(err => setInsightError(err instanceof Error ? err.message : "Nu am putut încărca datele de Ads."))
          .finally(() => setLoadingInsight(false));
      },
      "Analizează",
    );
  };

  const runBudget = () => {
    const bidValue = Number(bid.replace(",", "."));
    if (!Number.isFinite(bidValue) || bidValue <= 0) { setBudgetError("Introdu o licitație validă."); return; }
    requestConfirm(
      "Simulare buget Ads",
      `Estimez click-uri și cost pentru „${keyword}" la o licitație de ${bidValue} RON (~$0,09). Continui?`,
      () => {
        setLoadingBudget(true);
        setBudgetError("");
        onDiscoverBudget(keyword, bidValue)
          .then(setBudget)
          .catch(err => setBudgetError(err instanceof Error ? err.message : "Nu am putut estima bugetul."))
          .finally(() => setLoadingBudget(false));
      },
      "Simulează",
    );
  };

  return (
    <div className="rounded-xl border border-sky-300/20 bg-sky-300/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-sky-200/80">Pregătire Ads</p>
        {!insight && (
          <button type="button" onClick={runInsight} disabled={loadingInsight} className="rounded-lg border border-sky-300/40 px-3 py-1.5 text-xs font-medium text-sky-200 disabled:opacity-50">
            {loadingInsight ? "Analizez…" : "Analiză Ads"}
          </button>
        )}
      </div>
      {insightError && <p className="mt-2 text-xs text-red-300">{insightError}</p>}
      {insight && (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-200">
              CPC: {insight.cpc !== null ? `${insight.cpc.toFixed(2)} RON` : "—"}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs ${competitionTone(insight.competition)}`}>
              {competitionLabel(insight.competition)}{insight.competitionIndex !== null ? ` (${insight.competitionIndex}/100)` : ""}
            </span>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-200">
              Licitație: {insight.lowBid !== null && insight.highBid !== null ? `${insight.lowBid.toFixed(2)}–${insight.highBid.toFixed(2)} RON` : "—"}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs ${intentTone(insight.intent)}`}>
              {intentLabel(insight.intent, insight.intentProbability)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-gray-400">
              Licitație (RON/zi)
              <input
                value={bid}
                onChange={event => setBid(event.target.value)}
                className="mt-1 block w-24 rounded-lg border border-white/10 bg-black px-2 py-1.5 text-sm text-white"
              />
            </label>
            <button type="button" onClick={runBudget} disabled={loadingBudget} className="rounded-lg border border-sky-300/40 px-3 py-1.5 text-xs font-medium text-sky-200 disabled:opacity-50">
              {loadingBudget ? "Simulez…" : "Simulează"}
            </button>
            {budget && (
              <span className="text-xs text-gray-300">
                ~{budget.clicks !== null ? budget.clicks.toFixed(1) : "—"} click-uri · cost estimat ~{budget.cost !== null ? budget.cost.toFixed(2) : "—"} RON
                {budget.avgCpc !== null ? ` · CPC mediu ${budget.avgCpc.toFixed(2)} RON` : ""} (luna următoare)
              </span>
            )}
          </div>
          {budgetError && <p className="mt-2 text-xs text-red-300">{budgetError}</p>}
        </>
      )}
      <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, "_blank", "noopener,noreferrer")}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300"
        >
          Verifică manual →
        </button>
        <span className="text-[11px] text-gray-500">Reclamele live nu sunt fiabile prin API — verifică din browser, aproape de oraș.</span>
      </div>
    </div>
  );
};

const CoverageDetailPanel = ({
  cell,
  disabled,
  onView,
  onRescan,
  onCreateArticle,
  onClose,
  serviceQueryValue,
  onDiscoverKeywords,
  onAddColumn,
  existingQueries,
  onDiscoverAdsInsight,
  onDiscoverAdsBudget,
  requestConfirm,
}: {
  cell: CoverageCell;
  disabled: boolean;
  onView: (analysis: Analysis) => void;
  onRescan: (analysis: Analysis) => void;
  onCreateArticle: (analysis: Analysis) => void;
  onClose: () => void;
  serviceQueryValue: string;
  onDiscoverKeywords: (baseKeyword: string, city?: string) => Promise<KeywordSuggestion[]>;
  onAddColumn: (keyword: string) => void;
  existingQueries: Set<string>;
  onDiscoverAdsInsight: (keyword: string) => Promise<AdsInsight>;
  onDiscoverAdsBudget: (keyword: string, bid: number) => Promise<AdsBudgetEstimate>;
  requestConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
}) => {
  const analysis = cell.analysis;
  if (!analysis) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-white">
          {cell.serviceLabel} · {cell.city}
          <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-400">
            {analysis.provider === "dataforseo" ? "DataForSEO" : "SerpApi"}
          </span>
        </p>
        <span className="text-xs text-gray-500">{analysis.keyword} · {analysis.scanCount} {analysis.scanCount === 1 ? "captură" : "capturi"}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => onRescan(analysis)} disabled={disabled} className="rounded-xl border border-amber-200/50 px-3 py-1.5 text-xs font-medium text-amber-200 disabled:opacity-50">Rescanează</button>
          <button type="button" onClick={() => onView(analysis)} disabled={disabled} className="rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">Deschide analiza completă</button>
          {cell.status === "absent" && cell.articleCount === 0 && (
            <button type="button" onClick={() => onCreateArticle(analysis)} disabled={disabled} className="rounded-xl border border-emerald-300/50 px-3 py-1.5 text-xs font-medium text-emerald-200 disabled:opacity-50">Creează articol</button>
          )}
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-gray-400">Închide</button>
        </div>
      </div>
      <div className="mt-3">
        <KeywordSuggestionsPanel
          baseKeyword={serviceQueryValue}
          baseLabel={cell.serviceLabel}
          city={cell.city}
          existingQueries={existingQueries}
          onDiscover={onDiscoverKeywords}
          onAdd={onAddColumn}
          requestConfirm={requestConfirm}
        />
      </div>
      <div className="mt-3">
        <AdsInsightPanel
          keyword={analysis.keyword}
          onDiscoverInsight={onDiscoverAdsInsight}
          onDiscoverBudget={onDiscoverAdsBudget}
          requestConfirm={requestConfirm}
        />
      </div>
      <div className="mt-3">
        <PositionTimeline history={analysis.positionHistory} />
      </div>
      {analysis.positionHistory.length >= 2 && <PositionHistoryTable history={analysis.positionHistory} />}
    </div>
  );
};

const CoverageReport = ({
  analyses,
  loading,
  query,
  setQuery,
  providerFilter,
  setProviderFilter,
  view,
  setView,
  serviceFilter,
  setServiceFilter,
  statusFilter,
  setStatusFilter,
  planCities,
  setPlanCities,
  columns,
  customColumns,
  setCustomColumns,
  onView,
  onRescan,
  onScanOne,
  onRunManyScans,
  onCreateArticle,
  onDeleteAnalyses,
  onDiscoverKeywords,
  onDiscoverAdsInsight,
  onDiscoverAdsBudget,
  requestConfirm,
  defaultProvider,
  activeScanKey,
  queuedKeys,
  scanResults,
  onStopQueue,
  onClearScanResult,
  disabled,
}: {
  analyses: Analysis[];
  loading: boolean;
  query: string;
  setQuery: (value: string) => void;
  providerFilter: "all" | "serpapi" | "dataforseo";
  setProviderFilter: (value: "all" | "serpapi" | "dataforseo") => void;
  view: "grid" | "list";
  setView: (value: "grid" | "list") => void;
  serviceFilter: string;
  setServiceFilter: (value: string) => void;
  statusFilter: "all" | CoverageStatus | "unscanned" | "gaps";
  setStatusFilter: (value: "all" | CoverageStatus | "unscanned" | "gaps") => void;
  columns: CoverageService[];
  customColumns: CustomColumn[];
  setCustomColumns: React.Dispatch<React.SetStateAction<CustomColumn[]>>;
  planCities: string[];
  setPlanCities: React.Dispatch<React.SetStateAction<string[]>>;
  onView: (analysis: Analysis) => void;
  onRescan: (analysis: Analysis) => void;
  onScanOne: (serviceId: string, city: string) => void;
  onRunManyScans: (jobs: ScanJob[], provider: "serpapi" | "dataforseo") => void;
  onCreateArticle: (analysis: Analysis) => void;
  onDeleteAnalyses: (groups: { keyword: string; provider: "serpapi" | "dataforseo" }[], message: string, onDone?: () => void) => void;
  onDiscoverKeywords: (baseKeyword: string, city?: string) => Promise<KeywordSuggestion[]>;
  onDiscoverAdsInsight: (keyword: string) => Promise<AdsInsight>;
  onDiscoverAdsBudget: (keyword: string, bid: number) => Promise<AdsBudgetEstimate>;
  requestConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
  defaultProvider: "serpapi" | "dataforseo";
  activeScanKey: string | null;
  queuedKeys: ScanJob[];
  scanResults: Record<string, ScanOutcome>;
  onStopQueue: () => void;
  onClearScanResult: (key: string) => void;
  disabled: boolean;
}) => {
  const queuedKeySet = React.useMemo(() => new Set(queuedKeys.map(job => job.key)), [queuedKeys]);
  const activeScanLabel = queuedKeys.find(job => job.key === activeScanKey)?.label ?? "";
  const queueBehind = Math.max(0, queuedKeys.length - (activeScanKey ? 1 : 0));
  const erroredKeys = Object.keys(scanResults).filter(key => scanResults[key].error);
  const [showCities, setShowCities] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [newCity, setNewCity] = useState("");
  const [newColumn, setNewColumn] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProvider, setBulkProvider] = useState<"serpapi" | "dataforseo">(defaultProvider);
  const [expandedCombo, setExpandedCombo] = useState<string | null>(null);
  const [exploreState, setExploreState] = useState<{ done: number; total: number; current: string } | null>(null);
  const [exploreResults, setExploreResults] = useState<(KeywordSuggestion & { sources: string[] })[] | null>(null);
  const existingQueries = React.useMemo(() => new Set(columns.map(col => normalizeText(col.query))), [columns]);
  const comboKey = (serviceId: string, city: string) => `${serviceId}|${city}`;
  const toggleCombo = (serviceId: string, city: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      const key = comboKey(serviceId, city);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const annotated = React.useMemo(
    () => analyses
      .filter(analysis => providerFilter === "all" || analysis.provider === providerFilter)
      .map(analysis => ({
        analysis,
        serviceId: detectService(analysis.keyword, columns) ?? OTHER_SERVICE_ID,
        city: detectCity(analysis.keyword, analysis.city),
      })),
    [analyses, providerFilter, columns],
  );

  const cityList = React.useMemo(() => {
    const detected = annotated.map(item => item.city).filter(Boolean);
    const all = Array.from(new Set([...planCities, ...detected]));
    const normalizedQuery = normalizeText(query);
    return all
      .filter(cityName => !normalizedQuery || normalizeText(cityName).includes(normalizedQuery))
      .sort((a, b) => cityRank(a) - cityRank(b) || a.localeCompare(b, "ro"));
  }, [annotated, planCities, query]);

  const hasOtherService = annotated.some(item => item.serviceId === OTHER_SERVICE_ID);
  const serviceCols = React.useMemo(() => {
    const cols = columns.map(service => ({ id: service.id, label: service.label }));
    if (hasOtherService) cols.push({ id: OTHER_SERVICE_ID, label: "Alt serviciu" });
    return serviceFilter === "all" ? cols : cols.filter(col => col.id === serviceFilter);
  }, [columns, hasOtherService, serviceFilter]);

  const cellFor = React.useCallback((serviceId: string, cityName: string): CoverageCell => {
    const cityNorm = normalizeText(cityName);
    const matches = annotated.filter(item => item.serviceId === serviceId && normalizeText(item.city) === cityNorm);
    const best = matches
      .map(item => item.analysis)
      .sort((a, b) => (a.latestPosition ?? 999) - (b.latestPosition ?? 999))[0] ?? null;
    return {
      serviceId,
      serviceLabel: serviceLabel(serviceId === OTHER_SERVICE_ID ? null : serviceId, columns),
      city: cityName,
      analysis: best,
      status: best ? coverageStatus(best.latestPosition) : "unscanned",
      articleCount: best?.linkedPosts.length ?? 0,
      articleRanked: best?.linkedPosts.some(post => post.status === "ranked") ?? false,
    };
  }, [annotated, columns]);

  const allCells = React.useMemo(
    () => columns.flatMap(service => cityList.map(cityName => cellFor(service.id, cityName))),
    [columns, cityList, cellFor],
  );

  const summary = React.useMemo(() => {
    const count = (predicate: (cell: CoverageCell) => boolean) => allCells.filter(predicate).length;
    return {
      total: allCells.length,
      pos1: count(cell => cell.status === "pos1"),
      top3: count(cell => cell.status === "pos1" || cell.status === "top3"),
      top10: count(cell => cell.status === "top10"),
      absent: count(cell => cell.status === "absent"),
      unscanned: count(cell => cell.status === "unscanned"),
    };
  }, [allCells]);

  const matchesStatus = (status: CoverageCellStatus): boolean => {
    if (statusFilter === "all") return true;
    if (statusFilter === "gaps") return status === "absent" || status === "unscanned";
    return statusFilter === status;
  };

  const addCity = () => {
    const value = newCity.trim();
    if (!value) return;
    setPlanCities(current => (current.some(item => normalizeText(item) === normalizeText(value)) ? current : [...current, value]));
    setNewCity("");
  };

  const addColumn = (raw?: string) => {
    const value = (raw ?? newColumn).trim().replace(/\s+/g, " ");
    if (!value) return;
    const normalized = normalizeText(value);
    if (customColumns.some(col => normalizeText(col.query) === normalized) || SEO_RADAR_SERVICES.some(service => service.query === normalized)) {
      if (!raw) setNewColumn("");
      return;
    }
    setCustomColumns(current => [...current, { id: `col-${normalized.replace(/[^a-z0-9]+/g, "-")}`, label: value, query: normalized }]);
    if (!raw) setNewColumn("");
  };
  const removeColumn = (id: string) => setCustomColumns(current => current.filter(col => col.id !== id));

  // Rulează „Sugerează alternative" pe toate coloanele, una după alta, și combină rezultatele
  // într-un singur tabel dedup+sortat. Secvențial (nu Promise.all) ca să nu lovim rate-limit-ul
  // DataForSEO cu 3×N apeluri simultane.
  const runFullExplore = () => {
    if (exploreState) return;
    const targets = columns;
    if (!targets.length) return;
    requestConfirm(
      "Explorare completă",
      `Caut alternative pentru toate cele ${targets.length} coloane (${targets.map(col => col.label).join(", ")}) — Trends + DataForSEO Labs, ~$${(targets.length * 0.03).toFixed(2)}. Continui?`,
      async () => {
        setExploreResults(null);
        setExploreState({ done: 0, total: targets.length, current: targets[0].label });
        const merged = new Map<string, KeywordSuggestion & { sources: Set<string> }>();
        for (let index = 0; index < targets.length; index++) {
          const col = targets[index];
          setExploreState({ done: index, total: targets.length, current: col.label });
          try {
            const items = await onDiscoverKeywords(col.query);
            for (const item of items) {
              const norm = normalizeText(item.keyword);
              const existing = merged.get(norm);
              if (existing) {
                if (item.volume !== null) existing.volume = existing.volume === null ? item.volume : Math.max(existing.volume, item.volume);
                if (item.trendScore !== null) existing.trendScore = existing.trendScore === null ? item.trendScore : Math.max(existing.trendScore, item.trendScore);
                if (item.rising) existing.rising = true;
                existing.sources.add(col.label);
              } else {
                merged.set(norm, { ...item, sources: new Set([col.label]) });
              }
            }
          } catch {
            // o coloană eșuată nu oprește restul explorării
          }
          setExploreState({ done: index + 1, total: targets.length, current: col.label });
        }
        const sorted = Array.from(merged.values())
          .sort((a, b) => {
            if (a.volume !== null && b.volume !== null) return b.volume - a.volume;
            if (a.volume !== null) return -1;
            if (b.volume !== null) return 1;
            return (b.trendScore ?? 0) - (a.trendScore ?? 0);
          })
          .slice(0, 40)
          .map(item => ({ ...item, sources: Array.from(item.sources) }));
        setExploreResults(sorted);
        setExploreState(null);
      },
      "Explorează",
    );
  };

  // Toate analizele care aparțin unui oraș (toate serviciile) — pentru „șterge orașul".
  const analysesForCity = (cityName: string) => {
    const cityNorm = normalizeText(cityName);
    return annotated
      .filter(item => normalizeText(item.city) === cityNorm)
      .map(item => ({ keyword: item.analysis.keyword, provider: item.analysis.provider }));
  };
  const removeCityFromPlan = (cityName: string) =>
    setPlanCities(current => current.filter(item => normalizeText(item) !== normalizeText(cityName)));
  // Șterge un rând-oraș din raport: analizele lui (dacă are) + îl scoate din plan.
  const removeCityRow = (cityName: string) => {
    const cityGroups = analysesForCity(cityName);
    if (cityGroups.length === 0) { removeCityFromPlan(cityName); return; }
    onDeleteAnalyses(
      cityGroups,
      `Șterg orașul ${cityName} din raport, inclusiv cele ${cityGroups.length} ${cityGroups.length === 1 ? "analiză" : "analize"} (toate scanările + articolele legate). Nu se poate anula.`,
      () => removeCityFromPlan(cityName),
    );
  };

  const detectedCities = React.useMemo(
    () => Array.from(new Set(annotated.map(item => item.city).filter(Boolean)))
      .sort((a, b) => cityRank(a) - cityRank(b) || a.localeCompare(b, "ro")),
    [annotated],
  );
  const syncCities = () => setPlanCities(detectedCities);

  const jobForCombo = (serviceId: string, cityName: string): ScanJob | null => {
    const cell = cellFor(serviceId, cityName);
    if (cell.analysis) {
      return { key: comboKey(serviceId, cityName), label: cell.analysis.keyword, keyword: cell.analysis.keyword, city: cell.analysis.city, provider: bulkProvider };
    }
    const term = serviceQuery(serviceId, columns);
    if (!term) return null;
    const scanKeyword = `${term} ${cityName}`;
    return { key: comboKey(serviceId, cityName), label: scanKeyword, keyword: scanKeyword, city: cityName, provider: bulkProvider };
  };
  const visibleCombos = (): [string, string][] =>
    cityList
      .flatMap(cityName => serviceCols.map(col => [col.id, cityName] as [string, string]))
      .filter(([serviceId, cityName]) => matchesStatus(cellFor(serviceId, cityName).status));
  const setSelectionFrom = (pairs: [string, string][]) =>
    setSelected(new Set(pairs.map(([serviceId, cityName]) => comboKey(serviceId, cityName))));
  const selectedJobs = (): ScanJob[] =>
    Array.from(selected)
      .map(key => { const idx = key.indexOf("|"); return jobForCombo(key.slice(0, idx), key.slice(idx + 1)); })
      .filter((job): job is ScanJob => job !== null);
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };
  const runSelected = () => {
    const jobs = selectedJobs();
    onRunManyScans(jobs, bulkProvider);
    exitSelectMode();
  };
  const toggleCityRow = (cityName: string) => {
    const keys = serviceCols.map(col => comboKey(col.id, cityName));
    setSelected(prev => {
      const next = new Set(prev);
      const allOn = keys.every(key => next.has(key));
      keys.forEach(key => (allOn ? next.delete(key) : next.add(key)));
      return next;
    });
  };

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-amber-200/70">Acoperire SEO</p>
          <h2 className="mt-2 text-2xl font-light">Unde apărem și unde nu</h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Fiecare serviciu × oraș, cu poziția din top 10. Verde = top 3, galben = 4–10,
            roșu = am scanat dar nu apărem, punctat = încă nescanat. Click pe o celulă scanată =
            deschide analiza (fără credit); pe una nescanată = scanează pe loc. Pentru mai multe
            odată, folosește „Selectează pentru scanare".
          </p>
        </div>
        <div className="inline-flex shrink-0 rounded-xl border border-white/10 p-1 text-xs">
          <button type="button" onClick={() => setView("grid")} className={`rounded-lg px-3 py-1.5 ${view === "grid" ? "bg-white text-black" : "text-gray-300"}`}>Grilă</button>
          <button type="button" onClick={() => setView("list")} className={`rounded-lg px-3 py-1.5 ${view === "list" ? "bg-white text-black" : "text-gray-300"}`}>Listă</button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {([
          ["Combinații", summary.total, "text-white"],
          ["Poziția 1", summary.pos1, "text-emerald-200"],
          ["Top 3", summary.top3, "text-emerald-300"],
          ["Top 4–10", summary.top10, "text-amber-200"],
          ["Absent", summary.absent, "text-red-300"],
          ["Nescanat", summary.unscanned, "text-gray-400"],
        ] as [string, number, string][]).map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
            <p className={`mt-1 text-xl font-light ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Filtrează orașe…"
          className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
        />
        <select value={serviceFilter} onChange={event => setServiceFilter(event.target.value)} className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white">
          <option value="all">Toate coloanele</option>
          {columns.map(service => <option key={service.id} value={service.id}>{service.label}</option>)}
          {hasOtherService && <option value={OTHER_SERVICE_ID}>Alt serviciu</option>}
        </select>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white">
          <option value="all">Orice status</option>
          <option value="pos1">Poziția 1</option>
          <option value="top3">Top 3</option>
          <option value="top10">Top 4–10</option>
          <option value="absent">Absent</option>
          <option value="unscanned">Nescanat</option>
          <option value="gaps">Doar golurile</option>
        </select>
        <select value={providerFilter} onChange={event => setProviderFilter(event.target.value as "all" | "serpapi" | "dataforseo")} className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white">
          <option value="all">Toate sursele</option>
          <option value="serpapi">SerpApi</option>
          <option value="dataforseo">DataForSEO</option>
        </select>
        <button type="button" onClick={() => { setShowCities(value => !value); setShowColumns(false); }} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300">
          Orașe în plan ({planCities.length}) {showCities ? "▲" : "▼"}
        </button>
        <button type="button" onClick={() => { setShowColumns(value => !value); setShowCities(false); }} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300">
          Coloane ({columns.length}) {showColumns ? "▲" : "▼"}
        </button>
        <button
          type="button"
          onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          disabled={disabled}
          className={`rounded-xl border px-3 py-2 text-sm ${selectMode ? "border-amber-200 bg-amber-200/10 text-amber-200" : "border-white/10 text-gray-300"} disabled:opacity-50`}
        >
          {selectMode ? "Renunță la selecție" : "Selectează pentru scanare"}
        </button>
      </div>

      {selectMode && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200/30 bg-amber-200/5 p-3 text-sm">
          <span className="font-medium text-amber-100">{selected.size} selectate</span>
          <span className="text-gray-500">·</span>
          <button type="button" onClick={() => setSelectionFrom(visibleCombos())} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-300">Tot ce se vede</button>
          <button type="button" onClick={() => setSelectionFrom(visibleCombos().filter(([s, c]) => cellFor(s, c).status !== "unscanned"))} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-300">Doar scanate</button>
          <button type="button" onClick={() => setSelectionFrom(visibleCombos().filter(([s, c]) => cellFor(s, c).status === "unscanned"))} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-300">Doar nescanate</button>
          <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-300">Golește</button>
          <button
            type="button"
            onClick={() => {
              const groups = Array.from(selected)
                .map(key => { const idx = key.indexOf("|"); return cellFor(key.slice(0, idx), key.slice(idx + 1)).analysis; })
                .filter((analysis): analysis is Analysis => analysis !== null)
                .map(analysis => ({ keyword: analysis.keyword, provider: analysis.provider }));
              // Orașe cu toate coloanele bifate → se scot din plan (chiar dacă n-au analize).
              const fullCities = cityList.filter(city => serviceCols.every(col => selected.has(comboKey(col.id, city))));
              const removeFull = () => setPlanCities(current => current.filter(city => !fullCities.some(full => normalizeText(full) === normalizeText(city))));
              if (groups.length === 0) { removeFull(); exitSelectMode(); return; }
              onDeleteAnalyses(
                groups,
                `Șterg definitiv ${groups.length} ${groups.length === 1 ? "analiză" : "analize"} (toate scanările + articolele legate)${fullCities.length ? ` și scot din plan ${fullCities.length} ${fullCities.length === 1 ? "oraș" : "orașe"}` : ""}. Nu se poate anula.`,
                () => { removeFull(); exitSelectMode(); },
              );
            }}
            className="rounded-lg border border-red-400/50 px-2.5 py-1 text-xs text-red-300"
          >
            Șterge selectatele
          </button>
          <span className="ml-auto flex items-center gap-2">
            <select value={bulkProvider} onChange={event => setBulkProvider(event.target.value as "serpapi" | "dataforseo")} className="rounded-lg border border-white/10 bg-black px-2.5 py-1 text-xs text-white">
              <option value="serpapi">SerpApi</option>
              <option value="dataforseo">DataForSEO</option>
            </select>
            <button
              type="button"
              onClick={runSelected}
              disabled={disabled || selectedJobs().length === 0}
              className="rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
            >
              Scanează {selectedJobs().length} →
            </button>
          </span>
        </div>
      )}

      {showCities && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex flex-wrap gap-2">
            {planCities.length === 0 && <span className="text-xs text-gray-500">Niciun oraș în plan. Adaugă mai jos.</span>}
            {planCities.map(cityName => {
              const cityGroups = analysesForCity(cityName);
              return (
                <span key={cityName} className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-gray-200">
                  {cityName}
                  {cityGroups.length > 0 && <span className="text-gray-500">({cityGroups.length})</span>}
                  <button type="button" onClick={() => removeCityRow(cityName)} className="text-gray-500 hover:text-red-300">
                    ×
                  </button>
                </span>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              list="seo-coverage-cities"
              value={newCity}
              onChange={event => setNewCity(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCity(); } }}
              placeholder="Adaugă oraș din Ardeal"
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
            />
            <datalist id="seo-coverage-cities">
              {ARDEAL_CITIES.map(cityData => <option key={`${cityData.county}-${cityData.name}`} value={cityData.name} />)}
            </datalist>
            <button type="button" onClick={addCity} className="rounded-xl border border-amber-200/50 px-4 py-2 text-sm text-amber-200">Adaugă</button>
          </div>
          {detectedCities.length > 0 && (
            <button
              type="button"
              onClick={syncCities}
              className="mt-3 text-xs text-gray-400 underline decoration-dotted hover:text-amber-200"
            >
              Sincronizează cu orașele din analize ({detectedCities.join(", ")})
            </button>
          )}
        </div>
      )}

      {showColumns && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="mb-3 text-xs text-gray-500">
            Pentru fiecare coloană poți cere alternative de la Trends + DataForSEO — un click le
            adaugă ca și coloană nouă. Sau adaugă manual mai jos, ex. „fotograf nunta" → scanează
            „fotograf nunta {"{oraș}"}".
          </p>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-300/30 bg-violet-300/5 p-3">
            <div>
              <p className="text-sm text-violet-100">Explorare completă</p>
              <p className="text-xs text-gray-500">
                Rulează „Sugerează alternative" pe toate coloanele deodată și combină rezultatele
                într-un singur tabel.
              </p>
            </div>
            <button
              type="button"
              onClick={runFullExplore}
              disabled={exploreState !== null}
              className="shrink-0 rounded-xl border border-violet-300/50 px-4 py-2 text-xs font-medium text-violet-200 disabled:opacity-60"
            >
              {exploreState ? `Explorez „${exploreState.current}"… (${exploreState.done}/${exploreState.total})` : "Explorează tot"}
            </button>
          </div>

          {exploreResults && (
            <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-wider text-gray-500">{exploreResults.length} sugestii combinate</p>
                <button type="button" onClick={() => setExploreResults(null)} className="text-xs text-gray-500 hover:text-white">Ascunde</button>
              </div>
              {exploreResults.length === 0 ? (
                <p className="text-xs text-gray-400">Fără sugestii — încearcă din nou mai târziu.</p>
              ) : (
                <ul className="max-h-96 space-y-1.5 overflow-y-auto">
                  {exploreResults.map(item => {
                    const norm = normalizeText(item.keyword);
                    const added = existingQueries.has(norm);
                    return (
                      <li key={item.keyword} className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 flex-1 truncate text-gray-200" title={`din: ${item.sources.join(", ")}`}>{item.keyword}</span>
                        <span className="hidden shrink-0 truncate text-[10px] text-gray-600 sm:block sm:max-w-[140px]" title={item.sources.join(", ")}>{item.sources.join(", ")}</span>
                        <span className="shrink-0 text-gray-500">{suggestionMetric(item)}</span>
                        <button
                          type="button"
                          disabled={added}
                          onClick={() => addColumn(item.keyword)}
                          className="shrink-0 rounded-lg border border-amber-200/40 px-2 py-0.5 text-amber-200 disabled:border-white/10 disabled:text-gray-600"
                        >
                          {added ? "adăugat" : "+ coloană"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-2">
            {SEO_RADAR_SERVICES.map(service => (
              <div key={service.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2.5">
                <span className="min-w-[9rem] text-sm text-gray-200">{service.label}</span>
                <KeywordSuggestionsPanel
                  baseKeyword={service.query}
                  baseLabel={service.label}
                  existingQueries={existingQueries}
                  onDiscover={onDiscoverKeywords}
                  onAdd={addColumn}
                  requestConfirm={requestConfirm}
                />
              </div>
            ))}
            {customColumns.map(column => (
              <div key={column.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200/20 bg-amber-200/5 p-2.5">
                <span className="min-w-[9rem] text-sm text-amber-100">{column.label}</span>
                <KeywordSuggestionsPanel
                  baseKeyword={column.query}
                  baseLabel={column.label}
                  existingQueries={existingQueries}
                  onDiscover={onDiscoverKeywords}
                  onAdd={addColumn}
                  requestConfirm={requestConfirm}
                />
                <button type="button" onClick={() => removeColumn(column.id)} className="ml-auto text-amber-200/60 hover:text-red-300">Șterge coloana ×</button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newColumn}
              onChange={event => setNewColumn(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addColumn(); } }}
              placeholder="ex: fotograf nunta"
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
            />
            <button type="button" onClick={() => addColumn()} className="rounded-xl border border-amber-200/50 px-4 py-2 text-sm text-amber-200">Adaugă coloană</button>
          </div>
        </div>
      )}

      {(activeScanKey || queuedKeys.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200/30 bg-amber-200/5 px-3 py-2 text-xs">
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-amber-200 border-t-transparent" />
          <span className="text-amber-100">
            Scanez „{activeScanLabel}"{queueBehind > 0 ? ` · ${queueBehind} în coadă` : ""}
          </span>
          <button type="button" onClick={onStopQueue} className="ml-auto rounded-lg border border-white/10 px-2.5 py-1 text-gray-300">
            Oprește coada
          </button>
        </div>
      )}
      {erroredKeys.length > 0 && (
        <div className="mt-3 space-y-1">
          {erroredKeys.map(key => {
            const idx = key.indexOf("|");
            const sid = key.slice(0, idx);
            const cityName = key.slice(idx + 1);
            return (
              <div key={key} className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-1.5 text-xs text-red-300">
                <span className="min-w-0 flex-1 truncate">
                  {serviceLabel(sid === OTHER_SERVICE_ID ? null : sid)} · {cityName}: {scanResults[key].message}
                </span>
                <button type="button" onClick={() => { onClearScanResult(key); onScanOne(sid, cityName); }} className="shrink-0 rounded border border-red-400/40 px-2 py-0.5">Reîncearcă</button>
                <button type="button" onClick={() => onClearScanResult(key)} className="shrink-0 text-red-300/70 hover:text-red-200">×</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5">
        {loading && analyses.length === 0 ? (
          <p className="text-sm text-gray-500">Se încarcă analizele…</p>
        ) : analyses.length === 0 ? (
          <p className="text-sm text-gray-500">Nu există analize încă. Caută prima combinație mai sus.</p>
        ) : cityList.length === 0 ? (
          <p className="text-sm text-gray-500">Niciun oraș în plan. Deschide „Orașe în plan" și adaugă câteva.</p>
        ) : view === "grid" ? (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-neutral-950 px-2 py-2 text-left text-xs uppercase tracking-wider text-gray-500">Oraș</th>
                  {serviceCols.map(col => (
                    <th key={col.id} className="px-2 py-2 text-center text-xs font-medium text-gray-400">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cityList.map(cityName => {
                  const rowCells = serviceCols.map(col => cellFor(col.id, cityName));
                  if (statusFilter !== "all" && !rowCells.some(cell => matchesStatus(cell.status))) return null;
                  const rowKeys = serviceCols.map(col => comboKey(col.id, cityName));
                  const rowAllSelected = rowKeys.every(key => selected.has(key));
                  const expandedCell = expandedCombo && rowKeys.includes(expandedCombo)
                    ? rowCells.find(cell => comboKey(cell.serviceId, cityName) === expandedCombo && cell.analysis)
                    : undefined;
                  return (
                    <React.Fragment key={cityName}>
                    <tr>
                      <td className="group sticky left-0 z-10 bg-neutral-950 px-2 py-1.5 text-xs font-medium text-gray-200">
                        <span className="flex items-center gap-2">
                          {selectMode && (
                            <input type="checkbox" checked={rowAllSelected} onChange={() => toggleCityRow(cityName)} className="accent-amber-300" />
                          )}
                          {cityName}
                          <button
                            type="button"
                            onClick={() => removeCityRow(cityName)}
                            disabled={disabled}
                            title={`Șterge ${cityName} din raport`}
                            className="ml-auto text-gray-600 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100 disabled:opacity-0"
                          >
                            ×
                          </button>
                        </span>
                      </td>
                      {rowCells.map((cell, index) => {
                        const dim = !matchesStatus(cell.status);
                        const key = comboKey(cell.serviceId, cityName);
                        const isSelected = selected.has(key);
                        const isScanning = key === activeScanKey;
                        const isQueued = queuedKeySet.has(key) && !isScanning;
                        const outcome = scanResults[key];
                        const isExpanded = expandedCombo === key;
                        const delta = cell.analysis ? historyDelta(cell.analysis.positionHistory) : null;
                        return (
                          <td key={serviceCols[index].id} className="p-0 text-center">
                            <button
                              type="button"
                              disabled={disabled || isScanning || isQueued}
                              title={`${cell.serviceLabel} · ${cityName} — ${outcome?.error ? outcome.message : statusText(cell.status)}${cell.articleCount ? ` · articol ${cell.articleRanked ? "în top" : "în lucru"}` : ""}`}
                              onClick={() => {
                                if (selectMode) { toggleCombo(cell.serviceId, cityName); return; }
                                if (cell.analysis) setExpandedCombo(current => (current === key ? null : key));
                                else onScanOne(cell.serviceId, cityName);
                              }}
                              className={`relative m-auto flex h-9 w-full min-w-16 items-center justify-center rounded-lg border text-xs ${cellChipClass(cell.status)} ${dim && !selectMode ? "opacity-25" : ""} ${isSelected || isExpanded ? "ring-2 ring-amber-300" : ""} ${outcome?.error ? "ring-2 ring-red-400/60" : ""} ${isQueued ? "opacity-60" : ""} disabled:cursor-not-allowed`}
                            >
                              {isScanning ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : isQueued ? (
                                "…"
                              ) : outcome?.error ? (
                                "!"
                              ) : (
                                <span className="flex items-baseline gap-0.5">
                                  {cellLabel(cell)}
                                  {delta && delta.dir !== "flat" && (
                                    <span className={`text-[9px] ${delta.dir === "down" ? "text-red-300" : "text-emerald-300"}`}>
                                      {delta.dir === "new" ? "nou" : delta.dir === "up" ? `↑${delta.amount}` : `↓${delta.amount}`}
                                    </span>
                                  )}
                                </span>
                              )}
                              {selectMode && isSelected && (
                                <span className="absolute left-1 top-1 text-[10px] text-amber-300">✓</span>
                              )}
                              {cell.articleCount > 0 && !isScanning && (
                                <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${cell.articleRanked ? "bg-emerald-300" : "bg-amber-200"}`} />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                    {expandedCell?.analysis && (
                      <tr>
                        <td colSpan={serviceCols.length + 1} className="bg-black/20 px-3 py-4">
                          <CoverageDetailPanel
                            cell={expandedCell}
                            disabled={disabled}
                            onView={onView}
                            onRescan={onRescan}
                            onCreateArticle={onCreateArticle}
                            onClose={() => setExpandedCombo(null)}
                            serviceQueryValue={serviceQuery(expandedCell.serviceId, columns)}
                            onDiscoverKeywords={onDiscoverKeywords}
                            onAddColumn={addColumn}
                            existingQueries={existingQueries}
                            onDiscoverAdsInsight={onDiscoverAdsInsight}
                            onDiscoverAdsBudget={onDiscoverAdsBudget}
                            requestConfirm={requestConfirm}
                          />
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-500">
              {selectMode
                ? "Bifează celulele, alege sursa și apasă butonul de scanare. Scanările rulează una după alta."
                : "Punct verde = articol legat în top · punct galben = articol în lucru. Semnul plus = nescanat (click → scanează pe loc)."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {cityList.map(cityName => {
              const rowCells = serviceCols.map(col => cellFor(col.id, cityName)).filter(cell => matchesStatus(cell.status));
              if (rowCells.length === 0) return null;
              return (
                <div key={cityName}>
                  <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-200/70">
                    {cityName}
                    <button type="button" onClick={() => removeCityRow(cityName)} disabled={disabled} title={`Șterge ${cityName} din raport`} className="text-gray-600 hover:text-red-300 disabled:opacity-40">×</button>
                  </p>
                  <div className="space-y-2">
                    {rowCells.map(cell => {
                      const key = comboKey(cell.serviceId, cell.city);
                      return (
                        <CoverageListRow
                          key={cell.serviceId}
                          cell={cell}
                          disabled={disabled}
                          selectMode={selectMode}
                          selected={selected.has(key)}
                          scanning={key === activeScanKey}
                          queued={queuedKeySet.has(key) && key !== activeScanKey}
                          outcome={scanResults[key]}
                          onToggleSelect={() => toggleCombo(cell.serviceId, cell.city)}
                          onView={onView}
                          onRescan={onRescan}
                          onScanOne={onScanOne}
                          onCreateArticle={onCreateArticle}
                          onDelete={cell.analysis
                            ? () => onDeleteAnalyses(
                                [{ keyword: cell.analysis!.keyword, provider: cell.analysis!.provider }],
                                `Șterg definitiv analiza „${cell.analysis!.keyword}" (${cell.analysis!.scanCount} ${cell.analysis!.scanCount === 1 ? "captură" : "capturi"} + articolele legate). Nu se poate anula.`,
                              )
                            : undefined}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

const CoverageListRow = ({
  cell,
  disabled,
  selectMode,
  selected,
  scanning,
  queued,
  outcome,
  onToggleSelect,
  onView,
  onRescan,
  onScanOne,
  onCreateArticle,
  onDelete,
}: {
  cell: CoverageCell;
  disabled: boolean;
  selectMode: boolean;
  selected: boolean;
  scanning: boolean;
  queued: boolean;
  outcome?: ScanOutcome;
  onToggleSelect: () => void;
  onView: (analysis: Analysis) => void;
  onRescan: (analysis: Analysis) => void;
  onScanOne: (serviceId: string, city: string) => void;
  onCreateArticle: (analysis: Analysis) => void;
  onDelete?: () => void;
}) => {
  const analysis = cell.analysis;
  const [showHistory, setShowHistory] = useState(false);
  const checkbox = selectMode ? (
    <input type="checkbox" checked={selected} onChange={onToggleSelect} className="mr-2 accent-amber-300" />
  ) : null;
  const scanBadge = scanning ? (
    <span className="flex items-center gap-1.5 text-xs text-amber-200">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-200 border-t-transparent" /> se scanează…
    </span>
  ) : queued ? (
    <span className="text-xs text-gray-500">în coadă…</span>
  ) : outcome?.error ? (
    <span className="text-xs text-red-300" title={outcome.message}>eroare la scanare</span>
  ) : null;
  if (!analysis) {
    return (
      <div className={`flex items-center justify-between gap-3 rounded-2xl border border-dashed bg-black/20 p-4 ${selected ? "border-amber-300" : outcome?.error ? "border-red-400/40" : "border-white/15"}`}>
        <span className="flex items-center text-sm text-gray-400">{checkbox}{cell.serviceLabel} · <span className="ml-1 text-gray-600">nescanat</span></span>
        {scanBadge || (
          <button type="button" onClick={() => onScanOne(cell.serviceId, cell.city)} disabled={disabled} className="rounded-xl border border-amber-200/50 px-4 py-2 text-xs font-medium text-amber-200 disabled:opacity-50">
            Scanează
          </button>
        )}
      </div>
    );
  }
  const trend = analysis.positionTrend;
  return (
    <div className={`rounded-2xl border bg-black/30 p-4 ${selected ? "border-amber-300" : "border-white/10"}`}>
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start">
        {checkbox}
        <div className="min-w-0">
        <p className="text-sm font-medium text-white">
          {cell.serviceLabel}
          <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-400">
            {analysis.provider === "dataforseo" ? "DataForSEO" : "SerpApi"}
          </span>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {analysis.keyword} · ultima scanare {new Date(analysis.lastScanAt).toLocaleDateString("ro-RO")} · {analysis.scanCount} {analysis.scanCount === 1 ? "captură" : "capturi"}
        </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full border px-3 py-1 text-xs ${cellChipClass(cell.status)}`}>
          {cell.status === "absent" ? "Nu apărem în top 10" : `Poziția #${analysis.latestPosition}`}
        </span>
        {analysis.scanCount > 1 && trend !== null && trend !== 0 && (
          <span className={`text-xs ${trend > 0 ? "text-emerald-300" : "text-red-300"}`}>
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend)} față de prima captură
          </span>
        )}
        {cell.articleCount > 0 && (
          <span className={`rounded-full border px-3 py-1 text-xs ${cell.articleRanked ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-300" : "border-amber-200/40 bg-amber-200/10 text-amber-200"}`}>
            {cell.articleRanked ? "Articol în top 10" : `Articol în lucru (${cell.articleCount})`}
          </span>
        )}
        {scanBadge}
        <button type="button" onClick={() => setShowHistory(value => !value)} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-gray-300">
          Istoric {showHistory ? "▲" : "▾"}
        </button>
        <button type="button" onClick={() => onView(analysis)} disabled={disabled} className="rounded-xl bg-white px-4 py-2 text-xs font-medium text-black disabled:opacity-50">Deschide</button>
        <button type="button" onClick={() => onRescan(analysis)} disabled={disabled || scanning || queued} className="rounded-xl border border-amber-200/50 px-4 py-2 text-xs font-medium text-amber-200 disabled:opacity-50">Rescanează</button>
        {cell.status === "absent" && cell.articleCount === 0 && (
          <button type="button" onClick={() => onCreateArticle(analysis)} disabled={disabled} className="rounded-xl border border-emerald-300/50 px-4 py-2 text-xs font-medium text-emerald-200 disabled:opacity-50">Creează articol</button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} disabled={disabled} className="rounded-xl border border-red-400/40 px-4 py-2 text-xs font-medium text-red-300 disabled:opacity-50">Șterge</button>
        )}
      </div>
    </div>
    {showHistory && (
      <div className="mt-4 border-t border-white/10 pt-4">
        <PositionTimeline history={analysis.positionHistory} />
        {analysis.positionHistory.length >= 2 && <PositionHistoryTable history={analysis.positionHistory} />}
      </div>
    )}
    </div>
  );
};

export default SeoRadarPage;
