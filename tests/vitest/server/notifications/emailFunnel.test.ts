/*
 * Purpose: every email goes through one funnel — a blocked lead/contact is logged
 * as an error (and surfaced via console.error → serverErrors), the owner's own
 * traffic and duplicates are logged as info, and nothing is dropped silently.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

async function loadFunnel() {
  const logEmailMock = vi.fn().mockResolvedValue("log-id");
  const sendEmailMock = vi.fn().mockResolvedValue(undefined);
  vi.doMock("src/server/services/emailLog.service", () => ({ logEmail: logEmailMock }));
  vi.doMock("src/server/notifications/mailer", () => ({ sendEmail: sendEmailMock }));
  const funnel = await import("src/server/notifications/emailFunnel");
  return { ...funnel, logEmailMock, sendEmailMock };
}

const email = { to: "owner@test.ro", subject: "Lead rapid", html: "<p>x</p>", source: "lead" };

afterEach(() => { vi.resetModules(); vi.restoreAllMocks(); });

describe("emailFunnel", () => {
  test("a blocked lead is logged as an error with its reason and reported", async () => {
    const { blockEmail, logEmailMock } = await loadFunnel();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await blockEmail({ ...email, kind: "lead", leadId: "l1" }, "bot", "fără User-Agent");
    expect(logEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "skipped", severity: "error", reason: "bot: fără User-Agent", leadId: "l1", html: "<p>x</p>",
    }));
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("[email-funnel] BLOCAT"));
  });

  test("owner traffic and duplicates are logged as info, not errors", async () => {
    const { blockEmail, logEmailMock } = await loadFunnel();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await blockEmail({ ...email, kind: "contact" }, "duplicate");
    await blockEmail({ ...email, kind: "lead" }, "admin");
    expect(logEmailMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ severity: "info" }));
    expect(logEmailMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ severity: "info" }));
    expect(consoleError).not.toHaveBeenCalled();
  });

  test("severity rules", async () => {
    const { blockSeverity } = await loadFunnel();
    expect(blockSeverity("lead", "country")).toBe("error");
    expect(blockSeverity("lead", "settings")).toBe("error");
    expect(blockSeverity("contact", "bot")).toBe("error");
    expect(blockSeverity("contact", "local-ip")).toBe("info");
    expect(blockSeverity("notification", "country")).toBe("info");
  });

  test("sendViaFunnel hands the email to the mailer with source and lead link", async () => {
    const { sendViaFunnel, sendEmailMock } = await loadFunnel();
    await sendViaFunnel({ ...email, kind: "lead", leadId: "l1" });
    expect(sendEmailMock).toHaveBeenCalledWith({ to: "owner@test.ro", subject: "Lead rapid", html: "<p>x</p>", source: "lead", leadId: "l1" });
  });
});
