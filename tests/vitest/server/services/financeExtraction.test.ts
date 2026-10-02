/*
 * Purpose: verifies the deterministic parts of bank statement / receipt
 * extraction — CSV parsing for bank exports, balance reconciliation, receipt
 * sanity checks and receipt image tiling — without calling Claude.
 */
import { describe, expect, test } from "vitest";
import sharp from "sharp";
import { detectCsvMapping, parseCsvAmount, parseCsvDate, parseCsvRows, rowsToEntries } from "src/server/services/bankStatementCsv";
import { reconcileBalances } from "src/server/services/bankStatementAi";
import { validateScannedReceipt, type ScannedReceipt } from "src/server/services/receiptScan";
import { prepareImageBlocks } from "src/server/lib/visionImage";

describe("bank statement CSV import", () => {
  test("parses a Revolut personal export, skipping reverted rows and splitting fees", () => {
    const csv = [
      "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
      "CARD_PAYMENT,Current,2026-03-02 10:00:00,2026-03-03 09:00:00,Adobe,-24.99,0.50,USD,COMPLETED,975.01",
      "TOPUP,Current,2026-03-04 10:00:00,2026-03-04 10:01:00,Client SRL,1500.00,0.00,USD,COMPLETED,2475.01",
      "CARD_PAYMENT,Current,2026-03-05 10:00:00,,Netflix,-10.00,0.00,USD,REVERTED,",
    ].join("\n");
    const rows = parseCsvRows(csv);
    const mapping = detectCsvMapping(rows)!;
    expect(mapping).not.toBeNull();
    expect(rows[0][mapping.date]).toBe("Completed Date");

    const { entries, skipped } = rowsToEntries(rows, mapping);
    expect(skipped).toBe(1);
    expect(entries).toEqual([
      expect.objectContaining({ date: "2026-03-03", direction: "out", amount: 24.99, currency: "USD", description: "Adobe" }),
      expect.objectContaining({ date: "2026-03-03", direction: "out", amount: 0.5, currency: "USD", description: "Comision · Adobe" }),
      expect.objectContaining({ date: "2026-03-04", direction: "in", amount: 1500, currency: "USD" }),
    ]);
  });

  test("parses a Romanian semicolon export with separate debit/credit columns", () => {
    const csv = [
      "Extras de cont;;;;",
      "Data tranzactie;Descriere;Debit;Credit;Sold",
      '03.04.2026;"Plata POS PETROM 1234 BUCURESTI";"1.234,50";;"8.765,50"',
      "05.04.2026;Incasare Client SRL;;2.000,00;10.765,50",
    ].join("\r\n");
    const rows = parseCsvRows(csv);
    const mapping = detectCsvMapping(rows)!;
    expect(mapping.headerRow).toBe(1);
    const { entries } = rowsToEntries(rows, mapping);
    expect(entries).toEqual([
      expect.objectContaining({ date: "2026-04-03", direction: "out", amount: 1234.5, currency: "RON", balanceAfter: 8765.5 }),
      expect.objectContaining({ date: "2026-04-05", direction: "in", amount: 2000, currency: "RON" }),
    ]);
  });

  test("returns null mapping for unknown headers so the AI fallback can run", () => {
    expect(detectCsvMapping(parseCsvRows("foo,bar\n1,2"))).toBeNull();
  });

  test.each([
    ["1,234.56", 1234.56],
    ["1.234,56", 1234.56],
    ["-12,5", -12.5],
    ["(45.00)", -45],
    ["12.50 RON", 12.5],
    ["", null],
  ])("parseCsvAmount(%s) = %s", (input, expected) => {
    expect(parseCsvAmount(input)).toBe(expected);
  });

  test("reads dates as day-month-year and rejects impossible dates", () => {
    expect(parseCsvDate("03.04.2026")).toBe("2026-04-03");
    expect(parseCsvDate("2026-04-03 12:00")).toBe("2026-04-03");
    expect(parseCsvDate("3 apr 2026")).toBe("2026-04-03");
    expect(parseCsvDate("31.02.2026")).toBeNull();
  });
});

describe("reconcileBalances", () => {
  const entries = [
    { direction: "in" as const, amount: 1000, currency: "RON" },
    { direction: "out" as const, amount: 250.5, currency: "RON" },
    { direction: "out" as const, amount: 20, currency: "USD" },
  ];

  test("ok when opening + in - out = closing per currency", () => {
    const result = reconcileBalances(
      [{ currency: "RON", openingBalance: 100, closingBalance: 849.5 }, { currency: "USD", openingBalance: 50, closingBalance: 30 }],
      entries
    );
    expect(result.status).toBe("ok");
  });

  test("mismatch reports the missing difference", () => {
    const result = reconcileBalances([{ currency: "LEI", openingBalance: 100, closingBalance: 800 }], entries);
    expect(result.status).toBe("mismatch");
    expect(result.checks[0]).toMatchObject({ currency: "RON", expectedNet: 700, extractedNet: 749.5, difference: -49.5 });
  });

  test("unavailable when the statement shows no balances", () => {
    expect(reconcileBalances([{ currency: "RON", openingBalance: null, closingBalance: 10 }], entries).status).toBe("unavailable");
  });
});

describe("validateScannedReceipt", () => {
  const base: ScannedReceipt = {
    documentType: "bon_fiscal",
    date: "2026-09-15",
    supplier: "OMV Petrom SA",
    supplierCif: "RO 1590082",
    invoiceNumber: null,
    currency: "RON",
    total: 242,
    subtotal: 203.36,
    vat: 38.64,
    description: "Motorină",
    category: "combustibil",
    uncertainFields: [],
  };
  const now = new Date("2026-10-02T12:00:00Z");

  test("passes a consistent receipt through", () => {
    const result = validateScannedReceipt(base, now);
    expect(result.extracted).toMatchObject({ amount: 242, date: "2026-09-15", supplierCif: "1590082" });
    expect(result.uncertainFields).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test("flags the amount when total != subtotal + VAT", () => {
    const result = validateScannedReceipt({ ...base, total: 292 }, now);
    expect(result.uncertainFields).toContain("amount");
    expect(result.warnings[0]).toMatch(/subtotal \+ TVA/);
  });

  test("flags a future date (likely swapped day/month)", () => {
    const result = validateScannedReceipt({ ...base, date: "2026-12-10" }, now);
    expect(result.uncertainFields).toContain("date");
  });

  test("drops invalid dates instead of passing them to the form", () => {
    const result = validateScannedReceipt({ ...base, date: "2026-02-31" }, now);
    expect(result.extracted.date).toBeNull();
    expect(result.uncertainFields).toContain("date");
  });
});

describe("prepareImageBlocks", () => {
  test("keeps a normal photo as one JPEG within the resolution limit", async () => {
    const png = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: "#fff" } }).png().toBuffer();
    const blocks = await prepareImageBlocks(png, "image/png");
    expect(blocks).toHaveLength(1);
    const source = blocks[0].source as { media_type: string; data: string };
    expect(source.media_type).toBe("image/jpeg");
    const meta = await sharp(Buffer.from(source.data, "base64")).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2576);
  });

  test("splits a long receipt into overlapping tiles", async () => {
    const png = await sharp({ create: { width: 1000, height: 6000, channels: 3, background: "#fff" } }).png().toBuffer();
    const blocks = await prepareImageBlocks(png, "image/png");
    expect(blocks.length).toBe(4);
  });
});
