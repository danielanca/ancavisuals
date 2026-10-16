/*
 * Purpose: verifies invoice duplicate detection — normalized invoice numbers,
 * supplier identity (CIF / legal-form-insensitive names) and the
 * "same supplier + amount + near date" heuristic, including the recurring
 * monthly subscription case that must NOT be flagged.
 */
import { describe, expect, test } from "vitest";
import { findExpenseDuplicate, normalizeInvoiceNumber, sameSupplier, supplierKey } from "src/shared/finance/expenseDuplicates";

const base = { id: "e1", date: "2026-10-01", supplier: "Acme SRL", invoiceNumber: "FA 0012", amount: 120, currency: "RON" };

describe("normalization", () => {
  test.each([["Factura nr. FA-0012", "FA12"], ["fa 12", "FA12"], ["FA2026001", "FA2026001"], ["0007", "7"]])("invoice %s → %s", (input, expected) => {
    expect(normalizeInvoiceNumber(input)).toBe(expected);
  });

  test("ignores legal forms, punctuation and diacritics in supplier names", () => {
    expect(supplierKey("SC ACME S.R.L.")).toBe("acme");
    expect(supplierKey("Acme S. R. L.")).toBe("acme");
    expect(supplierKey("Ștefănescu Impex SA")).toBe("stefanescuimpex");
  });

  test("CIF decides supplier identity when both are known", () => {
    expect(sameSupplier({ supplier: "Acme", supplierCif: "RO123" }, { supplier: "Altceva", supplierCif: "123" })).toBe(true);
    expect(sameSupplier({ supplier: "Acme", supplierCif: "123" }, { supplier: "Acme", supplierCif: "456" })).toBe(false);
    expect(sameSupplier({ supplier: "Orange" }, { supplier: "Orange Romania SA" })).toBe(true);
    expect(sameSupplier({ supplier: null }, { supplier: "Acme" })).toBeNull();
  });
});

describe("findExpenseDuplicate", () => {
  test("same invoice from the same supplier written differently is certain", () => {
    const match = findExpenseDuplicate({ date: "2026-10-05", supplier: "ACME S.R.L.", invoiceNumber: "Factura nr. FA-12", amount: 999 }, [base]);
    expect(match).toMatchObject({ level: "certain", reason: "invoice_number", expense: { id: "e1" } });
  });

  test("same invoice number from a different supplier is not a duplicate", () => {
    expect(findExpenseDuplicate({ date: "2026-10-01", supplier: "Beta SRL", invoiceNumber: "FA 12", amount: 120 }, [base])).toBeNull();
  });

  test("same number with unknown supplier: certain only when the amount matches too", () => {
    expect(findExpenseDuplicate({ supplier: null, invoiceNumber: "FA12", amount: 120, currency: "RON" }, [base])?.level).toBe("certain");
    expect(findExpenseDuplicate({ supplier: null, invoiceNumber: "FA12", amount: 50, currency: "RON" }, [base])?.level).toBe("probable");
  });

  test("different invoice numbers are distinct even with the same supplier, amount and date", () => {
    expect(findExpenseDuplicate({ ...base, id: undefined, invoiceNumber: "FA 13" }, [base])).toBeNull();
  });

  test("same supplier + amount + near date without a number is probable (photo vs PDF)", () => {
    const match = findExpenseDuplicate({ date: "2026-10-03", supplier: "Acme", invoiceNumber: null, amount: 120, currency: "RON" }, [base]);
    expect(match).toMatchObject({ level: "probable", reason: "supplier_amount_date" });
  });

  test("a monthly subscription with the same amount is not flagged", () => {
    const september = { id: "s1", date: "2026-09-01", supplier: "Netflix", amount: 59.99, currency: "RON", invoiceNumber: null };
    expect(findExpenseDuplicate({ date: "2026-10-01", supplier: "Netflix", amount: 59.99, currency: "RON" }, [september])).toBeNull();
  });

  test("different currency or amount is not a duplicate", () => {
    expect(findExpenseDuplicate({ date: "2026-10-01", supplier: "Acme", amount: 120, currency: "EUR" }, [{ ...base, invoiceNumber: null }])).toBeNull();
    expect(findExpenseDuplicate({ date: "2026-10-01", supplier: "Acme", amount: 121, currency: "RON" }, [{ ...base, invoiceNumber: null }])).toBeNull();
  });

  test("prefers a certain match over an earlier probable one and skips itself", () => {
    const probable = { id: "p", date: "2026-10-01", supplier: "Acme", amount: 120, currency: "RON", invoiceNumber: null };
    expect(findExpenseDuplicate({ date: "2026-10-01", supplier: "Acme", invoiceNumber: "FA12", amount: 120 }, [probable, base])?.expense.id).toBe("e1");
    expect(findExpenseDuplicate({ ...base }, [base])).toBeNull();
  });
});
