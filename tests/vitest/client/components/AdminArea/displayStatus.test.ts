/*
 * Purpose: verifies the displayStatus rule from EventCard — past events
 * that are still marked "confirmat" should visually appear as "finalizat".
 */
import { describe, expect, test } from "vitest";
import type { EventStatus } from "src/client/features/admin/types";

/**
 * Mirrors the inline logic from EventCard.tsx:
 *   const displayStatus = isPast && event.status === "confirmat" ? "finalizat" : event.status;
 */
function displayStatus(status: EventStatus, eventDate: Date): EventStatus {
  const isPast = eventDate < new Date();
  return isPast && status === "confirmat" ? "finalizat" : status;
}

const PAST_DATE = new Date("2020-01-01");
const FUTURE_DATE = new Date("2099-01-01");

describe("displayStatus", () => {
  test("past + confirmat → finalizat", () => {
    expect(displayStatus("confirmat", PAST_DATE)).toBe("finalizat");
  });

  test("past + finalizat → finalizat (unchanged)", () => {
    expect(displayStatus("finalizat", PAST_DATE)).toBe("finalizat");
  });

  test("past + anulat → anulat (unchanged)", () => {
    expect(displayStatus("anulat", PAST_DATE)).toBe("anulat");
  });

  test("past + tentativ → tentativ (unchanged)", () => {
    expect(displayStatus("tentativ", PAST_DATE)).toBe("tentativ");
  });

  test("future + confirmat → confirmat (no override for future events)", () => {
    expect(displayStatus("confirmat", FUTURE_DATE)).toBe("confirmat");
  });

  test("future + finalizat → finalizat (unchanged)", () => {
    expect(displayStatus("finalizat", FUTURE_DATE)).toBe("finalizat");
  });

  test("future + lead → lead (unchanged)", () => {
    expect(displayStatus("lead", FUTURE_DATE)).toBe("lead");
  });
});
