/*
 * Purpose: named clause templates ("șabloane") — one complete, independently saved list of
 * clauses per kind of event (Nuntă, Botez, Majorat, Corporate…). Editing one template never
 * changes another; the contract form picks which template to generate clauses from.
 */

export const DEFAULT_CLAUSE_SET_EVENT_TYPES = ["Nuntă", "Botez", "Majorat", "Corporate"] as const;

export const CLAUSE_SET_NAME_MAX = 80;
export const CLAUSE_SET_MAX_CLAUSES = 80;
const TITLE_MAX = 300;
const BODY_MAX = 10000;

export interface ClauseSetClause {
  key: string;
  title: string;
  bodyTemplate: string;
  order: number;
  groupKey: string | null;
  conditionTag: string | null;
  mutexGroup: string | null;
  isActive: boolean;
}

export interface ClauseSet {
  id: string;
  name: string;
  /** Event type this template is preselected for in the contract form (null = none). */
  eventType: string | null;
  clauses: ClauseSetClause[];
  updatedAt?: string | null;
}

const plainText = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** Validates and normalizes a template coming from the admin editor. Returns an error message or the clean value. */
export function normalizeClauseSetInput(
  input: unknown,
): { error: string } | { value: Omit<ClauseSet, "id" | "updatedAt"> } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return { error: "Dă un nume șablonului." };
  if (name.length > CLAUSE_SET_NAME_MAX) return { error: `Numele șablonului are maxim ${CLAUSE_SET_NAME_MAX} caractere.` };

  if (!Array.isArray(raw.clauses)) return { error: "Lista de clauze lipsește." };
  if (raw.clauses.length > CLAUSE_SET_MAX_CLAUSES) return { error: `Un șablon poate avea maxim ${CLAUSE_SET_MAX_CLAUSES} clauze.` };

  const clauses: ClauseSetClause[] = [];
  const keys = new Set<string>();
  for (const [index, item] of raw.clauses.entries()) {
    const clause = (item ?? {}) as Record<string, unknown>;
    const title = typeof clause.title === "string" ? clause.title.trim() : "";
    const bodyTemplate = typeof clause.bodyTemplate === "string" ? clause.bodyTemplate : "";
    if (!title || title.length > TITLE_MAX || !plainText(bodyTemplate) || bodyTemplate.length > BODY_MAX) {
      return { error: `Clauza ${index + 1}: completează titlul și textul (maxim ${TITLE_MAX} / ${BODY_MAX.toLocaleString("ro-RO")} caractere).` };
    }
    let key = typeof clause.key === "string" && clause.key.trim() ? clause.key.trim() : `clauza-${index + 1}`;
    while (keys.has(key)) key = `${key}-${index + 1}`;
    keys.add(key);
    clauses.push({
      key,
      title,
      bodyTemplate,
      order: (index + 1) * 10,
      groupKey: optionalText(clause.groupKey),
      conditionTag: optionalText(clause.conditionTag),
      mutexGroup: optionalText(clause.mutexGroup),
      isActive: clause.isActive !== false,
    });
  }

  return { value: { name, eventType: optionalText(raw.eventType), clauses } };
}

/** The template the contract form preselects: the one made for this event type, if any. */
export function defaultClauseSetFor<T extends Pick<ClauseSet, "id" | "eventType">>(sets: T[], eventType: string): T | null {
  return sets.find((set) => set.eventType && set.eventType === eventType) ?? null;
}
