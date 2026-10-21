import { describe, expect, test } from "vitest";
import { coupleSmsMessage, describeQrUploads, emptyQrUploadCounts, smsLink } from "src/shared/qrMoments/coupleSms";

describe("QR Moments SMS to the couple", () => {
  test("lists what the guests left", () => {
    expect(describeQrUploads({ ...emptyQrUploadCounts(), photo: 12, video: 1, text: 2 })).toBe("12 poze, un videoclip și 2 urări scrise");
    expect(describeQrUploads({ ...emptyQrUploadCounts(), photo: 1 })).toBe("o poză");
    expect(describeQrUploads(emptyQrUploadCounts())).toBe("câteva amintiri");
  });

  test("greets with the event date and ends with the gallery link and the automated label", () => {
    const message = coupleSmsMessage("26august2026", { ...emptyQrUploadCounts(), photo: 3 }, "https://ancavisuals.ro/qr-moments/26august2026/gallery?pin=1234");
    expect(message).toMatch(/^Bună ziua! Suntem echipa foto-video de la evenimentul din data de 26 august 2026\./);
    expect(message).toContain("Invitații v-au lăsat 3 poze în QR Code Moments. Le puteți vedea aici: https://ancavisuals.ro/qr-moments/26august2026/gallery?pin=1234");
    expect(message).toMatch(/ancavisuals\.ro\.$/);
  });

  test("builds an sms: link that works on Android and iPhone", () => {
    expect(smsLink("+40745000000", "Bună ziua & salut")).toBe("sms:+40745000000?&body=Bun%C4%83%20ziua%20%26%20salut");
  });
});
