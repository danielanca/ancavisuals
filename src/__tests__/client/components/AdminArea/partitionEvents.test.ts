/*
 * Purpose: verifies the partitionEvents helper that splits events into
 * upcoming and past tabs in the admin dashboard EventList component.
 */
import { describe, expect, test } from "vitest";
import { partitionEvents } from "../../../../client/components/AdminArea/EventList";
import type { ClientEvent } from "../../../../client/types/admin";

const YEAR = 2026;
const TODAY = new Date(`${YEAR}-06-15T00:00:00`);

function makeEvent(id: string, isoDate: string, status: ClientEvent["status"] = "confirmat"): ClientEvent {
  return {
    id,
    createdAt: new Date("2026-01-01"),
    eventDate: new Date(isoDate),
    status,
    type: "Nuntă",
    client: { fullName: "Test", phone: "", email: "" },
    services: [],
    pricing: { total: 0, advanceAmount: 0, advancePaid: false, remainingAmount: 0 },
  };
}

describe("partitionEvents", () => {
  test("upcoming includes events from today onwards", () => {
    const events = [makeEvent("a", `${YEAR}-06-15`), makeEvent("b", `${YEAR}-12-01`)];
    const { upcoming } = partitionEvents(events, TODAY, YEAR);
    expect(upcoming.map(e => e.id)).toEqual(expect.arrayContaining(["a", "b"]));
  });

  test("past includes confirmed events strictly before today", () => {
    const events = [makeEvent("x", `${YEAR}-01-10`, "confirmat")];
    const { past } = partitionEvents(events, TODAY, YEAR);
    expect(past.map(e => e.id)).toContain("x");
  });

  test("past includes finalizat events before today", () => {
    const events = [makeEvent("y", `${YEAR}-02-20`, "finalizat")];
    const { past } = partitionEvents(events, TODAY, YEAR);
    expect(past.map(e => e.id)).toContain("y");
  });

  test("past does NOT include events with status lead, tentativ, or anulat", () => {
    const statuses: ClientEvent["status"][] = ["lead", "tentativ", "anulat"];
    for (const status of statuses) {
      const events = [makeEvent("z", `${YEAR}-01-01`, status)];
      const { past } = partitionEvents(events, TODAY, YEAR);
      expect(past).toHaveLength(0);
    }
  });

  test("events from a different year are excluded from both lists", () => {
    const events = [makeEvent("old", "2024-06-01", "confirmat")];
    const { upcoming, past } = partitionEvents(events, TODAY, YEAR);
    expect(upcoming).toHaveLength(0);
    expect(past).toHaveLength(0);
  });

  test("an event on today is upcoming, not past", () => {
    const events = [makeEvent("today", `${YEAR}-06-15`)];
    const { upcoming, past } = partitionEvents(events, TODAY, YEAR);
    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(0);
  });

  test("returns empty lists for an empty input", () => {
    const { upcoming, past } = partitionEvents([], TODAY, YEAR);
    expect(upcoming).toHaveLength(0);
    expect(past).toHaveLength(0);
  });

  test("yearEvents contains only the current year's events", () => {
    const events = [
      makeEvent("this", `${YEAR}-03-01`),
      makeEvent("other", "2025-03-01"),
    ];
    const { yearEvents } = partitionEvents(events, TODAY, YEAR);
    expect(yearEvents).toHaveLength(1);
    expect(yearEvents[0].id).toBe("this");
  });
});
