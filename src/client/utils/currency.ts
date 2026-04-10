export function convertToEur(
  raw: number,
  currency: "EUR" | "RON",
  exchangeRate: number,
): number | null {
  if (isNaN(raw) || raw <= 0) return null;
  if (currency === "EUR") return raw;
  if (isNaN(exchangeRate) || exchangeRate <= 0) return null;
  return Math.round((raw / exchangeRate) * 100) / 100;
}

export function parseAmount(value: string): number {
  return parseFloat(value.replace(",", "."));
}
