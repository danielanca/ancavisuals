import { describe, expect, test } from "vitest";
import { handoverSmsLink, handoverSmsText, nextAutoSignReminderAt, signReminderSmsText } from "src/shared/handoverSignReminder";

describe("nextAutoSignReminderAt", () => {
  test("3 days after the PV was sent, then 3 days after the last reminder", () => {
    expect(nextAutoSignReminderAt({ sentAt: "2026-10-01T10:00:00Z", lastReminderAt: null, autoCount: 0, enabled: undefined })?.toISOString()).toBe("2026-10-04T10:00:00.000Z");
    expect(nextAutoSignReminderAt({ sentAt: "2026-10-01T10:00:00Z", lastReminderAt: "2026-10-06T09:00:00Z", autoCount: 1, enabled: true })?.toISOString()).toBe("2026-10-09T09:00:00.000Z");
  });

  test("stops when turned off or after 4 automatic reminders", () => {
    expect(nextAutoSignReminderAt({ sentAt: "2026-10-01", lastReminderAt: null, autoCount: 0, enabled: false })).toBeNull();
    expect(nextAutoSignReminderAt({ sentAt: "2026-10-01", lastReminderAt: "2026-10-10", autoCount: 4, enabled: true })).toBeNull();
  });
});

test("SMS text greets as the event's team and says the materials come right after signing", () => {
  expect(signReminderSmsText({ eventDate: "2026-08-08", link: "L", automatedLabel: "AUTO" }))
    .toBe("Bună ziua! Suntem echipa foto-video de la evenimentul din data de 8 august 2026. Materialele vă așteaptă: semnați procesul verbal de predare și le primiți imediat: L\n\nAUTO");
});

test("the SMS link carries ?s=sms so opening it can be reported", () => {
  expect(handoverSmsLink("https://ancavisuals.ro/", "tok")).toBe("https://ancavisuals.ro/proces-verbal/tok?s=sms");
});

test("pop-up SMS text depends on whether the PV is signed and whether there's a digital link", () => {
  const greeting = "Bună ziua! Suntem echipa foto-video de la evenimentul din data de 23 august 2026.";
  expect(handoverSmsText({ eventDate: "2026-08-23", link: "L", signed: false, includeDigitalLink: true }))
    .toBe(`${greeting} Materialele sunt gata: semnați procesul verbal de predare și le primiți imediat: L`);
  expect(handoverSmsText({ eventDate: "2026-08-23", link: "L", signed: false, includeDigitalLink: false }))
    .toBe(`${greeting} Vă rugăm să semnați procesul verbal de predare a materialelor: L`);
  expect(handoverSmsText({ eventDate: "2026-08-23", link: "L", signed: true, includeDigitalLink: true }))
    .toBe(`${greeting} Aici găsiți procesul verbal semnat și materialele: L`);
});
