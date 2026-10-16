/*
 * Purpose: verifies the PFA (sistem real) tax estimate — CASS on real profit with the
 * 6/72 minimum-wage floor/cap, CAS as a step at 12/24 minimum wages, income tax after
 * deducting CAS + CASS — and the "set aside from each new invoice" rate.
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
  it("folosește cota marginală la marja de profit curentă", () => {
    const result = calcSetAside(30_000, 60_000);
    // 19% din profit (10% CASS + 10% impozit pe rest) × marjă 50%
    expect(result.rate).toBeCloseTo(0.095, 4);
    expect(result.alreadyOwed).toBe(calcPfaTax(30_000).total);
  });

  it("sub minimul CASS, cota cuprinde doar impozitul", () => {
    const result = calcSetAside(10_000, 10_000);
    // CASS minim e deja datorat; 1.000 RON în plus aduc doar 10% impozit
    expect(result.rate).toBeCloseTo(0.1, 4);
  });
});
