// Detecția facturilor duplicate, comună pentru server (registrul complet) și
// client (perioada încărcată). Două niveluri:
//  - "certain": aceeași factură (număr normalizat + același furnizor) → blocare;
//  - "probable": același furnizor, aceeași sumă, dată apropiată, fără numere de
//    factură diferite (ex. aceeași factură încărcată o dată ca poză, o dată ca
//    PDF) → avertizare, salvarea cere confirmare explicită.
// Abonamentele lunare cu sumă fixă NU sunt duplicate: diferă data cu ~30 de zile.

export type DuplicateLevel = "certain" | "probable";

export interface ExpenseIdentity {
  id?: string;
  date?: string | Date | null;
  supplier?: string | null;
  supplierCif?: string | null;
  invoiceNumber?: string | null;
  amount?: number | null;
  currency?: string | null;
}

export interface ExpenseDuplicateMatch<T extends ExpenseIdentity> {
  expense: T;
  level: DuplicateLevel;
  reason: "invoice_number" | "supplier_amount_date";
}

// Zile între documente pentru „probabil duplicat”: acoperă data facturii vs.
// data chitanței/plății pentru același document.
export const PROBABLE_DUPLICATE_MAX_DAYS = 3;

const COMBINING_MARKS = /[̀-ͯ]/g;
// Forme juridice și cuvinte care nu identifică firma.
const LEGAL_FORM_TOKENS = new Set(["sc", "srl", "srld", "sa", "pfa", "ii", "if", "snc", "scs", "ltd", "limited", "gmbh", "inc", "llc", "bv", "sro", "spa", "sas", "co", "company", "romania", "ro"]);

export function normalizeInvoiceNumber(value: unknown): string {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^FACTURA/, "")
    .replace(/^(NR|NO)/, "");
  // „FA 0012” și „FA 12” sunt aceeași factură: zerourile de umplutură de la
  // începutul unui grup numeric nu contează.
  return normalized.replace(/(^|[A-Z])0+(?=\d)/g, "$1");
}

export function normalizeCif(value: unknown): string {
  return String(value ?? "").toUpperCase().replace(/^\s*RO/, "").replace(/\D/g, "");
}

export function supplierKey(value: unknown): string {
  const parts = String(value ?? "")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  // „S.R.L.” / „S. R. L.” devin litere separate: le lipim la loc („srl”) ca să
  // poată fi recunoscute ca formă juridică.
  const tokens: string[] = [];
  let inInitials = false;
  for (const part of parts) {
    const isInitial = /^[a-z]$/.test(part);
    if (isInitial && inInitials) tokens[tokens.length - 1] += part;
    else tokens.push(part);
    inInitials = isInitial;
  }
  return tokens.filter((token) => !LEGAL_FORM_TOKENS.has(token)).join("");
}

// true / false când se poate decide, null când lipsesc datele despre furnizor.
export function sameSupplier(a: ExpenseIdentity, b: ExpenseIdentity): boolean | null {
  const cifA = normalizeCif(a.supplierCif);
  const cifB = normalizeCif(b.supplierCif);
  if (cifA && cifB) return cifA === cifB;
  const keyA = supplierKey(a.supplier);
  const keyB = supplierKey(b.supplier);
  if (!keyA || !keyB) return null;
  if (keyA === keyB) return true;
  const [shorter, longer] = keyA.length <= keyB.length ? [keyA, keyB] : [keyB, keyA];
  return shorter.length >= 4 && longer.includes(shorter);
}

function sameAmount(a: ExpenseIdentity, b: ExpenseIdentity): boolean {
  const amountA = Number(a.amount);
  const amountB = Number(b.amount);
  if (!Number.isFinite(amountA) || !Number.isFinite(amountB)) return false;
  return (a.currency || "RON") === (b.currency || "RON") && Math.abs(amountA - amountB) < 0.01;
}

function dayDistance(a: ExpenseIdentity, b: ExpenseIdentity): number | null {
  if (!a.date || !b.date) return null;
  const timeA = new Date(a.date).getTime();
  const timeB = new Date(b.date).getTime();
  if (!Number.isFinite(timeA) || !Number.isFinite(timeB)) return null;
  return Math.abs(timeA - timeB) / 86_400_000;
}

function classify(candidate: ExpenseIdentity, existing: ExpenseIdentity): ExpenseDuplicateMatch<ExpenseIdentity>["level"] | null {
  const supplierMatch = sameSupplier(candidate, existing);
  const numberA = normalizeInvoiceNumber(candidate.invoiceNumber);
  const numberB = normalizeInvoiceNumber(existing.invoiceNumber);

  if (numberA && numberB) {
    if (numberA !== numberB) return null; // facturi diferite, chiar dacă suma coincide
    if (supplierMatch === false) return null; // furnizori diferiți pot avea același număr
    if (supplierMatch === true || sameAmount(candidate, existing)) return "certain";
    return "probable";
  }

  if (supplierMatch !== true || !sameAmount(candidate, existing)) return null;
  const days = dayDistance(candidate, existing);
  return days != null && days <= PROBABLE_DUPLICATE_MAX_DAYS ? "probable" : null;
}

export function findExpenseDuplicate<T extends ExpenseIdentity>(candidate: ExpenseIdentity, existing: readonly T[]): ExpenseDuplicateMatch<T> | null {
  let probable: ExpenseDuplicateMatch<T> | null = null;
  for (const item of existing) {
    if (candidate.id && item.id === candidate.id) continue;
    const level = classify(candidate, item);
    if (!level) continue;
    const reason = normalizeInvoiceNumber(candidate.invoiceNumber) && normalizeInvoiceNumber(item.invoiceNumber) ? "invoice_number" : "supplier_amount_date";
    if (level === "certain") return { expense: item, level, reason };
    probable ??= { expense: item, level, reason };
  }
  return probable;
}
