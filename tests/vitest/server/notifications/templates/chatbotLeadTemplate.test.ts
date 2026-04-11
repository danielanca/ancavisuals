/*
 * Purpose: verifies that the chatbot lead email template renders the phone
 * number and date label correctly and contains expected structural elements.
 */
import { describe, expect, test } from "vitest";
import { renderChatbotLeadTemplate } from "src/server/notifications/templates/chatbotLeadTemplate";

describe("renderChatbotLeadTemplate", () => {
  test("includes the phone number in the output", () => {
    const html = renderChatbotLeadTemplate({ phone: "+40745123456", dateLabel: "18 Aprilie 2026" });
    expect(html).toContain("+40745123456");
  });

  test("includes the date label in the output", () => {
    const html = renderChatbotLeadTemplate({ phone: "+40745123456", dateLabel: "18 Aprilie 2026" });
    expect(html).toContain("18 Aprilie 2026");
  });

  test("shows 'nedefinită' when date label is empty string", () => {
    const html = renderChatbotLeadTemplate({ phone: "+40745000000", dateLabel: "" });
    expect(html).not.toContain("undefined");
  });

  test("returns a non-empty HTML string", () => {
    const html = renderChatbotLeadTemplate({ phone: "0745000000", dateLabel: "1 Mai 2026" });
    expect(html.trim().length).toBeGreaterThan(0);
    expect(html).toContain("<div");
  });
});
