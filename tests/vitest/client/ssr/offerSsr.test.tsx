// @vitest-environment node
/*
 * Purpose: /oferta/:slug renders on the server with the data the server loaded —
 * the hero text is in the first HTML (it was the LCP element, painted ~3 s late).
 */
import { describe, expect, test } from "vitest";
import { render } from "src/client/entry-server";

const offer = {
  id: "o1",
  slug: "olx",
  clientName: "",
  title: "Oferta",
  description: "",
  pdfUrl: "",
  price: "",
  packageName: "",
  packages: [],
  validUntil: "",
  selectedServices: ["photo"],
  serviceSections: [{
    id: "photo",
    label: "Fotografie",
    description: "",
    basePrice: "",
    assets: [
      { id: "a1", kind: "image", url: "https://cdn.test/big.jpg", label: "", sizeBytes: 2_200_000 },
      { id: "a2", kind: "image", url: "https://cdn.test/hero.webp", label: "", sizeBytes: 49_000 },
    ],
    assetsMobile: [],
  }],
};

describe("offer page server render", () => {
  test("renders the landing with its data instead of a loader", async () => {
    const { appHtml } = await render("/oferta/olx", { slug: "olx", offer });
    expect(appHtml).toContain("Pachet foto-video pentru nunta ta");
    expect(appHtml).toContain("Echipă foto-video pentru nunți în Transilvania");
    expect(appHtml).not.toContain("animate-spin");
    // The hero skips the photo over 1 MB.
    expect(appHtml).toContain("https://cdn.test/hero.webp");
  });

  test("without data it still renders (the browser loads it as before)", async () => {
    const { appHtml } = await render("/oferta/olx", null);
    expect(appHtml).toContain("animate-spin");
  });
});

describe("offer landing videos", () => {
  test("the hero keeps the photo in the HTML; the clip only joins later in the browser", async () => {
    const withVideos = { ...offer, heroVideo: { clipUrl: "https://cdn.test/hero-540p.mp4", filmUrl: "https://cdn.test/film.mp4" } };
    const { appHtml } = await render("/oferta/olx", { slug: "olx", offer: withVideos });
    expect(appHtml).toContain("https://cdn.test/hero.webp");
    expect(appHtml).not.toContain("hero-540p.mp4");
  });
});

describe("city pages (download only when opened)", () => {
  test("still render in full on the server, and tell the browser what to preload", async () => {
    const { appHtml, bodyEnd, redirect } = await render("/foto-video-nunta-cluj");
    expect(redirect).toBeUndefined();
    expect(appHtml).toContain("Cluj");
    expect(appHtml).not.toContain("anca-loader");
    expect(bodyEnd).toContain('window.__SSR_LAZY__=["location"]');
  });

  test("an unknown address still redirects", async () => {
    const { redirect } = await render("/nu-exista-pagina-asta");
    expect(redirect).toContain("/oferta/olx?notFound=");
  });
});
