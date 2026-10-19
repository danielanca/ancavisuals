import { describe, expect, test } from "vitest";
import { isValidNightEndTime, nightEventApplies, nightOvertimeFee } from "src/shared/contractNightEvent";

describe("nightOvertimeFee", () => {
  test.each([
    ["00:10", 0],
    ["00:25", 0],
    ["00:26", 200],
    ["00:55", 200],
    ["00:56", 400],
    ["01:25", 400],
    ["01:26", 600],
    ["23:40", 0],
  ])("day event ending at %s costs %i lei extra", (end, fee) => {
    expect(nightOvertimeFee("nu", end)).toBe(fee);
  });

  test("a night event counts from the declared end time", () => {
    expect(nightOvertimeFee("da", "02:20", "02:00")).toBe(0);
    expect(nightOvertimeFee("da", "02:26", "02:00")).toBe(200);
    expect(nightOvertimeFee("da", "03:00", "02:00")).toBe(400);
  });
});

describe("night-event helpers", () => {
  test("end time must be a night hour", () => {
    expect(isValidNightEndTime("02:30")).toBe(true);
    expect(isValidNightEndTime("08:00")).toBe(true);
    expect(isValidNightEndTime("21:00")).toBe(false);
    expect(isValidNightEndTime("2:30")).toBe(false);
  });

  test("applies to parties, not to photo sessions or funerals", () => {
    expect(nightEventApplies("Nuntă")).toBe(true);
    expect(nightEventApplies("Majorat")).toBe(true);
    expect(nightEventApplies("Ședință foto")).toBe(false);
    expect(nightEventApplies("Înmormântare")).toBe(false);
  });
});
