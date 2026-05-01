import { useEffect, useState, useMemo } from "react";
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

const STATUS_STYLE: Record<ProposalStatus, { background: string; color: string }> = {
  pending:  { background: "#1e1b4b", color: "#a5b4fc" },
  accepted: { background: "#164e63", color: "#67e8f9" },
  archived: { background: "#1a2e1a", color: "#86efac" },
  rejected: { background: "#450a0a", color: "#f87171" },
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
  // tracks which proposals have been downloaded (unlocks archive)
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

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

  const markDownloaded = (id: string) =>
    setDownloaded((prev) => new Set(prev).add(id));

  const handleDownloadAndMaybeArchive = async (proposal: InstagramProposal) => {
    await triggerDownload(proposal.photoUrl, proposal.fileName);
    markDownloaded(proposal.id);
  };

  const handleArchive = (id: string) => updateStatus(id, "archived");

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

  const renderAcceptedGroup = ([albumSlug, albumProposals]: [string, InstagramProposal[]]) => {
    const isCollapsed = collapsedAlbums.has(albumSlug);
    return (
      <div key={albumSlug} style={{ marginBottom: "20px", border: "1px solid #1a1a1a", borderRadius: "12px", overflow: "hidden", background: "#0a0a0a" }}>
        <div
          onClick={() => toggleAlbum(albumSlug)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px 20px",
            cursor: "pointer",
            borderBottom: isCollapsed ? "none" : "1px solid #1a1a1a",
            userSelect: "none",
          }}
        >
          <span style={{ fontSize: "12px", color: "#444" }}>{isCollapsed ? "▶" : "▼"}</span>
          <a
            href={`/media/${albumSlug}`}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            style={{ color: "#818cf8", fontSize: "14px", fontWeight: 600, textDecoration: "none", flex: 1 }}
          >
            {albumSlug}
          </a>
          <span style={{ background: "#0f766e", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px" }}>
            {albumProposals.length} acceptate
          </span>
        </div>
        {!isCollapsed && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "1px", background: "#1a1a1a" }}>
            {albumProposals.map((proposal) => (
              renderAcceptedCard(proposal)
            ))}
          </div>
        )}
      </div>
    );
  };

  const albums = useMemo(
    () => Array.from(new Set(proposals.map((p) => p.albumSlug))).sort(),
    [proposals]
  );

  const allFiltered = useMemo(() =>
    proposals.filter((p) => {
      const matchesStatus = allStatusFilter === "all" || p.status === allStatusFilter;
      const matchesAlbum = allAlbumFilter === "all" || p.albumSlug === allAlbumFilter;
      return matchesStatus && matchesAlbum;
    }),
    [proposals, allStatusFilter, allAlbumFilter]
  );

  const counts = {
    pending:  byStatus("pending").length,
    accepted: byStatus("accepted").length,
    archived: byStatus("archived").length,
    rejected: byStatus("rejected").length,
  };

  const TABS: { key: Tab; label: string; count?: number; accent?: string }[] = [
    { key: "pending",  label: "În așteptare", count: counts.pending,  accent: "#f97316" },
    { key: "all",      label: "Toate" },
    { key: "accepted", label: "Acceptate",    count: counts.accepted,  accent: "#06b6d4" },
    { key: "rejected", label: "Respinse",     count: counts.rejected,  accent: "#ef4444" },
    { key: "archived", label: "Arhivate",     count: counts.archived },
  ];

  // ── Accepted card ────────────────────────────────────────────────────────────
  const renderAcceptedCard = (proposal: InstagramProposal) => {
    const wasDownloaded = downloaded.has(proposal.id);
    const busy = updatingId === proposal.id;
    return (
      <div key={proposal.id} style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #1a1a1a", background: "#0f0f0f", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "relative" }}>
          <img src={proposal.photoUrl} alt={proposal.fileName} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} loading="lazy" />
          <span style={{ position: "absolute", top: "8px", right: "8px", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", ...STATUS_STYLE.accepted }}>
            Acceptat
          </span>
        </div>
        <div style={{ padding: "10px 12px 12px", flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
          <a href={`/media/${proposal.albumSlug}`} target="_blank" rel="noreferrer" style={{ color: "#6366f1", fontSize: "11px", textDecoration: "none", fontWeight: 600 }}>
            {proposal.albumSlug}
          </a>
          <p style={{ color: "#555", fontSize: "11px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proposal.proposedBy}</p>
          <button
            onClick={() => handleDownloadAndMaybeArchive(proposal)}
            style={{ width: "100%", padding: "8px 0", fontSize: "12px", fontWeight: 700, background: "#0f172a", color: "#60a5fa", border: "1px solid #1e3a5f", borderRadius: "6px", cursor: "pointer" }}
          >
            ↓ Descarcă
          </button>
          <button
            onClick={() => handleArchive(proposal.id)}
            disabled={!wasDownloaded || busy}
            title={wasDownloaded ? "Mută în Arhivate" : "Descarcă mai întâi pentru a putea arhiva"}
            style={{
              width: "100%", padding: "8px 0", fontSize: "12px", fontWeight: 700,
              background: wasDownloaded ? "#14532d" : "#0f0f0f",
              color: wasDownloaded ? "#4ade80" : "#2a2a2a",
              border: wasDownloaded ? "none" : "1px solid #1a1a1a",
              borderRadius: "6px",
              cursor: wasDownloaded ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "..." : wasDownloaded ? "✓ Mută în Arhivate" : "Arhivează (descarcă mai întâi)"}
          </button>
          <button onClick={() => deleteProposal(proposal.id)} disabled={busy} style={{ width: "100%", padding: "5px 0", fontSize: "11px", background: "none", color: "#333", border: "1px solid #1a1a1a", borderRadius: "6px", cursor: "pointer" }}>
            Șterge
          </button>
        </div>
      </div>
    );
  };

  // ── Pipeline group ───────────────────────────────────────────────────────────
  const renderPipelineGroup = ([albumSlug, albumProposals]: [string, InstagramProposal[]]) => {
    const isCollapsed = collapsedAlbums.has(albumSlug);
    return (
      <div key={albumSlug} style={{ marginBottom: "20px", border: "1px solid #1a1a1a", borderRadius: "12px", overflow: "hidden", background: "#0a0a0a" }}>
        <div onClick={() => toggleAlbum(albumSlug)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 20px", cursor: "pointer", borderBottom: isCollapsed ? "none" : "1px solid #1a1a1a", userSelect: "none" }}>
          <span style={{ fontSize: "12px", color: "#444" }}>{isCollapsed ? "▶" : "▼"}</span>
          <a href={`/media/${albumSlug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#818cf8", fontSize: "14px", fontWeight: 600, textDecoration: "none", flex: 1 }}>
            {albumSlug}
          </a>
          <span style={{ background: "#f97316", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px" }}>
            {albumProposals.length} propuneri
          </span>
        </div>
        {!isCollapsed && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "1px", background: "#1a1a1a" }}>
            {albumProposals.map((proposal) => (
              <div key={proposal.id} style={{ background: "#0a0a0a" }}>
                <div style={{ position: "relative" }}>
                  <img src={proposal.photoUrl} alt={proposal.fileName} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} loading="lazy" />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)", display: "flex", alignItems: "flex-end", padding: "8px" }}>
                    <span style={{ fontSize: "10px", color: "#888" }}>{proposal.proposedBy.split("@")[0]}</span>
                  </div>
                </div>
                <div style={{ padding: "8px 10px 10px", display: "flex", gap: "4px" }}>
                  <button onClick={() => updateStatus(proposal.id, "accepted")} disabled={updatingId === proposal.id} style={{ flex: 1, padding: "6px 0", fontSize: "10px", fontWeight: 700, background: "#164e63", color: "#67e8f9", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                    Acceptă
                  </button>
                  <button onClick={() => updateStatus(proposal.id, "rejected")} disabled={updatingId === proposal.id} style={{ flex: 1, padding: "6px 0", fontSize: "10px", fontWeight: 700, background: "#450a0a", color: "#f87171", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                    Respinge
                  </button>
                  <button onClick={() => deleteProposal(proposal.id)} disabled={updatingId === proposal.id} style={{ padding: "6px 8px", fontSize: "10px", background: "#111", color: "#444", border: "none", borderRadius: "6px", cursor: "pointer" }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "sans-serif" }}>
      <Breadcrumb />

      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 500, margin: 0 }}>Propuneri Instagram</h1>
          {counts.pending > 0 && (
            <span style={{ background: "#f97316", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px" }}>
              {counts.pending} noi
            </span>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "2px", background: "#111", borderRadius: "10px", padding: "4px", marginBottom: "28px", width: "fit-content", flexWrap: "wrap" }}>
          {TABS.map(({ key, label, count, accent }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{ padding: "7px 16px", borderRadius: "7px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", background: tab === key ? "#1a1a1a" : "transparent", color: tab === key ? "#fff" : "#555" }}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span style={{ background: tab === key ? (accent ?? "#333") : "#1a1a1a", color: tab === key ? "#fff" : "#555", fontSize: "10px", fontWeight: 700, padding: "1px 7px", borderRadius: "999px" }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {fetchError && (
          <div style={{ padding: "16px", background: "#1a0000", border: "1px solid #450a0a", borderRadius: "8px", marginBottom: "20px" }}>
            <p style={{ color: "#f87171", fontSize: "13px", margin: 0 }}>Eroare: {fetchError}</p>
          </div>
        )}

        {loading && <p style={{ color: "#555", fontSize: "14px" }}>Se încarcă...</p>}

        {/* ── ÎN AȘTEPTARE (Pipeline) ── */}
        {!loading && tab === "pending" && (() => {
          const groups = groupByAlbum(byStatus("pending"));
          return groups.length === 0
            ? <div style={{ textAlign: "center", padding: "64px 0", color: "#444", fontSize: "14px" }}>Nicio propunere în așteptare.</div>
            : groups.map(renderPipelineGroup);
        })()}

        {/* ── ACCEPTATE ── */}
        {!loading && tab === "accepted" && (() => {
          const accepted = byStatus("accepted");
          return accepted.length === 0
            ? <div style={{ textAlign: "center", padding: "64px 0", color: "#444", fontSize: "14px" }}>Nicio poză acceptată.</div>
            : (
              <>
                <p style={{ color: "#555", fontSize: "13px", marginBottom: "20px" }}>
                  Descarcă poza, apoi butonul „Mută în Arhivate" se activează.
                </p>
                {groupByAlbum(accepted).map(renderAcceptedGroup)}
              </>
            );
        })()}

        {/* ── RESPINSE ── */}
        {!loading && tab === "rejected" && (() => {
          const rejected = byStatus("rejected");
          return rejected.length === 0
            ? <div style={{ textAlign: "center", padding: "64px 0", color: "#444", fontSize: "14px" }}>Nicio poză respinsă.</div>
            : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "12px" }}>
                {rejected.map((proposal) => (
                  <div key={proposal.id} style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #1a1a1a", background: "#0f0f0f" }}>
                    <div style={{ position: "relative" }}>
                      <img src={proposal.photoUrl} alt={proposal.fileName} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", filter: "grayscale(60%)", opacity: 0.6 }} loading="lazy" />
                      <span style={{ position: "absolute", top: "8px", right: "8px", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", ...STATUS_STYLE.rejected }}>Respins</span>
                    </div>
                    <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <a href={`/media/${proposal.albumSlug}`} target="_blank" rel="noreferrer" style={{ color: "#6366f1", fontSize: "11px", textDecoration: "none", fontWeight: 600 }}>{proposal.albumSlug}</a>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button onClick={() => updateStatus(proposal.id, "pending")} disabled={updatingId === proposal.id} style={{ flex: 1, padding: "5px 0", fontSize: "10px", fontWeight: 700, background: "#1e1b4b", color: "#a5b4fc", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                          Repune în așteptare
                        </button>
                        <button onClick={() => deleteProposal(proposal.id)} disabled={updatingId === proposal.id} style={{ padding: "5px 8px", fontSize: "10px", background: "#111", color: "#444", border: "none", borderRadius: "6px", cursor: "pointer" }}>✕</button>
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
          return archived.length === 0
            ? <div style={{ textAlign: "center", padding: "64px 0", color: "#444", fontSize: "14px" }}>Nicio poză arhivată.</div>
            : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "12px" }}>
                {archived.map((proposal) => (
                  <div key={proposal.id} style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #1a1a1a", background: "#0f0f0f" }}>
                    <div style={{ position: "relative" }}>
                      <img src={proposal.photoUrl} alt={proposal.fileName} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} loading="lazy" />
                      <span style={{ position: "absolute", top: "8px", right: "8px", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", ...STATUS_STYLE.archived }}>Arhivat</span>
                    </div>
                    <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <a href={`/media/${proposal.albumSlug}`} target="_blank" rel="noreferrer" style={{ color: "#6366f1", fontSize: "11px", textDecoration: "none", fontWeight: 600 }}>{proposal.albumSlug}</a>
                      <button onClick={() => triggerDownload(proposal.photoUrl, proposal.fileName)} style={{ width: "100%", padding: "6px 0", fontSize: "11px", fontWeight: 600, background: "#0f172a", color: "#60a5fa", border: "1px solid #1e3a5f", borderRadius: "6px", cursor: "pointer" }}>
                        ↓ Descarcă din nou
                      </button>
                      <button onClick={() => deleteProposal(proposal.id)} disabled={updatingId === proposal.id} style={{ width: "100%", padding: "5px 0", fontSize: "11px", background: "none", color: "#333", border: "1px solid #1a1a1a", borderRadius: "6px", cursor: "pointer" }}>
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
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "4px", background: "#111", borderRadius: "8px", padding: "4px", flexWrap: "wrap" }}>
                {(["all", "pending", "accepted", "archived", "rejected"] as (ProposalStatus | "all")[]).map((filter) => (
                  <button key={filter} onClick={() => setAllStatusFilter(filter)} style={{ padding: "5px 12px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: allStatusFilter === filter ? "#222" : "transparent", color: allStatusFilter === filter ? "#fff" : "#555" }}>
                    {filter === "all" ? "Toate" : STATUS_LABEL[filter]}
                  </button>
                ))}
              </div>
              {albums.length > 1 && (
                <select value={allAlbumFilter} onChange={(e) => setAllAlbumFilter(e.target.value)} style={{ padding: "6px 12px", background: "#111", border: "1px solid #222", borderRadius: "6px", color: "#aaa", fontSize: "12px", cursor: "pointer" }}>
                  <option value="all">Toate albumele</option>
                  {albums.map((album) => <option key={album} value={album}>{album}</option>)}
                </select>
              )}
              <span style={{ color: "#444", fontSize: "12px", marginLeft: "auto" }}>{allFiltered.length} propuneri</span>
            </div>
            {allFiltered.length === 0
              ? <div style={{ textAlign: "center", padding: "64px 0", color: "#444", fontSize: "14px" }}>Nicio propunere.</div>
              : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "12px" }}>
                  {allFiltered.map((proposal) => (
                    <div key={proposal.id} style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #1a1a1a", background: "#0f0f0f" }}>
                      <div style={{ position: "relative" }}>
                        <img src={proposal.photoUrl} alt={proposal.fileName} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} loading="lazy" />
                        <span style={{ position: "absolute", top: "8px", right: "8px", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", ...STATUS_STYLE[proposal.status] }}>
                          {STATUS_LABEL[proposal.status]}
                        </span>
                        <button onClick={() => triggerDownload(proposal.photoUrl, proposal.fileName)} style={{ position: "absolute", bottom: "8px", right: "8px", padding: "4px 8px", fontSize: "11px", background: "rgba(0,0,0,0.7)", color: "#60a5fa", border: "1px solid #1e3a5f", borderRadius: "6px", cursor: "pointer" }}>↓</button>
                      </div>
                      <div style={{ padding: "10px 12px 12px" }}>
                        <a href={`/media/${proposal.albumSlug}`} target="_blank" rel="noreferrer" style={{ color: "#6366f1", fontSize: "11px", textDecoration: "none", fontWeight: 600 }}>{proposal.albumSlug}</a>
                        <p style={{ color: "#555", fontSize: "11px", margin: "3px 0 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proposal.proposedBy}</p>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {proposal.status === "pending" && <button onClick={() => updateStatus(proposal.id, "accepted")} disabled={updatingId === proposal.id} style={{ flex: 1, padding: "5px 0", fontSize: "10px", fontWeight: 700, background: "#164e63", color: "#67e8f9", border: "none", borderRadius: "6px", cursor: "pointer" }}>Acceptă</button>}
                          {proposal.status === "accepted" && <button onClick={() => updateStatus(proposal.id, "archived")} disabled={updatingId === proposal.id} style={{ flex: 1, padding: "5px 0", fontSize: "10px", fontWeight: 700, background: "#1a2e1a", color: "#86efac", border: "none", borderRadius: "6px", cursor: "pointer" }}>Arhivează</button>}
                          {(proposal.status === "pending" || proposal.status === "accepted") && <button onClick={() => updateStatus(proposal.id, "rejected")} disabled={updatingId === proposal.id} style={{ flex: 1, padding: "5px 0", fontSize: "10px", fontWeight: 700, background: "#450a0a", color: "#f87171", border: "none", borderRadius: "6px", cursor: "pointer" }}>Respinge</button>}
                          <button onClick={() => deleteProposal(proposal.id)} disabled={updatingId === proposal.id} style={{ padding: "5px 7px", fontSize: "10px", background: "#111", color: "#444", border: "none", borderRadius: "6px", cursor: "pointer" }}>✕</button>
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
