/*
 * Purpose: verifies the PFA (sistem real) tax estimate — CASS on real profit with the
 * 6/72 minimum-wage floor/cap, CAS as a step at 12/24 minimum wages, income tax after
 * deducting CAS + CASS — and the "set aside from each new payment" rate.
 */
import { describe, expect, it } from "vitest";
import { SMIN_2026, calcPfaTax, calcSetAside } from "src/shared/finance/pfaTax";

describe("calcPfaTax", () => {
  it("aplică CASS pe profitul real și deduce contribuțiile din baza impozitului", () => {
    const tax = calcPfaTax(28_168.47);
    expect(tax.cassBase).toBe(28_168.47);
    expect(tax.cass).toBe(2_816.85);
    expect(tax.cas).toBe(0);
    expect(tax.incomeTaxBase).toBeCloseTo(25_351.62, 2);
    expect(tax.impozit).toBe(2_535.16);
    expect(tax.total).toBe(5_352.01);
  });

  it("datorează CASS minim pe 6 salarii minime și sub prag sau la profit zero", () => {
    for (const base of [0, -500, 10_000]) {
      const tax = calcPfaTax(base);
      expect(tax.cassBase).toBe(6 * SMIN_2026);
      expect(tax.cass).toBe(0.6 * SMIN_2026);
    }
    expect(calcPfaTax(0).impozit).toBe(0);
  });

  it("plafonează CASS la 72 salarii minime", () => {
    expect(calcPfaTax(100 * SMIN_2026).cassBase).toBe(72 * SMIN_2026);
  });

  it("introduce CAS ca salt la 12 și 24 salarii minime", () => {
    expect(calcPfaTax(12 * SMIN_2026 - 1).cas).toBe(0);
    expect(calcPfaTax(12 * SMIN_2026).cas).toBe(12 * SMIN_2026 * 0.25);
    expect(calcPfaTax(24 * SMIN_2026).cas).toBe(24 * SMIN_2026 * 0.25);
  });
});

describe("calcSetAside", () => {
  it("împarte taxele în plus până la 31 dec la încasările rămase", () => {
    const currentBase = 28_168.47;
    const result = calcSetAside(currentBase, 63_000, { finalBase: 40_615.03, finalIncome: 90_911.46 });
    const extra = calcPfaTax(40_615.03).total - calcPfaTax(currentBase).total;
    expect(result.basedOnProjection).toBe(true);
    expect(result.alreadyOwed).toBe(5_352.01);
    expect(result.rate).toBeCloseTo(extra / 27_911.46, 6);
  });

  it("include saltul CAS când proiecția trece pragul", () => {
    const below = calcSetAside(40_000, 80_000, { finalBase: 12 * SMIN_2026 - 100, finalIncome: 90_000 });
    const above = calcSetAside(40_000, 80_000, { finalBase: 12 * SMIN_2026 + 100, finalIncome: 90_000 });
    expect(above.rate - below.rate).toBeGreaterThan((12 * SMIN_2026 * 0.25 * 0.9) / 10_000);
  });

  it("fără proiecție folosește cota marginală la marja de profit curentă", () => {
    const result = calcSetAside(30_000, 60_000, null);
    expect(result.basedOnProjection).toBe(false);
    // 19% din profit (10% CASS + 10% impozit pe rest) × marjă 50%
    expect(result.rate).toBeCloseTo(0.095, 4);
  });
});
