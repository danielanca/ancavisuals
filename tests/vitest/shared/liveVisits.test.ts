import { describe, expect, test } from "vitest";
import { visitDayBounds, visitDay, visitSource, visitStatus, observedDuration, isAlbumVisit } from "src/shared/liveVisits";

describe("visit days in Romania", () => {
  test("September 23 includes Romanian midnight, not UTC midnight", () => {
    const bounds = visitDayBounds("2026-09-23");
    expect(new Date(bounds.start).toISOString()).toBe("2026-09-22T21:00:00.000Z");
    expect(new Date(bounds.end).toISOString()).toBe("2026-09-23T21:00:00.000Z");
    expect(visitDay(bounds.start)).toBe("2026-09-23");
    expect(visitDay(bounds.end - 1)).toBe("2026-09-23");
  });
  test("handles 23 and 25 hour daylight saving days", () => {
    const spring = visitDayBounds("2026-03-29");
    const autumn = visitDayBounds("2026-10-25");
    expect(spring.end - spring.start).toBe(23 * 3600000);
    expect(autumn.end - autumn.start).toBe(25 * 3600000);
  });
  test.each(["2026-02-30", "invalid", "2026-13-01"])("rejects %s", (day) => expect(() => visitDayBounds(day)).toThrow());
});

describe("source attribution", () => {
  test.each([
    [{ gclid: "click", referrer: "https://www.google.ro" }, "google_ads"],
    [{ utmSource: "google", utmMedium: "cpc" }, "google_ads"],
    [{ referrer: "https://www.google.ro/search" }, "organic"],
    [{ referrer: "https://l.instagram.com/" }, "instagram"],
    [{ utmSource: "instagram", referrer: "https://google.com" }, "instagram"],
    [{ referrer: "https://m.facebook.com/" }, "facebook"],
    [{ utmSource: "tiktok" }, "tiktok"],
    [{ referrer: "https://chatgpt.com/" }, "ai"],
    [{ utmSource: "perplexity", referrer: "https://example.com" }, "ai"],
    [{ referrer: "https://copilot.microsoft.com/" }, "ai"],
    [{ landingPath: "/blog/fotograf-nunta" }, "direct"],
    [{ referrer: "https://ancavisuals.ro/blog" }, "direct"],
    [{ referrer: "https://evilancavisuals.ro/" }, "referral"],
    [{ referrer: "https://instagram.com.evil.test" }, "referral"],
  ] as const)("classifies %j as %s", (attr, expected) => expect(visitSource(attr)).toBe(expected));
  test("album audience stays separate without changing original source", () => {
    const s = { currentPage: "/", path: [{ page: "/media/wedding" }], attribution: { gclid: "test" } };
    expect(isAlbumVisit(s)).toBe(true);
    expect(visitSource(s.attribution)).toBe("google_ads");
  });
});

describe("honest presence and duration", () => {
  const s = { firstSeenAt: 1000, lastSeenAt: 11000, lastEventAt: 1000, endedAt: null, idle: false };
  test("old unfinished records never accumulate duration until today", () => {
    expect(visitStatus(s, 100000)).toBe("ended");
    expect(observedDuration(s)).toBe(10);
  });
  test("heartbeat without interaction is idle; hidden is a separate status", () => {
    expect(visitStatus({ ...s, lastSeenAt: 70000 }, 70000)).toBe("idle");
    expect(visitStatus({ ...s, visibility: "hidden" }, 11000)).toBe("hidden");
  });
});
