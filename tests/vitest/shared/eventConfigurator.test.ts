import { describe, expect, it } from "vitest";
import { DEFAULT_PRICE_BOOK } from "src/shared/pricing/configuratorPrices";
import { CONFIGURATOR_EVENTS, EXTRAS, buildQuote, defaultService, eventByKey, eventStartPrice, servicesFor } from "src/shared/pricing/eventConfigurator";

const prices = DEFAULT_PRICE_BOOK;

describe("eventConfigurator", () => {
  it("preselects the service that costs the advertised starting price", () => {
    for (const event of CONFIGURATOR_EVENTS) {
      const { total } = buildQuote({ event: event.key, service: defaultService(event), extras: [], guestTier: 0 }, prices);
      expect(total).toBe(eventStartPrice(event, prices));
    }
  });

  it("wedding: 950 €, each booth 200 € (owner, 2026-10-29) → 1150 / 1350", () => {
    const base = { event: "nunta" as const, service: "foto_video" as const, guestTier: 0 };
    expect(buildQuote({ ...base, extras: [] }, prices).total).toBe(950);
    expect(buildQuote({ ...base, extras: ["fotocabina"] }, prices).total).toBe(1150);
    expect(buildQuote({ ...base, extras: ["fotocabina", "videobooth"] }, prices).total).toBe(1350);
  });

  it("follows starting prices edited in /admin/preturi", () => {
    const edited = { ...prices, botez: 400 };
    expect(buildQuote({ event: "botez", service: "foto", extras: [], guestTier: 0 }, edited).total).toBe(400);
  });

  it("waives the photo booth during the promo but keeps the guest supplement", () => {
    const quote = buildQuote({ event: "nunta", service: "foto_video", extras: ["fotocabina"], guestTier: 1 }, prices, { photoboothFree: true });
    expect(quote.lines.find((l) => l.label === EXTRAS.fotocabina.label)?.waived).toBe(true);
    expect(quote.total).toBe(950 + 30);
  });

  it("lets the couple pick the videobooth instead of the photo booth as the promo gift", () => {
    const videoOnly = buildQuote({ event: "nunta", service: "foto_video", extras: ["videobooth"], guestTier: 0 }, prices, { photoboothFree: true });
    expect(videoOnly.lines.find((l) => l.label === EXTRAS.videobooth.label)?.waived).toBe(true);
    expect(videoOnly.total).toBe(950);
    // Both picked: only the first one is free, the other is paid.
    const both = buildQuote({ event: "nunta", service: "foto_video", extras: ["videobooth", "fotocabina"], guestTier: 0 }, prices, { photoboothFree: true });
    expect(both.lines.find((l) => l.label === EXTRAS.videobooth.label)?.waived).toBe(true);
    expect(both.lines.find((l) => l.label === EXTRAS.fotocabina.label)?.waived).toBeFalsy();
    expect(both.total).toBe(950 + prices.fotocabina);
  });

  it("asks for the guest count only at weddings and corporate events", () => {
    const quote = (event: "botez" | "majorat" | "corporate") =>
      buildQuote({ event, service: "foto", extras: ["fotocabina"], guestTier: 2 }, prices).total;
    expect(quote("botez")).toBe(prices.botez + prices.fotocabina);
    // Majorat: no guest supplement.
    expect(quote("majorat")).toBe(prices.majorat + prices.fotocabina);
    expect(quote("corporate")).toBe(100 + prices.fotocabina + 60);
  });

  it("christening: 250 € photo, video only as a +120 € add-on", () => {
    const botez = eventByKey("botez")!;
    expect(servicesFor(botez).map((s) => s.key)).toEqual(["foto", "foto_video"]);
    expect(buildQuote({ event: "botez", service: "foto", extras: [], guestTier: 0 }, prices).total).toBe(250);
    expect(buildQuote({ event: "botez", service: "foto_video", extras: [], guestTier: 0 }, prices).total).toBe(370);
    // A service the event doesn't offer falls back to the default one.
    expect(buildQuote({ event: "botez", service: "video", extras: [], guestTier: 0 }, prices).total).toBe(250);
  });

  it("corporate: 100 € covers the minimum 2 hours, then +55 € per hour", () => {
    const at = (hours?: number) => buildQuote({ event: "corporate", service: "foto", extras: [], guestTier: 0, hours }, prices);
    expect(at().total).toBe(100);
    expect(at(1).total).toBe(100);
    expect(at(3).total).toBe(155);
    expect(at(5).total).toBe(265);
    expect(at(5).lines[0].label).toBe("Foto · 5 ore");
    expect(at(99).total).toBe(100 + 10 * 55);
  });

  it("ignores extras the event does not offer", () => {
    // Weddings sell their own album (retro box / photo book), not the 40 € one.
    expect(buildQuote({ event: "nunta", service: "foto_video", extras: ["album"], guestTier: 0 }, prices).total).toBe(950);
    expect(buildQuote({ event: "botez", service: "foto", extras: ["album_nunta"], guestTier: 0 }, prices).total).toBe(250);
  });

  it("no free booth anywhere since 2026-10-29: each booth is paid, majorat included", () => {
    const at = (event: "majorat" | "nunta" | "botez", extras: ("fotocabina" | "videobooth")[]) =>
      buildQuote({ event, service: "foto", extras, guestTier: 0 }, prices);
    expect(at("majorat", ["fotocabina", "videobooth"]).total).toBe(prices.majorat + prices.fotocabina + prices.videobooth);
    expect(at("majorat", ["fotocabina", "videobooth"]).lines.some((l) => l.waived)).toBe(false);
    expect(at("botez", ["fotocabina"]).total).toBe(250 + prices.fotocabina);
    expect(EXTRAS.fotocabina.listPrice).toBe(450);
    expect(EXTRAS.videobooth.listPrice).toBe(450);
  });

  it("wedding album: retro box 60 € or photo book 100 €", () => {
    const base = { event: "nunta" as const, service: "foto_video" as const, extras: ["album_nunta" as const], guestTier: 0 };
    const retro = buildQuote(base, prices);
    expect(retro.total).toBe(950 + 60);
    expect(retro.lines.map((l) => l.label)).toContain("Album foto · Cutie retro");
    expect(buildQuote({ ...base, albumVariant: 1 }, prices).lines.map((l) => l.label)).toContain("Album foto · Fotocarte");
    expect(buildQuote({ ...base, albumVariant: 1 }, prices).total).toBe(950 + 100);
    expect(buildQuote({ ...base, albumVariant: 9 }, prices).total).toBe(950 + 60);
  });

  it("follows every configurator price edited in /admin/preturi", () => {
    const edited = { ...prices, nunta_foto: 700, corporate_base: 120, corporate_extra_hour: 60, fotocabina: 300, guests_200_500: 40, album_nunta_fotocarte: 150 };
    expect(buildQuote({ event: "nunta", service: "foto", extras: [], guestTier: 0 }, edited).total).toBe(700);
    expect(buildQuote({ event: "corporate", service: "foto", extras: [], guestTier: 0, hours: 4 }, edited).total).toBe(120 + 2 * 60);
    expect(buildQuote({ event: "botez", service: "foto", extras: ["fotocabina"], guestTier: 0 }, edited).total).toBe(250 + 300);
    expect(buildQuote({ event: "nunta", service: "foto_video", extras: ["fotocabina"], guestTier: 1 }, edited).total).toBe(950 + 300 + 40);
    expect(buildQuote({ event: "nunta", service: "foto_video", extras: ["album_nunta"], guestTier: 0, albumVariant: 1 }, edited).total).toBe(950 + 150);
  });

  it("majorat: foto + video 300 €", () => {
    expect(buildQuote({ event: "majorat", service: "foto_video", extras: [], guestTier: 0 }, prices).total).toBe(300);
  });

  it("only knows the four events", () => {
    expect(eventByKey("corporate")?.formEventType).toBe("Alt eveniment");
    expect(eventByKey("nimic")).toBeUndefined();
  });
});
