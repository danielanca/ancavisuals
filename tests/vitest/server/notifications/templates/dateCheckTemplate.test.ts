/*
 * Purpose: verifies that the date check email template renders the human date
 * and availability status correctly.
 */
import { describe, expect, test } from "vitest";
import { renderDateCheckTemplate } from "src/server/notifications/templates/dateCheckTemplate";

describe("renderDateCheckTemplate", () => {
  test("includes the human date in the output", () => {
    const html = renderDateCheckTemplate({ humanDate: "18 Aprilie 2026", isBooked: false });
    expect(html).toContain("18 Aprilie 2026");
  });

  test("shows available status when isBooked is false", () => {
    const html = renderDateCheckTemplate({ humanDate: "18 Aprilie 2026", isBooked: false });
    expect(html).toContain("Disponibilă");
    expect(html).toContain("#22c55e");
  });

  test("shows booked status when isBooked is true", () => {
    const html = renderDateCheckTemplate({ humanDate: "20 Mai 2026", isBooked: true });
    expect(html).toContain("Ocupată");
    expect(html).toContain("#e04444");
  });

  test("returns a non-empty HTML string", () => {
    const html = renderDateCheckTemplate({ humanDate: "1 Iunie 2026", isBooked: false });
    expect(html.trim().length).toBeGreaterThan(0);
    expect(html).toContain("<div");
  });
});
