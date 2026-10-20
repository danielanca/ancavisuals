/*
 * Purpose: verifies the per-category expense totals behind the "Cheltuieli pe categorii"
 * panel — RON conversion, deductible sums, sort order and unknown legacy categories.
 */
import { describe, expect, it } from "vitest";
import { EXPENSE_CATEGORIES, summarizeExpensesByCategory } from "../../../src/shared/finance/expenseCategories";

const toRON = (amount: number, currency: string) => (currency === "EUR" ? amount * 5 : amount);

describe("summarizeExpensesByCategory", () => {
  it("adună totalul și partea deductibilă pe categorie, în RON, sortat descrescător", () => {
    const { rows, total, deductible } = summarizeExpensesByCategory([
      { category: "transport", amount: 100, deductibleAmount: 100, currency: "RON", date: "2026-03-01" },
      { category: "ai", amount: 20, deductibleAmount: 20, currency: "EUR", date: "2026-03-02" },
      { category: "transport", amount: 50, deductibleAmount: 50, currency: "RON", date: "2026-03-03" },
      { category: "combustibil", amount: 200, deductibleAmount: 100, currency: "RON", date: "2026-03-04" },
    ], toRON);

    expect(total).toBe(450);
    expect(deductible).toBe(350);
    expect(rows.map((r) => [r.value, r.count, r.total, r.deductible])).toEqual([
      ["combustibil", 1, 200, 100],
      ["transport", 2, 150, 150],
      ["ai", 1, 100, 100],
    ]);
    expect(rows[0].share).toBeCloseTo(200 / 450);
  });

  it("păstrează categoriile necunoscute din datele vechi", () => {
    const { rows } = summarizeExpensesByCategory([
      { category: "veche", amount: 10, deductibleAmount: 0, currency: "RON", date: "2026-01-01" },
    ], toRON);
    expect(rows[0]).toMatchObject({ value: "veche", label: "veche", total: 10, share: 1 });
  });

  it("nu are valori de categorie duplicate", () => {
    const values = EXPENSE_CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
