/*
 * Purpose: protects event slug generation rules for sanitization, fallback
 * behavior and title/location composition.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { generateEventSlug } from "src/server/utils/eventUrl";

describe("generateEventSlug", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-11T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("combines title and location into a lowercase slug", () => {
    expect(generateEventSlug("Anca Visuals Wedding", "Bucharest")).toBe("anca-visuals-wedding-bucharest");
  });

  test("removes special characters and collapses repeated separators", () => {
    expect(generateEventSlug("  Gala   Night!!! ", " Cluj -- Center ")).toBe("gala-night-cluj-center");
  });

  test("works when location is omitted", () => {
    expect(generateEventSlug("Studio Session")).toBe("studio-session");
  });

  test("trims leading and trailing hyphens created by sanitization", () => {
    expect(generateEventSlug("---Open Day---", "---Hall---")).toBe("open-day-hall");
  });

  test("falls back to a timestamp based slug when input becomes empty", () => {
    expect(generateEventSlug("###", "@@@")).toBe(`event-${Date.now().toString(36)}`);
  });
});
