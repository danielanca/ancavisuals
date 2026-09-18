// Furnizori din străinătate care emit facturi fără TVA românesc (taxare inversă /
// achiziție intracomunitară de servicii ori bunuri) — extinde lista dacă apar alții.
export const REVERSE_CHARGE_SUPPLIERS = ["google", "openai", "anthropic", "bunny", "thomann", "meta", "facebook"];

const COMBINING_MARKS = /[̀-ͯ]/g;

function normaliseSupplierName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isReverseChargeSupplier(supplier: string | null | undefined): boolean {
  if (!supplier) return false;
  const normalised = normaliseSupplierName(supplier);
  return REVERSE_CHARGE_SUPPLIERS.some((name) => normalised.includes(name));
}

// Cotă standard TVA România — verifică periodic dacă legislația s-a schimbat.
// Folosită doar ca estimare pentru reamintirea de declarare; nu e sfat fiscal definitiv.
export const STANDARD_VAT_RATE = 0.21;
