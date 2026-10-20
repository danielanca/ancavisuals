import { describe, expect, test, vi } from "vitest";

const docs: Record<string, Record<string, unknown>> = {
  tokenSalomeea12345: { label: "Salomeea", albumSlug: "28iulie2026", active: true },
  tokenOff1234567890: { label: "Ana", albumSlug: "28iulie2026", active: false },
};
vi.mock("src/server/firestore", () => ({
  firestore: () => ({ collection: () => ({ doc: (id: string) => ({ get: async () => ({ exists: id in docs, data: () => docs[id] }) }) }) }),
}));
vi.mock("src/server/constants/domain", () => ({ APP_BASE_URL: "https://ancavisuals.ro" }));

const template = `<html><head><title>AncaVisuals – Fotograf</title>
<meta property="og:title" content="AncaVisuals – Fotograf" />
<meta property="og:description" content="site" />
<meta name="description" content="site" />
<meta property="og:image" content="https://ancavisuals.ro/og.jpg" />
</head><body></body></html>`;

const meta = (html: string, key: string) => new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`).exec(html)?.[1];

describe("proposalOgFor", () => {
  test("the WhatsApp preview invites the person by name, with the event date", async () => {
    const { proposalOgFor } = await import("src/server/ssr/proposalOg");
    const html = await proposalOgFor(template, "/propune/tokenSalomeea12345");
    expect(meta(html, "og:title")).toBe("Salomeea, ai fost invitată să alegi pozele pentru Instagram și site");
    expect(meta(html, "og:description")).toBe("Din albumul evenimentului din 28 iulie 2026 · Anca Visuals. Deschide linkul, scrie-ți numele și alege pozele preferate.");
    expect(meta(html, "og:url")).toBe("https://ancavisuals.ro/propune/tokenSalomeea12345");
    expect(meta(html, "robots")).toBe("noindex,nofollow");
    expect(meta(html, "og:image")).toBe("https://ancavisuals.ro/og.jpg");
    expect(html).toContain("<title>Salomeea, ai fost invitată");
    expect(html.match(/og:title/g)).toHaveLength(1);
  });

  test("an unknown or deactivated link keeps the invitation without a name", async () => {
    const { proposalOgFor } = await import("src/server/ssr/proposalOg");
    for (const path of ["/propune/tokenOff1234567890", "/propune/missingToken123456"]) {
      const html = await proposalOgFor(template, path);
      expect(meta(html, "og:title")).toBe("Ai fost invitată să alegi pozele pentru Instagram și site");
      expect(meta(html, "robots")).toBe("noindex,nofollow");
    }
  });

  test("other pages are untouched", async () => {
    const { proposalOgFor } = await import("src/server/ssr/proposalOg");
    expect(await proposalOgFor(template, "/media/28iulie2026")).toBe(template);
    expect(await proposalOgFor(template, "/propune/short")).toBe(template);
  });
});
