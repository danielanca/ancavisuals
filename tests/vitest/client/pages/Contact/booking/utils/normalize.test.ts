/*
 * Purpose: verifies package normalization rules for booking data coming from mixed
 * raw payload shapes, with emphasis on fallbacks, coercion and duplicate detection.
 */
import { describe, expect, test } from "vitest";
import { normalizePackages } from "src/client/pages/Contact/booking/utils/normalize";

describe("normalizePackages", () => {
  test("maps mixed raw package fields into a normalized shape", () => {
    const result = normalizePackages([
      {
        key: " premium ",
        label: " Premium Story ",
        amount: "2500",
        description: "Full day coverage",
        isRecommended: 1,
      },
    ]);

    expect(result).toEqual([
      {
        id: "premium",
        title: "Premium Story",
        price: 2500,
        note: "Full day coverage",
        recommended: true,
      },
    ]);
  });

  test("falls back to id for title when no title-like field is present", () => {
    const result = normalizePackages([{ slug: "wedding-basic", cost: 1500 }]);

    expect(result).toEqual([
      {
        id: "wedding-basic",
        title: "wedding-basic",
        price: 1500,
        note: "",
        recommended: false,
      },
    ]);
  });

  test("coerces invalid or missing numeric prices to zero", () => {
    const result = normalizePackages([
      { id: "first", price: "not-a-number" },
      { id: "second" },
    ]);

    expect(result).toEqual([
      {
        id: "first",
        title: "first",
        price: 0,
        note: "",
        recommended: false,
      },
      {
        id: "second",
        title: "second",
        price: 0,
        note: "",
        recommended: false,
      },
    ]);
  });

  test("preserves distinct ids after trimming but rejects duplicates after normalization", () => {
    expect(() =>
      normalizePackages([
        { id: "gold" },
        { slug: " gold " },
      ]),
    ).toThrowError("[PackageTiles] id duplicat: gold");
  });

  test("returns an empty list when raw input is empty", () => {
    expect(normalizePackages([])).toEqual([]);
  });
});
