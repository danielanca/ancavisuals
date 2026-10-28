/*
 * Purpose: the payment-details email after signing — the cron sends what is due (client + owner
 * copy happen in the template), only for signed transfer contracts, with the right account,
 * amount and BNR rate; it clears the due mark so nothing goes twice, and gives up after failures.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const { sendBankTransferEmailMock, getBnrLatestRateMock } = vi.hoisted(() => ({
  sendBankTransferEmailMock: vi.fn(),
  getBnrLatestRateMock: vi.fn(),
}));

type Doc = Record<string, unknown>;
let contracts: Record<string, Doc> = {};
let settings: Doc = {};
const updates: Array<[string, Doc]> = [];

const refFor = (id: string) => ({
  id,
  update: vi.fn(async (patch: Doc) => {
    updates.push([id, patch]);
    contracts[id] = { ...contracts[id], ...patch };
  }),
});

vi.mock("src/server/firestore", () => ({
  firestore: () => ({
    collection: (name: string) => {
      if (name === "settings") return { doc: () => ({ get: async () => ({ data: () => settings }) }) };
      return {
        where: (_field: string, _op: string, value: string) => ({
          get: async () => ({
            docs: Object.entries(contracts)
              .filter(([, data]) => typeof data.bankTransferEmailDueAt === "string" && (data.bankTransferEmailDueAt as string) <= value)
              .map(([id, data]) => ({ id, ref: refFor(id), data: () => data })),
          }),
        }),
      };
    },
    runTransaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        get: async (ref: { id: string }) => ({ data: () => contracts[ref.id] }),
        update: (ref: { id: string }, patch: Doc) => {
          contracts[ref.id] = { ...contracts[ref.id], ...patch };
        },
      }),
  }),
}));
vi.mock("src/server/notifications/templates/contractEmail", () => ({ sendBankTransferEmail: sendBankTransferEmailMock }));
vi.mock("src/server/services/bnrExchangeRate.service", () => ({ getBnrLatestRate: getBnrLatestRateMock }));

import { sendDueBankTransferEmails } from "src/server/services/contractBankTransfer";

const NOW = new Date("2026-10-28T12:10:00.000Z");
const signed = (extra: Doc = {}): Doc => ({
  status: "signed", paymentMethod: "Transfer bancar", clientEmail: "client@example.com", clientName: "Ion Popescu",
  eventType: "Nuntă", eventDate: "2026-09-12", priceTotal: 2000, priceAdvance: 500, currency: "EUR",
  bankBeneficiaryName: "ANCA DANIEL EMANUEL PFA", bankIban: "RO49AAAA1B31007593840000",
  bankTransferEmailDueAt: "2026-10-28T12:09:00.000Z", ...extra,
});

beforeEach(() => {
  contracts = {};
  settings = {};
  updates.length = 0;
  sendBankTransferEmailMock.mockReset().mockResolvedValue(undefined);
  getBnrLatestRateMock.mockReset().mockResolvedValue({ rate: 5.3495, date: "2026-10-28" });
});

describe("sendDueBankTransferEmails", () => {
  test("sends a due one with the contract's account, advance and today's rate, once", async () => {
    contracts = { c1: signed(), later: signed({ bankTransferEmailDueAt: "2026-10-28T12:13:00.000Z" }) };
    await sendDueBankTransferEmails(NOW);
    expect(sendBankTransferEmailMock).toHaveBeenCalledTimes(1);
    expect(sendBankTransferEmailMock).toHaveBeenCalledWith({
      to: "client@example.com", clientName: "Ion Popescu", eventType: "Nuntă", eventDate: "2026-09-12",
      beneficiaryName: "ANCA DANIEL EMANUEL PFA", iban: "RO49AAAA1B31007593840000",
      amount: 500, currency: "EUR", isAdvance: true, dueDate: undefined, eurRate: 5.3495, eurRateDate: "2026-10-28",
    });
    expect(contracts.c1).toMatchObject({ bankTransferEmailDueAt: null, bankTransferEmailSentAt: NOW.toISOString() });

    await sendDueBankTransferEmails(NOW);
    expect(sendBankTransferEmailMock).toHaveBeenCalledTimes(1);
  });

  test("no account on the contract: uses the one in settings; RON skips the rate", async () => {
    settings = { bankDetails: { beneficiaryName: "ANCA DANIEL EMANUEL", iban: "RO11BBBB" } };
    contracts = { c1: signed({ bankBeneficiaryName: "", bankIban: "", currency: "RON", noAdvance: true, priceTotal: 9000 }) };
    await sendDueBankTransferEmails(NOW);
    expect(sendBankTransferEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      beneficiaryName: "ANCA DANIEL EMANUEL", iban: "RO11BBBB", amount: 9000, isAdvance: false, eurRate: undefined,
    }));
    expect(getBnrLatestRateMock).not.toHaveBeenCalled();
  });

  test("switched to cash or signature reset meanwhile: dropped without an email", async () => {
    contracts = { cash: signed({ paymentMethod: "Cash" }), reset: signed({ status: "sent" }) };
    await sendDueBankTransferEmails(NOW);
    expect(sendBankTransferEmailMock).not.toHaveBeenCalled();
    expect(contracts.cash.bankTransferEmailDueAt).toBeNull();
    expect(contracts.reset.bankTransferEmailDueAt).toBeNull();
  });

  test("BNR down: still sends, just without the lei line", async () => {
    getBnrLatestRateMock.mockRejectedValue(new Error("down"));
    contracts = { c1: signed() };
    await sendDueBankTransferEmails(NOW);
    expect(sendBankTransferEmailMock).toHaveBeenCalledWith(expect.objectContaining({ eurRate: undefined, eurRateDate: undefined }));
  });

  test("SMTP failing: retried after the lease, gives up after 5 attempts", async () => {
    sendBankTransferEmailMock.mockRejectedValue(new Error("SMTP down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    contracts = { c1: signed() };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await sendDueBankTransferEmails(new Date(NOW.getTime() + attempt * 6 * 60_000));
    }
    expect(sendBankTransferEmailMock).toHaveBeenCalledTimes(5);
    expect(contracts.c1).toMatchObject({ bankTransferEmailDueAt: null, bankTransferEmailAttempts: 5 });

    await sendDueBankTransferEmails(new Date(NOW.getTime() + 60 * 60_000));
    expect(sendBankTransferEmailMock).toHaveBeenCalledTimes(5);
  });
});
