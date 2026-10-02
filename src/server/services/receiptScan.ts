import { nullable } from "../lib/claudeStructured";

export const RECEIPT_CATEGORIES = ["combustibil", "echipament", "transport", "software", "cazare", "alimentatie", "marketing", "altele"] as const;
const RECEIPT_FIELDS = ["date", "supplier", "amount", "currency", "invoiceNumber", "description", "category"] as const;

export type ReceiptField = (typeof RECEIPT_FIELDS)[number];

export type ScannedReceipt = {
  documentType: "bon_fiscal" | "factura" | "chitanta" | "altul";
  date: string | null;
  supplier: string | null;
  supplierCif: string | null;
  invoiceNumber: string | null;
  currency: "RON" | "EUR" | "USD" | null;
  total: number | null;
  subtotal: number | null;
  vat: number | null;
  description: string | null;
  category: (typeof RECEIPT_CATEGORIES)[number];
  uncertainFields: ReceiptField[];
};

export const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["documentType", "date", "supplier", "supplierCif", "invoiceNumber", "currency", "total", "subtotal", "vat", "description", "category", "uncertainFields"],
  properties: {
    documentType: { type: "string", enum: ["bon_fiscal", "factura", "chitanta", "altul"] },
    date: nullable({ type: "string", format: "date" }),
    supplier: nullable({ type: "string" }),
    supplierCif: nullable({ type: "string" }),
    invoiceNumber: nullable({ type: "string" }),
    currency: nullable({ type: "string", enum: ["RON", "EUR", "USD"] }),
    total: nullable({ type: "number" }),
    subtotal: nullable({ type: "number" }),
    vat: nullable({ type: "number" }),
    description: nullable({ type: "string" }),
    category: { type: "string", enum: [...RECEIPT_CATEGORIES] },
    uncertainFields: { type: "array", items: { type: "string", enum: [...RECEIPT_FIELDS] } },
  },
} as const satisfies Record<string, unknown>;

export function buildReceiptPrompt(imageCount: number): string {
  const tiles = imageCount > 1
    ? `\nCele ${imageCount} imagini sunt bucăți consecutive ale ACELUIAȘI document, de sus în jos, cu mică suprapunere între ele — nu număra de două ori rândurile care apar în zona suprapusă.\n`
    : "";
  return `Extrage datele din acest bon fiscal / factură / chitanță din România, pentru registrul de cheltuieli al unui PFA.${tiles}
Reguli:
- total = suma finală plătită, cu TVA inclus (rândul „TOTAL”, „TOTAL DE PLATĂ”, „TOTAL LEI”, „Total factură”). NU subtotalul, NU „REST”, NU suma predată în numerar/card dacă diferă de total.
- subtotal = baza impozabilă fără TVA, vat = TVA total. Dacă documentul nu le arată separat, pune null.
- date = data emiterii documentului, în format YYYY-MM-DD. Pe documentele românești data e scrisă ZI.LUNĂ.AN (ex. 03.04.2026 = 3 aprilie 2026), nu lună/zi.
- supplier = firma care a emis documentul (antetul, lângă CIF/CUI), nu clientul. supplierCif = CIF/CUI-ul ei, fără „RO” în față.
- invoiceNumber = seria și numărul exact cum apar (ex. „FA 2024 001”). Pentru bon fiscal fără număr de factură: null.
- currency = moneda totalului. „LEI” înseamnă RON.
- description = pe scurt ce s-a cumpărat (max ~8 cuvinte).
- Nu inventa și nu ghici: dacă un câmp nu se vede, pune null.
- uncertainFields = câmpurile pe care le-ai completat, dar a căror citire nu e sigură (cifre neclare, pliuri, text estompat, cerneală ștearsă). Lasă lista goală dacă totul e clar.`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function validDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

/**
 * Verificări deterministe peste ce a citit AI-ul: total = subtotal + TVA, dată
 * plauzibilă. Ce nu trece verificarea e marcat ca nesigur în formular, nu
 * corectat automat.
 */
export function validateScannedReceipt(scan: ScannedReceipt, now = new Date()) {
  const uncertain = new Set<ReceiptField>(scan.uncertainFields.filter((field) => RECEIPT_FIELDS.includes(field)));
  const warnings: string[] = [];

  const total = scan.total != null && Number.isFinite(scan.total) && scan.total > 0 ? round2(scan.total) : null;
  if (total != null && scan.subtotal != null && scan.vat != null) {
    const expected = round2(scan.subtotal + scan.vat);
    if (Math.abs(expected - total) > 0.05) {
      uncertain.add("amount");
      warnings.push(`Totalul citit (${total.toFixed(2)}) nu este egal cu subtotal + TVA (${expected.toFixed(2)}). Verifică suma.`);
    }
  }

  const date = validDate(scan.date);
  if (scan.date && !date) uncertain.add("date");
  if (date) {
    const ageDays = (now.getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86400000;
    if (ageDays < -1) {
      uncertain.add("date");
      warnings.push("Data citită este în viitor — probabil zi și lună inversate. Verifică data.");
    } else if (ageDays > 400) {
      uncertain.add("date");
      warnings.push("Data citită e mai veche de un an. Verifică data.");
    }
  }

  const supplier = scan.supplier?.trim() || null;
  const cif = scan.supplierCif?.replace(/^RO/i, "").replace(/\s+/g, "") || null;

  return {
    extracted: {
      date,
      supplier,
      supplierCif: cif,
      amount: total,
      currency: scan.currency,
      description: scan.description?.trim() || null,
      category: RECEIPT_CATEGORIES.includes(scan.category) ? scan.category : "altele",
      invoiceNumber: scan.invoiceNumber?.trim() || null,
      documentType: scan.documentType,
      subtotal: scan.subtotal,
      vat: scan.vat,
    },
    uncertainFields: [...uncertain],
    warnings,
  };
}
