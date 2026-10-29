/*
 * Purpose: an album link (/media/<slug>) shared on WhatsApp shows "Album poze · <date>" and the
 * album's first photo; a missing album or another /media page keeps the site's own tags.
 */
import sharp from "sharp";
import { describe, expect, test, vi } from "vitest";

const albums: Record<string, { photos: string[]; featured: string[] }> = {
  "8august2026": { photos: ["https://cdn.test/8august2026/photos_preview/a.webp"], featured: [] },
  "fara-poze": { photos: [], featured: [] },
};
vi.mock("src/server/services/album.service", () => ({
  resolveAlbumSlug: async (slug: string) => (slug === "08august2026" ? "8august2026" : slug),
  loadAlbum: async (slug: string) => albums[slug] ?? null,
}));
vi.mock("src/server/constants/domain", () => ({ APP_BASE_URL: "https://ancavisuals.ro" }));

const template = `<html><head><title>AncaVisuals – Fotograf</title>
<meta property="og:title" content="AncaVisuals – Fotograf" />
<meta property="og:description" content="site" />
<meta property="og:image" content="https://ancavisuals.ro/og.jpg" />
</head><body></body></html>`;

const meta = (html: string, key: string) => new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`).exec(html)?.[1];

describe("mediaOgFor", () => {
  test("title 'Album poze · date' and the album's first photo", async () => {
    const { mediaOgFor } = await import("src/server/ssr/mediaOg");
    const html = await mediaOgFor(template, "/media/08august2026");
    expect(meta(html, "og:title")).toBe("Album poze · 8 august 2026");
    expect(html).toContain("<title>Album poze · 8 august 2026</title>");
    expect(meta(html, "og:description")).toBe("Fotografiile de la evenimentul din 8 august 2026 · Anca Visuals. Apasă ca să le vezi și să le descarci.");
    expect(meta(html, "og:image")).toBe("https://ancavisuals.ro/api/album/08august2026/preview.jpg");
    expect(meta(html, "og:url")).toBe("https://ancavisuals.ro/media/08august2026");
  });

  test("an album without photos keeps the site image; a missing album or a sub-page is untouched", async () => {
    const { mediaOgFor } = await import("src/server/ssr/mediaOg");
    const empty = await mediaOgFor(template, "/media/fara-poze");
    expect(meta(empty, "og:title")).toBe("Album poze · Anca Visuals");
    expect(meta(empty, "og:image")).toBe("https://ancavisuals.ro/og.jpg");
    expect(await mediaOgFor(template, "/media/nu-exista")).toBe(template);
    expect(await mediaOgFor(template, "/media/8august2026/feedback")).toBe(template);
  });
});

describe("albumPreviewJpeg", () => {
  test("1200×630; a portrait photo keeps its upper part", async () => {
    vi.doMock("src/server/firestore", () => ({ firestore: () => ({}) }));
    const { albumPreviewJpeg } = await import("src/server/routes/album.routes");
    // Portrait: white top third (the face), black below.
    const top = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const portrait = await sharp({ create: { width: 600, height: 1200, channels: 3, background: "#000000" } })
      .composite([{ input: top, top: 0, left: 0 }]).jpeg().toBuffer();
    const out = await albumPreviewJpeg(portrait);
    const { width, height } = await sharp(out).metadata();
    expect([width, height]).toEqual([1200, 630]);
    const { dominant } = await sharp(out).stats();
    expect(dominant.r).toBeGreaterThan(128); // mostly the white top, not the black middle
  });
});
