/*
 * Purpose: verifies the finance assistant tool loop — Claude's tool calls are answered
 * from Firestore (expenses converted EUR→RON at the BNR rate of the document day, bank
 * transactions filtered by justification status), the final text is returned with the
 * list of consulted sources, and unknown tools come back as errors instead of crashing —
 * without hitting Firestore, BNR or Claude.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

type Handler = (req: any, res: any, next?: any) => Promise<void> | void;

class FakeTimestamp {
  constructor(private readonly date: Date) {}
  static fromDate(date: Date) { return new FakeTimestamp(date); }
  toDate() { return this.date; }
}

function createMockResponse() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

const collections: Record<string, Array<Record<string, unknown>>> = {
  adminEvents: [
    { id: "ev1", eventDate: new FakeTimestamp(new Date("2026-11-07T12:00:00Z")), type: "nunta", status: "confirmat", fiscalized: true, client: { fullName: "Ana" }, pricing: { total: 1000, remainingAmount: 700 } },
    { id: "ev2", eventDate: new FakeTimestamp(new Date("2026-11-14T12:00:00Z")), type: "nunta", status: "confirmat", fiscalized: false, client: { fullName: "Bogdan" }, pricing: { total: 1500, remainingAmount: 1500 } },
    { id: "ev3", eventDate: new FakeTimestamp(new Date("2026-11-21T12:00:00Z")), type: "botez", status: "tentativ", client: { fullName: "Cristi" }, pricing: { total: 600, remainingAmount: 600 } },
  ],
  expenses: [
    { id: "e1", date: new FakeTimestamp(new Date("2026-03-03T10:00:00Z")), supplier: "Adobe", category: "software", amount: 100, currency: "EUR", deductibleAmount: 100, factura: { url: "u" } },
    { id: "e2", date: new FakeTimestamp(new Date("2026-03-10T10:00:00Z")), supplier: "OMV Petrom", category: "combustibil", amount: 400, currency: "RON", deductibleAmount: 200, factura: null, chitanta: null },
  ],
  bankStatements: [
    {
      id: "s1", year: 2026, account: "BT",
      entries: [
        { date: "2026-03-05", direction: "out", amount: 250, currency: "RON", counterparty: "EMAG", description: null, justificationStatus: "unmatched" },
        { date: "2026-03-06", direction: "in", amount: 5000, currency: "RON", counterparty: "Ion Pop", description: "avans nunta", justificationStatus: "matched", matchedLabel: "ADE12" },
        { date: "2026-03-07", direction: "out", amount: 90, currency: "RON", counterparty: "Transfer propriu", description: null, justificationStatus: "unmatched", dismissed: true },
      ],
    },
  ],
};

async function loadHandler(responses: Array<Record<string, unknown>>) {
  vi.resetModules();
  process.env.ANTHROPIC_API_KEY = "test-key";
  const createMock = vi.fn();
  for (const response of responses) createMock.mockResolvedValueOnce(response);

  const collectionMock = vi.fn((name: string) => {
    const query = {
      where: () => query,
      orderBy: () => query,
      get: async () => {
        const docs = (collections[name] ?? []).map(({ id, ...data }) => ({ id, data: () => data }));
        return { docs, size: docs.length };
      },
    };
    return query;
  });

  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (_req: any, _res: any, next: () => void) => next(),
    requireSupremeAdmin: (_req: any, _res: any, next: () => void) => next(),
  }));
  vi.doMock("src/server/firestore", () => ({ firestore: () => ({ collection: collectionMock }) }));
  vi.doMock("src/server/services/bnrExchangeRate.service", () => ({
    getBnrYearRates: async () => ({ "2026-03-02": 5.0, "2026-03-03": 5.1 }),
  }));
  vi.doMock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: createMock }; } }));
  vi.doMock("firebase-admin/firestore", () => ({ Timestamp: FakeTimestamp }));

  const { default: router } = await import("src/server/routes/financeAssistant.routes");
  const layer = (router as any).stack.find((l: any) => l.route?.path === "/chat" && l.route.methods.post);
  const handlers: Handler[] = layer.route.stack.map((s: any) => s.handle);
  return { handler: handlers[handlers.length - 1], createMock };
}

const toolUse = (id: string, name: string, input: Record<string, unknown>) => ({ type: "tool_use", id, name, input });

function toolResults(createMock: ReturnType<typeof vi.fn>, call: number) {
  const messages = createMock.mock.calls[call][0].messages as Array<{ role: string; content: unknown }>;
  const last = messages[messages.length - 1].content as Array<{ tool_use_id: string; content: string; is_error?: boolean }>;
  return last;
}

afterEach(() => {
  vi.doUnmock("src/server/firestore");
  vi.resetModules();
});

describe("finance assistant chat", () => {
  test("answers tool calls from Firestore and returns the final reply with sources", async () => {
    const { handler, createMock } = await loadHandler([
      { stop_reason: "tool_use", content: [toolUse("t1", "list_expenses", { year: 2026, month: 3 }), toolUse("t2", "list_bank_transactions", { year: 2026, status: "unmatched" })] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Ai o plată fără document la EMAG." }] },
    ]);
    const res = createMockResponse();
    await handler({ body: { context: "Profit: 1000 RON", messages: [{ role: "user", content: "ce plăți nu au document?" }] } }, res);

    expect(res.json).toHaveBeenCalledWith({ reply: "Ai o plată fără document la EMAG.", sources: ["cheltuieli 2026", "extrase bancare 2026"] });
    expect(createMock.mock.calls[0][0].system).toContain("Profit: 1000 RON");

    const [expenses, bank] = toolResults(createMock, 1).map((block) => JSON.parse(block.content));
    // 100 EUR la cursul BNR din 3 martie (5.1) + 400 RON
    expect(expenses.totalRon).toBe(910);
    expect(expenses.deductibleRon).toBe(710);
    expect(expenses.withoutDocument).toBe(1);
    // Tranzacția marcată manual ca "dismissed" nu mai apare ca fără document.
    expect(bank.rows).toHaveLength(1);
    expect(bank.rows[0]).toMatchObject({ counterparty: "EMAG", status: "unmatched", amountRon: 250 });
  });

  test("never exposes unfiscalized events to the model", async () => {
    const { handler, createMock } = await loadHandler([
      { stop_reason: "tool_use", content: [toolUse("t1", "list_events", { from: "2026-10-16", to: "2026-12-31" })] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Ai un eveniment fiscalizat." }] },
    ]);
    const res = createMockResponse();
    await handler({ body: { messages: [{ role: "user", content: "ce evenimente mai am?" }] } }, res);

    const events = JSON.parse(toolResults(createMock, 1)[0].content);
    expect(events.rows.map((row: { id: string }) => row.id)).toEqual(["ev1"]);
    expect(events).toMatchObject({ count: 1, totalEur: 1000, remainingEur: 700 });
  });

  test("reports unknown tools as errors and keeps going", async () => {
    const { handler, createMock } = await loadHandler([
      { stop_reason: "tool_use", content: [toolUse("t1", "delete_everything", {})] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Nu pot face asta." }] },
    ]);
    const res = createMockResponse();
    await handler({ body: { messages: [{ role: "user", content: "șterge tot" }] } }, res);

    expect(toolResults(createMock, 1)[0]).toMatchObject({ tool_use_id: "t1", is_error: true });
    expect(res.json).toHaveBeenCalledWith({ reply: "Nu pot face asta.", sources: [] });
  });

  test("rejects an empty conversation", async () => {
    const { handler, createMock } = await loadHandler([]);
    const res = createMockResponse();
    await handler({ body: { messages: [] } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(createMock).not.toHaveBeenCalled();
  });
});
