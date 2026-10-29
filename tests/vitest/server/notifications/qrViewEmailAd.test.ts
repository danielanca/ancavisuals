import { describe, expect, test } from "vitest";
import { buildViewNotificationEmail } from "src/server/routes/qrMoments.routes";
import { NO_MARKETING_FOOTER_MARK, pickAdPhotos, referralWhatsAppUrl, renderOfferAd } from "src/server/notifications/qrViewEmailAd";
import { appendEmailFooters } from "src/server/notifications/emailMarketingFooter";

const photos = ["https://cdn.example.com/1.webp", "https://cdn.example.com/2.webp", "https://cdn.example.com/3.webp", "https://cdn.example.com/4.webp"];

describe("QR Moments 'au vizualizat' email", () => {
  test("is branded, white and square, with the ad and the referral CTA", () => {
    const { html } = buildViewNotificationEmail("Maria", "Ana și Dan", "guest-1", null, "poza încărcată", "nunta", photos);
    expect(html).toContain("ANCA VISUALS");
    expect(html).toContain("Foto · Video · Fotocabină · Video booth 360 · QR Moments");
    expect(html).toContain("/oferta?utm_source=qr-moments&amp;utm_medium=email&amp;utm_campaign=vizualizare#configurator");
    expect(html).toContain("Cunoști pe cineva care se căsătorește?");
    expect(html).toContain("/terms#recomandare");
    expect(html).not.toMatch(/border-radius|#e0a13b|#b7791f/);
  });

  test("lays the photos out in two columns (masonry)", () => {
    const ad = renderOfferAd(photos, "nunta");
    const columns = ad.split('<td width="50%"').slice(1);
    expect(columns).toHaveLength(2);
    expect(columns[0]).toContain("1.webp");
    expect(columns[0]).toContain("3.webp");
    expect(columns[1]).toContain("2.webp");
  });

  test("the referral link is the photo booth recommendation, without the guest's name", () => {
    const text = decodeURIComponent(referralWhatsAppUrl().split("text=")[1]);
    expect(text).toContain("fotocabina toată ziua la 200 € în loc de 450 €");
    expect(text).not.toContain("gratuit");
    expect(text).not.toContain("recomandat");
    expect(text).toContain("/oferta?utm_source=recomandare");
  });

  test("picks the same photos all day and others the next day", () => {
    const many = Array.from({ length: 20 }, (_, index) => `u${index}`);
    expect(pickAdPhotos(many, 5)).toEqual(pickAdPhotos(many, 5));
    expect(pickAdPhotos(many, 5)).not.toEqual(pickAdPhotos(many, 6));
    expect(pickAdPhotos(photos, 1)).toEqual(photos);
  });

  test("skips the shared marketing footer when the email carries its own ad", async () => {
    const html = await appendEmailFooters(`<p>x</p>${NO_MARKETING_FOOTER_MARK}`, "guest@example.com");
    expect(html).not.toContain("Păstrează emoția evenimentului tău");
  });
});
