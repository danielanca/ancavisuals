const PREFIX = "contract-work-draft:";
const LEGACY_KEY = "contract-create-draft";

export interface ContractWorkDraft {
  id: string;
  title: string;
  eventDate: string;
  updatedAt: string;
  progress: "todo" | "working";
  payload: string;
}

export function readWorkDraft(id: string): ContractWorkDraft | null {
  const raw = localStorage.getItem(PREFIX + id);
  if (!raw) return null;
  const draft = JSON.parse(raw) as ContractWorkDraft;
  return draft.id === id && typeof draft.payload === "string" ? draft : null;
}

export function saveWorkDraft(draft: ContractWorkDraft): void {
  localStorage.setItem(PREFIX + draft.id, JSON.stringify(draft));
}

export function removeWorkDraft(id: string): void {
  localStorage.removeItem(PREFIX + id);
}

export function listWorkDrafts(): ContractWorkDraft[] {
  const drafts: ContractWorkDraft[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      const draft = readWorkDraft(key.slice(PREFIX.length));
      if (draft) drafts.push(draft);
    } catch { /* An unreadable entry must not hide other drafts. */ }
  }
  return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function migrateLegacyWorkDraft(): string | null {
  const payload = localStorage.getItem(LEGACY_KEY);
  if (!payload) return null;
  const data = JSON.parse(payload);
  const id = localStorage.getItem(PREFIX + "legacy") ? crypto.randomUUID() : "legacy";
  saveWorkDraft({
    id, title: data.clientName?.trim() || "Draft necunoscut",
    eventDate: data.eventDate || data.eventDates?.[0] || data.dateToAdd || "", updatedAt: new Date().toISOString(),
    progress: "todo", payload,
  });
  localStorage.removeItem(LEGACY_KEY);
  return id;
}
