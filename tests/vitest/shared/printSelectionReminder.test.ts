import { describe, expect, test } from "vitest";
import { isPrintSelectionComplete, printReminderMessage, whatsappReminderUrl } from "src/shared/printSelectionReminder";
import { AUTOMATED_MESSAGE_LABEL, eventDateFromSlug, messageGreeting } from "src/shared/albumUpdates";

describe("printReminderMessage", () => {
  const url = "https://ancavisuals.ro/media/25iulie2026?select=print";
  test("greeting first, automatic label last", () => {
    const message = printReminderMessage("25iulie2026", 0, url);
    expect(message.startsWith("Bună ziua! Suntem echipa foto-video de la evenimentul din data de 25 iulie 2026.")).toBe(true);
    expect(message.endsWith(AUTOMATED_MESSAGE_LABEL)).toBe(true);
    expect(message).toContain("Nu ați ales încă");
    expect(message).toContain(url);
  });
  test("partial selection shows progress", () => {
    expect(printReminderMessage("25iulie2026", 40, url)).toContain("Ați ales până acum 40 din 100");
  });
  test("whatsapp link strips the plus", () => {
    expect(whatsappReminderUrl("+40745000000", "a b")).toBe("https://wa.me/40745000000?text=a%20b");
  });
});

describe("messageGreeting", () => {
  test.each([
    ["25iulie2026", "25 iulie 2026"],
    ["08august2026", "8 august 2026"],
    ["8august2026-ana", "8 august 2026"],
  ])("reads the event date from %s", (slug, date) => {
    expect(eventDateFromSlug(slug)).toBe(date);
  });
  test("slug without a date falls back to 'vostru'", () => {
    expect(eventDateFromSlug("nunta-ana")).toBeNull();
    expect(messageGreeting("nunta-ana")).toBe("Bună ziua! Suntem echipa foto-video de la evenimentul vostru.");
  });
});

describe("isPrintSelectionComplete", () => {
  test("100 picked photos (or more) need no reminder", () => {
    expect(isPrintSelectionComplete(99)).toBe(false);
    expect(isPrintSelectionComplete(100)).toBe(true);
    expect(isPrintSelectionComplete(104)).toBe(true);
  });
});
