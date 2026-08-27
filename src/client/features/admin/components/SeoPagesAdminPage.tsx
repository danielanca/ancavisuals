import React, { useEffect, useMemo, useState } from "react";
import useAuth from "../auth/useAuth";

type SitemapEntry = {
  loc: string;
  changefreq: string;
  priority: string;
};

export default function SeoPagesAdminPage() {
  const { auth } = useAuth();
  const [entries, setEntries] = useState<SitemapEntry[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/admin/seo/pages", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then(async (response) => {
        const data = await response.json() as { entries?: SitemapEntry[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Paginile SEO nu au putut fi încărcate.");
        setEntries(data.entries ?? []);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Eroare la încărcare."))
      .finally(() => setLoading(false));
  }, [auth.accessToken]);

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const matchesQuery = !query.trim() || entry.loc.toLowerCase().includes(query.trim().toLowerCase());
    const matchesKind = kind === "all" || (kind === "location" ? entry.loc.includes("foto-video-") : !entry.loc.includes("foto-video-"));
    return matchesQuery && matchesKind;
  }), [entries, kind, query]);

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-300/70">Marketing & Web</p>
          <h1 className="text-3xl font-semibold tracking-tight">Pagini SEO</h1>
          <p className="mt-1.5 text-sm text-neutral-500">Toate URL-urile generate și incluse în sitemap, separat de articolele de blog.</p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4"><p className="text-[11px] uppercase tracking-wider text-neutral-600">Total URL-uri</p><p className="mt-1 text-2xl font-semibold text-white">{entries.length}</p></div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4"><p className="text-[11px] uppercase tracking-wider text-neutral-600">Pagini locație</p><p className="mt-1 text-2xl font-semibold text-violet-400">{entries.filter(entry => entry.loc.includes("foto-video-")).length}</p></div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4"><p className="text-[11px] uppercase tracking-wider text-neutral-600">Afișate</p><p className="mt-1 text-2xl font-semibold text-emerald-400">{filteredEntries.length}</p></div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/70">
          <div className="flex flex-col gap-3 border-b border-neutral-800 p-4 sm:flex-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută după URL…" className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-amber-400/70" />
            <select value={kind} onChange={(event) => setKind(event.target.value)} className="rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-300 outline-none focus:border-amber-400/70"><option value="all">Toate paginile</option><option value="location">Pagini locație</option><option value="other">Alte URL-uri</option></select>
          </div>
          {error ? <p className="p-6 text-sm text-red-300">{error}</p> : loading ? <p className="p-6 text-sm text-neutral-500">Se încarcă paginile SEO…</p> : (
            <div className="max-h-[calc(100vh-370px)] overflow-y-auto">
              {filteredEntries.length === 0 ? <p className="p-8 text-center text-sm text-neutral-600">Nu există rezultate.</p> : filteredEntries.map((entry) => (
                <a key={entry.loc} href={entry.loc} target="_blank" rel="noreferrer" className="flex flex-col gap-1 border-b border-neutral-800/70 px-4 py-3 transition-colors last:border-0 hover:bg-neutral-800/60 sm:flex-row sm:items-center sm:justify-between">
                  <span className="break-all font-mono text-sm text-neutral-300">{entry.loc.replace("https://www.ancavisuals.ro", "")}</span>
                  <span className="shrink-0 text-xs text-neutral-600">prioritate {entry.priority} · {entry.changefreq}</span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
