import { firestore } from "../firestore";
import { NO_MARKETING_FOOTER_MARK } from "./qrViewEmailAd";

const ADMIN_ONLY_EMAIL = "ancadaniel1994@gmail.com";
const CONFIG_DOC = "global";
const FOOTER_COPY = "Foto · Video · Fotocabină · Videobooth 360 · QR Moments · Invitații digitale · Aplicație de planificare a nunții";

let imageCache: { expiresAt: number; urls: string[] } | undefined;

export function invalidateEmailMarketingFooterCache(): void {
  imageCache = undefined;
}

function escapeAttribute(value: string): string {
  return value.replace(/[&"<>]/g, char => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[char]!);
}

async function getSelectedImages(): Promise<string[]> {
  if (imageCache && imageCache.expiresAt > Date.now()) return imageCache.urls;
  try {
    const db = firestore();
    const config = await db.collection("qr_moments_email_config").doc(CONFIG_DOC).get();
    const assetIds = config.data()?.assetIds;
    if (!Array.isArray(assetIds) || assetIds.length !== 5 || assetIds.some(id => typeof id !== "string")) {
      imageCache = { urls: [], expiresAt: Date.now() + 60_000 };
      return imageCache.urls;
    }
    const docs = await Promise.all(assetIds.map(id => db.collection("offer_media_assets").doc(id).get()));
    const urls = docs.map(doc => {
      const asset = doc.data();
      if (!doc.exists || asset?.kind !== "image") return "";
      const url = asset.previewUrl || asset.url;
      if (typeof url !== "string") return "";
      try { return new URL(url).protocol === "https:" ? url : ""; } catch { return ""; }
    });
    imageCache = { urls: urls.length === 5 && urls.every(Boolean) ? urls : [], expiresAt: Date.now() + 5 * 60_000 };
    return imageCache.urls;
  } catch (error) {
    console.warn("[email] could not load selected marketing footer photos:", error);
    imageCache = { urls: [], expiresAt: Date.now() + 60_000 };
    return imageCache.urls;
  }
}

function renderFooter(images: string[]): string {
  if (images.length !== 5) return "";
  const photos = images.map(url => `
    <td width="33.33%" valign="middle" style="padding:0 4px;">
      <img src="${escapeAttribute(url)}" alt="AncaVisuals — fotografie de eveniment" width="135" height="140" style="display:block;width:100%;max-width:135px;height:140px;margin:0 auto;border:0;border-radius:10px;object-fit:contain;background:#fff;">
    </td>`).join("");
  return `
    <div style="width:100%;max-width:760px;box-sizing:border-box;margin:30px auto 0;padding:22px 18px 20px;background:#f8f2e8;border:1px solid #e8d9c1;border-radius:16px;font-family:Arial,sans-serif;color:#29231d;">
      <p style="margin:0 0 6px;color:#a66d20;font-size:11px;letter-spacing:3px;font-weight:700;">ANCAVISUALS</p>
      <h2 style="margin:0 0 15px;color:#29231d;font-size:20px;line-height:1.3;font-weight:700;">Păstrează emoția evenimentului tău</h2>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;"><tr>${photos}</tr></table>
      <p style="margin:15px 0 12px;color:#685b4c;font-size:12px;line-height:1.6;">${FOOTER_COPY}</p>
      <a href="https://ancavisuals.ro" style="display:inline-block;padding:10px 18px;background:#d99a35;border-radius:999px;color:#241f1a;text-decoration:none;font-size:13px;font-weight:700;">Descoperă AncaVisuals</a>
    </div>`;
}

export async function appendEmailFooters(html: string, recipient: string): Promise<string> {
  const normalized = recipient.trim().toLowerCase();
  // An email with its own ad (QR Moments "au vizualizat") skips this one.
  const marketing = normalized === ADMIN_ONLY_EMAIL || html.includes(NO_MARKETING_FOOTER_MARK) ? "" : renderFooter(await getSelectedImages());
  const additions = `${marketing}${CONTACT_FOOTER}`;
  if (html.trimStart().startsWith("<!DOCTYPE")) {
    if (/<\/body\s*>/i.test(html)) return html.replace(/<\/body\s*>/i, `${additions}</body>`);
    if (/<\/html\s*>/i.test(html)) return html.replace(/<\/html\s*>/i, `${additions}</html>`);
    return `${html}${additions}`;
  }
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="UTF-8"></head><body>${html}${additions}</body></html>`;
}

const CONTACT_EMAIL = "info@ancavisuals.ro";
const CONTACT_WHATSAPP_URL = "https://wa.me/40745469907";
const CONTACT_FOOTER = `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;font-family:sans-serif;font-size:13px;color:#666;">
    Ne puteți contacta prin email la <a href="mailto:${CONTACT_EMAIL}" style="color:#666;">${CONTACT_EMAIL}</a>
    sau prin <a href="${CONTACT_WHATSAPP_URL}" style="color:#666;">WhatsApp</a>.
  </div>
`;
