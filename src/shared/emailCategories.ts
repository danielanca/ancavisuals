/*
 * Purpose: /admin/email-log groups every email the site sent (and the replies it received) by
 * what it is about — leads, contracts, albums, QR Moments… — and by the event type in its subject
 * (Nuntă, Botez…). Most old log entries have no `source`, so the subject decides too.
 */

export type EmailDirection = "out" | "in";

export const EMAIL_CATEGORIES = [
  { id: "reply", label: "Răspunsuri primite", icon: "📥" },
  { id: "lead", label: "Lead-uri & contact", icon: "🔥" },
  { id: "contract", label: "Contracte & procese verbale", icon: "📝" },
  { id: "album", label: "Albume & livrare", icon: "🖼️" },
  { id: "qr", label: "QR Moments", icon: "✨" },
  { id: "proposal", label: "Propuneri Instagram", icon: "📸" },
  { id: "task", label: "Taskuri clienți", icon: "✅" },
  { id: "system", label: "Rapoarte & sistem", icon: "⚙️" },
  { id: "other", label: "Altele", icon: "✉️" },
] as const;

export type EmailCategory = (typeof EMAIL_CATEGORIES)[number]["id"];

type Rule = { category: EmailCategory; source?: RegExp; subject?: RegExp };

// First match wins: the source (set by newer code) is checked before the subject.
const RULES: Rule[] = [
  { category: "lead", source: /^(lead|live:|phone-reveal|contact-click|campaign|configurator|contact-form)/ },
  { category: "proposal", source: /^proposal-link/ },
  { category: "task", source: /^client-task/ },
  { category: "album", source: /^(album|print-selection|share)/ },
  { category: "qr", source: /^qr/ },
  { category: "qr", subject: /QR Moments|au vizualizat|a vizualizat/i },
  { category: "contract", subject: /contract|proces verbal|\bPV\b/i },
  { category: "album", subject: /album|ZIP|preview procesat|procesare|backup media|abonat nou|fotografii|poze|livrare|de trimis pe whatsapp/i },
  { category: "lead", subject: /lead|cerere|verificare dat|data .* (liber|ocupat)|whatsapp|telefon|contact/i },
  { category: "proposal", subject: /propuner/i },
  { category: "task", subject: /task/i },
  { category: "system", subject: /raport|eroare|erori|link greșit|nu se încarcă|decont|smtp|backup|alert/i },
];

export function categorizeEmail(entry: { source?: string | null; subject?: string | null; direction?: EmailDirection | null }): EmailCategory {
  if (entry.direction === "in") return "reply";
  const source = (entry.source ?? "").toLowerCase();
  const subject = entry.subject ?? "";
  for (const rule of RULES) {
    if (rule.source && source && rule.source.test(source)) return rule.category;
    if (rule.subject && rule.subject.test(subject)) return rule.category;
  }
  return "other";
}

const EVENT_TYPES: { label: string; pattern: RegExp }[] = [
  { label: "Nuntă", pattern: /nunt[aă]|cununie|mire|mireas/i },
  { label: "Botez", pattern: /botez/i },
  { label: "Majorat", pattern: /majorat/i },
  { label: "Corporate", pattern: /corporate|eveniment corporate/i },
  { label: "Ședință foto", pattern: /ședință foto|sedinta foto/i },
  { label: "Înmormântare", pattern: /înmormântare|inmormantare/i },
];

/** The event type named in the subject, e.g. "Contract semnat — Nuntă 12 iulie 2026" → "Nuntă". */
export function eventTypeOfEmail(subject?: string | null): string | null {
  const text = subject ?? "";
  return EVENT_TYPES.find((type) => type.pattern.test(text))?.label ?? null;
}

/** Lowercase, without diacritics: "Nuntă" and "nunta" match the same search. */
export const foldForSearch = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
