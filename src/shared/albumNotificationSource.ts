/*
 * Purpose: tells which notification brought a client to /media/:slug. Every album link we send
 * (SMS, WhatsApp, email) carries `?s=<canal>-<tip>`, e.g. `?s=sms-nou`. Kept this short on
 * purpose: SMS is billed per 160-character segment and a full utm_* string could add one.
 * The album page reports the open to /admin/live and to the dashboard's Activitate.
 */

export const NOTIFICATION_SOURCE_PARAM = "s";
/** Stored as utm_medium in the visit's attribution (utm_source = canal, utm_campaign = tip). */
export const NOTIFICATION_MEDIUM = "notificare";

export const NOTIFICATION_CHANNELS = {
  sms: "SMS",
  wa: "WhatsApp",
  email: "Email",
} as const;
export type NotificationChannel = keyof typeof NOTIFICATION_CHANNELS;

export const NOTIFICATION_KINDS = {
  nou: "noutate album",
  poze: "reamintire alege pozele",
  abonare: "confirmare abonare",
  expira: "album aproape de expirare",
} as const;
export type NotificationKind = keyof typeof NOTIFICATION_KINDS;

export type NotificationSource = { channel: NotificationChannel; kind: NotificationKind; label: string };

/** Album link for a notification; keeps any query the link already needs (e.g. `select=print`). */
export function albumNotificationUrl(
  baseUrl: string,
  slug: string,
  channel: NotificationChannel,
  kind: NotificationKind,
  query: Record<string, string> = {},
): string {
  const params = new URLSearchParams({ ...query, [NOTIFICATION_SOURCE_PARAM]: `${channel}-${kind}` });
  return `${baseUrl.replace(/\/+$/, "")}/media/${encodeURIComponent(slug)}?${params.toString()}`;
}

/** `sms-nou` → { channel: "sms", kind: "nou", label: "SMS · noutate album" }; anything else → null. */
export function parseNotificationSource(value: unknown): NotificationSource | null {
  const match = /^([a-z]+)-([a-z]+)$/.exec(String(value ?? "").trim().toLowerCase());
  if (!match) return null;
  const [, channel, kind] = match;
  // Object.hasOwn, not `in`: "constructor" would otherwise match the prototype.
  if (!Object.hasOwn(NOTIFICATION_CHANNELS, channel) || !Object.hasOwn(NOTIFICATION_KINDS, kind)) return null;
  const c = channel as NotificationChannel;
  const k = kind as NotificationKind;
  return { channel: c, kind: k, label: `${NOTIFICATION_CHANNELS[c]} · ${NOTIFICATION_KINDS[k]}` };
}

/** The notification a live / analytics visit came from, read back from its stored attribution. */
export function notificationSourceFromAttribution(attr: { utmSource?: string; utmMedium?: string; utmCampaign?: string }): NotificationSource | null {
  if (attr.utmMedium !== NOTIFICATION_MEDIUM) return null;
  return parseNotificationSource(`${attr.utmSource ?? ""}-${attr.utmCampaign ?? ""}`);
}
