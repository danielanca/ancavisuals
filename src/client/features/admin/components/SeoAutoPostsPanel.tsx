/*
 * Purpose: SEO Radar → "Articole automate": the keywords where we don't appear in the top 10
 * ("Absent") and have no article yet, the AI articles already published for them, and buttons to
 * write and publish now. Runs by itself after each deploy and on Mondays (2 articles, weekly).
 * Server: /api/admin/seo-auto-posts (seoAutoPosts.routes.ts → services/seoAutoPosts.service.ts).
 */
import { useCallback, useEffect, useState } from "react";

type AbsentKeyword = { keyword: string; city: string; lastScanAt: string };
type AutoPost = { keyword: string; status: string; slug?: string; title?: string; url?: string; error?: string; at: string; trigger: string };
type Overview = { lastRunAt: string | null; running: boolean; absent: AbsentKeyword[]; posts: AutoPost[] };

const POLL_MS = 10_000;
const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });

export default function SeoAutoPostsPanel() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/seo-auto-posts");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Eroare ${res.status}`);
      setOverview(data as Overview);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut încărca articolele automate.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const busy = waiting || Boolean(overview?.running);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => { void load(); }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [busy, load]);
  // A started run shows up as "running" on the next poll; stop waiting once it is over.
  useEffect(() => {
    if (!waiting || !overview || overview.running) return;
    const timer = window.setTimeout(() => setWaiting(false), POLL_MS * 2);
    return () => window.clearTimeout(timer);
  }, [waiting, overview]);

  const start = async (key: string, path: string, body: unknown) => {
    setStarting(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/seo-auto-posts${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Eroare ${res.status}`);
      setWaiting(true);
      window.setTimeout(() => { void load(); }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut porni articolele.");
    } finally {
      setStarting(null);
    }
  };

  const absent = overview?.absent ?? [];
  const published = overview?.posts.filter((post) => post.status === "published") ?? [];
  const failed = overview?.posts.filter((post) => post.status === "failed") ?? [];

  return (
    <section aria-label="Articole automate" className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-medium text-amber-100">✍️ Articole automate pentru „Absent”</h3>
          <p className="mt-1 max-w-2xl text-xs text-gray-400">
            Pentru cuvintele unde nu apărem în top 10 („—”), AI-ul scrie un articol de blog și îl publică direct: intră în sitemap,
            în llms.txt și e legat aici de cuvânt, ca rescanarea de luni să arate dacă urcă. Câte 2 pe săptămână, singur, după
            fiecare deploy și lunea. Fără prețuri sau recenzii inventate.
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            {overview?.lastRunAt ? `Ultima rulare: ${formatWhen(overview.lastRunAt)}.` : "Nu a rulat încă."}
            {overview ? ` ${absent.length} ${absent.length === 1 ? "cuvânt absent fără articol" : "cuvinte absente fără articol"}.` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void start("run", "/run", { limit: 2 })}
          disabled={busy || starting !== null || absent.length === 0}
          className="shrink-0 rounded-xl bg-amber-200 px-4 py-2 text-sm font-medium text-black hover:bg-amber-100 disabled:opacity-40"
        >
          {busy ? "Se scriu articolele…" : `Scrie și publică ${Math.min(2, absent.length) || 2} acum`}
        </button>
      </div>

      {busy && <p role="status" className="mt-3 text-xs text-amber-200">Claude scrie și publică articolele. Durează câteva minute; pagina se actualizează singură.</p>}
      {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}

      {absent.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Urmează (cele mai recent scanate primele)</p>
          <ul className="mt-2 space-y-1.5">
            {absent.slice(0, 8).map((item, index) => (
              <li key={item.keyword} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
                <span className="text-gray-200">
                  {index < 2 && <span className="mr-1.5 rounded bg-amber-300/20 px-1.5 py-0.5 text-[10px] text-amber-200">următorul</span>}
                  {item.keyword}
                  <span className="ml-2 text-[11px] text-red-300">— absent</span>
                </span>
                <button
                  type="button"
                  onClick={() => void start(item.keyword, "/keyword", { keyword: item.keyword })}
                  disabled={busy || starting !== null}
                  className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-gray-200 hover:border-white disabled:opacity-40"
                >
                  {starting === item.keyword ? "Pornește…" : "Scrie articol"}
                </button>
              </li>
            ))}
          </ul>
          {absent.length > 8 && <p className="mt-1 text-[11px] text-gray-500">și încă {absent.length - 8}.</p>}
        </div>
      )}

      {published.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Publicate automat</p>
          <ul className="mt-2 space-y-1.5">
            {published.map((post) => (
              <li key={`${post.keyword}-${post.slug}`} className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-sm">
                <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="text-emerald-200 hover:underline">{post.title} ↗</a>
                <span className="block text-[11px] text-gray-500">pentru „{post.keyword}” · {formatWhen(post.at)} · {post.trigger}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {failed.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Nu au reușit</p>
          <ul className="mt-2 space-y-1.5">
            {failed.map((post) => (
              <li key={`${post.keyword}-failed`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm">
                <span className="text-red-200">{post.keyword}<span className="block text-[11px] text-gray-500">{post.error}</span></span>
                <button
                  type="button"
                  onClick={() => void start(post.keyword, "/keyword", { keyword: post.keyword })}
                  disabled={busy || starting !== null}
                  className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-gray-200 hover:border-white disabled:opacity-40"
                >
                  Reîncearcă
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
