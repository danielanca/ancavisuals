import { describe, expect, test } from "vitest";
import { normalizeOfferHeroVideo } from "src/shared/offers/offerServices";

describe("offer landing videos", () => {
  test("keeps https links only and drops empty fields", () => {
    expect(normalizeOfferHeroVideo({ clipUrl: " https://cdn.test/a.mp4 ", filmUrl: "", other: "https://x" }))
      .toEqual({ clipUrl: "https://cdn.test/a.mp4" });
    expect(normalizeOfferHeroVideo({ clipUrl: "javascript:alert(1)", filmUrl: "http://cdn.test/f.mp4" })).toEqual({});
    expect(normalizeOfferHeroVideo(null)).toEqual({});
  });
});
