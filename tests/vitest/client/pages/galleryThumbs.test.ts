import { describe, expect, it } from "vitest";
import { galleryOriginals, galleryRatios, galleryTileUrl } from "src/client/pages/CampaignLanding/CampaignLandingPage";

const withThumb = { url: "https://cdn/a.preview.webp", thumbUrl: "https://cdn/a.thumb.webp", originalUrl: "https://cdn/a.jpg", bunnyPath: "a", width: 1600, height: 1067 };
const legacy = { url: "https://cdn/b.preview.webp", originalUrl: "https://cdn/b.jpg", bunnyPath: "b", width: 1067, height: 1600 };

describe("gallery thumbnails", () => {
  it("tiles load the small thumbnail when there is one, the shown file otherwise", () => {
    expect(galleryTileUrl(withThumb)).toBe("https://cdn/a.thumb.webp");
    expect(galleryTileUrl(legacy)).toBe("https://cdn/b.preview.webp");
  });
  it("ratios and click-to-open originals are keyed by the tile URL", () => {
    expect(galleryRatios([withThumb, legacy])).toEqual({ "https://cdn/a.thumb.webp": 1600 / 1067, "https://cdn/b.preview.webp": 1067 / 1600 });
    expect(galleryOriginals([withThumb, legacy])).toEqual({ "https://cdn/a.thumb.webp": "https://cdn/a.jpg", "https://cdn/b.preview.webp": "https://cdn/b.jpg" });
  });
  it("a thumbnail without a separate original opens the shown file", () => {
    expect(galleryOriginals([{ ...withThumb, originalUrl: undefined }])).toEqual({ "https://cdn/a.thumb.webp": "https://cdn/a.preview.webp" });
  });
});
