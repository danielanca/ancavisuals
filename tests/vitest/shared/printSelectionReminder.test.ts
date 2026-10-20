import { describe, expect, test } from "vitest";
import { printReminderMessage, whatsappReminderUrl } from "src/shared/printSelectionReminder";
import { AUTOMATED_MESSAGE_LABEL } from "src/shared/albumUpdates";

describe("printReminderMessage", () => {
  const url = "https://ancavisuals.ro/media/demo?select=print";
  test("nothing chosen yet", () => {
    const message = printReminderMessage("Ana Pop", 0, url);
    expect(message.startsWith(AUTOMATED_MESSAGE_LABEL)).toBe(true);
    expect(message).toContain("Bună, Ana!");
    expect(message).toContain("Nu ai ales încă");
    expect(message).toContain(url);
  });
  test("partial selection shows progress", () => {
    expect(printReminderMessage("", 40, url)).toContain("Bună! Ai ales până acum 40 din 100");
  });
  test("whatsapp link strips the plus", () => {
    expect(whatsappReminderUrl("+40745000000", "a b")).toBe("https://wa.me/40745000000?text=a%20b");
  });
});
