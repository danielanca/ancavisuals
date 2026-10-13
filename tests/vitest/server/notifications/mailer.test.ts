/*
 * Purpose: verifies that sendEmail correctly delegates to the nodemailer
 * transport with the right options, and uses the configured sender address.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const buildMailer = async (senderEmail = "sender@example.com") => {
  const sendMailMock = vi.fn().mockResolvedValue({ messageId: "test-id", accepted: ["client@example.com"], rejected: [] });
  const setMock = vi.fn().mockResolvedValue(undefined);
  const logSetMock = vi.fn().mockResolvedValue(undefined);
  vi.doMock("src/server/firestore", () => ({
    firestore: () => ({ collection: (name: string) => ({ doc: (id = "") => ({
      set: name === "emailLog" ? logSetMock : setMock,
      get: async () => name === "qr_moments_email_config"
        ? { exists: true, data: () => ({ assetIds: ["one", "two", "three", "four", "five"] }) }
        : { exists: true, data: () => ({ kind: "image", previewUrl: `https://cdn.example.com/${id}.webp` }) },
    }) }) }),
  }));
  const transportMock = { sendMail: sendMailMock, verify: vi.fn().mockResolvedValue(true) };
  const createTransportMock = vi.fn(() => transportMock);

  vi.doMock("nodemailer", () => ({ default: { createTransport: createTransportMock } }));
  vi.doMock("src/server/constants/credentials", () => ({
    emailAuth: { email: senderEmail, password: "secret" },
    adminUser: { email: "admin@example.com" },
  }));

  const { sendEmail } = await import("src/server/notifications/mailer");
  return { sendEmail, sendMailMock, createTransportMock, setMock, logSetMock };
};

describe("sendEmail", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

  describe("happy path", () => {
    test("calls sendMail with the correct to, subject and html", async () => {
      const { sendEmail, sendMailMock } = await buildMailer();

      await sendEmail({ to: "client@example.com", subject: "Test", html: "<p>Hello</p>" });

      expect(sendMailMock).toHaveBeenCalledOnce();
      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
        to: "client@example.com",
        subject: "Test",
        html: expect.stringContaining("<p>Hello</p>"),
      }));
    });

    test("uses the configured sender email, with a display name, as from", async () => {
      const { sendEmail, sendMailMock } = await buildMailer("studio@ancavisuals.ro");

      await sendEmail({ to: "client@example.com", subject: "S", html: "<p>x</p>" });

      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
        from: '"AncaVisuals" <studio@ancavisuals.ro>',
      }));
    });

    test("allows overriding the from address", async () => {
      const { sendEmail, sendMailMock } = await buildMailer("default@example.com");

      await sendEmail({ to: "x@x.com", subject: "S", html: "<p>x</p>", from: "custom@example.com" });

      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
        from: "custom@example.com",
      }));
    });
  });

  describe("error handling", () => {
    test("propagates errors thrown by the transport", async () => {
      const { sendEmail, sendMailMock } = await buildMailer();
      sendMailMock.mockRejectedValueOnce(new Error("SMTP error"));

      await expect(sendEmail({ to: "x@x.com", subject: "S", html: "<p>x</p>" }))
        .rejects.toThrow("SMTP error");
    });
  });

  test("records accepted only after SMTP and excludes message bodies", async () => {
    const { sendEmail, setMock } = await buildMailer();
    await sendEmail({ to: "client@example.com", subject: "Test", html: "private body" });
    expect(setMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: "accepted", messageId: "test-id" }), { merge: true });
    expect(JSON.stringify(setMock.mock.calls)).not.toContain("private body");
  });

  test("keeps a full copy of every email in emailLog, marked sent after SMTP", async () => {
    const { sendEmail, logSetMock } = await buildMailer();
    await sendEmail({ to: "client@example.com", subject: "Test", html: "private body", source: "lead", leadId: "lead-1" });
    expect(logSetMock).toHaveBeenCalledWith(expect.objectContaining({
      to: "client@example.com", subject: "Test", html: "private body", status: "pending", source: "lead", leadId: "lead-1",
    }), { merge: true });
    expect(logSetMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: "sent" }), { merge: true });
  });

  test("a failed email stays in emailLog as failed", async () => {
    const { sendEmail, sendMailMock, logSetMock } = await buildMailer();
    sendMailMock.mockRejectedValue({ code: "EAUTH", responseCode: 535 });
    await expect(sendEmail({ to: "client@example.com", subject: "Test", html: "x" })).rejects.toBeDefined();
    expect(logSetMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed" }), { merge: true });
  });

  test("authentication failures are not retried and do not expose secrets", async () => {
    const { sendEmail, sendMailMock, setMock } = await buildMailer();
    vi.stubEnv("SMTP_APP_PASSWORD", "private password");
    sendMailMock.mockRejectedValue({ code: "EAUTH", responseCode: 535, message: "Invalid login private password" });
    await expect(sendEmail({ to: "client@example.com", subject: "Test", html: "x" })).rejects.toBeDefined();
    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(setMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed", error: expect.stringContaining("Autentificare") }), { merge: true });
    expect(JSON.stringify(setMock.mock.calls)).not.toContain("private password");
  });

  test("retries explicit transient rejection then records acceptance", async () => {
    const { sendEmail, sendMailMock } = await buildMailer();
    sendMailMock.mockRejectedValueOnce({ responseCode: 451 });
    await sendEmail({ to: "client@example.com", subject: "Test", html: "x" });
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  test("does not retry an ambiguous timeout or partial acceptance", async () => {
    const { sendEmail, sendMailMock } = await buildMailer();
    sendMailMock.mockRejectedValueOnce({ code: "ETIMEDOUT" });
    await expect(sendEmail({ to: "client@example.com", subject: "Test", html: "x" })).rejects.toBeDefined();
    expect(sendMailMock).toHaveBeenCalledOnce();
    sendMailMock.mockResolvedValueOnce({ accepted: ["a@example.com"], rejected: ["b@example.com"] });
    await expect(sendEmail({ to: "a@example.com,b@example.com", subject: "Test", html: "x" })).rejects.toThrow("incomplete");
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  test("history outage never retries an accepted message", async () => {
    const { sendEmail, sendMailMock, setMock } = await buildMailer();
    setMock.mockRejectedValue(new Error("Firestore down"));
    await sendEmail({ to: "client@example.com", subject: "Test", html: "x" });
    expect(sendMailMock).toHaveBeenCalledOnce();
  });

  describe("contact footer", () => {
    test("appends the email + WhatsApp contact footer to plain content", async () => {
      const { sendEmail, sendMailMock } = await buildMailer();

      await sendEmail({ to: "client@example.com", subject: "S", html: "<p>Hello</p>" });

      const html = sendMailMock.mock.calls[0][0].html as string;
      expect(html).toContain("info@ancavisuals.ro");
      expect(html).toContain("https://wa.me/40745469907");
      expect(html).toContain("<p>Hello</p>");
    });

    test("inserts both footers before the closing body of a full HTML document", async () => {
      const { sendEmail, sendMailMock } = await buildMailer();
      const fullDoc = "<!DOCTYPE html><html><body><p>Pre-built report</p></body></html>";

      await sendEmail({ to: "client@example.com", subject: "S", html: fullDoc });

      const html = sendMailMock.mock.calls[0][0].html as string;
      expect(html.indexOf("Păstrează emoția")).toBeGreaterThan(html.indexOf("<p>Pre-built report</p>"));
      expect(html.indexOf("info@ancavisuals.ro")).toBeGreaterThan(html.indexOf("Păstrează emoția"));
      expect(html).toContain("</body></html>");
    });

    test("appends the selected three-photo brand footer to client email", async () => {
      const { sendEmail, sendMailMock } = await buildMailer();
      await sendEmail({ to: "client@example.com", subject: "S", html: "<p>Salut</p>" });
      const html = sendMailMock.mock.calls[0][0].html as string;
      expect(html.match(/cdn\.example\.com\/(one|two|three|four|five)\.webp/g)).toHaveLength(5);
      expect(html).toContain("Descoperă AncaVisuals");
      expect(html).toContain("Videobooth 360 · QR Moments · Invitații digitale · Aplicație de planificare a nunții");
    });

    test("omits the photo marketing footer for the owner's admin email", async () => {
      const { sendEmail, sendMailMock } = await buildMailer();
      await sendEmail({ to: "  ancadaniel1994@gmail.com ", subject: "S", html: "<p>Admin</p>" });
      const html = sendMailMock.mock.calls[0][0].html as string;
      expect(html).not.toContain("Păstrează emoția");
      expect(html).not.toContain("cdn.example.com");
      expect(html).toContain("info@ancavisuals.ro");
    });
  });
});
