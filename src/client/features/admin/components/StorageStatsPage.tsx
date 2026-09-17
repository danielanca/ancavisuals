import React, { useEffect, useState } from "react";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";
import AncaLoader from "../../../components/UI/AncaLoader";

type StorageFileType = "image" | "video" | "archive" | "document" | "other";

interface StorageFolder {
  folder: string;
  files: number;
  bytes: number;
  videoFiles: number;
  videoBytes: number;
}

interface StorageStats {
  computedAt: string;
  totalFiles: number;
  totalBytes: number;
  byType: Record<StorageFileType, { files: number; bytes: number }>;
  byFolder: StorageFolder[];
}

const TYPE_LABELS: Record<StorageFileType, { label: string; color: string }> = {
  image: { label: "Poze", color: "text-emerald-400" },
  video: { label: "Video", color: "text-sky-400" },
  archive: { label: "Arhive (.zip)", color: "text-amber-400" },
  document: { label: "Documente", color: "text-violet-400" },
  other: { label: "Altele", color: "text-neutral-400" },
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(gb >= 100 ? 0 : 1)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

// Preț de listă Bunny Storage: ~$0.01 / GB / lună. Estimare orientativă — verifică dashboard-ul Bunny pentru factura reală.
const BUNNY_STORAGE_PRICE_PER_GB = 0.01;

const INITIAL_FOLDER_LIMIT = 15;

export default function StorageStatsPage() {
  const { auth } = useAuth();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllFolders, setShowAllFolders] = useState(false);

  async function load(refresh: boolean) {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/storage-stats${refresh ? "?refresh=true" : ""}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as StorageStats;
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la scanarea Bunny Storage.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!auth.accessToken) return;
    void load(false);
  }, [auth.accessToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <AncaLoader />
      </div>
    );
  }

  const maxFolderBytes = stats?.byFolder[0]?.bytes ?? 0;
  const visibleFolders = stats ? (showAllFolders ? stats.byFolder : stats.byFolder.slice(0, INITIAL_FOLDER_LIMIT)) : [];
  const videoFolders = stats
    ? stats.byFolder.filter((f) => f.videoFiles > 0).sort((a, b) => b.videoBytes - a.videoBytes)
    : [];
  const storageCostMonthly = stats ? (stats.totalBytes / 1024 ** 3) * BUNNY_STORAGE_PRICE_PER_GB : 0;
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthsRemainingInYear = 12 - now.getMonth();

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumb />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-light tracking-tight">Stocare Bunny</h1>
            {stats && (
              <p className="text-xs text-neutral-500 mt-1">Actualizat {formatDateTime(stats.computedAt)}</p>
            )}
          </div>
          <button
            onClick={() => void load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-700 text-neutral-400 rounded-lg hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-50"
          >
            {refreshing ? "Se scanează..." : "Rescanează"}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {stats && (
          <>
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Total folosit</p>
              <p className="text-3xl font-semibold text-white">{formatBytes(stats.totalBytes)}</p>
              <p className="text-xs text-neutral-600 mt-1">{stats.totalFiles.toLocaleString("ro-RO")} fișiere · {stats.byFolder.length} foldere</p>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-amber-200/70 uppercase tracking-widest">Cost estimat stocare Bunny</p>
                <p className="text-xs text-amber-200/50">~${BUNNY_STORAGE_PRICE_PER_GB.toFixed(2)}/GB/lună</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-amber-200/60 mb-0.5">Lunar</p>
                  <p className="text-lg font-semibold text-amber-300">{formatUsd(storageCostMonthly)}</p>
                </div>
                <div>
                  <p className="text-xs text-amber-200/60 mb-0.5">Semestrial (6 luni)</p>
                  <p className="text-lg font-semibold text-amber-300">{formatUsd(storageCostMonthly * 6)}</p>
                </div>
                <div>
                  <p className="text-xs text-amber-200/60 mb-0.5">Anual (12 luni)</p>
                  <p className="text-lg font-semibold text-amber-300">{formatUsd(storageCostMonthly * 12)}</p>
                </div>
                <div>
                  <p className="text-xs text-amber-200/60 mb-0.5">Până la 31 dec {currentYear} ({monthsRemainingInYear} luni)</p>
                  <p className="text-lg font-semibold text-amber-300">{formatUsd(storageCostMonthly * monthsRemainingInYear)}</p>
                </div>
              </div>
              <p className="text-xs text-amber-200/50">Presupune că mărimea stocată rămâne constantă. Nu include traficul CDN (bandwidth) — doar stocarea.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(Object.keys(TYPE_LABELS) as StorageFileType[]).map((type) => {
                const data = stats.byType[type];
                const { label, color } = TYPE_LABELS[type];
                return (
                  <div key={type} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                    <p className="text-xs text-neutral-500 mb-1">{label}</p>
                    <p className={`text-lg font-semibold ${color}`}>{formatBytes(data.bytes)}</p>
                    <p className="text-xs text-neutral-600 mt-0.5">{data.files.toLocaleString("ro-RO")} fișiere</p>
                  </div>
                );
              })}
            </div>

            {videoFolders.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-neutral-400 mb-3">Unde sunt video-urile</h2>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl divide-y divide-neutral-800/60">
                  {videoFolders.map(({ folder, videoFiles, videoBytes }) => (
                    <div key={folder} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm text-neutral-200 truncate">{folder}</p>
                        <p className="text-xs text-sky-400 mt-0.5">{videoFiles.toLocaleString("ro-RO")} video · {formatBytes(videoBytes)}</p>
                      </div>
                      <a
                        href={`/media/${folder}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs border border-sky-500/40 text-sky-300 rounded-lg hover:border-sky-400 hover:bg-sky-500/10 transition-colors"
                      >
                        Deschide albumul
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm font-medium text-neutral-400 mb-3">Foldere după mărime</h2>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl divide-y divide-neutral-800/60">
                {visibleFolders.map(({ folder, files, bytes }) => (
                  <div key={folder} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-sm text-neutral-200 truncate">{folder}</span>
                      <span className="text-sm text-neutral-400 shrink-0">{formatBytes(bytes)} · {files.toLocaleString("ro-RO")} fișiere</span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${maxFolderBytes > 0 ? Math.max(2, Math.round((bytes / maxFolderBytes) * 100)) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {stats.byFolder.length > INITIAL_FOLDER_LIMIT && (
                <button
                  onClick={() => setShowAllFolders((v) => !v)}
                  className="w-full text-xs text-neutral-500 hover:text-neutral-300 transition-colors py-2"
                >
                  {showAllFolders ? "Arată mai puține" : `Arată toate (${stats.byFolder.length})`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
