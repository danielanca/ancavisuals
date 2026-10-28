import { describe, expect, test } from "vitest";
import { buildFamilyCalendarIcs, eventsBetween, googleCalendarSubscribeUrl, mondayOf, type FamilyCalendarEvent } from "src/shared/familyCalendar";

const event = (over: Partial<FamilyCalendarEvent> = {}): FamilyCalendarEvent => ({
  id: "ev1", dates: ["2026-11-14"], type: "Nuntă", clientName: "Ana, Ion", location: "Sala; Turda", total: 2500, status: "confirmat", ...over,
});

describe("family calendar", () => {
  test("mondayOf finds the week's Monday", () => {
    expect(mondayOf("2026-10-28")).toBe("2026-10-26");
    expect(mondayOf("2026-11-01")).toBe("2026-10-26");
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
  });

  test("eventsBetween keeps events with any day in range, earliest first", () => {
    const events = [event({ id: "b", dates: ["2026-11-20"] }), event({ id: "a", dates: ["2026-10-31", "2026-11-01"] }), event({ id: "c", dates: ["2026-12-01"] })];
    expect(eventsBetween(events, "2026-11-01", "2026-11-30").map((e) => e.id)).toEqual(["a", "b"]);
  });

  test("ics: all-day entry with price, location and reminders a week and a day before", () => {
    const ics = buildFamilyCalendarIcs([event()], new Date("2026-10-28T10:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261114");
    expect(ics).toContain("DTEND;VALUE=DATE:20261115");
    expect(ics).toContain("SUMMARY:💍 Nuntă · Ana\\, Ion");
    expect(ics).toContain("LOCATION:Sala\\; Turda");
    expect(ics).toMatch(/DESCRIPTION:Preț: 2\.?500\s(€|EUR)/);
    expect(ics).toContain("TRIGGER:-P6DT15H");
    expect(ics).toContain("TRIGGER:-PT15H");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  test("ics: consecutive days are one entry, a gap starts another", () => {
    const ics = buildFamilyCalendarIcs([event({ dates: ["2026-11-14", "2026-11-15", "2026-11-20"] })], new Date());
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("DTEND;VALUE=DATE:20261116");
    expect(ics).toContain("UID:ev1-2026-11-20@ancavisuals.ro");
  });

  test("google subscribe link uses webcal", () => {
    expect(googleCalendarSubscribeUrl("https://ancavisuals.ro/api/family-calendar/t/calendar.ics"))
      .toBe("https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fancavisuals.ro%2Fapi%2Ffamily-calendar%2Ft%2Fcalendar.ics");
  });
});
