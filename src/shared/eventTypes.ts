// The landing pages and /bio send display names ("Nuntă"), the /contact
// configurator sends keys ("nunta"); both collapse to one label here.
const LABELS: Record<string, string> = {
  nunta: "Nuntă",
  botez: "Botez",
  majorat: "Majorat",
  logodna: "Logodnă",
  cununie: "Cununie civilă",
  "cununie civila": "Cununie civilă",
  aniversare: "Aniversare",
  corporate: "Corporate",
  inmormantare: "Înmormântare",
};

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Human label for an event type, or null when none was sent. */
export function eventTypeLabel(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const key = fold(raw);
  if (LABELS[key]) return LABELS[key];
  const clean = raw.trim().slice(0, 40);
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}
