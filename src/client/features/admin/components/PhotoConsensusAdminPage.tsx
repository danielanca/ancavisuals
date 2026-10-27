import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";
import PhotoConsensusPanel from "../../../components/Media/PhotoConsensusPanel";
import type { AlbumCoverage, PhotoReviewer, PhotoVote } from "../../../../shared/media/proposalConsensus";

type ConsensusResponse = {
  albums: string[];
  albumSlug: string | null;
  proposals: PhotoVote[];
  reviewers: PhotoReviewer[];
  coverage: AlbumCoverage;
};

// One album at a time (owner, 2026-10-27); ?album= keeps the choice in the URL.
export default function PhotoConsensusAdminPage() {
  const { auth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedAlbum = searchParams.get("album") ?? "";
  const [data, setData] = useState<ConsensusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!auth.accessToken) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const query = requestedAlbum ? `?albumSlug=${encodeURIComponent(requestedAlbum)}` : "";
    fetch(`/api/instagram-proposals/admin/consensus${query}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` }, signal: controller.signal,
    }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Nu am putut încărca voturile.");
      if (!controller.signal.aborted) setData(result);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [auth.accessToken, requestedAlbum, refreshKey]);

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
        setData(previous => previous && { ...previous, proposals: previous.proposals.map(proposal => proposal.id === id ? { ...proposal, status } : proposal) });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusyKey(null); }
  };

  const chooseAlbum = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("album", slug);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Breadcrumb />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link to="/admin/instagram-proposals" className="text-sm text-neutral-400 hover:text-white">← Propuneri Media</Link>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {data && data.albums.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <select aria-label="Albumul" value={data.albumSlug ?? ""} onChange={event => chooseAlbum(event.target.value)} className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm">
              {data.albums.map(slug => <option key={slug} value={slug}>{slug}</option>)}
            </select>
            {data.albumSlug && <a href={`/media/${encodeURIComponent(data.albumSlug)}`} className="text-sm text-indigo-300">Deschide albumul ↗</a>}
          </div>
        )}
        <PhotoConsensusPanel key={data?.albumSlug ?? "none"} onModerate={auth.role === "admin" ? moderate : undefined} busyKey={busyKey}
          proposals={data?.proposals ?? []} reviewers={data?.reviewers} coverage={data?.coverage}
          loading={loading} onRefresh={() => setRefreshKey(key => key + 1)}
          initialDestination={searchParams.get("destination") === "media_assets" ? "media_assets" : "all"} />
      </div>
    </div>
  );
}
