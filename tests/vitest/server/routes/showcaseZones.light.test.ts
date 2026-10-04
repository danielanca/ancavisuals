/* eslint-disable @typescript-eslint/no-explicit-any -- reaches into Express router internals and mock req/res */
/*
 * Purpose: public showcase zones never send full-resolution album originals (they get the
 * album's optimized preview) nor photos over 350 KB — the admin gets those, flagged; videos stay.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const CDN = "https://cdn.test";
const SIZES: Record<string, number> = {
  [`${CDN}/album/photos/A.jpg`]: 4_000_000,
  [`${CDN}/album/photos_preview/A.webp`]: 120_000,
  [`${CDN}/album/photos/B.jpg`]: 3_000_000, // no preview
  [`${CDN}/offers-assets/photo/big.jpg`]: 2_500_000,
  [`${CDN}/offers-assets/photo/small.jpg`]: 200_000,
  [`${CDN}/offers-assets/photo/medium.jpg`]: 400_000, // over 350 KB
};

// HEADs that finished without a size: B has no preview.
const MISSING = new Set([`${CDN}/album/photos_preview/B.webp`]);

async function load(urls: string[], sizes: Record<string, number> = SIZES) {
  vi.stubEnv("BUNNY_CDN_DOMAIN", CDN);
  vi.doMock("src/server/utils/signBunnyUrl", () => ({ signBunnyUrl: (path: string) => `${CDN}${path}?token=t` }));
  vi.doMock("src/server/utils/remoteFileSize", () => ({
    remoteFileSizes: async (list: string[]) => new Map(list.map((url) => [url, sizes[url]])),
    isKnownMissing: (url: string) => MISSING.has(url),
  }));
  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({ requireFirebaseAuth: vi.fn(), requireSupremeAdmin: vi.fn() }));
  const get = vi.fn().mockResolvedValue({ exists: true, data: () => ({ photos: urls.map((url) => ({ url })) }) });
  vi.doMock("src/server/firestore", () => ({ firestore: () => ({ collection: () => ({ doc: () => ({ get }) }) }) }));
  const router = (await import("src/server/routes/showcase-zones.routes")).default as any;
  const layer = router.stack.find((l: any) => l.route?.path === "/:id" && l.route.methods.get);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

const call = async (handler: any, cookie = "") => {
  const res: any = { json: vi.fn(), status: vi.fn() };
  res.status.mockReturnValue(res);
  await handler({ params: { id: "media_footer" }, headers: { cookie } }, res);
  return res.json.mock.calls[0][0] as { photos: string[]; heavy?: Record<string, number> };
};

const stored = [
  `${CDN}/album/photos/A.jpg?token=old`,
  `${CDN}/album/photos/B.jpg`,
  `${CDN}/offers-assets/photo/big.jpg`,
  `${CDN}/offers-assets/photo/small.jpg`,
  `${CDN}/offers-assets/photo/medium.jpg`,
  `${CDN}/homepage/clip.mp4`,
];

describe("showcase zones: light photos", () => {
  beforeEach(() => { vi.resetModules(); });

  test("visitors get previews instead of originals and nothing over 350 KB; videos stay", async () => {
    const { photos, heavy } = await call(await load(stored));
    expect(heavy).toBeUndefined();
    expect(photos).toEqual([
      `${CDN}/album/photos_preview/A.webp?token=t`,
      `${CDN}/offers-assets/photo/small.jpg?token=t`,
      `${CDN}/homepage/clip.mp4?token=t`,
    ]);
  });

  test("the admin still gets the heavy photos, listed in `heavy` (previews still swapped in)", async () => {
    const { photos, heavy } = await call(await load(stored), "av_admin=1");
    expect(photos).toContain(`${CDN}/album/photos_preview/A.webp?token=t`);
    expect(photos).toContain(`${CDN}/album/photos/B.jpg?token=t`);
    expect(heavy).toEqual({
      [`${CDN}/album/photos/B.jpg?token=t`]: 3_000_000,
      [`${CDN}/offers-assets/photo/big.jpg?token=t`]: 2_500_000,
      [`${CDN}/offers-assets/photo/medium.jpg?token=t`]: 400_000,
    });
  });

  test("cold cache (sizes still loading): the album preview is sent, never the original", async () => {
    const { photos } = await call(await load([`${CDN}/27iunie2026/photos/Picture-0566.jpg?token=x`], {}));
    expect(photos).toEqual([`${CDN}/27iunie2026/photos_preview/Picture-0566.webp?token=t`]);
  });
});
