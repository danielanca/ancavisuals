/*
 * Purpose: tells the owner when a client opens the Proces Verbal from the link we texted them
 * (`/proces-verbal/<token>?s=sms`). Once per PV and day: Activitate + an email (asked for by the owner).
 */
import { adminEmail } from "../notifications/templates/emailBrand";
import { createActivityOnce } from "./activity.service";
import { sendEmail } from "../notifications/mailer";
import { adminUser } from "../constants/credentials";
import { APP_BASE_URL } from "../constants/domain";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function openedEmail(args: { eventLabel: string; status: string; geoLabel: string }): string {
  const at = new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  return adminEmail({
    eyebrow: "Proces-verbal",
    title: "Clientul a deschis procesul-verbal din SMS",
    rows: [["Eveniment", escapeHtml(args.eventLabel)], ["Stare PV", escapeHtml(args.status)], ["Când", at], ["Locație", escapeHtml(args.geoLabel)]],
    note: "Primești un singur email pe zi pentru fiecare proces-verbal.",
    button: { href: `${APP_BASE_URL}/admin/handover`, label: "Vezi procesele-verbale" },
  });
}

export async function notifyHandoverOpenedFromSms(args: {
  handoverId: string;
  eventType: string;
  eventDate: string;
  status: string;
  geoLabel: string;
}): Promise<void> {
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
  const eventLabel = `${args.eventType} · ${args.eventDate}`;
  const status = args.status === "signed" ? "deja semnat" : "nesemnat încă";
  const { created } = await createActivityOnce(`handover-open:${args.handoverId}:sms:${day}`, {
    type: "handover_opened",
    title: "📄 Proces verbal deschis din SMS",
    description: `${eventLabel} · ${status} · ${args.geoLabel}`,
    metadata: { handoverId: args.handoverId, channel: "sms", route: "/admin/handover" },
    emailSent: true,
  });
  if (!created) return;
  await sendEmail({
    to: adminUser.email,
    source: "handover-opened-sms",
    subject: `📄 Clientul a deschis procesul verbal din SMS — ${eventLabel}`,
    html: openedEmail({ eventLabel, status, geoLabel: args.geoLabel }),
  });
}
