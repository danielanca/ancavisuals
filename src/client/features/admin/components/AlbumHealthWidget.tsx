import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";

type AlbumCategory = "active" | "delivered" | "archived";
type ZipStatus = "ok" | "stale" | "missing";

interface AlbumEntry {
  slug: string;
  zipStatus: ZipStatus;
}

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

function getAutoCategory(slug: string, today: Date): AlbumCategory {
  const date = parseSlugDate(slug);
  if (!date) return "active";
  return date < today ? "delivered" : "active";
}

interface WidgetState {
  total: number;
  ok: number;
  issues: AlbumEntry[];
}

export default function AlbumHealthWidget() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<WidgetState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${auth.accessToken}` };

    const localCategories: Record<string, AlbumCategory> = (() => {
      try { return JSON.parse(localStorage.getItem("album-health-categories") ?? "{}") as Record<string, AlbumCategory>; } catch { return {}; }
    })();

    Promise.all([
      fetch("/api/admin/album-health", { headers }).then((r) => r.json()),
      fetch("/api/admin/album-health/categories", { headers }).then((r) => r.json()),
    ])
      .then(([healthData, categoriesData]: [{ albums?: AlbumEntry[] }, Record<string, AlbumCategory>]) => {
        const albums = healthData.albums ?? [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const allCategories = { ...localCategories, ...categoriesData };

        const getCategory = (slug: string): AlbumCategory =>
          allCategories[slug] ?? getAutoCategory(slug, today);

        const nonArchived = albums.filter((album) => getCategory(album.slug) !== "archived");
        const issues = nonArchived.filter((album) => album.zipStatus !== "ok");

        setState({
          total: nonArchived.length,
          ok: nonArchived.length - issues.length,
          issues,
        });
      })
      .catch(() => setState(null))
      .finally(() => setLoading(false));
  }, [auth.accessToken]);

  if (loading) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 animate-pulse">
        <div className="h-4 w-36 bg-neutral-800 rounded mb-3" />
        <div className="h-8 w-16 bg-neutral-800 rounded mb-2" />
        <div className="h-3 w-48 bg-neutral-800 rounded" />
      </div>
    );
  }

  if (!state) return null;

  const hasIssues = state.issues.length > 0;

  return (
    <div
      className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 cursor-pointer hover:border-neutral-700 transition-colors"
      onClick={() => navigate("/admin/album-health")}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Sănătate Albume</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      <div className="flex items-end gap-4 mb-3">
        <div>
          <div className={`text-2xl font-bold ${hasIssues ? "text-amber-400" : "text-emerald-400"}`}>
            {hasIssues ? state.issues.length : state.ok}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {hasIssues ? `ZIP ${state.issues.length === 1 ? "problemă" : "probleme"}` : "ZIP OK"}
          </div>
        </div>
        <div className="mb-1 text-xs text-neutral-600">
          din {state.total} {state.total === 1 ? "album" : "albume"}
        </div>
      </div>

      {hasIssues && (
        <div className="space-y-1 border-t border-neutral-800 pt-3">
          {state.issues.slice(0, 4).map((album) => (
            <div key={album.slug} className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-mono truncate">{album.slug}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                album.zipStatus === "missing"
                  ? "bg-neutral-700/50 text-neutral-500"
                  : "bg-orange-500/15 text-orange-400"
              }`}>
                {album.zipStatus === "missing" ? "lipsă" : "depășit"}
              </span>
            </div>
          ))}
          {state.issues.length > 4 && (
            <p className="text-[10px] text-neutral-600 pt-0.5">
              +{state.issues.length - 4} mai multe
            </p>
          )}
        </div>
      )}

      {!hasIssues && (
        <div className="text-xs text-neutral-600">
          Toate ZIP-urile sunt la zi
        </div>
      )}
    </div>
  );
}
