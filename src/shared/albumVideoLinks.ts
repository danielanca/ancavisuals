/*
 * Purpose: the album's "Video lung" / "Video scurt" links set by the admin on /media/:slug.
 * Shared so the server validates exactly what the client renders (embed for YouTube/Vimeo/Drive,
 * a plain "open" button for any other https link).
 */

export const ALBUM_VIDEO_KINDS = ["long", "short"] as const;
export type AlbumVideoKind = (typeof ALBUM_VIDEO_KINDS)[number];
export type AlbumVideoLinks = Partial<Record<AlbumVideoKind, string>>;

export const ALBUM_VIDEO_META: Record<AlbumVideoKind, { title: string; placeholder: string }> = {
  long: { title: "Video lung", placeholder: "https://youtube.com/... sau link Drive / Vimeo" },
  short: { title: "Video scurt", placeholder: "https://youtube.com/shorts/... sau link Drive / Vimeo" },
};

const MAX_LINK_LENGTH = 600;

/** "" = clear the link; null = invalid (only https links are accepted, they end up in an iframe or <a>). */
export function normalizeVideoLink(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.length > MAX_LINK_LENGTH) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const YOUTUBE_ID = /^[\w-]{6,20}$/;

/** Embeddable player URL for YouTube, Vimeo and Google Drive; null → show the link as a button. */
export function videoEmbedUrl(link: string): string | null {
  let url: URL;
  try { url = new URL(link); } catch { return null; }
  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" && parts[0] && YOUTUBE_ID.test(parts[0])) {
    return `https://www.youtube-nocookie.com/embed/${parts[0]}`;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = url.searchParams.get("v") ?? (["shorts", "embed", "live"].includes(parts[0] ?? "") ? parts[1] : undefined);
    return id && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "vimeo.com" && parts[0] && /^\d+$/.test(parts[0])) {
    // Unlisted Vimeo links carry a hash as the second segment (vimeo.com/123/abcdef).
    const hash = parts[1] && /^[\da-f]+$/i.test(parts[1]) ? `?h=${parts[1]}` : "";
    return `https://player.vimeo.com/video/${parts[0]}${hash}`;
  }
  if (host === "player.vimeo.com") return url.toString();
  if (host === "drive.google.com") {
    const id = parts[0] === "file" && parts[1] === "d" ? parts[2] : url.searchParams.get("id");
    return id && /^[\w-]+$/.test(id) ? `https://drive.google.com/file/d/${id}/preview` : null;
  }
  return null;
}

/** Shorts are vertical: the player uses a 9:16 box instead of 16:9. */
export function isVerticalVideoLink(link: string): boolean {
  try {
    return new URL(link).pathname.startsWith("/shorts/");
  } catch {
    return false;
  }
}
