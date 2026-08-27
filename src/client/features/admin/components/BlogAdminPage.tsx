import React, { useEffect, useMemo, useState } from "react";
import useAuth from "../auth/useAuth";

type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  city?: string;
  coverImage?: string;
  content: string;
  status: "draft" | "published";
  source: "markdown" | "firestore";
};

const emptyPost: BlogPost = {
  slug: "",
  title: "",
  description: "",
  date: new Date().toISOString().slice(0, 10),
  category: "general",
  tags: [],
  content: "",
  status: "draft",
  source: "firestore",
};

export default function BlogAdminPage() {
  const { auth } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selected, setSelected] = useState<BlogPost>(emptyPost);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [generatingTitles, setGeneratingTitles] = useState(false);
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[][]>([]);
  const [generatingMetadata, setGeneratingMetadata] = useState<"description" | "tags" | null>(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${auth.accessToken}` }), [auth.accessToken]);

  const load = async () => {
    if (!auth.accessToken) return;
    setLoading(true);
    try {
      const response = await fetch("/api/blog/admin/posts", { headers });
      const data = await response.json() as { posts?: BlogPost[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Nu s-au putut încărca articolele.");
      setPosts(data.posts ?? []);
      if (data.posts?.length && !selected.slug) setSelected(data.posts[0]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Eroare la încărcare.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load().catch(() => {}); }, [auth.accessToken]);

  const update = (field: keyof BlogPost, value: string | string[]) => {
    setSelected((post) => ({ ...post, [field]: value }));
    setMessage("");
  };

  const save = async () => {
    if (!selected.slug || !selected.title || !selected.content) {
      setError("Slug-ul, titlul și conținutul sunt obligatorii.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/blog/admin/posts/${encodeURIComponent(selected.slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(selected),
      });
      const data = await response.json() as { post?: BlogPost; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Articolul nu a putut fi salvat.");
      if (data.post) {
        setSelected(data.post);
        setPosts((current) => [data.post!, ...current.filter((post) => post.slug !== data.post!.slug)].sort((a, b) => b.date.localeCompare(a.date)));
      }
      setMessage(selected.status === "published" ? "Articol publicat." : "Draft salvat.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Eroare la salvare.");
    } finally { setSaving(false); }
  };

  const importPosts = async () => {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/blog/admin/import", { method: "POST", headers });
      const data = await response.json() as { imported?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Importul a eșuat.");
      setMessage(`${data.imported ?? 0} articole importate. Articolele deja editate au fost păstrate.`);
      await load();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Importul a eșuat.");
    } finally { setSaving(false); }
  };

  const generateTitleSuggestions = async () => {
    if (!selected.title.trim()) {
      setError("Scrie un titlu înainte să ceri sugestii.");
      return;
    }
    setGeneratingTitles(true);
    setError("");
    try {
      const response = await fetch("/api/blog/admin/title-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ title: selected.title, category: selected.category, city: selected.city }),
      });
      const data = await response.json() as { suggestions?: string[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Sugestiile nu au putut fi generate.");
      setTitleSuggestions(data.suggestions ?? []);
    } catch (suggestionError) {
      setError(suggestionError instanceof Error ? suggestionError.message : "Sugestiile nu au putut fi generate.");
    } finally {
      setGeneratingTitles(false);
    }
  };

  const generateMetadataSuggestions = async (kind: "description" | "tags") => {
    if (!selected.title.trim()) {
      setError("Scrie un titlu înainte să ceri sugestii.");
      return;
    }
    setGeneratingMetadata(kind);
    setError("");
    try {
      const response = await fetch("/api/blog/admin/metadata-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ title: selected.title, category: selected.category, city: selected.city, kind }),
      });
      const data = await response.json() as { suggestions?: string[] | string[][]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Sugestiile nu au putut fi generate.");
      if (kind === "tags") setTagSuggestions((data.suggestions ?? []) as string[][]);
      else setDescriptionSuggestions((data.suggestions ?? []) as string[]);
    } catch (suggestionError) {
      setError(suggestionError instanceof Error ? suggestionError.message : "Sugestiile nu au putut fi generate.");
    } finally {
      setGeneratingMetadata(null);
    }
  };

  const cities = Array.from(new Set(posts.map((post) => post.city).filter(Boolean))).sort() as string[];
  const visiblePosts = cityFilter === "all" ? posts : posts.filter((post) => post.city === cityFilter);
  const publishedCount = posts.filter((post) => post.status === "published").length;
  const draftCount = posts.filter((post) => post.status === "draft").length;
  const isNewPost = !posts.some((post) => post.slug === selected.slug);

  const inputClass = "mt-1.5 w-full rounded-xl border border-neutral-700 bg-neutral-950/70 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/10 disabled:cursor-not-allowed disabled:opacity-50";
  const labelClass = "text-xs font-medium uppercase tracking-wide text-neutral-500";

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-300/70">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Marketing & Web
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Gestionează blogul</h1>
            <p className="mt-1.5 max-w-xl text-sm text-neutral-500">Scrie, organizează și publică articole fără un deploy nou.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={importPosts} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-3.5 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white disabled:opacity-50">
              <span className="text-base">↥</span> Importă .md
            </button>
            <button onClick={() => { setSelected({ ...emptyPost }); setError(""); setMessage(""); }} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-amber-200">
              <span className="text-lg leading-none">+</span> Articol nou
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total articole", value: posts.length, accent: "text-white" },
            { label: "Publicate", value: publishedCount, accent: "text-emerald-400" },
            { label: "Drafturi", value: draftCount, accent: "text-amber-300" },
            { label: "Orașe SEO", value: cities.length, accent: "text-violet-400" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-600">{stat.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${stat.accent}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {(error || message) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"}`}>{error || message}</div>}

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/70 lg:max-h-[calc(100vh-245px)]">
          <div className="border-b border-neutral-800 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="text-sm font-semibold text-white">Articole</h2><p className="mt-0.5 text-xs text-neutral-600">{visiblePosts.length} afișate</p></div>
              <span className="rounded-lg bg-neutral-800 px-2 py-1 text-[11px] text-neutral-500">{cityFilter === "all" ? "Toate" : cityFilter}</span>
            </div>
            <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-300 outline-none focus:border-amber-400/70">
              <option value="all">Toate orașele</option>{cities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-2 lg:max-h-[calc(100vh-365px)]">
            {loading ? <p className="p-3 text-sm text-neutral-500">Se încarcă…</p> : visiblePosts.length === 0 ? <p className="p-5 text-center text-sm text-neutral-600">Nu există articole pentru acest filtru.</p> : visiblePosts.map((post) => (
              <button key={post.slug} onClick={() => setSelected(post)} className={`mb-1 w-full rounded-xl border p-3 text-left transition-colors ${selected.slug === post.slug ? "border-amber-300/30 bg-amber-300/10" : "border-transparent hover:border-neutral-700 hover:bg-neutral-800/80"}`}>
                <span className="block truncate text-sm font-medium text-neutral-200">{post.title || "Fără titlu"}</span>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-600"><span className={`h-1.5 w-1.5 rounded-full ${post.status === "draft" ? "bg-amber-300" : "bg-emerald-400"}`} />{post.city || "Fără oraș"}<span>·</span>{post.status === "draft" ? "Draft" : "Publicat"}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 rounded-2xl border border-neutral-800 bg-neutral-900/70">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-800 px-5 py-4 sm:px-6">
            <div><p className="text-xs font-medium uppercase tracking-wider text-neutral-600">{isNewPost ? "Editor nou" : "Editor articol"}</p><h2 className="mt-1 truncate text-lg font-semibold text-white">{selected.title || "Articol fără titlu"}</h2></div>
            <div className="flex items-center gap-2">
              {selected.slug && <a href={`/blog/${encodeURIComponent(selected.slug)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:border-amber-300/50 hover:text-amber-300">Previzualizare articol <span aria-hidden="true">↗</span></a>}
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${selected.status === "draft" ? "border-amber-300/20 bg-amber-300/10 text-amber-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-400"}`}>{selected.status === "draft" ? "Draft" : "Publicat"}</span>
              <button onClick={save} disabled={saving} className="rounded-xl bg-amber-300 px-4 py-2 text-xs font-semibold text-neutral-950 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Se salvează…" : selected.status === "published" ? "Salvează și publică" : "Salvează draft"}</button>
            </div>
          </div>
          <div className="space-y-6 p-5 sm:p-6">
            <div><h3 className="text-sm font-semibold text-neutral-200">Informații articol</h3><p className="mt-1 text-xs text-neutral-600">Datele folosite pentru organizare și SEO.</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClass}>Slug<input value={selected.slug} disabled={Boolean(posts.find((post) => post.slug === selected.slug))} onChange={(e) => update("slug", e.target.value)} className={inputClass} placeholder="exemplu-articol" /></label>
              <label className={labelClass}>Titlu
                <div className="mt-1.5 flex gap-2">
                  <input value={selected.title} onChange={(e) => { update("title", e.target.value); setTitleSuggestions([]); }} className={`${inputClass} mt-0`} placeholder="Titlul articolului" />
                  <button type="button" onClick={generateTitleSuggestions} disabled={generatingTitles || !selected.title.trim()} title="Generează sugestii cu AI" aria-label="Generează sugestii de titlu cu AI" className="flex h-[42px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/10 text-xl transition-colors hover:border-violet-300/60 hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-40">
                    {generatingTitles ? <span className="animate-spin text-base">✦</span> : "🪄"}
                  </button>
                </div>
                {titleSuggestions.length > 0 && <div className="mt-2 space-y-1.5 rounded-xl border border-violet-400/20 bg-violet-400/5 p-2.5">
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-violet-300/70">Sugestii AI · alege una</p>
                  {titleSuggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => { update("title", suggestion); setTitleSuggestions([]); }} className="block w-full rounded-lg px-2.5 py-2 text-left text-sm normal-case tracking-normal text-neutral-300 transition-colors hover:bg-violet-400/15 hover:text-white">{suggestion}</button>)}
                </div>}
              </label>
              <label className={labelClass}>Data<input type="date" value={selected.date.slice(0, 10)} onChange={(e) => update("date", e.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Categorie<input value={selected.category} onChange={(e) => update("category", e.target.value)} className={inputClass} placeholder="general" /></label>
              <label className={labelClass}>Oraș țintă SEO<input value={selected.city ?? ""} onChange={(e) => update("city", e.target.value)} className={inputClass} placeholder="ex. Cluj-Napoca" /></label>
              <label className={labelClass}>Etichete <span className="normal-case tracking-normal text-neutral-600">(virgulă)</span>
                <div className="mt-1.5 flex gap-2"><input value={selected.tags.join(", ")} onChange={(e) => { update("tags", e.target.value.split(",").map((tag) => tag.trim()).filter(Boolean)); setTagSuggestions([]); }} className={`${inputClass} mt-0`} placeholder="nuntă, fotografie, idei" /><button type="button" onClick={() => generateMetadataSuggestions("tags")} disabled={generatingMetadata !== null || !selected.title.trim()} title="Generează etichete cu AI" aria-label="Generează etichete cu AI" className="flex h-[42px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/10 text-xl transition-colors hover:border-violet-300/60 hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-40">{generatingMetadata === "tags" ? <span className="animate-spin text-base">✦</span> : "🪄"}</button></div>
                {tagSuggestions.length > 0 && <div className="mt-2 space-y-1.5 rounded-xl border border-violet-400/20 bg-violet-400/5 p-2.5"><p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-violet-300/70">Seturi de etichete AI · alege unul</p>{tagSuggestions.map((suggestionSet) => <button key={suggestionSet.join(",")} type="button" onClick={() => { update("tags", suggestionSet); setTagSuggestions([]); }} className="block w-full rounded-lg px-2.5 py-2 text-left text-sm normal-case tracking-normal text-neutral-300 transition-colors hover:bg-violet-400/15 hover:text-white">{suggestionSet.join(" · ")}</button>)}</div>}
              </label>
            </div>
            <label className={labelClass}>Descriere SEO
              <div className="mt-1.5 flex items-start gap-2"><textarea value={selected.description} onChange={(e) => { update("description", e.target.value); setDescriptionSuggestions([]); }} rows={3} className={`${inputClass} mt-0 resize-y`} placeholder="Un rezumat scurt pentru motoarele de căutare…" /><button type="button" onClick={() => generateMetadataSuggestions("description")} disabled={generatingMetadata !== null || !selected.title.trim()} title="Generează descriere SEO cu AI" aria-label="Generează descriere SEO cu AI" className="flex h-[42px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/10 text-xl transition-colors hover:border-violet-300/60 hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-40">{generatingMetadata === "description" ? <span className="animate-spin text-base">✦</span> : "🪄"}</button></div>
              {descriptionSuggestions.length > 0 && <div className="mt-2 space-y-1.5 rounded-xl border border-violet-400/20 bg-violet-400/5 p-2.5"><p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-violet-300/70">Descrieri AI · alege una</p>{descriptionSuggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => { update("description", suggestion); setDescriptionSuggestions([]); }} className="block w-full rounded-lg px-2.5 py-2 text-left text-sm normal-case tracking-normal text-neutral-300 transition-colors hover:bg-violet-400/15 hover:text-white">{suggestion}</button>)}</div>}
            </label>
            <div className="border-t border-neutral-800 pt-5"><label className={labelClass}>Conținut Markdown<textarea value={selected.content} onChange={(e) => update("content", e.target.value)} rows={20} className={`${inputClass} resize-y font-mono text-[13px] leading-relaxed`} placeholder="# Titlu\n\nScrie articolul aici…" /></label></div>
            <div className="flex flex-col-reverse gap-3 border-t border-neutral-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Status<select value={selected.status} onChange={(e) => update("status", e.target.value)} className="rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm normal-case tracking-normal text-neutral-200 outline-none focus:border-amber-400/70"><option value="draft">Draft</option><option value="published">Publicat</option></select></label>
              <p className="text-xs text-neutral-600">Modificările nu sunt salvate automat.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
