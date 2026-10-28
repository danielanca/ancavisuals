/*
 * Purpose: /admin/seo-radar/pagina?keyword=…&city=… — opened from SEO Radar on a keyword where we
 * don't rank ("—"). Builds a "pagină specială" with AI, step by step: what Google shows today →
 * AI analysis (intent, competitors, outline, questions) → the owner's real facts → the page written
 * by AI, editable, with an SEO checklist → publish at /servicii/<slug> (sitemap + linked in SEO
 * Radar). Without a keyword it lists the pages made so far.
 * Server: /api/admin/seo-pages (seoLandingPages.routes.ts), shared: src/shared/seoLandingPages.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import {
  emptySeoPage, seoPageChecks, seoPagePath, seoPageScore,
  type SeoLandingPage, type SeoPagePlan,
} from "../../../../shared/seoLandingPages";

type SerpItem = { position: number; title: string; url: string; domain: string; snippet: string };
type Context = { keyword: string; city: string; capturedAt: string | null; ownPosition: number | null; results: SerpItem[]; pages: string[] };

const SITE = "https://ancavisuals.ro";
const card = "space-y-3 border border-neutral-800 bg-neutral-900 p-4";
const input = "w-full border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-white focus:outline-none";
const label = "block text-xs font-semibold uppercase tracking-wider text-neutral-400";
const primary = "bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-50";
const plain = "border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-white disabled:opacity-50";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/seo-pages${path}`, { ...init, headers: { "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Eroare ${res.status}`);
  return data as T;
}

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={`text-[11px] ${value.length > max ? "text-red-400" : "text-neutral-500"}`}>{value.length}/{max}</span>;
}

function PagesList() {
  const [pages, setPages] = useState<SeoLandingPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ pages: SeoLandingPage[] }>("").then((data) => setPages(data.pages)).catch((e: unknown) => setError(e instanceof Error ? e.message : "Eroare"));
  }, []);
  return (
    <section className={card} aria-label="Pagini speciale">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">Pagini speciale făcute</h2>
      <p className="text-sm text-neutral-400">Ca să faci una nouă, intră în SEO Radar și apasă pe un cuvânt cu „—” (unde nu apărem), apoi pe „🚀 Creează pagină specială”.</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {pages?.length === 0 && <p className="text-sm text-neutral-500">Nicio pagină încă.</p>}
      <ul className="space-y-2">
        {pages?.map((page) => (
          <li key={page.slug} className="flex flex-wrap items-center justify-between gap-2 border border-neutral-800 px-3 py-2 text-sm">
            <span>
              <span className="text-white">{page.h1 || page.keyword}</span>
              <span className="block text-xs text-neutral-500">„{page.keyword}” · {page.status === "published" ? "publicată" : "ciornă"} · scor {seoPageScore(page)}%</span>
            </span>
            <span className="flex gap-2">
              <Link to={`/admin/seo-radar/pagina?keyword=${encodeURIComponent(page.keyword)}&city=${encodeURIComponent(page.city)}`} className={plain}>Editează</Link>
              {page.status === "published" && <a href={seoPagePath(page.slug)} target="_blank" rel="noreferrer" className={plain}>Deschide ↗</a>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SeoPageCreatorPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const keyword = (params.get("keyword") ?? "").trim();
  const city = (params.get("city") ?? "").trim();

  const [context, setContext] = useState<Context | null>(null);
  const [plan, setPlan] = useState<SeoPagePlan | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [page, setPage] = useState<SeoLandingPage | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!keyword) return;
    setBusy("load");
    api<{ context: Context; page: SeoLandingPage | null }>(`/context?keyword=${encodeURIComponent(keyword)}&city=${encodeURIComponent(city)}`)
      .then((data) => {
        setContext(data.context);
        if (data.page) {
          setPage(data.page);
          setSavedSlug(data.page.slug);
        }
      })
      .catch((e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : "Eroare" }))
      .finally(() => setBusy(null));
  }, [keyword, city]);

  const run = async <T,>(key: string, task: () => Promise<T>): Promise<T | null> => {
    setBusy(key);
    setMessage(null);
    try {
      return await task();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Ceva n-a mers." });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const analyze = async () => {
    const data = await run("plan", () => api<{ plan: SeoPagePlan }>("/plan", { method: "POST", body: JSON.stringify({ keyword, city }) }));
    if (data) setPlan(data.plan);
  };

  const write = async () => {
    if (!plan) return;
    if (page && !window.confirm("AI-ul rescrie pagina de la zero. Modificările tale nesalvate se pierd. Continui?")) return;
    const data = await run("write", () => api<{ page: Omit<SeoLandingPage, "status" | "updatedAt" | "publishedAt"> }>("/write", {
      method: "POST",
      body: JSON.stringify({ keyword, city, plan, notes, answers: plan.questions.map((question) => ({ question, answer: answers[question] ?? "" })) }),
    }));
    if (data) {
      setPage({ ...emptySeoPage(keyword, city), ...data.page, status: page?.status ?? "draft", publishedAt: page?.publishedAt ?? null, slug: page?.status === "published" ? page.slug : data.page.slug });
      setMessage({ ok: true, text: "Pagina e scrisă. Citește-o, corectează ce nu e exact și apoi publică." });
    }
  };

  const save = async (status: "draft" | "published") => {
    if (!page) return;
    if (status === "published" && !window.confirm(`Publici pagina la ${SITE}${seoPagePath(page.slug)}? Intră în sitemap și o vede oricine.`)) return;
    const data = await run(status, () => api<{ page: SeoLandingPage }>("", { method: "PUT", body: JSON.stringify({ page, status, previousSlug: savedSlug }) }));
    if (!data) return;
    setPage(data.page);
    setSavedSlug(data.page.slug);
    setMessage({ ok: true, text: status === "published" ? "Publicată! E în sitemap și legată de cuvânt în SEO Radar." : "Ciornă salvată." });
  };

  const update = (patch: Partial<SeoLandingPage>) => setPage((current) => (current ? { ...current, ...patch } : current));
  const updateSection = (index: number, patch: Partial<SeoLandingPage["sections"][number]>) =>
    setPage((current) => current && { ...current, sections: current.sections.map((section, i) => (i === index ? { ...section, ...patch } : section)) });
  const updateFaq = (index: number, patch: Partial<SeoLandingPage["faq"][number]>) =>
    setPage((current) => current && { ...current, faq: current.faq.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

  const checks = useMemo(() => (page ? seoPageChecks(page) : []), [page]);
  const score = page ? seoPageScore(page) : 0;
  const published = page?.status === "published";
  const pageUrl = page ? `${SITE}${seoPagePath(page.slug)}` : "";

  if (!keyword) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <Breadcrumb />
        <h1 className="text-2xl font-light tracking-tight text-white">Pagini speciale SEO</h1>
        <PagesList />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <Breadcrumb />
      <div>
        <button type="button" onClick={() => navigate("/admin/seo-radar")} className="mb-3 text-xs text-neutral-400 underline hover:text-white">← SEO Radar</button>
        <h1 className="text-2xl font-light tracking-tight text-white">Pagină specială pentru „{keyword}”</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Facem o pagină dedicată acestui cuvânt, cu ajutorul AI-ului, ca să urcăm în Google. Pagina apare la {SITE}/servicii/…, intră în sitemap
          și o urmărim în SEO Radar la rescanarea de luni.
        </p>
      </div>

      {message && <p role={message.ok ? "status" : "alert"} className={`border px-3 py-2 text-sm ${message.ok ? "border-emerald-700 text-emerald-300" : "border-red-700 text-red-300"}`}>{message.text}</p>}
      {busy === "load" && <p className="text-sm text-neutral-500">Se încarcă…</p>}

      {context && (
        <section className={card} aria-label="Ce arată Google">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">1. Ce arată Google azi</h2>
          <p className="text-sm text-neutral-400">
            {context.ownPosition ? `Suntem pe locul ${context.ownPosition}.` : "Nu apărem în primele 10 rezultate."}
            {context.capturedAt ? ` Scanat pe ${new Date(context.capturedAt).toLocaleDateString("ro-RO")}.` : ""}
          </p>
          {context.results.length > 0 && (
            <ol className="space-y-1.5 text-sm">
              {context.results.map((item) => (
                <li key={`${item.position}-${item.url}`} className="border-l-2 border-neutral-700 pl-3">
                  <span className="text-neutral-500">{item.position}.</span> <span className="text-neutral-100">{item.title}</span>
                  <span className="block text-xs text-neutral-500">{item.domain}</span>
                </li>
              ))}
            </ol>
          )}
          <button type="button" onClick={() => void analyze()} disabled={busy !== null} className={primary}>
            {busy === "plan" ? "AI-ul analizează…" : plan ? "🔎 Analizează din nou" : "🔎 Analizează cu AI"}
          </button>
        </section>
      )}

      {plan && (
        <section className={card} aria-label="Analiza AI">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">2. Ce a găsit AI-ul</h2>
          <dl className="space-y-2 text-sm">
            <div><dt className={label}>Ce caută oamenii</dt><dd className="text-neutral-200">{plan.intent}</dd></div>
            <div><dt className={label}>Paginile din top</dt><dd className="text-neutral-200">{plan.competitors}</dd></div>
            <div><dt className={label}>Unghiul nostru</dt><dd className="text-neutral-200">{plan.angle}</dd></div>
            <div><dt className={label}>Structura propusă</dt><dd><ul className="list-disc pl-5 text-neutral-200">{plan.outline.map((item) => <li key={item}>{item}</li>)}</ul></dd></div>
            {plan.secondaryKeywords.length > 0 && <div><dt className={label}>Cuvinte înrudite</dt><dd className="text-neutral-300">{plan.secondaryKeywords.join(", ")}</dd></div>}
          </dl>
          <div className="space-y-3 border-t border-neutral-800 pt-3">
            <p className="text-sm text-neutral-300">Răspunde la ce știi (poți dicta cu 🎙): AI-ul folosește doar ce scrii aici despre preț, ce include și zonă. Ce lași gol nu inventează.</p>
            {plan.questions.map((question, index) => (
              <label key={question} className="block space-y-1">
                <span className="block text-sm text-neutral-200">{question}</span>
                <textarea id={`seo-answer-${index}`} rows={2} value={answers[question] ?? ""} onChange={(e) => setAnswers((current) => ({ ...current, [question]: e.target.value }))} className={input} />
              </label>
            ))}
            <label className="block space-y-1">
              <span className="block text-sm text-neutral-200">Altceva important pentru pagină (opțional)</span>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
            </label>
            <button type="button" onClick={() => void write()} disabled={busy !== null} className={primary}>
              {busy === "write" ? "AI-ul scrie pagina… (1–2 minute)" : page ? "✍️ Rescrie pagina cu AI" : "✍️ Scrie pagina cu AI"}
            </button>
          </div>
        </section>
      )}

      {page && (
        <>
          <section className={card} aria-label="Scor SEO">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">Scor SEO</h2>
              <span className={`text-2xl font-light ${score >= 80 ? "text-emerald-300" : score >= 50 ? "text-amber-300" : "text-red-300"}`}>{score}%</span>
            </div>
            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
              {checks.map((check) => (
                <li key={check.id} className={check.ok ? "text-emerald-300" : "text-amber-200"} title={check.tip}>
                  {check.ok ? "✓" : "○"} {check.label}
                  {!check.ok && <span className="block pl-4 text-xs text-neutral-500">{check.tip}</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className={card} aria-label="Pagina">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">3. Pagina {published ? "· publicată" : "· ciornă"}</h2>
              <button type="button" onClick={() => setPreview((value) => !value)} className={plain}>{preview ? "✏️ Editează" : "👁 Previzualizare"}</button>
            </div>

            <div className="border border-neutral-800 bg-white p-3 text-left" aria-label="Cum apare în Google">
              <p className="text-xs text-[#202124]">{SITE.replace("https://", "")} › servicii › {page.slug}</p>
              <p className="text-lg text-[#1a0dab]">{page.seoTitle || "Titlul paginii"}</p>
              <p className="text-sm text-[#4d5156]">{page.metaDescription || "Descrierea paginii…"}</p>
            </div>

            {preview ? (
              <div className="blog-article max-w-none border border-neutral-800 bg-[#0a0a0a] p-4">
                <h1>{page.h1}</h1>
                {page.subtitle && <p>{page.subtitle}</p>}
                <div dangerouslySetInnerHTML={{ __html: page.intro }} />
                {page.sections.map((section, index) => <section key={index}><h2>{section.heading}</h2><div dangerouslySetInnerHTML={{ __html: section.html }} /></section>)}
                {page.faq.length > 0 && <section><h2>Întrebări frecvente</h2>{page.faq.map((item, index) => <div key={index}><h3>{item.question}</h3><p>{item.answer}</p></div>)}</section>}
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block space-y-1">
                  <span className={label}>Adresa paginii</span>
                  <div className="flex items-center gap-1 text-sm text-neutral-500">
                    <span className="shrink-0">ancavisuals.ro/servicii/</span>
                    <input value={page.slug} disabled={published} onChange={(e) => update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className={input} aria-label="Slug" />
                  </div>
                  {published && <span className="text-[11px] text-neutral-500">Adresa unei pagini publicate nu se mai schimbă.</span>}
                </label>
                <label className="block space-y-1">
                  <span className="flex justify-between"><span className={label}>Titlu în Google (title)</span><Counter value={page.seoTitle} max={60} /></span>
                  <input value={page.seoTitle} onChange={(e) => update({ seoTitle: e.target.value })} className={input} />
                </label>
                <label className="block space-y-1">
                  <span className="flex justify-between"><span className={label}>Descriere în Google (meta)</span><Counter value={page.metaDescription} max={155} /></span>
                  <textarea rows={2} value={page.metaDescription} onChange={(e) => update({ metaDescription: e.target.value })} className={input} />
                </label>
                <label className="block space-y-1">
                  <span className={label}>Titlul mare (H1)</span>
                  <input value={page.h1} onChange={(e) => update({ h1: e.target.value })} className={input} />
                </label>
                <label className="block space-y-1">
                  <span className={label}>Sub titlu</span>
                  <input value={page.subtitle} onChange={(e) => update({ subtitle: e.target.value })} className={input} />
                </label>
                <label className="block space-y-1">
                  <span className={label}>Introducere (HTML simplu)</span>
                  <textarea rows={4} value={page.intro} onChange={(e) => update({ intro: e.target.value })} className={`${input} font-mono text-xs`} />
                </label>

                <div className="space-y-3">
                  <p className={label}>Secțiuni</p>
                  {page.sections.map((section, index) => (
                    <div key={index} className="space-y-2 border border-neutral-800 p-3">
                      <div className="flex gap-2">
                        <input aria-label={`Subtitlu secțiunea ${index + 1}`} value={section.heading} onChange={(e) => updateSection(index, { heading: e.target.value })} className={input} />
                        <button type="button" onClick={() => update({ sections: page.sections.filter((_, i) => i !== index) })} className="shrink-0 px-2 text-xs text-neutral-500 hover:text-red-300">Șterge</button>
                      </div>
                      <textarea aria-label={`Text secțiunea ${index + 1}`} rows={6} value={section.html} onChange={(e) => updateSection(index, { html: e.target.value })} className={`${input} font-mono text-xs`} />
                    </div>
                  ))}
                  <button type="button" onClick={() => update({ sections: [...page.sections, { heading: "", html: "<p></p>" }] })} className={plain}>＋ Secțiune</button>
                </div>

                <div className="space-y-3">
                  <p className={label}>Întrebări frecvente</p>
                  {page.faq.map((item, index) => (
                    <div key={index} className="space-y-2 border border-neutral-800 p-3">
                      <div className="flex gap-2">
                        <input aria-label={`Întrebarea ${index + 1}`} value={item.question} onChange={(e) => updateFaq(index, { question: e.target.value })} className={input} />
                        <button type="button" onClick={() => update({ faq: page.faq.filter((_, i) => i !== index) })} className="shrink-0 px-2 text-xs text-neutral-500 hover:text-red-300">Șterge</button>
                      </div>
                      <textarea aria-label={`Răspunsul ${index + 1}`} rows={3} value={item.answer} onChange={(e) => updateFaq(index, { answer: e.target.value })} className={input} />
                    </div>
                  ))}
                  <button type="button" onClick={() => update({ faq: [...page.faq, { question: "", answer: "" }] })} className={plain}>＋ Întrebare</button>
                </div>
              </div>
            )}
          </section>

          <section className={card} aria-label="Publicare">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">4. Publică și indexează</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void save("draft")} disabled={busy !== null} className={plain}>{busy === "draft" ? "Se salvează…" : "💾 Salvează ciorna"}</button>
              <button type="button" onClick={() => void save("published")} disabled={busy !== null} className={primary}>{busy === "published" ? "Se publică…" : published ? "🚀 Publică modificările" : "🚀 Publică pagina"}</button>
            </div>
            {published && (
              <div className="space-y-2 text-sm text-neutral-300">
                <p>Pagina e live și în sitemap: <a href={seoPagePath(page.slug)} target="_blank" rel="noreferrer" className="text-white underline">{pageUrl} ↗</a></p>
                <p>Ca Google s-o vadă mai repede, cere indexarea în Search Console (lipești adresa și apeși „Solicită indexarea”):</p>
                <a href={`https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent("sc-domain:ancavisuals.ro")}&id=${encodeURIComponent(pageUrl)}`} target="_blank" rel="noreferrer" className={`${plain} inline-block`}>Deschide Search Console ↗</a>
                <p className="text-xs text-neutral-500">Poziția o vezi în SEO Radar după rescanarea de luni. Urcarea durează de obicei câteva săptămâni.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
