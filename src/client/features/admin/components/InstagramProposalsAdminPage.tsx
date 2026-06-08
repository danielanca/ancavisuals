import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";

type ProposalStatus = "pending" | "accepted" | "archived" | "rejected";
type Tab = "pending" | "all" | "accepted" | "rejected" | "archived";
type ProposalDestination = "instagram" | "media_assets";

type InstagramProposal = {
  id: string;
  albumSlug: string;
  photoUrl: string;
  originalPhotoUrl?: string;
  fileName: string;
  proposedBy: string;
  proposedAt: string;
  status: ProposalStatus;
  destinations?: ProposalDestination[];
  mediaAssetServiceIds?: string[];
};

type GroupedProposal = {
  key: string;
  albumSlug: string;
  fileName: string;
  photoUrl: string;
  originalPhotoUrl?: string;
  proposedBy: string[];
  ids: string[];
  status: ProposalStatus;
  destinations: ProposalDestination[];
};

const STATUS_PRIORITY: Record<ProposalStatus, number> = { pending: 4, accepted: 3, archived: 2, rejected: 1 };

function groupByPhoto(proposals: InstagramProposal[]): GroupedProposal[] {
  const map = new Map<string, GroupedProposal>();
  for (const p of proposals) {
    const key = `${p.albumSlug}::${p.fileName}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        albumSlug: p.albumSlug,
        fileName: p.fileName,
        photoUrl: p.photoUrl,
        originalPhotoUrl: p.originalPhotoUrl,
        proposedBy: [],
        ids: [],
        status: p.status,
        destinations: [],
      });
    }
    const group = map.get(key)!;
    group.ids.push(p.id);
    if (!group.proposedBy.includes(p.proposedBy)) group.proposedBy.push(p.proposedBy);
    for (const dest of (p.destinations ?? ["instagram"] as ProposalDestination[])) {
      if (!group.destinations.includes(dest)) group.destinations.push(dest);
    }
    if (STATUS_PRIORITY[p.status] > STATUS_PRIORITY[group.status]) group.status = p.status;
  }
  return Array.from(map.values());
}

function formatProposedBy(emails: string[]): string {
  const names = emails.map((e) => e.split("@")[0]);
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + " și " + names[names.length - 1];
}

const STATUS_LABEL: Record<ProposalStatus, string> = {
  pending:  "În așteptare",
  accepted: "Acceptat",
  archived: "Arhivat",
  rejected: "Respins",
};

const STATUS_BADGE: Record<ProposalStatus, string> = {
  pending:  "bg-indigo-900/60 text-indigo-300",
  accepted: "bg-cyan-900/60 text-cyan-300",
  archived: "bg-green-900/60 text-green-300",
  rejected: "bg-red-900/60 text-red-400",
};

function triggerDownload(url: string, fileName: string): Promise<void> {
  const normalizedFileName = fileName.replace(/\.webp$/i, ".jpg") || "photo.jpg";
  return fetch(url)
    .then((r) => r.blob())
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = normalizedFileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    })
    .catch(() => { window.open(url, "_blank"); });
}

// ─── Pending card — list layout on mobile, grid on desktop ───────────────────

function PendingCard({
  group,
  busy,
  accepted,
  onAccept,
  onReject,
  onDelete,
}: {
  group: GroupedProposal;
  busy: boolean;
  accepted: boolean;
  onAccept: (destinations: ProposalDestination[]) => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const [acceptDests, setAcceptDests] = useState<Set<ProposalDestination>>(
    new Set(group.destinations.length > 0 ? group.destinations : ["instagram"])
  );

  function toggleDest(dest: ProposalDestination) {
    setAcceptDests(prev => {
      const next = new Set(prev);
      next.has(dest) ? next.delete(dest) : next.add(dest);
      return next;
    });
  }

  const nameDisplay = formatProposedBy(group.proposedBy);
  const isJoint = group.proposedBy.length > 1;

  return (
    <div className={`bg-neutral-950 border rounded-xl overflow-hidden ${accepted ? "border-cyan-900/60" : "border-neutral-800"}`}>
      <div className="flex sm:flex-col">
        <div className="relative flex-shrink-0 w-28 sm:w-full">
          <img
            src={group.originalPhotoUrl ?? group.photoUrl}
            alt={group.fileName}
            className="w-full h-28 sm:h-auto sm:aspect-square object-cover block"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          {accepted && (
            <div className="absolute inset-0 bg-black/65 flex items-center justify-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-cyan-300 text-2xl font-bold leading-none">✓</span>
                <span className="text-cyan-300 text-[10px] font-semibold tracking-wide uppercase">Acceptat</span>
              </div>
            </div>
          )}
          {!accepted && (isJoint ? (
            <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[9px] text-amber-300 font-semibold bg-amber-950/80 rounded px-1 py-0.5 text-center leading-tight">
              {nameDisplay}
            </span>
          ) : (
            <span className="absolute bottom-1.5 left-1.5 text-[10px] text-white/60 truncate max-w-[80px]">
              {nameDisplay}
            </span>
          ))}
        </div>

        <div className="flex-1 flex flex-col justify-between p-3 gap-2 sm:p-2.5">
          <a
            href={`/media/${group.albumSlug}`}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 text-xs font-semibold truncate hover:text-indigo-300 transition-colors"
          >
            {group.albumSlug}
          </a>

          {accepted ? (
            <div className="flex gap-1 flex-wrap">
              {group.destinations.map((destination) => (
                <span
                  key={destination}
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    destination === "media_assets" ? "bg-teal-950/60 text-teal-300" : "bg-fuchsia-950/60 text-fuchsia-300"
                  }`}
                >
                  {destination === "media_assets" ? "Media Assets" : "Instagram"}
                </span>
              ))}
            </div>
          ) : accepting ? (
            <>
              <div className="flex gap-1.5 flex-wrap">
                {(["instagram", "media_assets"] as ProposalDestination[]).map(dest => {
                  const active = acceptDests.has(dest);
                  return (
                    <button
                      key={dest}
                      type="button"
                      onClick={() => toggleDest(dest)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                        dest === "media_assets"
                          ? active ? "bg-teal-900/60 text-teal-300 border-teal-700" : "bg-transparent text-teal-700 border-teal-900"
                          : active ? "bg-fuchsia-900/60 text-fuchsia-300 border-fuchsia-700" : "bg-transparent text-fuchsia-800 border-fuchsia-950"
                      }`}
                    >
                      {dest === "media_assets" ? "Media Assets" : "Instagram"}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 sm:gap-1.5">
                <button
                  onClick={() => { onAccept(Array.from(acceptDests)); setAccepting(false); }}
                  disabled={busy || acceptDests.size === 0}
                  className="flex-1 py-2.5 sm:py-2 rounded-lg text-xs font-bold bg-cyan-900/50 text-cyan-300 hover:bg-cyan-800/60 transition-colors disabled:opacity-40 active:scale-95"
                >
                  {busy ? "..." : "Confirmă"}
                </button>
                <button
                  onClick={() => setAccepting(false)}
                  disabled={busy}
                  className="px-3 py-2.5 sm:py-2 rounded-lg text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors disabled:opacity-40"
                >
                  ✕
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-1 flex-wrap">
                {group.destinations.map((destination) => (
                  <span
                    key={destination}
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      destination === "media_assets" ? "bg-teal-950/60 text-teal-300" : "bg-fuchsia-950/60 text-fuchsia-300"
                    }`}
                  >
                    {destination === "media_assets" ? "Media Assets" : "Instagram"}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 sm:gap-1.5">
                <button
                  onClick={() => setAccepting(true)}
                  disabled={busy}
                  className="flex-1 py-2.5 sm:py-2 rounded-lg text-xs font-bold bg-cyan-900/50 text-cyan-300 hover:bg-cyan-800/60 transition-colors disabled:opacity-40 active:scale-95"
                >
                  Acceptă
                </button>
                <button
                  onClick={onReject}
                  disabled={busy}
                  className="flex-1 py-2.5 sm:py-2 rounded-lg text-xs font-bold bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors disabled:opacity-40 active:scale-95"
                >
                  Respinge
                </button>
                <button
                  onClick={onDelete}
                  disabled={busy}
                  className="px-3 py-2.5 sm:py-2 rounded-lg text-xs text-neutral-600 hover:text-red-400 hover:bg-neutral-800 transition-colors disabled:opacity-40"
                  title="Șterge"
                >
                  ✕
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Accepted card ────────────────────────────────────────────────────────────

function AcceptedCard({
  proposal,
  wasDownloaded,
  busy,
  onDownload,
  onArchive,
  onDelete,
}: {
  proposal: InstagramProposal;
  wasDownloaded: boolean;
  busy: boolean;
  onDownload: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
      <div className="relative">
        <img
          src={proposal.originalPhotoUrl ?? proposal.photoUrl}
          alt={proposal.fileName}
          className="w-full aspect-square object-cover block"
          loading="lazy"
        />
        <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-900/70 text-cyan-300">
          Acceptat
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <a
          href={`/media/${proposal.albumSlug}`}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-400 text-xs font-semibold truncate hover:text-indigo-300 transition-colors"
        >
          {proposal.albumSlug}
        </a>
        <div className="flex gap-1 flex-wrap">
          {(proposal.destinations ?? ["instagram"]).map((destination) => (
            <span
              key={destination}
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                destination === "media_assets" ? "bg-teal-950/60 text-teal-300" : "bg-fuchsia-950/60 text-fuchsia-300"
              }`}
            >
              {destination === "media_assets" ? "Media Assets" : "Instagram"}
            </span>
          ))}
        </div>
        <p className="text-neutral-600 text-xs truncate">{proposal.proposedBy}</p>
        <button
          onClick={onDownload}
          className="w-full py-2.5 rounded-lg text-xs font-bold bg-blue-600/80 text-white hover:bg-blue-600 transition-colors active:scale-95"
        >
          ↓ Descarcă
        </button>
        <div className="flex gap-2">
          <button
            onClick={onArchive}
            disabled={!wasDownloaded || busy}
            title={wasDownloaded ? "Mută în Arhivate" : "Descarcă mai întâi"}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors active:scale-95 ${
              wasDownloaded
                ? "bg-green-950/60 text-green-400 border border-green-900/50 hover:bg-green-900/40"
                : "bg-neutral-900 text-neutral-700 border border-neutral-800 cursor-not-allowed"
            }`}
          >
            {busy ? "..." : "✓ Arhivează"}
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-xs text-neutral-600 border border-neutral-800 hover:text-red-400 hover:border-red-900/50 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Album group header ───────────────────────────────────────────────────────

function AlbumGroupHeader({
  albumSlug,
  count,
  label,
  labelColor,
  isCollapsed,
  onToggle,
}: {
  albumSlug: string;
  count: number;
  label: string;
  labelColor: string;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none border-b border-neutral-800/50"
    >
      <span className="text-xs text-neutral-600">{isCollapsed ? "▶" : "▼"}</span>
      <a
        href={`/media/${albumSlug}`}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-indigo-400 text-sm font-semibold flex-1 hover:text-indigo-300 transition-colors truncate"
      >
        {albumSlug}
      </a>
      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${labelColor}`}>
        {count} {label}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InstagramProposalsAdminPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<InstagramProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [collapsedAlbums, setCollapsedAlbums] = useState<Set<string>>(new Set());
  const [allStatusFilter, setAllStatusFilter] = useState<ProposalStatus | "all">("all");
  const [destinationFilter, setDestinationFilter] = useState<ProposalDestination | "all">("all");
  const [allAlbumFilter, setAllAlbumFilter] = useState("all");
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const [acceptedInSession, setAcceptedInSession] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.accessToken) return;
    setLoading(true);
    setFetchError(null);
    fetch("/api/instagram-proposals/admin/all", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then(async (response) => {
        const data = await response.json() as { proposals?: InstagramProposal[]; error?: string };
        if (!response.ok) { setFetchError(data.error ?? `HTTP ${response.status}`); return; }
        setProposals(data.proposals ?? []);
      })
      .catch((err: unknown) => setFetchError(String(err)))
      .finally(() => setLoading(false));
  }, [auth.accessToken, refreshKey]);

  const updateStatus = async (id: string, status: ProposalStatus, destinations?: ProposalDestination[]) => {
    if (!auth.accessToken) return;
    setUpdatingId(id);
    try {
      const body: Record<string, unknown> = { status };
      if (destinations) body.destinations = destinations;
      await fetch(`/api/instagram-proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify(body),
      });
      setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status, ...(destinations ? { destinations } : {}) } : p)));
    } catch { } finally { setUpdatingId(null); }
  };

  const updateStatusGroup = async (groupKey: string, ids: string[], status: ProposalStatus, destinations?: ProposalDestination[]) => {
    if (!auth.accessToken) return;
    setUpdatingId(groupKey);
    try {
      const body: Record<string, unknown> = { status };
      if (destinations) body.destinations = destinations;
      await Promise.all(ids.map((id) =>
        fetch(`/api/instagram-proposals/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
          body: JSON.stringify(body),
        })
      ));
      setProposals((prev) => prev.map((p) => ids.includes(p.id) ? { ...p, status, ...(destinations ? { destinations } : {}) } : p));
      if (status === "accepted") setAcceptedInSession((prev) => new Set([...prev, groupKey]));
    } catch { } finally { setUpdatingId(null); }
  };

  const deleteProposal = async (id: string) => {
    if (!auth.accessToken) return;
    setUpdatingId(id);
    try {
      await fetch(`/api/instagram-proposals/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setProposals((prev) => prev.filter((p) => p.id !== id));
    } catch { } finally { setUpdatingId(null); }
  };

  const deleteProposalGroup = async (groupKey: string, ids: string[]) => {
    if (!auth.accessToken) return;
    setUpdatingId(groupKey);
    try {
      await Promise.all(ids.map((id) =>
        fetch(`/api/instagram-proposals/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        })
      ));
      setProposals((prev) => prev.filter((p) => !ids.includes(p.id)));
    } catch { } finally { setUpdatingId(null); }
  };

  const [deletingAll, setDeletingAll] = useState<ProposalStatus | null>(null);

  const deleteAllByStatus = async (status: ProposalStatus) => {
    if (!auth.accessToken) return;
    setDeletingAll(status);
    try {
      await fetch(`/api/instagram-proposals/admin/bulk?status=${status}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setProposals((prev) => prev.filter((p) => p.status !== status));
    } catch { } finally { setDeletingAll(null); }
  };

  const handleDownload = async (proposal: InstagramProposal) => {
    await triggerDownload(proposal.originalPhotoUrl ?? proposal.photoUrl, proposal.fileName);
    setDownloaded((prev) => new Set(prev).add(proposal.id));
  };

  const toggleAlbum = (slug: string) =>
    setCollapsedAlbums((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });

  const byStatus = (s: ProposalStatus) => proposals.filter((p) => p.status === s);

  const groupByAlbum = (list: InstagramProposal[]) => {
    const grouped: Record<string, InstagramProposal[]> = {};
    for (const p of list) {
      if (!grouped[p.albumSlug]) grouped[p.albumSlug] = [];
      grouped[p.albumSlug].push(p);
    }
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  };

  const albums = useMemo(
    () => Array.from(new Set(proposals.map((p) => p.albumSlug))).sort(),
    [proposals],
  );

  const allFiltered = useMemo(
    () => proposals.filter((p) => {
      const matchesStatus = allStatusFilter === "all" || p.status === allStatusFilter;
      const matchesDestination = destinationFilter === "all" || (p.destinations ?? ["instagram"]).includes(destinationFilter);
      const matchesAlbum = allAlbumFilter === "all" || p.albumSlug === allAlbumFilter;
      return matchesStatus && matchesDestination && matchesAlbum;
    }),
    [proposals, allStatusFilter, destinationFilter, allAlbumFilter],
  );

  const counts = {
    pending:  byStatus("pending").length,
    accepted: byStatus("accepted").length,
    archived: byStatus("archived").length,
    rejected: byStatus("rejected").length,
  };

  const TABS: { key: Tab; label: string; count?: number; accentBg?: string }[] = [
    { key: "pending",  label: "În așteptare", count: counts.pending,  accentBg: "bg-orange-500" },
    { key: "all",      label: "Toate" },
    { key: "accepted", label: "Acceptate",    count: counts.accepted,  accentBg: "bg-cyan-500" },
    { key: "rejected", label: "Respinse",     count: counts.rejected,  accentBg: "bg-red-500" },
    { key: "archived", label: "Arhivate",     count: counts.archived },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Breadcrumb />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-light text-white">Propuneri Media</h1>
            {counts.pending > 0 && (
              <span className="bg-orange-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {counts.pending} noi
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 text-xs font-medium hover:bg-neutral-700 hover:text-white transition-colors disabled:opacity-40"
              title="Reîncarcă propunerile"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              Refresh
            </button>
            {counts.pending > 0 && (
              <button
                onClick={() => navigate("/admin/swipe-proposals")}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-400 text-xs font-medium hover:bg-violet-500/25 transition-colors border border-violet-500/20"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Folosește Swiper-ul
              </button>
            )}
          </div>
        </div>

        {/* Tabs — scrollable on mobile */}
        <div
          ref={tabsRef}
          className="flex gap-1 bg-neutral-900 rounded-xl p-1 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {TABS.map(({ key, label, count, accentBg }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === key
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === key && accentBg
                    ? `${accentBg} text-white`
                    : "bg-neutral-700 text-neutral-400"
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {fetchError && (
          <div className="bg-red-950/50 border border-red-900 rounded-xl px-4 py-3 text-sm text-red-400">
            Eroare: {fetchError}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="aspect-square rounded-xl bg-neutral-900 animate-pulse" />
            ))}
          </div>
        )}

        {/* ── PENDING ── */}
        {!loading && tab === "pending" && (() => {
          const visiblePending = proposals.filter(
            (p) => p.status === "pending" || acceptedInSession.has(`${p.albumSlug}::${p.fileName}`)
          );
          const albumGroups = groupByAlbum(visiblePending);
          if (albumGroups.length === 0) {
            return (
              <div className="text-center py-16 text-neutral-600 text-sm">
                Nicio propunere în așteptare.
              </div>
            );
          }
          return albumGroups.map(([albumSlug, albumProposals]) => {
            const photoGroups = groupByPhoto(albumProposals);
            return (
              <div key={albumSlug} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                <AlbumGroupHeader
                  albumSlug={albumSlug}
                  count={photoGroups.length}
                  label={photoGroups.length !== albumProposals.length ? `poze (${albumProposals.length} propuneri)` : "propuneri"}
                  labelColor="bg-orange-500/20 text-orange-400"
                  isCollapsed={collapsedAlbums.has(albumSlug)}
                  onToggle={() => toggleAlbum(albumSlug)}
                />
                {!collapsedAlbums.has(albumSlug) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-neutral-800">
                    {photoGroups.map((group) => (
                      <div key={group.key} className="bg-neutral-950">
                        <PendingCard
                          group={group}
                          busy={updatingId === group.key}
                          accepted={acceptedInSession.has(group.key)}
                          onAccept={(destinations) => updateStatusGroup(group.key, group.ids, "accepted", destinations)}
                          onReject={() => updateStatusGroup(group.key, group.ids, "rejected")}
                          onDelete={() => deleteProposalGroup(group.key, group.ids)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          });
        })()}

        {/* ── ACCEPTATE ── */}
        {!loading && tab === "accepted" && (() => {
          const accepted = byStatus("accepted");
          if (accepted.length === 0) {
            return <div className="text-center py-16 text-neutral-600 text-sm">Nicio poză acceptată.</div>;
          }
          return (
            <>
              <div className="flex items-center justify-between">
                <p className="text-neutral-600 text-xs">
                  Descarcă poza — butonul „Mută în Arhivate" se activează după descărcare.
                </p>
                <button
                  onClick={() => { if (window.confirm(`Ștergi definitiv toate cele ${accepted.length} poze acceptate?`)) deleteAllByStatus("accepted"); }}
                  disabled={deletingAll === "accepted"}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-red-400 hover:border-red-900/40 transition-colors disabled:opacity-40"
                >
                  {deletingAll === "accepted" ? "Se șterge..." : `Șterge tot (${accepted.length})`}
                </button>
              </div>
              {groupByAlbum(accepted).map(([albumSlug, albumProposals]) => (
                <div key={albumSlug} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                  <AlbumGroupHeader
                    albumSlug={albumSlug}
                    count={albumProposals.length}
                    label="acceptate"
                    labelColor="bg-cyan-500/20 text-cyan-400"
                    isCollapsed={collapsedAlbums.has(albumSlug)}
                    onToggle={() => toggleAlbum(albumSlug)}
                  />
                  {!collapsedAlbums.has(albumSlug) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3">
                      {albumProposals.map((proposal) => (
                        <AcceptedCard
                          key={proposal.id}
                          proposal={proposal}
                          wasDownloaded={downloaded.has(proposal.id)}
                          busy={updatingId === proposal.id}
                          onDownload={() => handleDownload(proposal)}
                          onArchive={() => updateStatus(proposal.id, "archived")}
                          onDelete={() => deleteProposal(proposal.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          );
        })()}

        {/* ── RESPINSE ── */}
        {!loading && tab === "rejected" && (() => {
          const rejected = byStatus("rejected");
          if (rejected.length === 0) {
            return <div className="text-center py-16 text-neutral-600 text-sm">Nicio poză respinsă.</div>;
          }
          return (
            <>
              <div className="flex justify-end">
                <button
                  onClick={() => { if (window.confirm(`Ștergi definitiv toate cele ${rejected.length} poze respinse?`)) deleteAllByStatus("rejected"); }}
                  disabled={deletingAll === "rejected"}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-950/50 text-red-400 border border-red-900/40 hover:bg-red-900/40 transition-colors disabled:opacity-40"
                >
                  {deletingAll === "rejected" ? "Se șterge..." : `Șterge tot (${rejected.length})`}
                </button>
              </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {rejected.map((proposal) => (
                <div key={proposal.id} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
                  <div className="relative">
                    <img
                      src={proposal.originalPhotoUrl ?? proposal.photoUrl}
                      alt={proposal.fileName}
                      className="w-full aspect-square object-cover block grayscale opacity-50"
                      loading="lazy"
                    />
                    <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-900/70 text-red-400">
                      Respins
                    </span>
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <a
                      href={`/media/${proposal.albumSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 text-xs font-semibold truncate hover:text-indigo-300 transition-colors"
                    >
                      {proposal.albumSlug}
                    </a>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(proposal.id, "pending")}
                        disabled={updatingId === proposal.id}
                        className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-indigo-900/40 text-indigo-300 hover:bg-indigo-900/60 transition-colors disabled:opacity-40 active:scale-95"
                      >
                        Repune
                      </button>
                      <button
                        onClick={() => deleteProposal(proposal.id)}
                        disabled={updatingId === proposal.id}
                        className="px-3 py-2.5 rounded-lg text-xs text-neutral-600 hover:text-red-400 hover:bg-neutral-800 transition-colors disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </>
          );
        })()}

        {/* ── ARHIVATE ── */}
        {!loading && tab === "archived" && (() => {
          const archived = byStatus("archived");
          if (archived.length === 0) {
            return <div className="text-center py-16 text-neutral-600 text-sm">Nicio poză arhivată.</div>;
          }
          return (
            <>
              <div className="flex justify-end">
                <button
                  onClick={() => { if (window.confirm(`Ștergi definitiv toate cele ${archived.length} poze arhivate?`)) deleteAllByStatus("archived"); }}
                  disabled={deletingAll === "archived"}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-red-400 hover:border-red-900/40 transition-colors disabled:opacity-40"
                >
                  {deletingAll === "archived" ? "Se șterge..." : `Șterge tot (${archived.length})`}
                </button>
              </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {archived.map((proposal) => (
                <div key={proposal.id} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
                  <div className="relative">
                    <img
                      src={proposal.originalPhotoUrl ?? proposal.photoUrl}
                      alt={proposal.fileName}
                      className="w-full aspect-square object-cover block"
                      loading="lazy"
                    />
                    <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/70 text-green-400">
                      Arhivat
                    </span>
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <a
                      href={`/media/${proposal.albumSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 text-xs font-semibold truncate hover:text-indigo-300 transition-colors"
                    >
                      {proposal.albumSlug}
                    </a>
                    <button
                      onClick={() => triggerDownload(proposal.originalPhotoUrl ?? proposal.photoUrl, proposal.fileName)}
                      className="w-full py-2.5 rounded-lg text-xs font-bold bg-blue-950/60 text-blue-400 border border-blue-900/50 hover:bg-blue-900/40 transition-colors active:scale-95"
                    >
                      ↓ Descarcă din nou
                    </button>
                    <button
                      onClick={() => deleteProposal(proposal.id)}
                      disabled={updatingId === proposal.id}
                      className="w-full py-2 rounded-lg text-xs text-neutral-600 border border-neutral-800 hover:text-red-400 hover:border-red-900/50 transition-colors"
                    >
                      Șterge
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </>
          );
        })()}

        {/* ── TOATE ── */}
        {!loading && tab === "all" && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-1 bg-neutral-900 rounded-xl p-1 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
                {(["all", "pending", "accepted", "archived", "rejected"] as (ProposalStatus | "all")[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setAllStatusFilter(filter)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      allStatusFilter === filter ? "bg-neutral-700 text-white" : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    {filter === "all" ? "Toate statusurile" : STATUS_LABEL[filter]}
                  </button>
                ))}
              </div>

              <div className="flex gap-1 bg-neutral-900 rounded-xl p-1 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
                {(["all", "instagram", "media_assets"] as (ProposalDestination | "all")[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDestinationFilter(filter)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      destinationFilter === filter ? "bg-neutral-700 text-white" : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    {filter === "all" ? "Toate destinațiile" : filter === "media_assets" ? "Media Assets" : "Instagram"}
                  </button>
                ))}
              </div>

              {albums.length > 1 && (
                <select
                  value={allAlbumFilter}
                  onChange={(e) => setAllAlbumFilter(e.target.value)}
                  className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 text-xs focus:outline-none focus:border-neutral-600"
                >
                  <option value="all">Toate albumele</option>
                  {albums.map((album) => <option key={album} value={album}>{album}</option>)}
                </select>
              )}

              <span className="text-neutral-600 text-xs self-center sm:ml-auto">
                {allFiltered.length} propuneri
              </span>
            </div>

            {allFiltered.length === 0 ? (
              <div className="text-center py-16 text-neutral-600 text-sm">Nicio propunere.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {allFiltered.map((proposal) => (
                  <div key={proposal.id} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
                    <div className="relative">
                      <img
                        src={proposal.originalPhotoUrl ?? proposal.photoUrl}
                        alt={proposal.fileName}
                        className="w-full aspect-square object-cover block"
                        loading="lazy"
                      />
                      <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[proposal.status]}`}>
                        {STATUS_LABEL[proposal.status]}
                      </span>
                      <button
                        onClick={() => triggerDownload(proposal.originalPhotoUrl ?? proposal.photoUrl, proposal.fileName)}
                        className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-xs bg-black/70 text-blue-400 border border-blue-900/50 hover:bg-black/90 transition-colors"
                      >
                        ↓
                      </button>
                    </div>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <a
                        href={`/media/${proposal.albumSlug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 text-xs font-semibold truncate hover:text-indigo-300 transition-colors"
                      >
                        {proposal.albumSlug}
                      </a>
                      <p className="text-neutral-600 text-xs truncate">{proposal.proposedBy}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {(proposal.destinations ?? ["instagram"]).map((destination) => (
                          <span
                            key={destination}
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              destination === "media_assets" ? "bg-teal-950/60 text-teal-300" : "bg-fuchsia-950/60 text-fuchsia-300"
                            }`}
                          >
                            {destination === "media_assets" ? "Media Assets" : "Instagram"}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {proposal.status === "pending" && (
                          <button
                            onClick={() => updateStatus(proposal.id, "accepted")}
                            disabled={updatingId === proposal.id}
                            className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-cyan-900/40 text-cyan-300 hover:bg-cyan-900/60 transition-colors disabled:opacity-40 active:scale-95"
                          >
                            Acceptă
                          </button>
                        )}
                        {proposal.status === "accepted" && (
                          <button
                            onClick={() => updateStatus(proposal.id, "archived")}
                            disabled={updatingId === proposal.id}
                            className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-green-950/60 text-green-400 hover:bg-green-900/40 transition-colors disabled:opacity-40 active:scale-95"
                          >
                            Arhivează
                          </button>
                        )}
                        {(proposal.status === "pending" || proposal.status === "accepted") && (
                          <button
                            onClick={() => updateStatus(proposal.id, "rejected")}
                            disabled={updatingId === proposal.id}
                            className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors disabled:opacity-40 active:scale-95"
                          >
                            Respinge
                          </button>
                        )}
                        <button
                          onClick={() => deleteProposal(proposal.id)}
                          disabled={updatingId === proposal.id}
                          className="px-2.5 py-2 rounded-lg text-xs text-neutral-600 hover:text-red-400 hover:bg-neutral-800 transition-colors disabled:opacity-40"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
