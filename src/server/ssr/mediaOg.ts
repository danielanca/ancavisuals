/*
 * Purpose: link preview for /media/<slug> (the album link sent to clients on WhatsApp & co.).
 * Those apps read the Open Graph tags from the server HTML, so the site-wide tags are swapped
 * for the album's own (owner, 2026-10-29): title "Album poze · 8 august 2026" and the album's
 * first photo via /api/album/<slug>/preview.jpg. An album without photos keeps the site image.
 */
import { APP_BASE_URL } from "../constants/domain";
import { eventDateFromSlug } from "../../shared/albumUpdates";
import { loadAlbum, resolveAlbumSlug } from "../services/album.service";
import { setMeta } from "./shareOg";

// Only the album page itself, not /media/<slug>/feedback & co.
const MEDIA_PATH = /^\/media\/([a-z0-9][a-z0-9_-]{0,120})\/?$/i;

export const mediaSlugFromPath = (path: string): string | null => MEDIA_PATH.exec(path)?.[1] ?? null;

export function mediaAlbumTitle(slug: string): string {
  const date = eventDateFromSlug(slug);
  return date ? `Album poze · ${date}` : "Album poze · Anca Visuals";
}

export function applyMediaOg(html: string, slug: string, hasPhoto: boolean): string {
  const base = APP_BASE_URL.replace(/\/+$/, "");
  const date = eventDateFromSlug(slug);
  const title = mediaAlbumTitle(slug);
  const description = `${date ? `Fotografiile de la evenimentul din ${date}` : "Fotografiile evenimentului"} · Anca Visuals. Apasă ca să le vezi și să le descarci.`;
  let out = html;
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", description);
  out = setMeta(out, "property", "og:url", `${base}/media/${slug}`);
  out = setMeta(out, "name", "description", description);
  if (hasPhoto) {
    out = setMeta(out, "property", "og:image", `${base}/api/album/${slug}/preview.jpg`);
    out = setMeta(out, "property", "og:image:width", "1200");
    out = setMeta(out, "property", "og:image:height", "630");
    out = setMeta(out, "property", "og:image:type", "image/jpeg");
    out = setMeta(out, "name", "twitter:card", "summary_large_image");
  }
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${title.replace(/</g, "&lt;")}</title>`);
  return out;
}

/** Album pages get their own title and first photo; anything else (or a missing album) is left as is. */
export async function mediaOgFor(html: string, path: string): Promise<string> {
  const requested = mediaSlugFromPath(path);
  if (!requested) return html;
  try {
    const slug = await resolveAlbumSlug(requested);
    const album = await loadAlbum(slug);
    if (!album) return html;
    return applyMediaOg(html, requested, album.photos.length > 0 || album.featured.length > 0);
  } catch {
    return html;
  }
}
