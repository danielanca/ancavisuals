/*
 * Purpose: verifies which events feed the year-end tax projection — only future,
 * fiscalized, confirmed/tentative events of the selected year — and that amounts
 * already invoiced for an event (in any year, RON or EUR) are not counted twice.
 */
import { describe, expect, it } from "vitest";
import { fiscalizedEventsToInvoice } from "src/shared/finance/taxProjection";

const now = new Date("2026-10-16T12:00:00");
const opts = { year: 2026, now, eurRate: 5 };
const ev = (id: string, date: string, extra: Record<string, unknown> = {}) => ({
  id, eventDate: date, status: "confirmat", fiscalized: true, pricing: { total: 1000 }, ...extra,
});

describe("fiscalizedEventsToInvoice", () => {
  it("keeps only future fiscalized confirmed/tentative events of the selected year", () => {
    const rows = fiscalizedEventsToInvoice([
      ev("ok", "2026-11-07"),
      ev("tentativ", "2026-12-05", { status: "tentativ" }),
      ev("nefiscalizat", "2026-11-14", { fiscalized: false }),
      ev("lipsa-bifa", "2026-11-21", { fiscalized: undefined }),
      ev("anulat", "2026-11-28", { status: "anulat" }),
      ev("trecut", "2026-10-10"),
      ev("anul-viitor", "2027-05-15"),
      ev("fara-data", "", { eventDate: null }),
    ], [], opts);
    expect(rows.map((row) => row.event.id)).toEqual(["ok", "tentativ"]);
    expect(rows[0]).toMatchObject({ totalEur: 1000, invoicedEur: 0, toInvoiceEur: 1000, toInvoiceRon: 5000 });
  });

  it("subtracts invoices already issued for the event, from any year and currency", () => {
    const rows = fiscalizedEventsToInvoice([ev("e1", "2026-11-07"), ev("e2", "2026-11-14")], [
      { eventId: "e1", totalAmount: 1000, currency: "RON", taxExchangeRate: 5 }, // avans 200 EUR, facturat anul trecut
      { eventId: "e1", totalAmount: 100, currency: "EUR" },
      { eventId: "e2", totalAmount: 6000, currency: "RON" }, // facturat integral (curs implicit 5)
      { eventId: null, totalAmount: 999, currency: "RON" },
    ], opts);
    expect(rows[0]).toMatchObject({ invoicedEur: 300, toInvoiceEur: 700, toInvoiceRon: 3500 });
    expect(rows[1]).toMatchObject({ invoicedEur: 1200, toInvoiceEur: 0 });
  });
});
