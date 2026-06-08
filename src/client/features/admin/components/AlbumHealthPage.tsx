import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import useAuth from "../auth/useAuth";

interface AlbumHealth {
  slug: string;
  total: number;
  withPreview: number;
  missing: number;
  missingFiles: string[];
  hasPreviewFolder: boolean;
  coverage: number;
  zipStatus: "ok" | "stale" | "missing";
  zipDate: string | null;
}

interface JobState {
  status: "running" | "done" | "error";
  log: string[];
  progress: { done: number; total: number };
  initialWithPreview: number;
  error?: string;
}

// Tries to parse a date from an album slug like "16mai2026", "26aprilie2026"
const MONTHS: Record<string, number> = {
  ianuarie: 0, februarie: 1, martie: 2, aprilie: 3, mai: 4, iunie: 5,
  iulie: 6, august: 7, septembrie: 8, octombrie: 9, noiembrie: 10, decembrie: 11,
};

function parseSlugDate(slug: string): Date | null {
  const match = slug.match(/^(\d{1,2})([a-z]+)(\d{4})$/i);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = MONTHS[match[2].toLowerCase()];
  const year = parseInt(match[3], 10);
  if (month === undefined || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month, day);
}

type AlbumCategory = "active" | "delivered" | "archived";
const CATEGORY_STORAGE_KEY = "album-health-categories";

function loadCategoryOverrides(): Record<string, AlbumCategory> {
  try {
    return JSON.parse(localStorage.getItem(CATEGORY_STORAGE_KEY) ?? "{}") as Record<string, AlbumCategory>;
  } catch { return {}; }
}

function getAutoCategory(slug: string, today: Date): AlbumCategory {
  const date = parseSlugDate(slug);
  if (!date) return "active";
  return date < today ? "delivered" : "active";
}

export default function AlbumHealthPage() {
  const { auth } = useAuth();
  const [albums, setAlbums] = useState<AlbumHealth[]>([]);
  const [jobStates, setJobStates] = useState<Record<string, JobState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, AlbumCategory>>(loadCategoryOverrides);
  const liveCleanups = useRef<Record<string, () => void>>({});
  const MAX_RETRIES = 10;

  const setCategory = useCallback((slug: string, category: AlbumCategory) => {
    setCategoryOverrides((prev) => {
      const next = { ...prev, [slug]: category };
      localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    fetch("/api/admin/album-health/categories", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ [slug]: category }),
    }).catch(() => {});
  }, [auth.accessToken]);

  const toggleDetails = (slug: string) =>
    setExpandedDetails((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });

  const connectLive = useCallback((slug: string) => {
    // cleanup any existing connection for this slug
    liveCleanups.current[slug]?.();

    let stopped = false;
    const controller = new AbortController();

    const connect = async () => {
      try {
        const res = await fetch(`/api/admin/album-health/${encodeURIComponent(slug)}/live`, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
          signal: controller.signal,
        });
        if (!res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as Record<string, unknown>;
              handleLiveEvent(slug, event);
            } catch {}
          }
        }
      } catch (err) {
        if (!stopped) {
          setJobStates((prev) => {
            const current = prev[slug];
            if (!current || current.status !== "running") return prev;
            return { ...prev, [slug]: { ...current, status: "error", error: String(err) } };
          });
        }
      }
    };

    connect();

    const cleanup = () => { stopped = true; controller.abort(); };
    liveCleanups.current[slug] = cleanup;
    return cleanup;
  }, [auth.accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLiveEvent = (slug: string, event: Record<string, unknown>) => {
    setJobStates((prev) => {
      const current = prev[slug] ?? { status: "running", log: [], progress: { done: 0, total: 0 }, initialWithPreview: 0 };

      if (event.type === "init") {
        return {
          ...prev,
          [slug]: {
            status: event.status as JobState["status"],
            log: (event.log as string[]) ?? [],
            progress: (event.progress as JobState["progress"]) ?? { done: 0, total: 0 },
            initialWithPreview: (event.initialWithPreview as number) ?? 0,
            error: event.error as string | undefined,
          },
        };
      }
      if (event.type === "log") {
        return { ...prev, [slug]: { ...current, log: [...current.log, event.message as string] } };
      }
      if (event.type === "progress") {
        return { ...prev, [slug]: { ...current, progress: { done: event.done as number, total: event.total as number } } };
      }
      if (event.type === "done") {
        setAlbums((albums) => albums.map((a) =>
          a.slug === slug ? { ...a, withPreview: a.total, missing: 0, missingFiles: [], coverage: 100, hasPreviewFolder: true } : a
        ));
        return { ...prev, [slug]: { ...current, status: "done" } };
      }
      if (event.type === "error") {
        return { ...prev, [slug]: { ...current, status: "error", error: event.error as string } };
      }
      return prev;
    });
  };

  const scan = useCallback(async (attempt = 1) => {
    setLoading(true);
    setError(null);
    if (attempt > 1) setRetryCount(attempt);

    try {
      const headers = { Authorization: `Bearer ${auth.accessToken}` };
      const [healthRes, jobsRes, categoriesRes] = await Promise.all([
        fetch("/api/admin/album-health", { headers }),
        fetch("/api/admin/album-health/jobs", { headers }),
        fetch("/api/admin/album-health/categories", { headers }),
      ]);

      if (!healthRes.ok) throw new Error((await healthRes.json() as { error?: string }).error ?? "Eroare server");

      const { albums: fetchedAlbums } = await healthRes.json() as { albums: AlbumHealth[] };
      setAlbums(fetchedAlbums);
      setScanned(true);
      setRetryCount(0);

      if (categoriesRes.ok) {
        const serverCategories = await categoriesRes.json() as Record<string, AlbumCategory>;
        setCategoryOverrides((prev) => {
          const merged = { ...prev, ...serverCategories };
          localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(merged));
          return merged;
        });
      }

      if (jobsRes.ok) {
        const { jobs } = await jobsRes.json() as { jobs: Array<{ slug: string; status: string; log: string[]; progress: { done: number; total: number }; initialWithPreview: number; error?: string }> };
        const states: Record<string, JobState> = {};
        for (const job of jobs) {
          states[job.slug] = {
            status: job.status as JobState["status"],
            log: job.log,
            progress: job.progress,
            initialWithPreview: job.initialWithPreview,
            error: job.error,
          };
          if (job.status === "running") connectLive(job.slug);
        }
        setJobStates(states);
      }
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        setTimeout(() => scan(attempt + 1), 2000);
        return;
      }
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, connectLive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { scan(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteZip = useCallback(async (slug: string) => {
    const res = await fetch(`/api/admin/album-health/${encodeURIComponent(slug)}/zip`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    if (!res.ok) return;
    setAlbums((prev) => prev.map((album) =>
      album.slug === slug ? { ...album, zipStatus: "missing" as const, zipDate: null } : album
    ));
  }, [auth.accessToken]);

  const startProcess = useCallback(async (slug: string, initialWithPreview: number) => {
    const res = await fetch(`/api/admin/album-health/${encodeURIComponent(slug)}/process`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ initialWithPreview }),
    });
    if (!res.ok) return;
    setJobStates((prev) => ({
      ...prev,
      [slug]: { status: "running", log: ["Se conectează..."], progress: { done: 0, total: 0 }, initialWithPreview },
    }));
    connectLive(slug);
  }, [auth.accessToken, connectLive]);

  useEffect(() => {
    const cleanups = liveCleanups.current;
    return () => { Object.values(cleanups).forEach((fn) => fn()); };
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sorted = [...albums].sort((a, b) => {
    const dateA = parseSlugDate(a.slug);
    const dateB = parseSlugDate(b.slug);
    if (dateA && dateB) return dateB.getTime() - dateA.getTime();
    if (dateA) return -1;
    if (dateB) return 1;
    return a.slug.localeCompare(b.slug);
  });

  const getCategory = (slug: string): AlbumCategory =>
    categoryOverrides[slug] ?? getAutoCategory(slug, today);

  const activeAlbums = sorted.filter((a) => getCategory(a.slug) === "active");
  const deliveredAlbums = sorted.filter((a) => getCategory(a.slug) === "delivered");
  const archivedAlbums = sorted.filter((a) => getCategory(a.slug) === "archived");

  const [createSlug, setCreateSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreate = useCallback(async () => {
    const slug = createSlug.trim().toLowerCase();
    if (!slug) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/album-health/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setCreateError(data.error ?? "Eroare"); return; }
      setAlbums((prev) => [{
        slug,
        total: 0,
        withPreview: 0,
        missing: 0,
        missingFiles: [],
        hasPreviewFolder: false,
        coverage: 0,
        zipStatus: "missing" as const,
        zipDate: null,
      }, ...prev]);
      setCreateSlug("");
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(String(err));
    } finally {
      setCreating(false);
    }
  }, [auth.accessToken, createSlug]);

  const nonArchived = albums.filter((a) => getCategory(a.slug) !== "archived");
  const complete = nonArchived.filter((a) => a.coverage === 100).length;
  const incomplete = nonArchived.filter((a) => a.coverage < 100).length;
  const totalMissing = nonArchived.reduce((sum, a) => sum + a.missing, 0);

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white">Albume</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Previzualizări WebP · structură Bunny · procesare
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://dash.bunny.net/storage/${import.meta.env.VITE_BUNNY_STORAGE_ZONE_ID ?? ""}/file-manager`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-sm font-medium hover:bg-neutral-700 hover:text-white transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Bunny Storage
            </a>
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Album nou
            </button>
            <button
              onClick={() => scan(1)}
              disabled={loading}
              title="Reîncarcă"
              className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-40"
            >
              <svg className={loading ? "animate-spin" : ""} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" />
              </svg>
            </button>
          </div>
        </div>

        {showCreateForm && (
          <div className="mb-5 p-4 bg-neutral-900 border border-neutral-700 rounded-lg">
            <p className="text-sm font-medium text-white mb-3">Creează album nou în Bunny</p>
            <p className="text-xs text-neutral-500 mb-3">
              Se vor crea folderele: <code className="text-neutral-400">photos/</code>, <code className="text-neutral-400">photos_preview/</code>, <code className="text-neutral-400">shortvideo/</code>, <code className="text-neutral-400">longvideo/</code>
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={createSlug}
                onChange={(e) => { setCreateSlug(e.target.value); setCreateError(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="ex: 8martie2026"
                className="flex-1 bg-neutral-800 text-white text-sm placeholder-neutral-600 border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 transition-colors font-mono"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !createSlug.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
              >
                {creating ? (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                )}
                {creating ? "Creare..." : "Creează"}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setCreateSlug(""); setCreateError(null); }}
                className="px-3 py-2 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors text-sm"
              >
                Anulează
              </button>
            </div>
            {createError && (
              <p className="mt-2 text-xs text-red-400">{createError}</p>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {loading && !scanned && <AlbumSkeleton retryCount={retryCount} maxRetries={MAX_RETRIES} />}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-white font-medium mb-1">Nu s-au putut încărca albumele</p>
            <p className="text-neutral-500 text-sm mb-1">{error}</p>
            <p className="text-neutral-600 text-xs mb-5">S-au încercat {MAX_RETRIES} conexiuni fără succes</p>
            <button
              onClick={() => scan(1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/15 text-violet-400 text-sm font-medium hover:bg-violet-500/25 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" /></svg>
              Încearcă din nou
            </button>
          </div>
        )}

        {scanned && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Stat value={albums.length} label="Albume totale" />
              <Stat value={complete} label="Complete (100% WebP)" color="emerald" />
              <Stat value={incomplete} label={`Incomplete · ${totalMissing} lipsă`} color="amber" />
            </div>
            <Section title="În lucru" albums={activeAlbums} jobStates={jobStates} expandedDetails={expandedDetails} toggleDetails={toggleDetails} startProcess={startProcess} currentCategory="active" onSetCategory={setCategory} onDeleteZip={handleDeleteZip} />
            <Section title="Predate" albums={deliveredAlbums} jobStates={jobStates} expandedDetails={expandedDetails} toggleDetails={toggleDetails} startProcess={startProcess} currentCategory="delivered" onSetCategory={setCategory} onDeleteZip={handleDeleteZip} dimmed />
            <Section title="Arhivate" albums={archivedAlbums} jobStates={jobStates} expandedDetails={expandedDetails} toggleDetails={toggleDetails} startProcess={startProcess} currentCategory="archived" onSetCategory={setCategory} onDeleteZip={handleDeleteZip} dimmed />
          </>
        )}
      </div>
    </div>
  );
}

function AlbumSkeleton({ retryCount, maxRetries }: { retryCount: number; maxRetries: number }) {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="h-7 w-12 bg-neutral-800 rounded mb-2" />
            <div className="h-3 w-28 bg-neutral-800 rounded" />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="h-3 w-14 bg-neutral-800 rounded" />
        <div className="flex-1 h-px bg-neutral-800" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="h-4 rounded bg-neutral-800" style={{ width: `${100 + (i * 37) % 120}px` }} />
                  <div className="h-4 w-16 rounded bg-neutral-800" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-neutral-800 rounded-full">
                    <div className="h-full bg-neutral-700 rounded-full" style={{ width: `${20 + (i * 13) % 70}%` }} />
                  </div>
                  <div className="h-3 w-20 bg-neutral-800 rounded" />
                </div>
              </div>
              <div className="h-7 w-28 bg-neutral-800 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {retryCount > 1 && (
        <p className="text-center text-xs text-neutral-600 mt-4">
          Reconectare... ({retryCount}/{maxRetries})
        </p>
      )}
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color?: "emerald" | "amber" }) {
  const colorClass = color === "emerald" ? "text-emerald-400" : color === "amber" ? "text-amber-400" : "text-white";
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-neutral-500 mt-0.5">{label}</div>
    </div>
  );
}

const CATEGORY_LABELS: Record<AlbumCategory, string> = {
  active: "În lucru",
  delivered: "Predate",
  archived: "Arhivate",
};

function Section({ title, albums, jobStates, expandedDetails, toggleDetails, startProcess, currentCategory, onSetCategory, onDeleteZip, dimmed }: {
  title: string;
  albums: AlbumHealth[];
  jobStates: Record<string, JobState>;
  expandedDetails: Set<string>;
  toggleDetails: (slug: string) => void;
  startProcess: (slug: string, initialWithPreview: number) => void;
  currentCategory: AlbumCategory;
  onSetCategory: (slug: string, category: AlbumCategory) => void;
  onDeleteZip: (slug: string) => Promise<void>;
  dimmed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  if (albums.length === 0) return null;
  const filtered = search.trim()
    ? albums.filter((a) => a.slug.toLowerCase().includes(search.toLowerCase()))
    : albums;
  return (
    <div className={`mb-6 ${dimmed ? "opacity-75" : ""}`}>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-end gap-3 mb-4 group"
      >
        <h2 className={`text-2xl font-bold tracking-tight uppercase ${
          currentCategory === "active" ? "text-yellow-400" :
          currentCategory === "delivered" ? "text-emerald-400" :
          "text-red-400"
        }`}>{title}</h2>
        <div className="flex-1 h-px bg-neutral-800 mb-1" />
        <span className="text-base font-semibold text-neutral-400 mb-0.5">{albums.length} {albums.length === 1 ? "album" : "albume"}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className={`mb-0.5 text-neutral-600 group-hover:text-neutral-400 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {!collapsed && (
        <>
          {albums.length > 1 && (
            <div className="relative mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Caută în ${title.toLowerCase()}...`}
                className="w-full bg-neutral-900 border border-neutral-800 text-sm text-white placeholder-neutral-600 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-neutral-600 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
          )}
        <div className="space-y-2">
          {filtered.map((album) => (
            <AlbumRow
              key={album.slug}
              album={album}
              job={jobStates[album.slug]}
              detailsOpen={expandedDetails.has(album.slug)}
              onToggleDetails={() => toggleDetails(album.slug)}
              onProcess={() => startProcess(album.slug, album.withPreview)}
              onRetry={() => startProcess(album.slug, album.withPreview)}
              onDeleteZip={() => onDeleteZip(album.slug)}
              currentCategory={currentCategory}
              onSetCategory={(cat) => onSetCategory(album.slug, cat)}
            />
          ))}
          {search && filtered.length === 0 && (
            <p className="text-center text-sm text-neutral-600 py-6">Niciun album găsit pentru „{search}"</p>
          )}
        </div>
        </>
      )}
    </div>
  );
}

function AlbumRow({ album, job, detailsOpen, onToggleDetails, onProcess, onRetry, onDeleteZip, currentCategory, onSetCategory }: {
  album: AlbumHealth;
  job?: JobState;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onProcess: () => void;
  onRetry: () => void;
  onDeleteZip: () => Promise<void>;
  currentCategory: AlbumCategory;
  onSetCategory: (cat: AlbumCategory) => void;
}) {
  const isRunning = job?.status === "running";
  const isError = job?.status === "error";
  const isDone = job?.status === "done";
  const [confirmingZipDelete, setConfirmingZipDelete] = useState(false);
  const [deletingZip, setDeletingZip] = useState(false);

  const handleConfirmDeleteZip = async () => {
    setDeletingZip(true);
    await onDeleteZip();
    setDeletingZip(false);
    setConfirmingZipDelete(false);
  };

  const displayWithPreview = isRunning && job
    ? Math.min(job.initialWithPreview + job.progress.done, album.total)
    : album.withPreview;
  const displayCoverage = album.total > 0 ? Math.round((displayWithPreview / album.total) * 100) : album.coverage;

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.log.length]);

  return (
    <div className={`bg-neutral-900 border rounded-lg p-4 transition-colors ${isError ? "border-red-500/30" : "border-neutral-800"}`}>
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">{album.slug}</span>
            <StatusBadge album={album} isDone={isDone} onClickDetails={album.missing > 0 && !isDone ? onToggleDetails : undefined} detailsOpen={detailsOpen} />
            <ZipBadge status={album.zipStatus} zipDate={album.zipDate} />
            {album.zipStatus !== "missing" && !confirmingZipDelete && (
              <button
                onClick={() => setConfirmingZipDelete(true)}
                title="Șterge photos.zip"
                className="inline-flex items-center gap-0.5 p-0.5 rounded text-neutral-600 hover:text-red-400 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            )}
            {confirmingZipDelete && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-neutral-400 whitespace-nowrap">Ștergi ZIP?</span>
                <button
                  onClick={handleConfirmDeleteZip}
                  disabled={deletingZip}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {deletingZip ? "..." : "Da"}
                </button>
                <button
                  onClick={() => setConfirmingZipDelete(false)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium text-neutral-500 hover:text-white transition-colors"
                >
                  Nu
                </button>
              </div>
            )}
            {isError && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400">
                ❌ Eroare
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  displayCoverage === 100 ? "bg-emerald-500" : displayCoverage > 0 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${displayCoverage}%` }}
              />
            </div>
            <span className="text-xs text-neutral-500 whitespace-nowrap">
              {displayWithPreview}/{album.total} · {displayCoverage}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isError && (
            <button onClick={onRetry} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" /></svg>
              Retry
            </button>
          )}
          {!isError && !isDone && album.missing > 0 && (
            <button onClick={onProcess} disabled={isRunning} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-500/15 text-violet-400 text-xs font-medium hover:bg-violet-500/25 transition-colors disabled:opacity-50 whitespace-nowrap">
              {isRunning ? (
                <><svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Procesez...</>
              ) : (
                <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>Procesează ({album.missing} lipsă)</>
              )}
            </button>
          )}

          {import.meta.env.VITE_BUNNY_STORAGE_ZONE_ID && (
            <a
              href={`https://dash.bunny.net/storage/${import.meta.env.VITE_BUNNY_STORAGE_ZONE_ID}/file-manager?path=${album.slug}&page=1`}
              target="_blank"
              rel="noopener noreferrer"
              title="Deschide în Bunny Storage"
              className="p-1.5 rounded-md text-neutral-500 hover:text-orange-400 hover:bg-neutral-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
          {/* Move-to category menu — portal-based to escape stacking contexts */}
          <CategoryMenu currentCategory={currentCategory} onSetCategory={onSetCategory} />
        </div>
      </div>

      {detailsOpen && !isRunning && album.missingFiles.length > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 mb-2">{album.missingFiles.length} poze fără WebP preview:</p>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {album.missingFiles.map((file) => (
              <div key={file} className="text-xs text-neutral-400 font-mono flex items-center gap-1.5">
                <span className="text-red-500/70">✕</span>{file}
              </div>
            ))}
          </div>
        </div>
      )}

      {job && job.log.length > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-800">
          {isError && job.error && (
            <div className="mb-2 text-xs text-red-400 font-medium">Suspendat: {job.error}</div>
          )}
          <div ref={logRef} className="space-y-0.5 max-h-36 overflow-y-auto">
            {job.log.map((line, i) => (
              <div key={i} className="text-xs text-neutral-400 font-mono">{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryMenu({ currentCategory, onSetCategory }: {
  currentCategory: AlbumCategory;
  onSetCategory: (cat: AlbumCategory) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
        title="Mută în categorie"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
        </svg>
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[999] bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl py-1 min-w-[150px]"
            style={{ top: pos.top, right: pos.right }}
          >
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">Mută în</p>
            {(["active", "delivered", "archived"] as AlbumCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => { onSetCategory(cat); setOpen(false); }}
                disabled={cat === currentCategory}
                className="w-full flex items-center gap-3 px-4 py-3 text-base text-left transition-colors disabled:text-neutral-600 disabled:cursor-default hover:bg-neutral-800 hover:text-white text-neutral-300"
              >
                {cat === currentCategory
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  : <span className="w-[13px]" />
                }
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function ZipBadge({ status, zipDate }: { status: "ok" | "stale" | "missing"; zipDate: string | null }) {
  const dateStr = zipDate
    ? new Date(zipDate).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  if (status === "ok") {
    return (
      <span title={`ZIP la zi · ${dateStr}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-400">
        📦 ZIP ✓
      </span>
    );
  }
  if (status === "stale") {
    return (
      <span title={`ZIP depășit · creat ${dateStr}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/15 text-orange-400">
        📦 ZIP depășit
      </span>
    );
  }
  return (
    <span title="photos.zip lipsește" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-700/50 text-neutral-500">
      📦 ZIP lipsă
    </span>
  );
}

function StatusBadge({ album, isDone, onClickDetails, detailsOpen }: {
  album: AlbumHealth;
  isDone?: boolean;
  onClickDetails?: () => void;
  detailsOpen?: boolean;
}) {
  if (album.coverage === 100 || isDone) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
        ✓ Complet
      </span>
    );
  }
  const chevron = (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${detailsOpen ? "rotate-180" : ""}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
  if (!album.hasPreviewFolder || album.total === 0) {
    return (
      <button onClick={onClickDetails} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
        ✕ Fără preview {chevron}
      </button>
    );
  }
  return (
    <button onClick={onClickDetails} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors">
      ⚠ Parțial · {album.missing} lipsă {chevron}
    </button>
  );
}
