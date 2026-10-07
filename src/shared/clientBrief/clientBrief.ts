export interface BriefMoment {
  id: string;
  label: string;
  integral?: boolean;
}
export interface MomentAnswer {
  presence: "" | "yes" | "no" | "unknown";
  coverage: "" | "full" | "highlights" | "discuss";
  details: string;
}
export interface BriefAnswers {
  priorities: string;
  groupPhotos: string;
  importantPeople: string;
  avoid: string;
  schedule: string;
  contact: string;
  notes: string;
  moments: Record<string, MomentAnswer>;
}
export interface ClientBrief {
  clientName: string;
  eventType: string;
  eventDate: string | null;
  moments: BriefMoment[];
  answers: BriefAnswers;
  status: "draft" | "completed";
  revision: number;
  updatedAt: string;
  submittedAt: string | null;
  url?: string;
}
export interface TodayBriefEvent {
  id: string;
  clientName: string;
  eventType: string;
  eventDate: string | null;
  phone: string;
  services: string[];
  brief: ClientBrief | null;
}
export interface TodayBriefResponse {
  day: string;
  events: TodayBriefEvent[];
}
const weddingMoments: BriefMoment[] = [
  { id: "brideHome", label: "Pregătirile miresei acasă (dacă există)" },
  { id: "groomHome", label: "Pregătirile mirelui acasă (dacă există)" },
  { id: "homeTraditions", label: "Tradițiile de acasă (dacă există)", integral: true },
  { id: "civil", label: "Cununia civilă (dacă există)", integral: true },
  { id: "religious", label: "Cununia religioasă (dacă există)", integral: true },
  { id: "coupleSession", label: "Ședința foto-video de cuplu (dacă există)" },
  { id: "family", label: "Fotografiile cu familia și prietenii (dacă există)" },
  { id: "firstDance", label: "Dansul mirilor (dacă există)", integral: true },
  { id: "speeches", label: "Discursurile și surprizele (dacă există)", integral: true },
  { id: "party", label: "Petrecerea și tradițiile (dacă există)", integral: true },
  { id: "cake", label: "Momentul tortului (dacă există)", integral: true },
];
export function getBriefMoments(eventType: string): BriefMoment[] {
  if (eventType === "Nuntă" || eventType === "Logodnă") return weddingMoments;
  if (eventType === "Cununie civilă") return weddingMoments.filter(m => ["civil", "coupleSession", "family", "party", "cake"].includes(m.id));
  return [
    { id: "preparations", label: "Pregătirile de acasă (dacă există)" },
    ...(eventType === "Botez" ? [{ id: "religious", label: "Ceremonia religioasă (dacă există)", integral: true }] : []),
    { id: "session", label: "Ședința foto-video (dacă există)" },
    { id: "family", label: "Fotografiile cu familia și prietenii (dacă există)" },
    { id: "speeches", label: "Discursurile și surprizele (dacă există)", integral: true },
    { id: "party", label: "Petrecerea și momentele speciale (dacă există)", integral: true },
    { id: "cake", label: "Momentul tortului (dacă există)", integral: true },
  ];
}
export function emptyBriefAnswers(): BriefAnswers {
  return { priorities: "", groupPhotos: "", importantPeople: "", avoid: "", schedule: "", contact: "", notes: "", moments: {} };
}
export function emptyMomentAnswer(): MomentAnswer {
  return { presence: "", coverage: "", details: "" };
}
export function validateBriefAnswers(input: unknown, moments: BriefMoment[]): BriefAnswers {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Răspunsuri invalide.");
  const source = input as Record<string, unknown>;
  const answers = emptyBriefAnswers();
  for (const key of ["priorities", "groupPhotos", "importantPeople", "avoid", "schedule", "contact", "notes"] as const) {
    if (typeof source[key] !== "string" || source[key].length > 5000) throw new Error("Fiecare răspuns trebuie să aibă cel mult 5000 de caractere.");
    answers[key] = source[key].trim();
  }
  if (!source.moments || typeof source.moments !== "object" || Array.isArray(source.moments)) throw new Error("Momente invalide.");
  for (const moment of moments) {
    const raw = (source.moments as Record<string, unknown>)[moment.id];
    if (raw === undefined) continue;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Moment invalid.");
    const value = raw as Record<string, unknown>;
    if (!["", "yes", "no", "unknown"].includes(value.presence as string) ||
        !["", "full", "highlights", "discuss"].includes(value.coverage as string) ||
        typeof value.details !== "string" || value.details.length > 3000) throw new Error("Opțiuni invalide pentru un moment.");
    const exists = value.presence !== "no";
    answers.moments[moment.id] = {
      presence: value.presence as MomentAnswer["presence"],
      coverage: exists && moment.integral ? value.coverage as MomentAnswer["coverage"] : "",
      details: value.details.trim(),
    };
  }
  return answers;
}
