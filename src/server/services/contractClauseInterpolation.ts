import { esc, formatDate, resolveBankDetails, computeTransportEstimate } from "./pdf.generator";

export interface ClauseInterpolationContext {
  eventDate?: unknown;
  eventStartTime?: string;
  eventEndTime?: string;
  eventLocation?: string;
  eventType?: string;
  clientName?: string;
  contractTitle?: string;
  priceTotal?: number;
  currency?: string;
  priceAdvance?: number;
  priceRest?: number;
  transportKm?: number;
  transportFuelPrice?: number;
  bankBeneficiaryName?: string;
  bankIban?: string;
}

// Set fix, documentat, de token-uri disponibile în textul unei clauze din bibliotecă.
// Rezolvate o singură dată (la generarea checklist-ului în formularul de contract) — nu rămân
// vii în textul editat de admin, ca să nu riscăm sintaxă de template spartă după editare manuală.
export const CLAUSE_TOKENS: { token: string; description: string }[] = [
  { token: "{{eventDateFormatted}}", description: "Data evenimentului (ex: 12 iulie 2026)" },
  { token: "{{eventStartTime}}", description: "Ora de început a evenimentului" },
  { token: "{{eventEndTime}}", description: "Ora de final a evenimentului" },
  { token: "{{eventLocation}}", description: "Locația evenimentului" },
  { token: "{{eventType}}", description: "Tipul evenimentului (ex: Nuntă)" },
  { token: "{{clientName}}", description: "Numele beneficiarului" },
  { token: "{{contractTitle}}", description: "Titlul contractului (ex: Foto-Video)" },
  { token: "{{priceTotal}}", description: "Prețul total (fără monedă)" },
  { token: "{{currency}}", description: "Moneda (RON/EUR)" },
  { token: "{{priceAdvance}}", description: "Avansul" },
  { token: "{{priceRest}}", description: "Restul de plată" },
  { token: "{{transportEstimatedCost}}", description: "Estimarea costului de transport (dacă e cazul)" },
  { token: "{{bankBeneficiaryName}}", description: "Numele beneficiarului contului bancar" },
  { token: "{{bankIban}}", description: "IBAN-ul pentru plată" },
];

export function interpolateClauseTokens(template: string, ctx: ClauseInterpolationContext): string {
  const bankDetails = resolveBankDetails({ bankBeneficiaryName: ctx.bankBeneficiaryName, bankIban: ctx.bankIban });
  const transportEstimatedCost = ctx.transportKm
    ? String(computeTransportEstimate(Number(ctx.transportKm), Number(ctx.transportFuelPrice) || 10))
    : "";

  const replacements: Record<string, string> = {
    "{{eventDateFormatted}}": formatDate(ctx.eventDate),
    "{{eventStartTime}}": esc(ctx.eventStartTime ?? ""),
    "{{eventEndTime}}": esc(ctx.eventEndTime ?? ""),
    "{{eventLocation}}": esc(ctx.eventLocation ?? ""),
    "{{eventType}}": esc(ctx.eventType ?? ""),
    "{{clientName}}": esc(ctx.clientName ?? ""),
    "{{contractTitle}}": esc(ctx.contractTitle ?? ""),
    "{{priceTotal}}": esc(ctx.priceTotal ?? ""),
    "{{currency}}": esc(ctx.currency ?? ""),
    "{{priceAdvance}}": esc(ctx.priceAdvance ?? ""),
    "{{priceRest}}": esc(ctx.priceRest ?? ""),
    "{{transportEstimatedCost}}": transportEstimatedCost,
    "{{bankBeneficiaryName}}": esc(bankDetails.beneficiaryName),
    "{{bankIban}}": esc(bankDetails.iban),
  };

  let result = template;
  for (const [token, value] of Object.entries(replacements)) {
    result = result.split(token).join(value);
  }
  return result;
}
