/*
 * Purpose: covers the slugify utility used to build Firebase Storage file paths
 * for contracts and invoices in the admin dashboard.
 */
import { describe, expect, test } from "vitest";
import { slugify } from "src/client/utils/slugify";

describe("slugify", () => {
  test("replaces spaces with underscores", () => {
    expect(slugify("Ana Mihai")).toBe("Ana_Mihai");
  });

  test("strips Romanian diacritics", () => {
    expect(slugify("Nuntă Ștefan & Ioana")).toBe("Nunta_Stefan_Ioana");
  });

  test("strips special characters", () => {
    expect(slugify("Event #1 — Cluj!")).toBe("Event_1_Cluj");
  });

  test("removes leading and trailing underscores", () => {
    expect(slugify("  Ana & Mihai  ")).toBe("Ana_Mihai");
  });

  test("collapses consecutive non-alphanumeric chars into one underscore", () => {
    expect(slugify("Ana --- Mihai")).toBe("Ana_Mihai");
  });

  test("preserves numbers", () => {
    expect(slugify("Event 2026")).toBe("Event_2026");
  });

  test("handles already clean strings", () => {
    expect(slugify("AnaPopescu")).toBe("AnaPopescu");
  });

  test("returns empty string for fully non-alphanumeric input", () => {
    expect(slugify("---###---")).toBe("");
  });
});
