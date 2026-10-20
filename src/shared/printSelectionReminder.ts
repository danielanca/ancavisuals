/*
 * Purpose: admin reminder "alege pozele pentru album" sent from /media/:slug to the event's
 * client(s) by email + SMS (SMSAPI), with WhatsApp returned as wa.me links to send by hand.
 */
import { AUTOMATED_MESSAGE_LABEL } from "./albumUpdates";

export const PRINT_REMINDER_COOLDOWN_MS = 12 * 60 * 60 * 1000;
export const PRINT_SELECTION_TARGET = 100;

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

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? "";

export function printReminderMessage(clientName: string, selectedCount: number, selectUrl: string): string {
  const hello = firstName(clientName) ? `Bună, ${firstName(clientName)}!` : "Bună!";
  const progress = selectedCount > 0
    ? `Ai ales până acum ${selectedCount} din ${PRINT_SELECTION_TARGET} de poze pentru albumul tipărit.`
    : `Nu ai ales încă pozele pentru albumul tipărit (până la ${PRINT_SELECTION_TARGET}).`;
  return `${AUTOMATED_MESSAGE_LABEL}\n\n${hello} ${progress} Ca să putem începe albumul, alege-le aici: ${selectUrl}`;
}

export function whatsappReminderUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
