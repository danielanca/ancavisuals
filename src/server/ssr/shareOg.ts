/*
 * Purpose: link previews for /share/<id>. WhatsApp, Messenger & co. read the Open Graph tags
 * from the server HTML (no JavaScript), so the page's site-wide tags are swapped for the
 * share's own: neutral title (no album or couple name — the link is anonymous), the photo
 * count, and the first chosen photo via /api/share/<id>/preview.jpg. Also noindex: these
 * are private links and must never show up in search.
 */
import { readShareRecord } from "../services/share.store";
import { APP_BASE_URL } from "../constants/domain";

const SHARE_PATH = /^\/share\/([a-f0-9]{20})\/?$/;

export const shareIdFromPath = (path: string): string | null => SHARE_PATH.exec(path)?.[1] ?? null;

const escAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function setMeta(html: string, attr: "property" | "name", key: string, content: string): string {
  const tag = `<meta ${attr}="${key}" content="${escAttr(content)}" />`;
  const existing = new RegExp(`<meta\\s+${attr}="${key.replace(/[.:]/g, "\\$&")}"[^>]*>`, "i");
  return existing.test(html) ? html.replace(existing, tag) : html.replace("</head>", `${tag}\n</head>`);
}

export function applyShareOg(html: string, id: string, count: number | null): string {
  const base = APP_BASE_URL.replace(/\/+$/, "");
  const description = count && count > 0
    ? `${count} ${count === 1 ? "fotografie aleasă" : "fotografii alese"} pentru tine. Apasă ca să le vezi și să le descarci.`
    : "Fotografii alese pentru tine. Apasă ca să le vezi și să le descarci.";
  let out = html;
  out = setMeta(out, "property", "og:title", "Pozele făcute de AncaVisuals");
  out = setMeta(out, "property", "og:description", description);
  out = setMeta(out, "property", "og:url", `${base}/share/${id}`);
  out = setMeta(out, "property", "og:image", `${base}/api/share/${id}/preview.jpg`);
  out = setMeta(out, "property", "og:image:width", "1200");
  out = setMeta(out, "property", "og:image:height", "630");
  out = setMeta(out, "property", "og:image:type", "image/jpeg");
  out = setMeta(out, "name", "twitter:card", "summary_large_image");
  out = setMeta(out, "name", "robots", "noindex,nofollow");
  out = out.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${base}/share/${id}" />`);
  return out;
}

/** Same as applyShareOg, reading the photo count; a missing/expired share keeps the generic tags but stays noindex. */
export async function shareOgFor(html: string, path: string): Promise<string> {
  const id = shareIdFromPath(path);
  if (!id) return html;
  try {
    const rec = await readShareRecord(id);
    if (rec.revoked || Date.now() > rec.expiresAt) return setMeta(html, "name", "robots", "noindex,nofollow");
    return applyShareOg(html, id, rec.items.length);
  } catch {
    return setMeta(html, "name", "robots", "noindex,nofollow");
  }
}
