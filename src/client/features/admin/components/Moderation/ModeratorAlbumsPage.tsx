import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../auth/useAuth";

export default function ModeratorAlbumsPage() {
  const { auth, logOut } = useAuth();
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/moderare/albums", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((response) => response.json())
      .then((data: { albums?: string[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setAlbums(data.albums ?? []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [auth.accessToken]);

  const handleLogout = async () => {
    await logOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-xl mx-auto space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-white text-xl font-light tracking-tight">Moderare albume</h1>
            <p className="text-neutral-500 text-xs mt-1">{auth.user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-800 text-neutral-400 text-xs hover:border-red-500/50 hover:text-red-400 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Deconectare
          </button>
        </div>

        <p className="text-neutral-500 text-sm">
          Selectează un album, alege pozele care nu sunt bune pentru client și trimite spre moderare.
        </p>

        <button
          onClick={() => navigate("/colaborator")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-sm hover:bg-violet-500/25 transition-colors w-full"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Propune poze pentru galeria de inspirație
        </button>

        {loading && (
          <p className="text-neutral-600 text-sm">Se încarcă albumele...</p>
        )}

        {error && (
          <p className="text-red-400 text-sm">Eroare: {error}</p>
        )}

        <div className="flex flex-col gap-2">
          {albums.map((slug) => (
            <button
              key={slug}
              onClick={() => navigate(`/media/${slug}?mod=1`)}
              className="flex items-center justify-between px-4 py-3.5 border border-neutral-800 rounded-lg text-neutral-300 text-sm hover:border-neutral-600 hover:text-white transition-colors text-left"
            >
              <span className="font-mono tracking-wide">{slug}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
          {!loading && albums.length === 0 && !error && (
            <p className="text-neutral-600 text-sm">Niciun album disponibil.</p>
          )}
        </div>

      </div>
    </div>
  );
}
