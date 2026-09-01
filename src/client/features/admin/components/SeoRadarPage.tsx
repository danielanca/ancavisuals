import React, { useEffect, useState } from "react";
import useAuth from "../auth/useAuth";

interface Result { position: number; title: string; url: string; domain: string; snippet: string; }
interface HistoryItem { id: string; capturedAt: string; ownDomainPosition: number | null; ownDomainUrl: string | null; positionChange: number | null; localPack: boolean; }
interface SearchResult { keyword: string; city: string; capturedAt: string; source: "serpapi" | "dataforseo"; organicResults: Result[]; ads: Result[]; localPack: boolean; ownDomainPosition: number | null; ownDomainUrl: string | null; previousPosition: number | null; positionChange: number | null; history: HistoryItem[]; }
interface ProviderStats { provider: "serpapi" | "dataforseo"; planName?: string | null; searchesLeft?: number | null; searchesUsed?: number | null; searchesLimit?: number | null; thisMonthUsage?: number | null; balance?: number | null; capturedAt: string; }
interface PostVariant { title: string; slug: string; canonicalUrl: string; metaDescription: string; seoTitle: string; tags: string[]; category: string; angle: string; bodyHtml: string; faq: { question: string; answer: string }[]; internalLinks: string[]; priority: string; }

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
  const [analysisError, setAnalysisError] = useState("");
  const [postVariants, setPostVariants] = useState<PostVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState(0);

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
    setLoading(true); setError("");
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
      setAnalysisError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Căutarea a eșuat."); }
    finally { setLoading(false); }
  };

  const analyze = async () => {
    if (!result) return;
    setAnalysisLoading(true); setAnalysisError("");
    try {
      const response = await fetch("/api/admin/seo-radar/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ keyword: result.keyword, city: result.city, source: result.source, organicResults: result.organicResults }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analiza AI a eșuat.");
      setPostVariants(data.variants);
      setSelectedVariant(0);
    } catch (err) { setAnalysisError(err instanceof Error ? err.message : "Analiza AI a eșuat."); }
    finally { setAnalysisLoading(false); }
  };

  return <div className="min-h-screen bg-black px-6 py-10 text-white md:px-10">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">AncaVisuals · SEO Radar</p>
          <h1 className="mt-4 text-4xl font-light md:text-6xl">Caută și analizează SERP</h1>
        </div>
        <div className="min-w-[280px] rounded-2xl border border-amber-200/20 bg-amber-200/10 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">{provider === "dataforseo" ? "DataForSEO · sold" : "SerpApi · credite"}</p>
          {stats ? <div className="mt-2 flex items-end justify-between gap-5"><strong className="text-3xl font-light">{provider === "dataforseo" ? (stats.balance === null || stats.balance === undefined ? "—" : stats.balance.toFixed(2)) : stats.searchesLeft ?? "—"}</strong><span className="pb-1 text-right text-xs text-gray-300">{provider === "dataforseo" ? <>USD<br />disponibili</> : <>căutări<br />rămase</>}</span></div> : <p className="mt-3 text-sm text-gray-400">{statsError || "Se încarcă…"}</p>}
          {stats && provider === "serpapi" && <p className="mt-2 text-xs text-gray-400">{stats.planName || "Plan SerpApi"} · folosite: {stats.searchesUsed ?? stats.thisMonthUsage ?? "—"}{stats.searchesLimit !== null ? ` / ${stats.searchesLimit}` : ""}</p>}
        </div>
      </div>
      <div className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 md:grid-cols-[1fr_220px_180px_auto]">
        <label className="text-sm text-gray-300">Keyword<input value={keyword} onChange={e => setKeyword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white" /></label>
        <label className="text-sm text-gray-300">Locație<input value={city} onChange={e => setCity(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white" /></label>
        <label className="text-sm text-gray-300">Sursă<select value={provider} onChange={e => setProvider(e.target.value as "serpapi" | "dataforseo")} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white"><option value="serpapi">SerpApi</option><option value="dataforseo">DataForSEO</option></select></label>
        <button onClick={search} disabled={loading} className="self-end rounded-xl bg-white px-6 py-3 font-medium text-black disabled:opacity-50">{loading ? "Caut…" : "Capturează"}</button>
      </div>
      {error && <p className="mt-5 text-red-300">{error}</p>}
      {result && <>
        <p className="mt-6 text-xs uppercase tracking-[0.2em] text-gray-500">Rezultate prin {result.source === "dataforseo" ? "DataForSEO" : "SerpApi"}</p>
        <div className="mt-8 grid gap-3 md:grid-cols-4"><Metric value={result.ownDomainPosition ? `#${result.ownDomainPosition}` : "—"} label="Poziție AncaVisuals" /><Metric value={result.positionChange === null ? "—" : result.positionChange > 0 ? `↑ ${result.positionChange}` : result.positionChange < 0 ? `↓ ${Math.abs(result.positionChange)}` : "= 0"} label="Față de ultima căutare" /><Metric value={result.localPack ? "Da" : "Nu"} label="Local Pack" /><Metric value={String(result.history.length)} label="Capturi salvate" /></div>
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"><p className="text-xs uppercase tracking-[0.25em] text-amber-200/70">Istoric · {result.keyword}{result.city ? ` · ${result.city}` : ""}</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-gray-500"><tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Poziție</th><th className="px-3 py-3">Evoluție</th><th className="px-3 py-3">Local Pack</th></tr></thead><tbody className="divide-y divide-white/10">{[...result.history].reverse().map(item => <tr key={item.id}><td className="px-3 py-3 text-gray-300">{new Date(item.capturedAt).toLocaleString("ro-RO")}</td><td className="px-3 py-3 font-medium text-amber-200">{item.ownDomainPosition ? `#${item.ownDomainPosition}` : "Nu apare în top 10"}</td><td className={`px-3 py-3 ${item.positionChange === null ? "text-gray-500" : item.positionChange > 0 ? "text-emerald-300" : item.positionChange < 0 ? "text-red-300" : "text-gray-400"}`}>{item.positionChange === null ? "Prima captură" : item.positionChange > 0 ? `↑ ${item.positionChange}` : item.positionChange < 0 ? `↓ ${Math.abs(item.positionChange)}` : "Fără schimbare"}</td><td className="px-3 py-3 text-gray-400">{item.localPack ? "Da" : "Nu"}</td></tr>)}</tbody></table></div></section>
        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5"><div className="border-b border-white/10 px-6 py-5"><p className="text-xs uppercase tracking-[0.25em] text-amber-200/70">Rezultate organice</p><h2 className="mt-2 text-2xl font-light">Top 10 · {result.keyword}</h2></div><div className="divide-y divide-white/10">{result.organicResults.map(item => <a key={`${item.position}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" className={`block px-6 py-5 hover:bg-white/5 ${item.domain.includes("ancavisuals.ro") ? "text-emerald-300" : ""}`}><div className="flex gap-4"><strong className="w-8 text-amber-200">{item.position}</strong><div><h3 className="font-medium">{item.title}</h3><p className="mt-1 text-xs text-gray-400">{item.domain}</p><p className="mt-2 text-sm leading-6 text-gray-300">{item.snippet}</p></div></div></a>)}</div></section>
        <section className="mt-8 rounded-3xl border border-amber-200/20 bg-amber-200/5 p-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-xs uppercase tracking-[0.25em] text-amber-200/70">Creator postare SEO · Claude</p><h2 className="mt-2 text-2xl font-light">Creează postare SEO</h2><p className="mt-2 max-w-3xl text-sm text-gray-400">Generează 3 variante complete, apoi alege, editează și rafinează varianta potrivită.</p></div><button onClick={analyze} disabled={analysisLoading} className="shrink-0 rounded-xl bg-amber-200 px-5 py-3 font-medium text-black disabled:opacity-50">{analysisLoading ? "Generez…" : postVariants.length ? "Regenerează 3 variante" : "Creează postare SEO"}</button></div>{analysisError && <p className="mt-5 text-red-300">{analysisError}</p>}{postVariants.length > 0 && <div className="mt-7"><div className="flex flex-wrap gap-2">{postVariants.map((variant, index) => <button key={index} onClick={() => setSelectedVariant(index)} className={`rounded-xl px-4 py-2 text-sm ${selectedVariant === index ? "bg-amber-200 text-black" : "border border-white/10 text-gray-300"}`}>Varianta {index + 1}: {variant.title}</button>)}</div><PostVariantEditor variant={postVariants[selectedVariant]} token={auth.accessToken} onChange={updated => setPostVariants(current => current.map((item, index) => index === selectedVariant ? updated : item))} /></div>}</section>
      </>}
    </div>
  </div>;
};

const PostVariantEditor = ({ variant, token, onChange }: { variant: PostVariant; token: string; onChange: (variant: PostVariant) => void }) => {
  const [instruction, setInstruction] = useState("");
  const [bodyOptions, setBodyOptions] = useState<{ title: string; html: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [bodyError, setBodyError] = useState("");
  const inputClass = "mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white";
  const update = <K extends keyof PostVariant>(key: K, value: PostVariant[K]) => onChange({ ...variant, [key]: value });
  const format = (command: string) => document.execCommand(command, false);
  const generateBody = async () => {
    setGenerating(true); setBodyError("");
    try {
      const response = await fetch("/api/admin/seo-radar/generate-body", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ instruction, context: variant.title }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generarea a eșuat.");
      setBodyOptions(data.variants);
    } catch (error) { setBodyError(error instanceof Error ? error.message : "Generarea a eșuat."); }
    finally { setGenerating(false); }
  };
  return <div className="mt-6 space-y-5"><div className="grid gap-4 md:grid-cols-2"><label className="text-xs uppercase tracking-wider text-gray-500">Titlu SEO<input className={inputClass} value={variant.title} onChange={e => update("title", e.target.value)} /></label><label className="text-xs uppercase tracking-wider text-gray-500">SEO title<input className={inputClass} value={variant.seoTitle} onChange={e => update("seoTitle", e.target.value)} /></label><label className="text-xs uppercase tracking-wider text-gray-500">Slug<input className={inputClass} value={variant.slug} onChange={e => update("slug", e.target.value)} /></label><label className="text-xs uppercase tracking-wider text-gray-500">URL canonic<input className={inputClass} value={variant.canonicalUrl} onChange={e => update("canonicalUrl", e.target.value)} /></label><label className="text-xs uppercase tracking-wider text-gray-500 md:col-span-2">Meta description<textarea className={inputClass} rows={2} value={variant.metaDescription} onChange={e => update("metaDescription", e.target.value)} /></label><label className="text-xs uppercase tracking-wider text-gray-500">Tag-uri SEO<input className={inputClass} value={variant.tags.join(", ")} onChange={e => update("tags", e.target.value.split(",").map(item => item.trim()).filter(Boolean))} /></label><label className="text-xs uppercase tracking-wider text-gray-500">Categorie<input className={inputClass} value={variant.category} onChange={e => update("category", e.target.value)} /></label></div><div className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="flex flex-wrap gap-2 border-b border-white/10 pb-3"><button type="button" onClick={() => format("bold")} className="rounded-lg border border-white/10 px-3 py-1 font-bold">B</button><button type="button" onClick={() => format("italic")} className="rounded-lg border border-white/10 px-3 py-1 italic">I</button><button type="button" onClick={() => format("insertUnorderedList")} className="rounded-lg border border-white/10 px-3 py-1">• Listă</button><span className="ml-2 self-center text-xs text-gray-500">Body articol · editare vizuală</span></div><div contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: variant.bodyHtml }} onInput={event => update("bodyHtml", event.currentTarget.innerHTML)} className="blog-article mt-4 min-h-[360px] rounded-xl border border-white/10 bg-black p-4 text-sm leading-7 text-gray-200 outline-none focus:border-amber-200/50" /><div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs uppercase tracking-wider text-amber-200/70">Generează text cu AI</p><div className="mt-2 flex flex-col gap-2 md:flex-row"><textarea value={instruction} onChange={e => setInstruction(e.target.value)} rows={2} placeholder="Ex.: Vorbește despre serviciile de fotocabină în Gilău, prețul este X, oferim magneți…" className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white" /><button type="button" onClick={generateBody} disabled={generating || !instruction.trim()} className="rounded-xl bg-violet-300 px-4 py-2 text-sm font-medium text-black disabled:opacity-50">{generating ? "Generez…" : "Generează 3 variante"}</button></div>{bodyError && <p className="mt-2 text-sm text-red-300">{bodyError}</p>}{bodyOptions.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-3">{bodyOptions.map((option, index) => <div key={index} className="rounded-xl border border-white/10 p-3"><p className="text-xs text-gray-500">Varianta {index + 1} · {option.title}</p><div className="mt-2 text-sm text-gray-300" dangerouslySetInnerHTML={{ __html: option.html }} /><button type="button" onClick={() => { update("bodyHtml", `${variant.bodyHtml}<p>${option.html}</p>`); setBodyOptions([]); }} className="mt-3 rounded-lg border border-amber-200/30 px-3 py-1.5 text-xs text-amber-200">Inserează în body</button></div>)}</div>}</div></div><p className="text-xs text-gray-500">Unghi: {variant.angle} · Prioritate: {variant.priority} · Linkuri interne: {variant.internalLinks.join(", ")}</p></div>;
};

const Metric = ({ value, label }: { value: string; label: string }) => <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><strong className="block text-2xl font-light">{value}</strong><span className="text-xs text-gray-400">{label}</span></div>;
export default SeoRadarPage;
