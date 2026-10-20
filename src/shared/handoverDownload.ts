// Digital links from a signed handover (Proces Verbal) are valid N days from signing.
// Shared by the admin list (shows the deadline) and the download-reminder email.
export const DEFAULT_DIGITAL_LINK_EXPIRY_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

export function digitalLinksValidUntil(signedAt: string | null | undefined, expiryDays?: number | null): Date | null {
  if (!signedAt) return null;
  const signed = new Date(signedAt);
  if (isNaN(signed.getTime())) return null;
  const days = typeof expiryDays === "number" && expiryDays > 0 ? expiryDays : DEFAULT_DIGITAL_LINK_EXPIRY_DAYS;
  return new Date(signed.getTime() + days * DAY_MS);
}

/** Whole days left until the links expire (negative once expired). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}
