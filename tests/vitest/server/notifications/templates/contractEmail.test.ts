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
    test("sendContractLinkEmail sends to client first then copies admin", async () => {
      const { sendContractLinkEmail, sendMailMock } = await buildModule();

      await sendContractLinkEmail({
        to: "client@example.com",
        token: "token-1",
        eventType: "Nuntă",
        eventDate: "2026-09-12",
        baseUrl: "https://ancavisuals.ro",
      });

      expect(sendMailMock).toHaveBeenCalledTimes(2);
      expect(sendMailMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        from: "studio@ancavisuals.ro",
        to: "client@example.com",
        subject: expect.stringContaining("Contract servicii foto/video"),
        html: expect.stringContaining("https://ancavisuals.ro/contract/token-1"),
      }));
      expect(sendMailMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        to: "admin@ancavisuals.ro",
        subject: expect.stringContaining("[Copie] Link contract trimis"),
        html: expect.stringContaining("https://ancavisuals.ro/contract/token-1"),
      }));
    });

    test("sendContractLinkEmail does not send admin copy if client delivery fails", async () => {
      const { sendContractLinkEmail, sendMailMock } = await buildModule();
      sendMailMock.mockRejectedValueOnce(new Error("SMTP connection refused"));

      await expect(sendContractLinkEmail({
        to: "client@example.com",
        token: "token-1",
        eventType: "Nuntă",
        eventDate: "2026-09-12",
        baseUrl: "https://ancavisuals.ro",
      })).rejects.toThrow("SMTP connection refused");

      expect(sendMailMock).toHaveBeenCalledTimes(1);
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

describe("signed contract email designs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  const options = {
    to: "client@example.com",
    eventType: "Nuntă",
    eventDate: "2027-08-27",
    clientName: "Boncz <Iulia>",
    pdfUrl: "https://storage.example.com/c.pdf",
    admin: { contractId: "abc123", clientPhone: "0712 345 678", priceTotal: 9500, priceAdvance: 2000, currency: "RON" },
  };

  test("the client gets the letter without the admin-only details, with the name escaped", async () => {
    const { sendSignedContractEmail, sendMailMock } = await buildModule();
    await sendSignedContractEmail(options);
    const html = sendMailMock.mock.calls[0][0].html as string;
    expect(html).toContain("Vă mulțumim!");
    expect(html).toContain("Descarcă contractul (PDF)");
    expect(html).toContain("Boncz &lt;Iulia&gt;");
    expect(html).not.toContain("<Iulia>");
    expect(html).not.toContain("9.500");
    expect(html).not.toContain("/admin/contracts/");
  });

  test("the admin gets the summary card with contact, money and quick actions", async () => {
    const { sendSignedContractEmail, sendMailMock } = await buildModule();
    await sendSignedContractEmail(options);
    const html = sendMailMock.mock.calls[1][0].html as string;
    expect(html).toContain("mailto:client@example.com");
    expect(html).toContain("https://wa.me/40712345678");
    expect(html).toContain("/admin/contracts/abc123/edit");
    expect(html).toContain("9.500 RON");
    expect(html).toContain("2.000 RON");
  });

  describe("bank transfer details", () => {
    const base = {
      to: "client@example.com", clientName: "Ion Popescu", eventType: "Nuntă", eventDate: "2026-09-12",
      beneficiaryName: "ANCA DANIEL EMANUEL PFA", iban: "ro49aaaa1b31007593840000", amount: 500, currency: "EUR", isAdvance: true,
    };

    test("description is 'date - service'", async () => {
      const { paymentReference } = await buildModule();
      expect(paymentReference("2026-09-12", "Nuntă")).toBe("12.09.2026 - Nuntă");
      expect(paymentReference("2026-05-03", "Botez")).toBe("03.05.2026 - Botez");
    });

    test("shows beneficiary, grouped IBAN, advance, lei equivalent and the description; sends to the client, then a copy to the owner", async () => {
      const { sendBankTransferEmail, bankTransferEmailHtml, sendMailMock } = await buildModule();
      const html = bankTransferEmailHtml({ ...base, eurRate: 4.98, eurRateDate: "2026-10-28", dueDate: "15.11.2026" });
      expect(html).toContain("ANCA DANIEL EMANUEL");
      expect(html).not.toContain("PFA");
      expect(html).toContain("RO49 AAAA 1B31 0075 9384 0000");
      expect(html).toContain("Avans");
      expect(html).toContain("500 EUR");
      expect(html).toContain(`${(2490).toLocaleString("ro-RO")} lei`);
      expect(html).toContain("curs BNR din 28.10.2026");
      expect(html).toContain("15.11.2026");
      expect(html).toContain("12.09.2026 - Nuntă");
      expect(html).toContain("euro sau echivalentul în lei");

      await sendBankTransferEmail(base);
      expect(sendMailMock).toHaveBeenCalledTimes(2);
      expect(sendMailMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ to: "client@example.com", subject: expect.stringContaining("Date pentru plată") }));
      expect(sendMailMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: "admin@ancavisuals.ro", subject: expect.stringContaining("[Copie] Date pentru plată") }));
    });

    test("the beneficiary is the person, without PFA", async () => {
      const { transferBeneficiaryName } = await buildModule();
      expect(transferBeneficiaryName("ANCA DANIEL EMANUEL PFA")).toBe("ANCA DANIEL EMANUEL");
      expect(transferBeneficiaryName("PFA Anca Daniel Emanuel")).toBe("Anca Daniel Emanuel");
      expect(transferBeneficiaryName("ANCA DANIEL EMANUEL P.F.A.")).toBe("ANCA DANIEL EMANUEL");
      expect(transferBeneficiaryName("ANCA DANIEL EMANUEL")).toBe("ANCA DANIEL EMANUEL");
    });

    test("RON contract: no lei line, no euro note", async () => {
      const { bankTransferEmailHtml } = await buildModule();
      const html = bankTransferEmailHtml({ ...base, currency: "RON", amount: 2500 });
      expect(html).not.toContain("curs BNR");
      expect(html).not.toContain("euro sau echivalentul");
    });
  });
});
