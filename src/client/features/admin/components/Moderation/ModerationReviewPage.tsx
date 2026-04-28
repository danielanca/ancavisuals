import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../auth/useAuth";
import Breadcrumb from "../Breadcrumb";

type ProposedPhoto = {
  filename: string;
  signedUrl: string;
};

type AlbumProposal = {
  albumSlug: string;
  submissionIds: string[];
  moderatorEmails: string[];
  latestCreatedAt: string;
  photos: ProposedPhoto[];
};

export default function ModerationReviewPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [proposals, setProposals] = useState<AlbumProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Map<string, Set<string>>>(new Map());
  const [previewAlbum, setPreviewAlbum] = useState<AlbumProposal | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [lastResult, setLastResult] = useState<{ albumSlug: string; deleted: number; kept: number } | null>(null);
  const hasFetchedRef = useRef(false);

  const loadPending = (token: string) => {
    setLoading(true);
    setError(null);
    fetch("/api/moderare/pending", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((data: { albums?: AlbumProposal[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        const albums = data.albums ?? [];
        setProposals(albums);
        const initialSelection = new Map<string, Set<string>>();
        albums.forEach((album) => {
          initialSelection.set(album.albumSlug, new Set(album.photos.map((photo) => photo.filename)));
        });
        setSelectedForDeletion(initialSelection);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!auth.accessToken || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    loadPending(auth.accessToken);
  }, [auth.accessToken]);

  const togglePhoto = (albumSlug: string, filename: string) => {
    setSelectedForDeletion((previous) => {
      const next = new Map(previous);
      const photoSet = new Set(next.get(albumSlug) ?? []);
      photoSet.has(filename) ? photoSet.delete(filename) : photoSet.add(filename);
      next.set(albumSlug, photoSet);
      return next;
    });
  };

  const handleConfirmReview = async (album: AlbumProposal) => {
    const photosToDelete = Array.from(selectedForDeletion.get(album.albumSlug) ?? []);
    setReviewing(true);
    try {
      const response = await fetch("/api/moderare/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({
          albumSlug: album.albumSlug,
          submissionIds: album.submissionIds,
          photosToDelete,
        }),
      });
      const data = await response.json() as { ok?: boolean; deleted?: number; kept?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Eroare server");
      setLastResult({ albumSlug: album.albumSlug, deleted: data.deleted ?? 0, kept: data.kept ?? 0 });
      setPreviewAlbum(null);
      hasFetchedRef.current = false;
      loadPending(auth.accessToken);
    } catch (err) {
      alert(`Eroare: ${(err as Error).message}`);
    } finally {
      setReviewing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <p className="text-neutral-600 text-sm">Se încarcă propunerile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">

        <Breadcrumb />

        <div className="flex items-center gap-3">
          <h1 className="text-white text-xl font-light tracking-tight">Propuneri de moderare</h1>
        </div>

        {error && (
          <p className="text-red-400 text-sm">Eroare: {error}</p>
        )}

        {lastResult && (
          <div className="px-4 py-3 rounded-lg border border-emerald-800/40 bg-emerald-950/30">
            <p className="text-emerald-400 text-sm">
              Album <strong>{lastResult.albumSlug}</strong>: {lastResult.deleted} poze șterse, {lastResult.kept} păstrate. Moderatorul a fost notificat.
            </p>
          </div>
        )}

        {!loading && proposals.length === 0 && (
          <p className="text-neutral-600 text-sm pt-8">Nicio propunere în așteptare.</p>
        )}

        {proposals.map((album) => {
          const deletionSet = selectedForDeletion.get(album.albumSlug) ?? new Set<string>();
          return (
            <div key={album.albumSlug} className="border border-neutral-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-medium text-sm font-mono">{album.albumSlug}</p>
                  <p className="text-neutral-500 text-xs mt-0.5">
                    {album.photos.length} poze propuse · {album.moderatorEmails.join(", ")}
                  </p>
                </div>
                <button
                  onClick={() => setPreviewAlbum(album)}
                  className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Confirmă ștergerea ({deletionSet.size})
                </button>
              </div>

              <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {album.photos.map(({ filename, signedUrl }) => {
                  const isSelectedForDeletion = deletionSet.has(filename);
                  return (
                    <button
                      key={filename}
                      type="button"
                      onClick={() => togglePhoto(album.albumSlug, filename)}
                      className="relative rounded-md overflow-hidden border-2 transition-all focus:outline-none"
                      style={{ borderColor: isSelectedForDeletion ? "#ef4444" : "#1f1f1f" }}
                      title={filename}
                    >
                      <img
                        src={signedUrl}
                        alt={filename}
                        className="w-full aspect-square object-cover block"
                        style={{ opacity: isSelectedForDeletion ? 1 : 0.3 }}
                        loading="lazy"
                      />
                      {isSelectedForDeletion && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="px-4 pb-3 text-xs text-neutral-600">
                Click pe poze pentru a le selecta/deselecta din lista de ștergere. Pozele estompate se vor păstra.
              </div>
            </div>
          );
        })}

      </div>

      {previewAlbum && (() => {
        const deletionSet = selectedForDeletion.get(previewAlbum.albumSlug) ?? new Set<string>();
        const toDelete = Array.from(deletionSet);
        const toKeep = previewAlbum.photos
          .filter((photo) => !deletionSet.has(photo.filename))
          .map((photo) => photo.filename);

        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-neutral-900 rounded-2xl p-6 max-w-md w-full border border-neutral-800 space-y-4">
              <h2 className="text-white text-lg font-light">Confirmi acțiunea?</h2>
              <p className="text-neutral-400 text-sm">
                Album: <span className="text-white font-mono">{previewAlbum.albumSlug}</span>
              </p>

              <div className="space-y-3">
                <div>
                  <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Se șterg definitiv din Bunny ({toDelete.length})
                  </p>
                  <div className="max-h-28 overflow-y-auto bg-neutral-950 rounded-lg p-2 space-y-0.5">
                    {toDelete.length === 0
                      ? <p className="text-neutral-600 text-xs italic">Nicio poză selectată</p>
                      : toDelete.map((filename) => (
                        <p key={filename} className="text-neutral-400 text-xs font-mono truncate">{filename}</p>
                      ))
                    }
                  </div>
                </div>

                <div>
                  <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Se păstrează ({toKeep.length})
                  </p>
                  <div className="max-h-20 overflow-y-auto bg-neutral-950 rounded-lg p-2 space-y-0.5">
                    {toKeep.length === 0
                      ? <p className="text-neutral-600 text-xs italic">—</p>
                      : toKeep.map((filename) => (
                        <p key={filename} className="text-neutral-600 text-xs font-mono truncate">{filename}</p>
                      ))
                    }
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setPreviewAlbum(null)}
                  disabled={reviewing}
                  className="px-4 py-2 border border-neutral-700 rounded-lg text-neutral-400 text-sm hover:text-white hover:border-neutral-500 transition-colors disabled:opacity-50"
                >
                  Anulează
                </button>
                <button
                  onClick={() => handleConfirmReview(previewAlbum)}
                  disabled={reviewing || toDelete.length === 0}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reviewing ? "Se procesează..." : "Șterge definitiv"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
