import { describe, expect, test } from "vitest";
import { offerGalleryPhotos } from "src/client/pages/Portfolio/PortfolioGallery";

describe("offerGalleryPhotos (QR Moments gallery = the offer's photos)", () => {
  test("keeps the offer order per device, prefers the WebP copy and skips videos and heavy photos", () => {
    const photos = offerGalleryPhotos([
      { assets: [
        { kind: "image", url: "a.jpg", displayUrl: "a.webp", sizeBytes: 200_000 },
        { kind: "video", url: "film.mp4" },
        { kind: "image", url: "heavy.jpg", sizeBytes: 5_000_000 },
      ], assetsMobile: [{ kind: "image", url: "m.jpg" }] },
      { assets: [{ url: "b.jpg" }] },
    ]);
    expect(photos).toEqual({ desktop: ["a.webp", "b.jpg"], mobile: ["m.jpg"] });
  });
});

describe("dense gallery thumbnails", () => {
  test("alternate heights so the masonry shows even with same-shaped photos", async () => {
    const { denseRatio } = await import("src/client/pages/Portfolio/PortfolioGallery");
    const column = [0, 1, 2, 3].map((index) => denseRatio(index, 0));
    expect(new Set(column).size).toBeGreaterThan(2);
    expect(denseRatio(0, 0)).not.toBe(denseRatio(0, 1));
  });
});
