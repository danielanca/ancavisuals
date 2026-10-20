/*
 * Purpose: admin reminder "alege pozele pentru album" sent from /media/:slug to the event's
 * client(s) by email + SMS (SMSAPI), with WhatsApp returned as wa.me links to send by hand.
 */
import { AUTOMATED_MESSAGE_LABEL, messageGreeting } from "./albumUpdates";

export const PRINT_REMINDER_COOLDOWN_MS = 12 * 60 * 60 * 1000;
/** "Trimite din nou oricum" skips the 12 h pause, but never twice within a minute (double click). */
export const PRINT_REMINDER_FORCE_GAP_MS = 60 * 1000;
export const PRINT_SELECTION_TARGET = 100;

/** All the album photos are picked: a reminder would only annoy the client. */
export const isPrintSelectionComplete = (selectedCount: number) => selectedCount >= PRINT_SELECTION_TARGET;

export type PrintReminderRecipient = { name: string; email: string | null; phone: string | null };

export type PrintReminderStatus = {
  selectedCount: number;
  recipients: PrintReminderRecipient[];
  lastSentAt: number | null;
  nextAllowedAt: number | null;
};

export type PrintReminderResult = {
  emailed: number;
  smsSent: number;
  smsFailed: number;
  smsSkipped: boolean;
  whatsapp: { name: string; url: string }[];
  lastSentAt: number;
  nextAllowedAt: number;
};

export function printReminderMessage(slug: string, selectedCount: number, selectUrl: string): string {
  const progress = selectedCount > 0
    ? `Ați ales până acum ${selectedCount} din ${PRINT_SELECTION_TARGET} de poze pentru albumul tipărit.`
    : `Nu ați ales încă pozele pentru albumul tipărit (până la ${PRINT_SELECTION_TARGET}).`;
  return `${messageGreeting(slug)}\n\n${progress} Ca să putem începe albumul, le puteți alege aici: ${selectUrl}\n\n${AUTOMATED_MESSAGE_LABEL}`;
}

export function whatsappReminderUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
