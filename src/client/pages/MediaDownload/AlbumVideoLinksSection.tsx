/*
 * Purpose: "Video lung" / "Video scurt" at the end of /media/:slug, after the photos.
 * The admin always sees both sections with a link field; the client only sees a section once
 * its link is saved. "Video scurt" plays inline (YouTube / Vimeo / Drive); "Video lung" is never
 * played on the page — the client only gets a download button that opens the link.
 * "Video scurt" is edited in the uploaded-video section (AlbumShortVideoManager); here it only plays
 * the link, and only while no file is uploaded — the uploaded file wins.
 */
import { useEffect, useState } from "react";
import {
  ALBUM_VIDEO_KINDS,
  ALBUM_VIDEO_META,
  isVerticalVideoLink,
  normalizeVideoLink,
  videoEmbedUrl,
  type AlbumVideoKind,
  type AlbumVideoLinks,
} from "../../../shared/albumVideoLinks";
import styles from "./MediaAlbumPage.module.scss";

type Props = {
  slug: string;
  isAdmin: boolean;
  accessToken: string | null;
  hasUploadedShort: boolean;
};

function VideoPlayer({ link, title, playable }: { link: string; title: string; playable: boolean }) {
  const embed = playable ? videoEmbedUrl(link) : null;
  if (!embed) {
    return (
      <div className={styles.actions}>
        <a className={styles.downloadBtn} href={link} target="_blank" rel="noopener noreferrer">
          {playable ? "▶ DESCHIDE" : "⬇ DESCARCĂ"} {title.toUpperCase()}
        </a>
      </div>
    );
  }
  const vertical = isVerticalVideoLink(link);
  return (
    <div className={styles.mediaCenter}>
      <div className={`${styles.videoWrap} !rounded-none`} style={vertical ? { aspectRatio: "9 / 16", maxWidth: 360 } : undefined}>
        <iframe
          className={styles.video}
          src={embed}
          title={title}
          loading="lazy"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function AdminVideoLinkForm({
  kind,
  saved,
  onSave,
}: {
  kind: AlbumVideoKind;
  saved: string;
  onSave: (kind: AlbumVideoKind, link: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setDraft(saved), [saved]);

  const submit = async (link: string) => {
    if (normalizeVideoLink(link) === null) {
      setMessage("Linkul trebuie să înceapă cu https://");
      return;
    }
    setBusy(true);
    setMessage(null);
    const error = await onSave(kind, link);
    setBusy(false);
    setMessage(error ?? (link.trim() ? "Salvat — clientul vede acum secțiunea." : "Șters — secțiunea e ascunsă pentru client."));
  };

  return (
    <form
      className="mb-6 border border-neutral-700 bg-neutral-950 p-3"
      onSubmit={(e) => { e.preventDefault(); void submit(draft); }}
    >
      <p className="mb-2 text-xs text-neutral-400">
        {saved ? "🛠 Admin · vizibil pentru client" : "🛠 Admin · ascuns pentru client până adaugi un link"}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="url"
          inputMode="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={ALBUM_VIDEO_META[kind].placeholder}
          aria-label={`Link ${ALBUM_VIDEO_META[kind].title}`}
          className="min-w-0 flex-1 border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
        />
        <button
          type="submit"
          disabled={busy || draft.trim() === saved}
          className="border border-white bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
        >
          {busy ? "Se salvează..." : saved ? "Înlocuiește" : "Salvează"}
        </button>
        {saved && (
          <button
            type="button"
            disabled={busy}
            onClick={() => { if (!window.confirm(`Ștergi linkul pentru ${ALBUM_VIDEO_META[kind].title}?`)) return; setDraft(""); void submit(""); }}
            className="border border-neutral-600 px-4 py-2 text-sm text-neutral-300 hover:border-white disabled:opacity-40"
          >
            Șterge
          </button>
        )}
      </div>
      {message && <p className="mt-2 text-xs text-neutral-300" role="status">{message}</p>}
    </form>
  );
}

export default function AlbumVideoLinksSection({ slug, isAdmin, accessToken, hasUploadedShort }: Props) {
  const [links, setLinks] = useState<AlbumVideoLinks>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/album/${encodeURIComponent(slug)}/video-links`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { links?: AlbumVideoLinks } | null) => { if (!cancelled) setLinks(data?.links ?? {}); })
      .catch(() => { if (!cancelled) setLinks({}); });
    return () => { cancelled = true; };
  }, [slug]);

  const save = async (kind: AlbumVideoKind, link: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/album/${encodeURIComponent(slug)}/video-links`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken ?? ""}` },
        body: JSON.stringify({ [kind]: link.trim() }),
      });
      if (!response.ok) return response.status === 400 ? "Link invalid." : "Nu s-a putut salva. Încearcă din nou.";
      const data = await response.json() as { links?: AlbumVideoLinks };
      setLinks(data.links ?? {});
      return null;
    } catch {
      return "Nu s-a putut salva. Verifică conexiunea.";
    }
  };

  const visible = ALBUM_VIDEO_KINDS.filter((kind) =>
    kind === "short" ? Boolean(links.short) && !hasUploadedShort : isAdmin || Boolean(links[kind]));
  if (visible.length === 0) return null;

  return (
    <section aria-label="Video">
      {visible.map((kind) => {
        const link = links[kind] ?? "";
        const { title } = ALBUM_VIDEO_META[kind];
        return (
          <div key={kind} data-testid={`album-video-${kind}`}>
            <h2 className={styles.sectionTitle}>{title}</h2>
            {link && <VideoPlayer link={link} title={title} playable={kind === "short"} />}
            {isAdmin && kind !== "short" && <AdminVideoLinkForm kind={kind} saved={link} onSave={save} />}
          </div>
        );
      })}
    </section>
  );
}
