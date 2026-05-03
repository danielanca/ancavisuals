import { useEffect, useState, useMemo, useRef } from "react";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";

type ProposalStatus = "pending" | "accepted" | "archived" | "rejected";
type Tab = "pending" | "all" | "accepted" | "rejected" | "archived";

type InstagramProposal = {
  id: string;
  albumSlug: string;
  photoUrl: string;
  fileName: string;
  proposedBy: string;
  proposedAt: string;
  status: ProposalStatus;
};

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
  return fetch(url)
    .then((r) => r.blob())
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName || "photo.jpg";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    })
    .catch(() => { window.open(url, "_blank"); });
}

// ─── Pending card — list layout on mobile, grid on desktop ───────────────────

function PendingCard({
  proposal,
  busy,
  onAccept,
  onReject,
  onDelete,
}: {
  proposal: InstagramProposal;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
      {/* Mobile: row layout */}
      <div className="flex sm:flex-col">
        <div className="relative flex-shrink-0 w-28 sm:w-full">
          <img
            src={proposal.photoUrl}
            alt={proposal.fileName}
            className="w-full h-28 sm:h-auto sm:aspect-square object-cover block"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <span className="absolute bottom-1.5 left-1.5 text-[10px] text-white/60 truncate max-w-[80px]">
            {proposal.proposedBy.split("@")[0]}
          </span>
        </div>

        <div className="flex-1 flex flex-col justify-between p-3 gap-2 sm:p-2.5">
          <a
            href={`/media/${proposal.albumSlug}`}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 text-xs font-semibold truncate hover:text-indigo-300 transition-colors"
          >
            {proposal.albumSlug}
          </a>

          <div className="flex gap-2 sm:gap-1.5">
            <button
              onClick={onAccept}
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
          src={proposal.photoUrl}
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
        <p className="text-neutral-600 text-xs truncate">{proposal.proposedBy}</p>
        <button
          onClick={onDownload}
          className="w-full py-2.5 rounded-lg text-xs font-bold bg-blue-950/60 text-blue-400 border border-blue-900/50 hover:bg-blue-900/40 transition-colors active:scale-95"
        >
          ↓ Descarcă
        </button>
        <button
          onClick={onArchive}
          disabled={!wasDownloaded || busy}
          title={wasDownloaded ? "Mută în Arhivate" : "Descarcă mai întâi"}
          className={`w-full py-2.5 rounded-lg text-xs font-bold transition-colors active:scale-95 ${
            wasDownloaded
              ? "bg-green-950/60 text-green-400 border border-green-900/50 hover:bg-green-900/40"
              : "bg-neutral-900 text-neutral-700 border border-neutral-800 cursor-not-allowed"
          }`}
        >
          {busy ? "..." : wasDownloaded ? "✓ Mută în Arhivate" : "Arhivează (descarcă mai întâi)"}
        </button>
        <button
          onClick={onDelete}
          disabled={busy}
          className="w-full py-2 rounded-lg text-xs text-neutral-600 border border-neutral-800 hover:text-red-400 hover:border-red-900/50 transition-colors"
        >
          Șterge
        </button>
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
  const [proposals, setProposals] = useState<InstagramProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [collapsedAlbums, setCollapsedAlbums] = useState<Set<string>>(new Set());
  const [allStatusFilter, setAllStatusFilter] = useState<ProposalStatus | "all">("all");
  const [allAlbumFilter, setAllAlbumFilter] = useState("all");
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.accessToken) return;
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
  }, [auth.accessToken]);

  const updateStatus = async (id: string, status: ProposalStatus) => {
    if (!auth.accessToken) return;
    setUpdatingId(id);
    try {
      await fetch(`/api/instagram-proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ status }),
      });
      setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
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

  const handleDownload = async (proposal: InstagramProposal) => {
    await triggerDownload(proposal.photoUrl, proposal.fileName);
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
      const matchesAlbum = allAlbumFilter === "all" || p.albumSlug === allAlbumFilter;
      return matchesStatus && matchesAlbum;
    }),
    [proposals, allStatusFilter, allAlbumFilter],
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
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-light text-white">Propuneri Instagram</h1>
          {counts.pending > 0 && (
            <span className="bg-orange-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              {counts.pending} noi
            </span>
          )}
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
          const groups = groupByAlbum(byStatus("pending"));
          if (groups.length === 0) {
            return (
              <div className="text-center py-16 text-neutral-600 text-sm">
                Nicio propunere în așteptare.
              </div>
            );
          }
          return groups.map(([albumSlug, albumProposals]) => (
            <div key={albumSlug} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <AlbumGroupHeader
                albumSlug={albumSlug}
                count={albumProposals.length}
                label="propuneri"
                labelColor="bg-orange-500/20 text-orange-400"
                isCollapsed={collapsedAlbums.has(albumSlug)}
                onToggle={() => toggleAlbum(albumSlug)}
              />
              {!collapsedAlbums.has(albumSlug) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-neutral-800">
                  {albumProposals.map((proposal) => (
                    <div key={proposal.id} className="bg-neutral-950">
                      <PendingCard
                        proposal={proposal}
                        busy={updatingId === proposal.id}
                        onAccept={() => updateStatus(proposal.id, "accepted")}
                        onReject={() => updateStatus(proposal.id, "rejected")}
                        onDelete={() => deleteProposal(proposal.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ));
        })()}

        {/* ── ACCEPTATE ── */}
        {!loading && tab === "accepted" && (() => {
          const accepted = byStatus("accepted");
          if (accepted.length === 0) {
            return <div className="text-center py-16 text-neutral-600 text-sm">Nicio poză acceptată.</div>;
          }
          return (
            <>
              <p className="text-neutral-600 text-xs">
                Descarcă poza — butonul „Mută în Arhivate" se activează după descărcare.
              </p>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {rejected.map((proposal) => (
                <div key={proposal.id} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
                  <div className="relative">
                    <img
                      src={proposal.photoUrl}
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
          );
        })()}

        {/* ── ARHIVATE ── */}
        {!loading && tab === "archived" && (() => {
          const archived = byStatus("archived");
          if (archived.length === 0) {
            return <div className="text-center py-16 text-neutral-600 text-sm">Nicio poză arhivată.</div>;
          }
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {archived.map((proposal) => (
                <div key={proposal.id} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
                  <div className="relative">
                    <img
                      src={proposal.photoUrl}
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
                      onClick={() => triggerDownload(proposal.photoUrl, proposal.fileName)}
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
                        src={proposal.photoUrl}
                        alt={proposal.fileName}
                        className="w-full aspect-square object-cover block"
                        loading="lazy"
                      />
                      <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[proposal.status]}`}>
                        {STATUS_LABEL[proposal.status]}
                      </span>
                      <button
                        onClick={() => triggerDownload(proposal.photoUrl, proposal.fileName)}
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
