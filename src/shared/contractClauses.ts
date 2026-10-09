/** Custom clauses augment the legacy defaults when no library snapshot exists. */
export const CUSTOM_CLAUSE_PREFIX = "custom:";

export function validateCustomContractClauses(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const clause of value) {
    if (!clause || typeof clause !== "object" || typeof clause.key !== "string" || !clause.key.startsWith(CUSTOM_CLAUSE_PREFIX)) continue;
    if (typeof clause.title !== "string" || !clause.title.trim() || clause.title.length > 300 ||
        typeof clause.body !== "string" || !clause.body.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() || clause.body.length > 10000) {
      return "Completează titlul și textul fiecărei clauze adăugate (maxim 300 / 10.000 caractere) sau șterge/debifează clauza.";
    }
  }
  return null;
}
