import { expect, test } from "vitest";
import { smsShareUrl, whatsappShareText, whatsappShareUrl } from "src/client/pages/MediaDownload/whatsappShare";

const link = "https://ancavisuals.ro/share/3f9a1c2b4d5e6f708192";

test("the message starts with 'Pozele făcute de AncaVisuals:' followed by the anonymous link", () => {
  expect(whatsappShareText(link)).toBe(`Pozele făcute de AncaVisuals: ${link}`);
});

test("WhatsApp (contact picker) and SMS open with exactly that text", () => {
  expect(whatsappShareUrl(link)).toBe(`https://wa.me/?text=${encodeURIComponent(`Pozele făcute de AncaVisuals: ${link}`)}`);
  expect(smsShareUrl(link)).toBe(`sms:?&body=${encodeURIComponent(`Pozele făcute de AncaVisuals: ${link}`)}`);
});
