/*
 * Purpose: verifies the today-timeline math — Bucharest clock, snapping,
 * overlap lanes, elapsed/overrun state and the visible hour range.
 */
import { describe, expect, test } from "vitest";
import {
  absoluteStart,
  blockState,
  clockLabel,
  bucharestMinutes,
  formatDuration,
  fromMinutes,
  layoutBlocks,
  snap,
  splitAbsolute,
  toMinutes,
  visibleRange,
  whenLabel,
} from "src/client/features/admin/components/Tasks/timeline";

describe("timeline", () => {
  test("reads the Bucharest wall clock (EEST, UTC+3 in October)", () => {
    expect(bucharestMinutes(new Date("2026-10-02T09:30:00.000Z"))).toBe(12 * 60 + 30);
  });

  test("converts, snaps and formats times", () => {
    expect(toMinutes("09:45")).toBe(585);
    expect(fromMinutes(585)).toBe("09:45");
    expect(fromMinutes(-20)).toBe("00:00");
    expect(fromMinutes(2000)).toBe("23:59");
    expect(snap(52)).toBe(45);
    expect(snap(53)).toBe(60);
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(45)).toBe("45 min");
  });

  test("puts overlapping blocks side by side and leaves separate ones full width", () => {
    const laid = layoutBlocks([
      { id: "a", start: 600, end: 660 },
      { id: "b", start: 630, end: 690 },
      { id: "c", start: 720, end: 780 },
    ]);
    const byId = Object.fromEntries(laid.map((block) => [block.id, block]));
    expect([byId.a.lane, byId.a.lanes]).toEqual([0, 2]);
    expect([byId.b.lane, byId.b.lanes]).toEqual([1, 2]);
    expect([byId.c.lane, byId.c.lanes]).toEqual([0, 1]);
  });

  test("tracks how much of a block time has passed over", () => {
    const block = { id: "x", start: 600, end: 660 };
    expect(blockState(block, 590, false)).toEqual({ state: "upcoming", elapsed: 0 });
    expect(blockState(block, 615, false)).toEqual({ state: "active", elapsed: 0.25 });
    expect(blockState(block, 700, false)).toEqual({ state: "overrun", elapsed: 1 });
    expect(blockState(block, 700, true).state).toBe("done");
  });

  test("visible range covers today from 08:00 through tomorrow and stretches for earlier or longer blocks", () => {
    expect(visibleRange([], 12 * 60)).toEqual({ start: 8 * 60, end: 48 * 60 });
    expect(visibleRange([{ id: "e", start: 6 * 60 + 30, end: 7 * 60 }], 12 * 60).start).toBe(6 * 60);
    // După miezul nopții, un bloc început ieri la 22:00 trage intervalul înapoi în ziua de ieri.
    expect(visibleRange([{ id: "n", start: -120, end: 120 }], 30).start).toBe(-120);
    expect(visibleRange([{ id: "w", start: 600, end: 600 + 3 * 1440 }], 600).end).toBe(600 + 3 * 1440);
  });

  test("maps tasks across midnight and days", () => {
    expect(absoluteStart("2026-10-02", "22:00", "2026-10-02")).toBe(22 * 60);
    expect(absoluteStart("2026-10-01", "22:00", "2026-10-02")).toBe(-120);
    expect(absoluteStart("2026-10-03", "01:30", "2026-10-02")).toBe(1440 + 90);
    expect(splitAbsolute(1440 + 90, "2026-10-02")).toEqual({ day: "2026-10-03", time: "01:30" });
    expect(splitAbsolute(-120, "2026-10-02")).toEqual({ day: "2026-10-01", time: "22:00" });
    expect(whenLabel(22 * 60)).toBe("22:00");
    expect(whenLabel(1440 + 120)).toBe("mâine 02:00");
    expect(clockLabel(-30)).toBe("23:30");
    expect(formatDuration(1440 + 120)).toBe("1 zi 2h");
    expect(formatDuration(2880)).toBe("2 zile");
  });
});
