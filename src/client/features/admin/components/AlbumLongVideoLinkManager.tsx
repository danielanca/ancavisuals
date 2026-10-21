/*
 * Purpose: admin control for the album's "Video lung" link in EventCard — save, replace or delete
 * the download link (SwissTransfer / WeTransfer / Drive). /media edits the same link in
 * AlbumVideoLinksSection; the PUT merges per kind, so the short video is never touched here.
 */
import { useEffect, useState } from "react";
import { ALBUM_VIDEO_META, normalizeVideoLink, type AlbumVideoLinks } from "../../../../shared/albumVideoLinks";

type Props = { slug: string; accessToken: string | null | undefined };

export default function AlbumLongVideoLinkManager({ slug, accessToken }: Props) {
  const [saved, setSaved] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const base = `/api/album/${encodeURIComponent(slug)}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`${base}/video-links`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { links?: AlbumVideoLinks } | null) => {
        if (cancelled) return;
        setSaved(data?.links?.long ?? "");
        setDraft(data?.links?.long ?? "");
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [base]);

  const save = async (link: string) => {
    if (normalizeVideoLink(link) === null) { setMessage({ ok: false, text: "Linkul trebuie să înceapă cu https://" }); return; }
    setBusy(true);
    try {
      const response = await fetch(`${base}/video-links`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken ?? ""}` },
        body: JSON.stringify({ long: link.trim() }),
      });
      if (!response.ok) throw new Error(response.status === 400 ? "Link invalid." : "Nu s-a putut salva.");
      const data = await response.json() as { links?: AlbumVideoLinks };
      setSaved(data.links?.long ?? "");
      setDraft(data.links?.long ?? "");
      setMessage({ ok: true, text: link.trim() ? (saved ? "Link înlocuit." : "Link salvat — clientul îl vede.") : "Link șters — clientul nu mai vede videoul lung." });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error && error.message ? error.message : "Nu s-a putut salva." });
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!window.confirm("Ștergi linkul videoului lung? Clientul nu îl va mai vedea până pui altul.")) return;
    void save("");
  };

  return (
    <div className="space-y-2 border border-neutral-700 bg-neutral-950 p-3" onClick={(e) => e.stopPropagation()}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">🛠 Video lung</p>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void save(draft); }}>
        <input
          type="url"
          inputMode="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={ALBUM_VIDEO_META.long.placeholder}
          aria-label="Link video lung"
          className="min-w-0 flex-1 border border-neutral-700 bg-black px-3 py-1.5 text-xs text-white outline-none focus:border-white"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim() || draft.trim() === saved}
          className="border border-white bg-white px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40"
        >
          {saved ? "Înlocuiește link" : "Salvează link"}
        </button>
        {saved && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="border border-neutral-600 px-3 py-1.5 text-xs text-neutral-300 hover:border-white disabled:opacity-40"
          >
            Șterge
          </button>
        )}
      </form>
      {message && <p role="status" className={`text-xs ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
    </div>
  );
}
