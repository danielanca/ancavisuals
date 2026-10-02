import { describe, expect, it } from "vitest";
import { contactMetric, summarizeContactStats } from "src/shared/contactStats";

const at = Date.parse("2026-09-30T10:00:00Z");

describe("contactMetric", () => {
  it("maps live events to contact actions", () => {
    expect(contactMetric({ name: "whatsapp_clicked" })).toBe("whatsapp");
    expect(contactMetric({ name: "phone_revealed" })).toBe("phone_call");
    expect(contactMetric({ name: "availability_checked" })).toBe("availability");
    expect(contactMetric({ name: "element_clicked", meta: { text: "AFIȘEAZĂ NUMĂRUL" } })).toBe("phone_shown");
    expect(contactMetric({ name: "element_clicked", label: "Afișează numărul de telefon" })).toBe("phone_shown");
    expect(contactMetric({ name: "element_clicked", meta: { text: "Vezi pachetele" } })).toBeNull();
    expect(contactMetric({ name: "page_view" })).toBeNull();
  });
});

describe("summarizeContactStats", () => {
  it("counts clicks and distinct visitors per metric, source, day and page", () => {
    const stats = summarizeContactStats([
      {
        sessionId: "s1", visitorId: "v1", attribution: { gclid: "abc" },
        events: [
          { name: "whatsapp_clicked", at, page: "/oferta/nunta?gclid=abc" },
          { name: "whatsapp_clicked", at, page: "/oferta/nunta" },
          { name: "availability_checked", at, page: "/oferta/nunta" },
        ],
      },
      { sessionId: "s2", visitorId: "v1", attribution: { gclid: "abc" }, events: [{ name: "whatsapp_clicked", at, page: "/" }] },
      { sessionId: "s3", events: [{ name: "element_clicked", at, page: "/", meta: { text: "AFIȘEAZĂ NUMĂRUL" } }] },
    ]);

    expect(stats.sessions).toBe(3);
    expect(stats.visitors).toBe(2);
    expect(stats.totals.whatsapp).toEqual({ clicks: 3, visitors: 1 });
    expect(stats.totals.phone_shown).toEqual({ clicks: 1, visitors: 1 });
    expect(stats.totals.availability).toEqual({ clicks: 1, visitors: 1 });
    expect(stats.bySource.google_ads?.visitors).toBe(1);
    expect(stats.bySource.google_ads?.counts.whatsapp.clicks).toBe(3);
    expect(stats.bySource.direct?.counts.phone_shown.visitors).toBe(1);
    expect(stats.byDay).toEqual([expect.objectContaining({ day: "2026-09-30" })]);
    expect(stats.byPage[0]).toEqual(expect.objectContaining({ page: "/oferta/nunta" }));
  });

  it("splits availability checks by event type, pairing configurator checks with the type chosen later", () => {
    const stats = summarizeContactStats([
      { sessionId: "a", visitorId: "v1", events: [{ name: "availability_checked", at, meta: { eventType: "Nuntă" } }] },
      { sessionId: "b", visitorId: "v2", events: [{ name: "availability_checked", at, meta: { eventType: "nunta" } }] },
      {
        sessionId: "c", visitorId: "v3",
        events: [
          { name: "availability_checked", at, page: "/contact" },
          { name: "event_type_selected", at, meta: { eventType: "botez" } },
        ],
      },
      { sessionId: "d", visitorId: "v4", events: [{ name: "availability_checked", at }] },
    ]);
    expect(stats.availabilityByEventType).toEqual([
      { eventType: "Nuntă", checks: { clicks: 2, visitors: 2 } },
      { eventType: "Botez", checks: { clicks: 1, visitors: 1 } },
      { eventType: "Nespecificat", checks: { clicks: 1, visitors: 1 } },
    ]);
  });
});

describe("eventTypeLabel", () => {
  it("collapses configurator keys and display names to one label", async () => {
    const { eventTypeLabel } = await import("src/shared/eventTypes");
    expect(eventTypeLabel("nunta")).toBe("Nuntă");
    expect(eventTypeLabel("Nuntă")).toBe("Nuntă");
    expect(eventTypeLabel("logodna")).toBe("Logodnă");
    expect(eventTypeLabel("Cununie civilă")).toBe("Cununie civilă");
    expect(eventTypeLabel("Alt eveniment")).toBe("Alt eveniment");
    expect(eventTypeLabel("")).toBeNull();
    expect(eventTypeLabel(undefined)).toBeNull();
  });
});
