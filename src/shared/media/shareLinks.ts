/*
 * Purpose: contract shared by the album page, the couple's share manager and the
 * /api/share endpoints — couple-key transport, label/message limits and the
 * summary shape the manager lists.
 */

/** Query param on /media/:slug that carries the couple's secret key (stripped after first read). */
export const COUPLE_KEY_PARAM = "cheie";
/** Header the album page sends so the server knows a share was made by the couple. */
export const COUPLE_KEY_HEADER = "x-couple-key";

export const SHARE_LABEL_MAX = 60;
export const SHARE_MESSAGE_MAX = 280;

/** Quick picks for "pentru cine e linkul". */
export const SHARE_LABEL_SUGGESTIONS = [
  "Nașii",
  "Părinții",
  "Familia miresei",
  "Familia mirelui",
  "Prietenii",
  "Colegii",
] as const;

export type ShareCreator = "couple" | "guest";

export type ShareLinkSummary = {
  id: string;
  label: string;
  message: string;
  createdBy: ShareCreator;
  count: number;
  showAll: boolean;
  createdAt: number | null;
  lastViewedAt: number | null;
  views: number;
  downloads: number;
  forwards: number;
  revoked: boolean;
  cover: string | null;
};

export const sharePath = (id: string) => `/share/${encodeURIComponent(id)}`;

export const coupleLinkPath = (slug: string, key: string) =>
  `/media/${encodeURIComponent(slug)}?${COUPLE_KEY_PARAM}=${encodeURIComponent(key)}`;

const isControlChar = (char: string, keepNewline: boolean) => {
  const code = char.charCodeAt(0);
  if (keepNewline && char === "\n") return false;
  return code < 0x20 || code === 0x7f;
};

const stripControlChars = (value: string, keepNewline: boolean) =>
  Array.from(value, (char) => (isControlChar(char, keepNewline) ? " " : char)).join("");

/** Trims, collapses whitespace and clips free text from the share form. */
export function cleanShareText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return stripControlChars(value, false).replace(/\s+/g, " ").trim().slice(0, max);
}

/** Message keeps line breaks (a short note from the couple), but nothing else unusual. */
export function cleanShareMessage(value: unknown): string {
  if (typeof value !== "string") return "";
  return stripControlChars(value.replace(/\r\n?/g, "\n"), true)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, SHARE_MESSAGE_MAX);
}
