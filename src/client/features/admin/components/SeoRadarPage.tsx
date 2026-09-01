import React, { useEffect, useRef, useState } from "react";
import useAuth from "../auth/useAuth";
import { CITIES } from "../../../pages/LocationSEO/locationData";

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
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SEO_RADAR_DRAFT_KEY) || "null") as {
        result?: SearchResult | null;
        postVariants?: PostVariant[];
        selectedVariant?: number;
      } | null;
      if (saved?.result) setResult(saved.result);
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

  const search = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/seo-radar/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ keyword, city, provider }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Căutarea a eșuat.");
      setResult(data);
      setPostVariants([]);
      localStorage.removeItem(SEO_RADAR_DRAFT_KEY);
      setAnalysisError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Căutarea a eșuat.");
    } finally {
      setLoading(false);
    }
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
        body: JSON.stringify({ keyword: result.keyword, city: result.city, source: result.source, organicResults: result.organicResults, variantIndex: index }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generarea variantei a eșuat.");
      setPostVariants(current => current.map((item, itemIndex) => itemIndex === index ? data.variants[0] : item));
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
      setAnalysisError("Articolul a fost publicat cu succes.");
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
        <DiacriticsCorrector token={auth.accessToken} />
        {error && <p className="mt-5 text-red-300">{error}</p>}
        {result && (
          <>
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
                    {[...result.history].reverse().map(item => (
                      <tr key={item.id}>
                        <td className="px-3 py-3 text-gray-300">{new Date(item.capturedAt).toLocaleString("ro-RO")}</td>
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
                    ))}
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
                    className={`block px-6 py-5 hover:bg-white/5 ${item.domain.includes("ancavisuals.ro") ? "text-emerald-300" : ""}`}
                  >
                    <div className="flex gap-4">
                      <strong className="w-8 text-amber-200">{item.position}</strong>
                      <div>
                        <h3 className="font-medium">{item.title}</h3>
                        <p className="mt-1 text-xs text-gray-400">{item.domain}</p>
                        <p className="mt-2 text-sm leading-6 text-gray-300">{item.snippet}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
            <section className="mt-8 rounded-3xl border border-amber-200/20 bg-amber-200/5 p-6">
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
  const population2021: Record<string, number> = {
    "Cluj-Napoca": 286598,
    Brașov: 237589,
    Oradea: 183105,
    Arad: 145078,
    Sibiu: 134308,
    "Târgu Mureș": 116033,
    "Baia Mare": 108759,
    "Satu Mare": 91056,
    Bistrița: 78877,
    "Alba Iulia": 64359,
    Turda: 55401,
    Deva: 53011,
    Zalău: 52238,
    Hunedoara: 50457,
    "Sfântu Gheorghe": 50080,
    "Câmpia Turzii": 20895,
    Mediaș: 39780,
    Reghin: 29115,
    Aiud: 21822,
    Sebeș: 27019,
    Luduș: 15000,
    Sighișoara: 23087,
    Cugir: 21762,
    Gherla: 20765,
    Blaj: 17800,
    Avrig: 12624,
    Făgăraș: 30488,
    Predeal: 4186,
    Sovata: 11000,
  };
  const ardealCities = CITIES.filter(cityData =>
    new Set([
      "Alba",
      "Arad",
      "Bihor",
      "Bistrița-Năsăud",
      "Brașov",
      "Cluj",
      "Covasna",
      "Harghita",
      "Hunedoara",
      "Maramureș",
      "Mureș",
      "Sălaj",
      "Satu Mare",
      "Sibiu",
    ]).has(cityData.county),
  )
    .map(cityData => ({ ...cityData, population: population2021[cityData.name] ?? 0 }))
    .sort((a, b) => b.population - a.population || a.name.localeCompare(b.name, "ro"));
  const build = () => {
    const values = parts.map(value => value.trim()).filter(Boolean);
    if (!values.length) {
      setError("Completează cel puțin unul dintre cele 4 câmpuri.");
      return;
    }
    setError("");
    setKeyword(values.join(" "));
    if (parts[3].trim()) setCity(parts[3].trim());
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
            onChange={event => setKeyword(event.target.value)}
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
          onClick={search}
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
                onClick={() => setKeyword(suggestion)}
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
export default SeoRadarPage;
