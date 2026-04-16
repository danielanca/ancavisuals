/*
 * Purpose: verifies contract email helpers compose the expected links, subjects,
 * recipients, and PDF attachments before delegating to the mailer transport.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const buildModule = async () => {
  const sendMailMock = vi.fn().mockResolvedValue(undefined);

  vi.doMock("src/server/notifications/mailer", () => ({
    mailer: {
      sendMail: sendMailMock,
    },
  }));

  vi.doMock("src/server/constants/credentials", () => ({
    emailAuth: { email: "studio@ancavisuals.ro", password: "secret" },
    adminUser: { email: "admin@ancavisuals.ro" },
  }));

  const module = await import("src/server/notifications/templates/contractEmail");
  return { ...module, sendMailMock };
};

describe("contractEmail helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe("happy path", () => {
    test("sendContractLinkEmail builds the public signing link and subject", async () => {
      const { sendContractLinkEmail, sendMailMock } = await buildModule();

      await sendContractLinkEmail({
        to: "client@example.com",
        token: "token-1",
        eventType: "Nuntă",
        eventDate: "2026-09-12",
        baseUrl: "https://ancavisuals.ro",
      });

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
        from: "studio@ancavisuals.ro",
        to: "client@example.com",
        subject: expect.stringContaining("Contract servicii foto/video"),
        html: expect.stringContaining("https://ancavisuals.ro/contract/token-1"),
      }));
    });

    test("sendSignedContractEmail sends one mail to the client and one to admin with a download link", async () => {
      const { sendSignedContractEmail, sendMailMock } = await buildModule();
      const pdfUrl = "https://storage.example.com/contracts/Botez_2026-08-01.pdf";

      await sendSignedContractEmail({
        to: "client@example.com",
        eventType: "Botez",
        eventDate: "2026-08-01",
        clientName: "Ion Popescu",
        pdfUrl,
      });

      expect(sendMailMock).toHaveBeenCalledTimes(2);
      expect(sendMailMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        to: "client@example.com",
        from: "studio@ancavisuals.ro",
        subject: expect.stringContaining("Contract semnat"),
        html: expect.stringContaining(pdfUrl),
      }));
      expect(sendMailMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        to: "admin@ancavisuals.ro",
        subject: expect.stringContaining("[Admin] Contract semnat"),
        html: expect.stringContaining("Ion Popescu"),
      }));
    });
  });
});
