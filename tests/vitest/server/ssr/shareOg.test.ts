// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";

const template = `<html><head>
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="https://www.ancavisuals.ro/" />
    <meta property="og:title" content="AncaVisuals – Fotograf" />
    <meta property="og:description" content="Foto & video" />
    <meta property="og:url" content="https://www.ancavisuals.ro/" />
    <meta property="og:image" content="https://www.ancavisuals.ro/og-image.jpg" />
</head><body></body></html>`;

const id = "3f9a1c2b4d5e6f708192";
const readShareRecord = vi.fn();
vi.mock("src/server/services/share.store", () => ({ readShareRecord }));
vi.mock("src/server/constants/domain", () => ({ APP_BASE_URL: "https://ancavisuals.ro" }));

afterEach(() => readShareRecord.mockReset());

test("a share link previews the first photo with a neutral title, no album name, and noindex", async () => {
  const { shareOgFor } = await import("src/server/ssr/shareOg");
  readShareRecord.mockResolvedValue({ id, slug: "petcu-nunta", items: ["a.jpg", "b.jpg", "c.jpg"], expiresAt: Date.now() + 1e6, revoked: false });
  const html = await shareOgFor(template, `/share/${id}`);
  expect(html).toContain(`<meta property="og:image" content="https://ancavisuals.ro/api/share/${id}/preview.jpg" />`);
  expect(html).toContain('<meta property="og:title" content="Pozele făcute de AncaVisuals" />');
  expect(html).toContain("3 fotografii alese pentru tine");
  expect(html).toContain('<meta name="robots" content="noindex,nofollow" />');
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  expect(html).not.toContain("petcu");
  expect(html.match(/og:image"/g)).toHaveLength(1);
});

test("other pages are untouched; a revoked share keeps generic tags but is noindex", async () => {
  const { shareOgFor } = await import("src/server/ssr/shareOg");
  expect(await shareOgFor(template, "/oferta/olx")).toBe(template);
  readShareRecord.mockResolvedValue({ id, slug: "x", items: ["a.jpg"], expiresAt: Date.now() + 1e6, revoked: true });
  const html = await shareOgFor(template, `/share/${id}`);
  expect(html).toContain("og-image.jpg");
  expect(html).toContain('content="noindex,nofollow"');
});
