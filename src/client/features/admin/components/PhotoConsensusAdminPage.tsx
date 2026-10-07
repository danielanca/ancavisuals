import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";
import PhotoConsensusPanel from "../../../components/Media/PhotoConsensusPanel";
import type { PhotoVote } from "../../../../shared/media/proposalConsensus";

export default function PhotoConsensusAdminPage() {
  const { auth } = useAuth();
  const [searchParams] = useSearchParams();
  const [proposals, setProposals] = useState<PhotoVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!auth.accessToken) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch("/api/instagram-proposals/admin/all", {
      headers: { Authorization: `Bearer ${auth.accessToken}` }, signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Nu am putut încărca voturile.");
      if (!controller.signal.aborted) setProposals(data.proposals ?? []);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [auth.accessToken, refreshKey]);

  const moderate = async (ids: string[], status: "accepted" | "rejected") => {
    if (!auth.accessToken || busyKey) return;
    setBusyKey(ids[0]);
    setError(null);
    try {
      for (const id of ids) {
        const response = await fetch(`/api/instagram-proposals/${encodeURIComponent(id)}`, {
          method: "PATCH", headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error((await response.json()).error ?? "Nu am putut salva selecția.");
        setProposals(previous => previous.map(proposal => proposal.id === id ? { ...proposal, status } : proposal));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusyKey(null); }
  };


  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Breadcrumb />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link to="/admin/instagram-proposals" className="text-sm text-neutral-400 hover:text-white">← Propuneri Media</Link>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <PhotoConsensusPanel onModerate={auth.role === "admin" ? moderate : undefined} busyKey={busyKey} proposals={proposals} loading={loading} onRefresh={() => setRefreshKey(key => key + 1)}
          initialDestination={searchParams.get("destination") === "media_assets" ? "media_assets" : "all"} />
      </div>
    </div>
  );
}
