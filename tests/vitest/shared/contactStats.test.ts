import { describe, expect, it } from "vitest";
import { visitDay } from "src/shared/liveVisits";
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

  it("splits availability check results (free / booked / unknown) per traffic source", () => {
    const stats = summarizeContactStats([
      {
        sessionId: "a", visitorId: "v1", attribution: { gclid: "x" },
        events: [
          { name: "availability_checked", at, meta: { available: false } },
          { name: "availability_checked", at, meta: { available: true } },
        ],
      },
      { sessionId: "b", visitorId: "v2", attribution: { gclid: "y" }, events: [{ name: "availability_checked", at, meta: { available: false } }] },
      { sessionId: "c", visitorId: "v3", events: [{ name: "availability_checked", at }] },
    ]);
    expect(stats.availabilityOutcomeBySource).toEqual([
      { source: "google_ads", outcomes: { free: { clicks: 1, visitors: 1 }, booked: { clicks: 2, visitors: 2 }, unknown: { clicks: 0, visitors: 0 } } },
      { source: "direct", outcomes: { free: { clicks: 0, visitors: 0 }, booked: { clicks: 0, visitors: 0 }, unknown: { clicks: 1, visitors: 1 } } },
    ]);
  });

  it("ranks checked event dates by demand and groups them by calendar month", () => {
    const check = (dateKey: string, available: boolean) => ({ name: "availability_checked", at, meta: { dateKey, available } });
    const stats = summarizeContactStats([
      { sessionId: "a", visitorId: "v1", attribution: { gclid: "x" }, events: [check("2027-08-28", false), check("2027-08-28", false)] },
      { sessionId: "b", visitorId: "v2", events: [check("2027-08-28", true), check("2026-08-15", true)] },
      { sessionId: "c", visitorId: "v3", events: [check("2027-06-05", true), { name: "availability_checked", at, meta: { dateKey: "bad" } }] },
    ]);
    expect(stats.checkedDates.map((d) => d.dateKey)).toEqual(["2027-08-28", "2026-08-15", "2027-06-05"]);
    expect(stats.checkedDates[0]).toEqual({
      dateKey: "2027-08-28",
      all: { total: { clicks: 3, visitors: 2 }, booked: { clicks: 2, visitors: 1 }, free: { clicks: 1, visitors: 1 } },
      googleAds: { total: { clicks: 2, visitors: 1 }, booked: { clicks: 2, visitors: 1 }, free: { clicks: 0, visitors: 0 } },
      searchers: [
        { days: [visitDay(at)], checks: 2, source: "google_ads", sawBooked: true },
        { days: [visitDay(at)], checks: 1, source: "direct", sawBooked: false },
      ],
    });
    expect(stats.checkedMonths.map((m) => [m.month, m.all.total.visitors])).toEqual([[6, 1], [8, 2]]);
  });

  it("lists each person once per checked date, with every day they searched it", () => {
    const day1 = Date.UTC(2026, 9, 10, 9);
    const day2 = Date.UTC(2026, 9, 14, 9);
    const check = (when: number) => ({ name: "availability_checked", at: when, meta: { dateKey: "2027-08-28", available: true } });
    const stats = summarizeContactStats([
      // Same person (v1) in two sessions on two days, three checks in total.
      { sessionId: "a", visitorId: "v1", events: [check(day1), check(day1)] },
      { sessionId: "b", visitorId: "v1", events: [check(day2)] },
      { sessionId: "c", visitorId: "v2", events: [check(day1)] },
    ]);
    const date = stats.checkedDates[0];
    expect(date.all.total).toEqual({ clicks: 4, visitors: 2 });
    expect(date.searchers).toEqual([
      { days: ["2026-10-10", "2026-10-14"], checks: 3, source: "direct", sawBooked: false },
      { days: ["2026-10-10"], checks: 1, source: "direct", sawBooked: false },
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
