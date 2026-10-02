/*
 * Purpose: a returning visitor's time on site is the sum of their visits, not the
 * span from first to last visit (which showed "75h" for someone who came back over 3 days).
 */
import { describe, expect, test } from "vitest";
import { visitorTimeOnSiteMs } from "src/client/features/admin/components/AnalyticsPage";

const at = (iso: string, timeSpent?: number) => ({ timestamp: iso, timeSpent });

describe("visitorTimeOnSiteMs", () => {
  test("sums visits days apart instead of measuring first-to-last", () => {
    const ms = visitorTimeOnSiteMs([
      { pages: [at("2026-09-27T10:00:00Z", 60)] },
      { pages: [at("2026-09-30T13:00:00Z"), at("2026-09-30T13:02:00Z", 30)] },
    ]);
    expect(ms).toBe(60_000 + 120_000 + 30_000);
  });

  test("caps an idle gap (forgotten tab) at 30 minutes", () => {
    const ms = visitorTimeOnSiteMs([{ pages: [at("2026-10-01T08:00:00Z"), at("2026-10-01T20:00:00Z")] }]);
    expect(ms).toBe(30 * 60_000);
  });

  test("uses tracked page time when it is larger than the gaps", () => {
    expect(visitorTimeOnSiteMs([{ pages: [at("2026-10-01T08:00:00Z", 300)] }])).toBe(300_000);
  });
});
