/*
 * Purpose: "Noutăți album" — the admin posts estimates / new-photos / announcements on an
 * album; subscribers (email, SMS, WhatsApp) get the same short message. Shared by the album
 * page, the admin composer and /api/album-subscriptions.
 */

export const ALBUM_UPDATE_KINDS = ["estimate", "delay", "photos", "announcement"] as const;
export type AlbumUpdateKind = (typeof ALBUM_UPDATE_KINDS)[number];

export const ALBUM_UPDATE_META: Record<AlbumUpdateKind, { emoji: string; label: string; placeholder: string }> = {
  estimate: { emoji: "📅", label: "Estimare", placeholder: "Ex: Pozele editate sunt gata în jur de 15 noiembrie." },
  delay: { emoji: "⏳", label: "Termen actualizat", placeholder: "Ex: Din cauza numărului mare de evenimente, pozele vor fi gata cu câteva zile mai târziu." },
  photos: { emoji: "📸", label: "Poze noi", placeholder: "Ex: Am încărcat încă 120 de poze de la petrecere." },
  announcement: { emoji: "📢", label: "Anunț", placeholder: "Ex: Filmul de nuntă e în montaj, revenim cu noutăți." },
};

export const SUBSCRIBE_CHANNELS = ["email", "sms", "whatsapp"] as const;
export type SubscribeChannel = (typeof SUBSCRIBE_CHANNELS)[number];

export const SUBSCRIBE_CHANNEL_META: Record<SubscribeChannel, { emoji: string; label: string }> = {
  email: { emoji: "✉️", label: "Email" },
  sms: { emoji: "💬", label: "SMS" },
  whatsapp: { emoji: "🟢", label: "WhatsApp" },
};

/**
 * How a published update reaches subscribers who left a phone number: as each one chose,
 * or the admin overrides it for this message (e.g. WhatsApp for everyone, no SMS cost).
 */
export const PHONE_DELIVERIES = ["subscriber", "whatsapp", "sms", "both", "none"] as const;
export type PhoneDelivery = (typeof PHONE_DELIVERIES)[number];

export const PHONE_DELIVERY_LABEL: Record<PhoneDelivery, string> = {
  subscriber: "Cum a ales fiecare abonat",
  whatsapp: "Toți pe WhatsApp (tu apeși Trimite)",
  sms: "Toți pe SMS (automat)",
  both: "Și WhatsApp, și SMS",
  none: "Fără SMS / WhatsApp",
};

/** The admin's ticked channels → how phone subscribers are reached. */
export function phoneDeliveryFromChoice(sms: boolean, whatsapp: boolean): PhoneDelivery {
  if (sms && whatsapp) return "both";
  if (sms) return "sms";
  if (whatsapp) return "whatsapp";
  return "none";
}

export const parsePhoneDelivery = (value: unknown): PhoneDelivery =>
  PHONE_DELIVERIES.includes(value as PhoneDelivery) ? (value as PhoneDelivery) : "subscriber";

/** Phone channels to use for one subscriber; email-only subscribers never get a phone channel. */
export function phoneChannelsFor(subscriberChannels: readonly SubscribeChannel[], delivery: PhoneDelivery): ("sms" | "whatsapp")[] {
  const own = subscriberChannels.filter((c): c is "sms" | "whatsapp" => c === "sms" || c === "whatsapp");
  if (delivery === "none") return [];
  if (delivery === "subscriber" || own.length === 0) return own;
  return delivery === "both" ? ["whatsapp", "sms"] : [delivery];
}

export const ALBUM_UPDATE_TEXT_MAX = 600;

/** Kinds that carry a date shown big in the timeline. */
export const kindHasDate = (kind: AlbumUpdateKind) => kind === "estimate" || kind === "delay";

export type AlbumUpdate = {
  id: string;
  kind: AlbumUpdateKind;
  text: string;
  /** ISO date (YYYY-MM-DD) for estimates. */
  estimateDate: string | null;
  createdAt: string | null;
};

export function parseAlbumUpdateKind(value: unknown): AlbumUpdateKind | null {
  return ALBUM_UPDATE_KINDS.includes(value as AlbumUpdateKind) ? (value as AlbumUpdateKind) : null;
}

export function parseSubscribeChannels(value: unknown): SubscribeChannel[] {
  if (!Array.isArray(value)) return [];
  return SUBSCRIBE_CHANNELS.filter((channel) => value.includes(channel));
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseEstimateDate(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : value;
}

export function formatEstimateDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
}

/** Every message to subscribers says up front that it is automatic. */
export const AUTOMATED_MESSAGE_LABEL = "🤖 Acest mesaj este automat și a fost trimis de sistemul ancavisuals.ro — fotograful de la evenimentul tău.";
export const CONTACT_PHONE_DISPLAY = "0745 469 907";

/** Text used for SMS / WhatsApp: automatic-message label, the update, the album link. */
export function albumUpdateMessage(update: Pick<AlbumUpdate, "kind" | "text" | "estimateDate">, albumUrl: string): string {
  const meta = ALBUM_UPDATE_META[update.kind];
  const date = update.estimateDate ? ` (${formatEstimateDate(update.estimateDate)})` : "";
  return `${AUTOMATED_MESSAGE_LABEL}\n\n${meta.emoji} ${meta.label}${date}: ${update.text.trim()}\n\nAlbumul: ${albumUrl}`;
}
