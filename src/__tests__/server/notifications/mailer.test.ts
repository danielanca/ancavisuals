/*
 * Purpose: verifies that sendEmail correctly delegates to the nodemailer
 * transport with the right options, and uses the configured sender address.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const buildMailer = async (senderEmail = "sender@example.com") => {
  const sendMailMock = vi.fn().mockResolvedValue({ messageId: "test-id" });
  const transportMock = { sendMail: sendMailMock };
  const createTransportMock = vi.fn(() => transportMock);

  vi.doMock("nodemailer", () => ({ default: { createTransport: createTransportMock } }));
  vi.doMock("../../../server/constants/credentials", () => ({
    emailAuth: { email: senderEmail, password: "secret" },
    adminUser: { email: "admin@example.com" },
  }));

  const { sendEmail } = await import("../../../server/notifications/mailer");
  return { sendEmail, sendMailMock, createTransportMock };
};

describe("sendEmail", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.clearAllMocks(); });

  test("calls sendMail with the correct to, subject and html", async () => {
    const { sendEmail, sendMailMock } = await buildMailer();

    await sendEmail({ to: "client@example.com", subject: "Test", html: "<p>Hello</p>" });

    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: "client@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    }));
  });

  test("uses the configured sender email as from", async () => {
    const { sendEmail, sendMailMock } = await buildMailer("studio@ancavisuals.ro");

    await sendEmail({ to: "client@example.com", subject: "S", html: "<p>x</p>" });

    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      from: "studio@ancavisuals.ro",
    }));
  });

  test("allows overriding the from address", async () => {
    const { sendEmail, sendMailMock } = await buildMailer("default@example.com");

    await sendEmail({ to: "x@x.com", subject: "S", html: "<p>x</p>", from: "custom@example.com" });

    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      from: "custom@example.com",
    }));
  });

  test("propagates errors thrown by the transport", async () => {
    const { sendEmail, sendMailMock } = await buildMailer();
    sendMailMock.mockRejectedValueOnce(new Error("SMTP error"));

    await expect(sendEmail({ to: "x@x.com", subject: "S", html: "<p>x</p>" }))
      .rejects.toThrow("SMTP error");
  });
});
