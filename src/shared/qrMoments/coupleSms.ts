/*
 * Purpose: the SMS the owner sends the couple from /admin/qr-moments — "invitații v-au lăsat
 * 12 poze și 2 urări în QR Code Moments" + the gallery link. The phone comes from the event
 * linked to the QR Moments (adminEvents.client.phone). The owner is reminded to send it in the
 * upload notification email; nothing is sent to the couple without the owner pressing the button.
 */
import { AUTOMATED_MESSAGE_LABEL, messageGreeting } from "../albumUpdates";

export type QrUploadCounts = { photo: number; video: number; audio: number; text: number };

export type CoupleSmsRecipient = { name: string; phone: string };

export type CoupleSmsStatus = {
  recipients: CoupleSmsRecipient[];
  lastSentAt: number | null;
  /** Materials uploaded since the last SMS (all of them when none was sent yet). */
  newCounts: QrUploadCounts;
  message: string;
  smsConfigured: boolean;
};

export type CoupleSmsResult = {
  smsSent: number;
  smsFailed: number;
  smsSkipped: boolean;
  /** sms: links, to send from the owner's phone when SMSAPI is not set up or failed. */
  manual: { name: string; url: string }[];
  lastSentAt: number;
};

/** Double click guard only: the owner decides when to write to the couple again. */
export const COUPLE_SMS_GAP_MS = 60 * 1000;

export const emptyQrUploadCounts = (): QrUploadCounts => ({ photo: 0, video: 0, audio: 0, text: 0 });

export const totalQrUploads = (counts: QrUploadCounts) => counts.photo + counts.video + counts.audio + counts.text;

const plural = (count: number, one: string, many: string) => (count === 1 ? `o ${one}` : `${count} ${many}`);

/** "12 poze, un videoclip și 2 urări". */
export function describeQrUploads(counts: QrUploadCounts): string {
  const parts = [
    counts.photo ? plural(counts.photo, "poză", "poze") : "",
    counts.video ? (counts.video === 1 ? "un videoclip" : `${counts.video} videoclipuri`) : "",
    counts.audio ? (counts.audio === 1 ? "un mesaj vocal" : `${counts.audio} mesaje vocale`) : "",
    counts.text ? plural(counts.text, "urare scrisă", "urări scrise") : "",
  ].filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "câteva amintiri";
  return `${parts.slice(0, -1).join(", ")} și ${parts[parts.length - 1]}`;
}

export function coupleSmsMessage(eventSlug: string, counts: QrUploadCounts, galleryUrl: string): string {
  return `${messageGreeting(eventSlug)}\n\nInvitații v-au lăsat ${describeQrUploads(counts)} în QR Code Moments. Le puteți vedea aici: ${galleryUrl}\n\n${AUTOMATED_MESSAGE_LABEL}`;
}

export const smsLink = (phone: string, message: string) => `sms:${phone}?&body=${encodeURIComponent(message)}`;
