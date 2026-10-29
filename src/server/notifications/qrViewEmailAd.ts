/*
 * Purpose: the ad at the end of the QR Moments "👀 … au vizualizat poza încărcată de tine" email —
 * the guests who get it are often next in line to marry. A few portfolio photos laid out as a
 * masonry (two table columns of photos with their own heights, the only masonry that holds up
 * in Gmail/Outlook) and a button to the price configurator on /oferta.
 */
import { firestore } from "../firestore";
import { APP_BASE_URL } from "../constants/domain";
import type { QrEventType } from "../../shared/qrMoments/hostRoles";

export const AD_PHOTO_COUNT = 6;
/** Put in an email that already carries its own ad, so the shared marketing footer is not added too. */
export const NO_MARKETING_FOOTER_MARK = "<!--av-no-marketing-footer-->";

const CACHE_MS = 10 * 60 * 1000;
let cache: { expiresAt: number; urls: string[] } | undefined;

const escapeAttribute = (value: string) =>
  value.replace(/[&"<>]/g, (char) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[char]!);

export const configuratorAdUrl = () =>
  `${APP_BASE_URL}/oferta?utm_source=qr-moments&utm_medium=email&utm_campaign=vizualizare#configurator`;

/** Same pick for the whole day, a different one the next day: `seed` = days since epoch. */
export function pickAdPhotos(urls: string[], seed: number, count = AD_PHOTO_COUNT): string[] {
  if (urls.length <= count) return urls;
  const start = (seed * count) % urls.length;
  return Array.from({ length: count }, (_, index) => urls[(start + index) % urls.length]);
}

/** Portfolio photos (Media Assets), the WebP copy when there is one. Empty when none load. */
export async function loadAdPhotos(): Promise<string[]> {
  if (!cache || cache.expiresAt <= Date.now()) {
    try {
      const snapshot = await firestore().collection("offer_media_assets").get();
      const urls = new Set<string>();
      snapshot.docs.forEach((doc) => {
        const asset = doc.data();
        if (asset.kind && asset.kind !== "image") return;
        const url = asset.previewUrl || asset.url;
        if (typeof url !== "string") return;
        try { if (new URL(url).protocol === "https:") urls.add(url); } catch { /* not a URL */ }
      });
      cache = { urls: [...urls], expiresAt: Date.now() + CACHE_MS };
    } catch (error) {
      console.warn("[qr-moments] could not load the email ad photos:", error);
      cache = { urls: [], expiresAt: Date.now() + 60_000 };
    }
  }
  return pickAdPhotos(cache.urls, Math.floor(Date.now() / 86_400_000));
}

const HEADLINE: Record<QrEventType, { title: string; text: string; button: string }> = {
  nunta: {
    title: "Urmează nunta ta? 💍",
    text: "Fotografie, video, fotocabină și QR Code Moments, ca la evenimentul la care ai fost. Alege ce vrei și vezi prețul pe loc.",
    button: "Calculează-ți oferta →",
  },
  botez: {
    title: "Urmează un botez sau o nuntă? 💛",
    text: "Fotografie, video, fotocabină și QR Code Moments, ca la evenimentul la care ai fost. Alege ce vrei și vezi prețul pe loc.",
    button: "Calculează-ți oferta →",
  },
  corporate: {
    title: "Organizezi un eveniment?",
    text: "Fotografie, video, fotocabină și QR Code Moments pentru evenimentul tău. Alege ce vrei și vezi prețul pe loc.",
    button: "Calculează oferta →",
  },
};

function photoCell(url: string): string {
  return `<a href="${escapeAttribute(configuratorAdUrl())}" style="display:block;margin:0 0 8px;text-decoration:none;">
          <img src="${escapeAttribute(url)}" alt="Fotografie AncaVisuals" width="252" style="display:block;width:100%;max-width:252px;height:auto;border:0;">
        </a>`;
}

/** Photos alternate between the two columns, so their different heights give the masonry. */
export function renderOfferAd(photos: string[], eventType: QrEventType): string {
  const copy = HEADLINE[eventType] ?? HEADLINE.nunta;
  const columns: [string[], string[]] = [[], []];
  photos.forEach((url, index) => columns[index % 2].push(photoCell(url)));
  const masonry = photos.length >= 2
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;margin:0 0 8px;"><tr>
        <td width="50%" valign="top" style="padding:0 4px 0 0;">${columns[0].join("")}</td>
        <td width="50%" valign="top" style="padding:0 0 0 4px;">${columns[1].join("")}</td>
      </tr></table>`
    : "";

  return `${NO_MARKETING_FOOTER_MARK}
    <div style="max-width:560px;margin:18px auto 0;background:#ffffff;border:1px solid #e5e5e5;padding:24px 20px;font-family:Arial,Helvetica,sans-serif;color:#111111;">
      <p style="margin:0 0 10px;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#737373;">AncaVisuals</p>
      <h2 style="margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:600;color:#111111;">${copy.title}</h2>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#404040;">${copy.text}</p>
      ${masonry}
      <p style="margin:12px 0 0;text-align:center;">
        <a href="${escapeAttribute(configuratorAdUrl())}" style="display:inline-block;background:#111111;color:#ffffff;padding:14px 28px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;">${copy.button}</a>
      </p>
      <p style="margin:10px 0 0;text-align:center;font-size:12px;color:#737373;">🎁 QR Code Moments gratuit pentru evenimentul tău</p>
    </div>`;
}

/** Same message and link as "Recomandă-ne pe WhatsApp" on /share pages. */
export function referralWhatsAppUrl(): string {
  const text = `Bună! Vă recomand AncaVisuals dacă doriți fotograf și videograf la nuntă. Acum au fotocabina toată ziua la 200 € în loc de 450 €, iar QR code-ul e inclus: ${APP_BASE_URL}/oferta?utm_source=recomandare`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** "Trimite-l cuiva care se căsătorește": the guest gets a photo session once the couple signs (no free booth since 2026-10-29). */
export function renderReferralCta(): string {
  return `
    <div style="max-width:560px;margin:18px auto 0;background:#111111;padding:24px 20px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
      <p style="margin:0 0 10px;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#a3a3a3;">Recomandă-ne</p>
      <h2 style="margin:0 0 10px;font-size:20px;line-height:1.3;font-weight:600;color:#ffffff;">Cunoști pe cineva care se căsătorește? 💍</h2>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#e5e5e5;">Trimite-le acest mesaj. Acum au <strong style="color:#ffffff;">fotocabina toată ziua la 200 € în loc de 450 €</strong>.</p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#e5e5e5;">Iar tu primești <strong style="color:#ffffff;">o ședință foto gratuită</strong> 📸</p>
      <a href="${escapeAttribute(referralWhatsAppUrl())}" style="display:inline-block;background:#ffffff;color:#111111;padding:13px 24px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;">Trimite pe WhatsApp →</a>
      <p style="margin:14px 0 0;font-size:11px;color:#a3a3a3;">Se aplică <a href="${APP_BASE_URL}/terms#recomandare" style="color:#ffffff;text-decoration:underline;">termeni și condiții</a>.</p>
    </div>`;
}
