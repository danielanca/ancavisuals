import { expect, test } from "vitest";
import { normalizeTrafficSource, referralTraffic, type ReferralVisit } from "src/shared/referralTraffic";

const cutoff = new Date("2026-10-01T00:00:00Z");
function visit(overrides: Partial<ReferralVisit> = {}): ReferralVisit {
  return { id: "1", sessionId: "session", visitorId: "visitor", timestamp: "2026-10-08T10:00:00Z", page: "/", referrer: "https://www.sibiunews.net/articol", ...overrides };
}

test("counts unique people, sessions and all pages without splitting a visit by later referrers", () => {
  const rows = referralTraffic([
    visit({ id: "2", page: "/contact", timestamp: "2026-10-08T10:01:00Z", referrer: "https://ancavisuals.ro/" }),
    visit(),
    visit({ id: "3", sessionId: "return" }),
    visit({ id: "4", sessionId: "other", visitorId: "other-person" }),
  ], cutoff);
  expect(rows).toEqual([{ source: "sibiunews.net", visitors: 2, sessions: 3, pageViews: 4, pages: [{ page: "/", count: 3 }, { page: "/contact", count: 1 }] }]);
});

test("explicit UTM source wins and works without a referrer", () => {
  expect(referralTraffic([visit({ utmSource: "SibiuNews", referrer: "https://facebook.com/" })], cutoff)[0].source).toBe("sibiunews");
  expect(referralTraffic([visit({ utmSource: "SibiuNews", referrer: "" })], cutoff)[0].source).toBe("sibiunews");
});

test("ignores internal, malformed and absent referrers but keeps external lookalike hosts", () => {
  for (const referrer of ["", "invalid", "https://www.ancavisuals.ro/", "https://sub.ancavisuals.ro/", "https://localhost/", "javascript:alert(1)"]) {
    expect(referralTraffic([visit({ referrer })], cutoff)).toEqual([]);
  }
  expect(referralTraffic([visit({ referrer: "https://ancavisuals.ro.example.com/" })], cutoff)[0].source).toBe("ancavisuals.ro.example.com");
});

test("period counts only matching pages while keeping the observed session origin", () => {
  const visits = [visit({ timestamp: "2026-09-30T23:59:00Z" }), visit({ id: "2", timestamp: "2026-10-01T00:00:00Z", page: "/contact", referrer: "" })];
  expect(referralTraffic(visits, cutoff)[0]).toMatchObject({ visitors: 1, sessions: 1, pageViews: 1, pages: [{ page: "/contact", count: 1 }] });
  expect(referralTraffic(visits, new Date("2026-10-02"))).toEqual([]);
});

test("missing visitor/session IDs do not collapse unrelated visits", () => {
  expect(referralTraffic([visit({ id: "1", sessionId: "", visitorId: "" }), visit({ id: "2", sessionId: "", visitorId: "" })], cutoff)[0]).toMatchObject({ visitors: 2, sessions: 2 });
});

test("normalizes case, www and pasted URLs for source searches", () => {
  expect(normalizeTrafficSource(" HTTPS://WWW.SIBIUNEWS.NET/articol ")).toBe("sibiunews.net");
  expect(normalizeTrafficSource("sibiunews")).toBe("sibiunews");
  expect(normalizeTrafficSource("")).toBe("");
});
