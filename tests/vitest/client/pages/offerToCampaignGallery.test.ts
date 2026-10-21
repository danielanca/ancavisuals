/*
 * Purpose: the portfolio of /oferta/olx (and /contact) is the template's "Fotografie" section
 * only — the album and QR Moments photos must not be appended at the end of the gallery.
 */
import { describe, expect, test, vi } from "vitest";

vi.mock("src/client/pages/CampaignLanding/CampaignLandingPage", () => ({ default: () => null, isHeavyPhoto: () => false }));

import { offerToCampaign, type Offer } from "src/client/pages/OfertaPage";

const image = (id: string) => ({ id, kind: "image" as const, url: `https://cdn.test/${id}.jpg`, label: id });
const section = (id: string, assets: ReturnType<typeof image>[], assetsMobile: ReturnType<typeof image>[] = []) =>
  ({ id, label: id, description: "", basePrice: "", assets, assetsMobile });

const offer = {
  id: "olx", slug: "olx", clientName: "", title: "", description: "", pdfUrl: "", price: "", packageName: "", validUntil: "",
  selectedServices: ["photo", "album", "qrmoments"],
  serviceSections: [
    section("photo", [image("p1"), image("p2")], [image("p2")]),
    section("album", [image("album1")]),
    section("qrmoments", [image("qr")]),
  ],
} as unknown as Offer;

describe("offerToCampaign gallery", () => {
  test("uses only the Fotografie section, per device", () => {
    const page = offerToCampaign(offer);
    expect(page.galleryDesktop?.map((item) => item.url)).toEqual(["https://cdn.test/p1.jpg", "https://cdn.test/p2.jpg"]);
    expect(page.galleryMobile?.map((item) => item.url)).toEqual(["https://cdn.test/p2.jpg"]);
    expect(page.gallery.map((item) => item.url)).not.toContain("https://cdn.test/album1.jpg");
  });
});
