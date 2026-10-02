/*
 * Purpose: verifies bank statement re-matching — foreign-currency entries keep
 * their currency, card payments in another currency match via BNR rates when the
 * name matches too, and learned counterparty aliases link renamed merchants —
 * without hitting Firestore, BNR or Claude.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

type Handler = (req: any, res: any, next?: any) => Promise<void> | void;

function createMockResponse() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

class FakeTimestamp {
  constructor(private readonly date: Date) {}
  static fromDate(date: Date) { return new FakeTimestamp(date); }
  static now() { return new FakeTimestamp(new Date()); }
  toDate() { return this.date; }
}

async function loadRouter(opts: {
  entries: Array<Record<string, unknown>>;
  invoices?: Array<Record<string, unknown>>;
  expenses?: Array<Record<string, unknown>>;
  aliases?: Array<Record<string, unknown>>;
}) {
  vi.resetModules();
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const statement = { year: 2026, account: "Cont", file: { url: "u", name: "x.pdf" }, entries: opts.entries, statementDate: new FakeTimestamp(new Date("2026-03-31")), createdAt: new FakeTimestamp(new Date()) };
  const asDocs = (items: Array<Record<string, unknown>> = []) => ({
    docs: items.map((item) => ({ id: String(item.id), data: () => ({ ...item, date: new FakeTimestamp(new Date(String(item.date))) }) })),
  });

  const collectionMock = vi.fn((name: string) => {
    const query = {
      where: () => query,
      get: async () => {
        if (name === "invoices") return asDocs(opts.invoices);
        if (name === "expenses") return asDocs(opts.expenses);
        if (name === "bankCounterpartyAliases") return { docs: (opts.aliases ?? []).map((a, i) => ({ id: `a${i}`, data: () => a })) };
        return { docs: [] };
      },
      doc: () => ({ get: async () => ({ exists: true, id: "st1", data: () => statement }), update: updateMock }),
    };
    return query;
  });

  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (_req: any, _res: any, next: () => void) => next(),
    requireSupremeAdmin: (_req: any, _res: any, next: () => void) => next(),
  }));
  vi.doMock("src/server/firestore", () => ({ firestore: () => ({ collection: collectionMock }) }));
  vi.doMock("src/server/constants/bunny", () => ({
    BUNNY_ACCESS_KEY_HEADER: "AccessKey",
    BUNNY_STORAGE_BASE_URL: "https://storage.bunnycdn.com",
    getBunnyStorageZone: () => "zone",
    getBunnyStoragePassword: () => "secret",
  }));
  vi.doMock("src/server/services/bnrExchangeRate.service", () => ({
    getBnrYearRates: async (_year: number, currency: "EUR" | "USD") => ({ "2026-03-02": currency === "USD" ? 4.6 : 5.0 }),
  }));
  const streamMock = vi.fn(() => ({ finalMessage: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: '{"decisions":[]}' }] }) }));
  vi.doMock("@anthropic-ai/sdk", () => ({ default: class { messages = { stream: streamMock }; } }));
  vi.doMock("firebase-admin/firestore", () => ({ Timestamp: FakeTimestamp }));

  const { default: router } = await import("src/server/routes/bankStatements.routes");
  const layer = (router as any).stack.find((l: any) => l.route?.path === "/:id/rematch" && l.route.methods.post);
  const handlers: Handler[] = layer.route.stack.map((s: any) => s.handle);
  return { handler: handlers[handlers.length - 1], updateMock };
}

async function rematch(opts: Parameters<typeof loadRouter>[0]) {
  const { handler } = await loadRouter(opts);
  const res = createMockResponse();
  await handler({ params: { id: "st1" }, body: {} }, res);
  return res.json.mock.calls[0][0].statement.entries as Array<Record<string, unknown>>;
}

afterEach(() => {
  vi.doUnmock("src/server/firestore");
  vi.resetModules();
});

describe("bank statements rematch", () => {
  test("matches a USD card payment to an expense stored in RON with its original USD amount", async () => {
    const entries = await rematch({
      entries: [{ date: "2026-03-02", direction: "out", amount: 20, currency: "USD", counterparty: "ADOBE", description: null }],
      expenses: [{ id: "e1", date: "2026-03-01", amount: 92, currency: "RON", originalAmount: 20, originalCurrency: "USD", supplier: "Adobe" }],
    });
    expect(entries[0]).toMatchObject({ currency: "USD", justificationStatus: "matched", matchedId: "e1" });
  });

  test("matches a RON debit for a EUR invoice paid by card via BNR rate when the name matches", async () => {
    const entries = await rematch({
      entries: [{ date: "2026-03-02", direction: "out", amount: 502.5, currency: "RON", counterparty: "Canva", description: null }],
      expenses: [{ id: "e2", date: "2026-03-02", amount: 100, currency: "EUR", supplier: "Canva" }],
    });
    expect(entries[0]).toMatchObject({ justificationStatus: "matched", matchedId: "e2" });
  });

  test("does not FX-match on amount and date alone", async () => {
    const entries = await rematch({
      entries: [{ date: "2026-03-02", direction: "out", amount: 502.5, currency: "RON", counterparty: "Transfer", description: null }],
      expenses: [{ id: "e3", date: "2026-03-02", amount: 100, currency: "EUR", supplier: "Canva" }],
    });
    expect(entries[0]).toMatchObject({ justificationStatus: "unmatched" });
  });

  test("uses a learned alias to link a renamed merchant outside the date window", async () => {
    const entries = await rematch({
      entries: [{ date: "2026-03-28", direction: "out", amount: 300, currency: "RON", counterparty: "PETROM 1234 BUCURESTI", description: null }],
      expenses: [{ id: "e4", date: "2026-03-02", amount: 300, currency: "RON", supplier: "OMV Petrom SA" }],
      aliases: [{ type: "expense", counterpartyKey: "petrom bucuresti", targetKey: "omv petrom sa" }],
    });
    expect(entries[0]).toMatchObject({ justificationStatus: "matched", matchedId: "e4" });
  });
});
