/*
 * Purpose: verifies that groupByMonth sorts events correctly and groups
 * them into Romanian month/year labels for the EventList component.
 */
import { describe, expect, test } from "vitest";
import { groupByMonth } from "../../../../client/features/admin/components/EventList";
import type { ClientEvent } from "../../../../client/features/admin/types";

function makeEvent(id: string, isoDate: string): ClientEvent {
  return {
    id,
    createdAt: new Date("2026-01-01"),
    eventDate: new Date(isoDate),
    status: "confirmat",
    type: "Nuntă",
    client: { fullName: "Test Client", phone: "", email: "" },
    services: [],
    pricing: { total: 1000, advanceAmount: 0, advancePaid: false, remainingAmount: 1000 },
  };
}

describe("groupByMonth", () => {
  test("groups events under the correct Romanian month label", () => {
    const events = [makeEvent("1", "2026-04-15")];
    const result = groupByMonth(events, true);
    expect([...result.keys()]).toContain("APRILIE 2026");
  });

  test("ascending order places earlier months first", () => {
    const events = [
      makeEvent("a", "2026-06-01"),
      makeEvent("b", "2026-03-01"),
    ];
    const result = groupByMonth(events, true);
    const keys = [...result.keys()];
    expect(keys[0]).toBe("MARTIE 2026");
    expect(keys[1]).toBe("IUNIE 2026");
  });

  test("descending order places later months first", () => {
    const events = [
      makeEvent("a", "2026-03-01"),
      makeEvent("b", "2026-06-01"),
    ];
    const result = groupByMonth(events, false);
    const keys = [...result.keys()];
    expect(keys[0]).toBe("IUNIE 2026");
    expect(keys[1]).toBe("MARTIE 2026");
  });

  test("multiple events in the same month appear under one key", () => {
    const events = [
      makeEvent("a", "2026-05-10"),
      makeEvent("b", "2026-05-25"),
    ];
    const result = groupByMonth(events, true);
    expect(result.size).toBe(1);
    expect(result.get("MAI 2026")).toHaveLength(2);
  });

  test("events in the same month are sorted ascending within the group", () => {
    const events = [
      makeEvent("later", "2026-09-20"),
      makeEvent("earlier", "2026-09-05"),
    ];
    const result = groupByMonth(events, true);
    const group = result.get("SEPTEMBRIE 2026")!;
    expect(group[0].id).toBe("earlier");
    expect(group[1].id).toBe("later");
  });

  test("returns an empty map for an empty input array", () => {
    const result = groupByMonth([], true);
    expect(result.size).toBe(0);
  });

  test("events spanning multiple years each get their own label", () => {
    const events = [
      makeEvent("a", "2025-12-31"),
      makeEvent("b", "2026-01-01"),
    ];
    const result = groupByMonth(events, true);
    expect([...result.keys()]).toContain("DECEMBRIE 2025");
    expect([...result.keys()]).toContain("IANUARIE 2026");
  });
});
