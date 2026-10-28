/*
 * Purpose: /admin/instagram-proposals/albume — albums (confirmed/finished events) that don't have
 * enough photos proposed for Instagram and for Media Assets yet, emptiest first, with who already
 * proposed and links to open the album and propose. The minimums are set on the page (kept in
 * this browser). Server: GET /api/instagram-proposals/admin/album-coverage.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import {
  albumsNeedingProposals, DEFAULT_COVERAGE_MINIMUMS, type AlbumProposalCoverage, type CoverageMinimums,
} from "../../../../shared/media/albumProposalCoverage";

const MINIMUMS_KEY = "albumProposalCoverage:minimums";
type Filter = "all" | "instagram" | "media";

function readMinimums(): CoverageMinimums {
  try {
    const stored = JSON.parse(localStorage.getItem(MINIMUMS_KEY) ?? "null") as Partial<CoverageMinimums> | null;
    return {
      instagram: Number.isFinite(stored?.instagram) ? Number(stored!.instagram) : DEFAULT_COVERAGE_MINIMUMS.instagram,
      mediaAssets: Number.isFinite(stored?.mediaAssets) ? Number(stored!.mediaAssets) : DEFAULT_COVERAGE_MINIMUMS.mediaAssets,
    };
  } catch {
    return DEFAULT_COVERAGE_MINIMUMS;
  }
}

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" }) : "—");
const personLabel = (id: string) => (id.includes("@") ? id.split("@")[0] : id.charAt(0).toUpperCase() + id.slice(1));

function Meter({ label, value, min, tone }: { label: string; value: number; min: number; tone: "pink" | "sky" }) {
  const ok = value >= min;
  const pct = min > 0 ? Math.min(100, Math.round((value / min) * 100)) : 100;
  const bar = ok ? "bg-emerald-500" : tone === "pink" ? "bg-pink-500" : "bg-sky-500";
  return (
    <div className="min-w-[150px] flex-1 space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-neutral-400">{label}</span>
        <span className={ok ? "text-emerald-300" : "font-semibold text-amber-200"}>{value}/{min}{ok ? " ✓" : ` · lipsesc ${min - value}`}</span>
      </div>
      <div className="h-1.5 bg-neutral-800"><div className={`h-1.5 ${bar}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function AlbumProposalCoveragePage() {
  const [albums, setAlbums] = useState<AlbumProposalCoverage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minimums, setMinimums] = useState<CoverageMinimums>(readMinimums);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [showComplete, setShowComplete] = useState(false);

  useEffect(() => {
    fetch("/api/instagram-proposals/admin/album-coverage")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Eroare ${res.status}`);
        setAlbums(data.albums as AlbumProposalCoverage[]);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Nu am putut încărca albumele."));
  }, []);

  const changeMinimum = (key: keyof CoverageMinimums, value: string) => {
    const next = { ...minimums, [key]: Math.max(0, Math.min(500, Math.round(Number(value) || 0))) };
    setMinimums(next);
    try { localStorage.setItem(MINIMUMS_KEY, JSON.stringify(next)); } catch { /* just not remembered */ }
  };

  const needing = useMemo(() => (albums ? albumsNeedingProposals(albums, minimums) : []), [albums, minimums]);
  const visible = useMemo(() => {
    const base = showComplete && albums
      ? [...needing, ...albums.filter((album) => !needing.includes(album)).sort((a, b) => String(b.eventDate ?? "").localeCompare(String(a.eventDate ?? "")))]
      : needing;
    const q = query.trim().toLowerCase();
    return base
      .filter((album) => filter === "all" || (filter === "instagram" ? album.instagram < minimums.instagram : album.mediaAssets < minimums.mediaAssets))
      .filter((album) => !q || `${album.name} ${album.slug}`.toLowerCase().includes(q));
  }, [albums, needing, showComplete, filter, query, minimums]);

  const missingInstagram = needing.filter((album) => album.instagram < minimums.instagram).length;
  const missingMedia = needing.filter((album) => album.mediaAssets < minimums.mediaAssets).length;
  const numberInput = "w-16 border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white focus:border-white focus:outline-none";

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <Breadcrumb />
      <div>
        <h1 className="text-2xl font-light tracking-tight text-white">Albume cu puține propuneri</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Albumele evenimentelor confirmate care nu au încă destule poze propuse pentru Instagram sau Media Assets. Se numără pozele
          diferite (aceeași poză propusă de mai mulți contează o dată), fără cele respinse.{" "}
          <Link to="/admin/instagram-proposals" className="underline hover:text-white">← Propuneri Media</Link>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-300">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Minim pe album</span>
        <label className="flex items-center gap-2">📸 Instagram <input type="number" min={0} value={minimums.instagram} onChange={(e) => changeMinimum("instagram", e.target.value)} className={numberInput} aria-label="Minim Instagram" /></label>
        <label className="flex items-center gap-2">🗂️ Media Assets <input type="number" min={0} value={minimums.mediaAssets} onChange={(e) => changeMinimum("mediaAssets", e.target.value)} className={numberInput} aria-label="Minim Media Assets" /></label>
      </div>

      {albums && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-[11px] uppercase tracking-wider text-amber-200/70">Albume sub minim</p>
            <p className="text-2xl font-light text-amber-100">{needing.length} <span className="text-sm text-neutral-400">din {albums.length}</span></p>
          </div>
          <div className="border border-pink-500/40 bg-pink-500/10 p-3">
            <p className="text-[11px] uppercase tracking-wider text-pink-200/70">Le lipsește Instagram</p>
            <p className="text-2xl font-light text-pink-100">{missingInstagram}</p>
          </div>
          <div className="border border-sky-500/40 bg-sky-500/10 p-3">
            <p className="text-[11px] uppercase tracking-wider text-sky-200/70">Le lipsește Media Assets</p>
            <p className="text-2xl font-light text-sky-100">{missingMedia}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută album sau client…" aria-label="Caută album" className="min-w-[200px] flex-1 border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-white focus:outline-none" />
        {([["all", "Toate"], ["instagram", "Lipsă Instagram"], ["media", "Lipsă Media Assets"]] as [Filter, string][]).map(([value, text]) => (
          <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`border px-3 py-2 text-xs ${filter === value ? "border-white bg-white text-neutral-950" : "border-neutral-700 text-neutral-300 hover:border-white"}`}>{text}</button>
        ))}
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={showComplete} onChange={(e) => setShowComplete(e.target.checked)} /> Arată și albumele complete
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {!albums && !error && <p className="text-sm text-neutral-500">Se încarcă albumele…</p>}
      {albums && visible.length === 0 && <p className="text-sm text-emerald-300">Toate albumele au destule propuneri. 🎉</p>}

      <ul className="space-y-2" aria-label="Albume">
        {visible.map((album) => (
          <li key={album.slug} aria-label={album.name} className="space-y-3 border border-neutral-800 bg-neutral-900 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{album.name}</p>
                <p className="text-xs text-neutral-500">{formatDate(album.eventDate)} · <span className="font-mono">{album.slug}</span></p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <a href={`/media/${album.slug}`} target="_blank" rel="noreferrer" className="border border-neutral-700 px-2.5 py-1 text-neutral-200 hover:border-white">Deschide albumul ↗</a>
                <Link to={`/admin/instagram-proposals/selectie-comuna?album=${encodeURIComponent(album.slug)}`} className="border border-neutral-700 px-2.5 py-1 text-neutral-200 hover:border-white">Selecție comună</Link>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <Meter label="📸 Instagram" value={album.instagram} min={minimums.instagram} tone="pink" />
              <Meter label="🗂️ Media Assets" value={album.mediaAssets} min={minimums.mediaAssets} tone="sky" />
            </div>
            <p className="text-xs text-neutral-500">
              {album.people.length ? `Au propus: ${album.people.map(personLabel).join(", ")}` : "Nimeni n-a propus încă."}
              {album.accepted ? ` · ${album.accepted} acceptate` : ""}
              {album.lastProposedAt ? ` · ultima propunere ${formatDate(album.lastProposedAt)}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
