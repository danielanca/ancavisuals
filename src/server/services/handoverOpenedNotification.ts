/*
 * Purpose: tells the owner when a client opens the Proces Verbal from the link we texted them
 * (`/proces-verbal/<token>?s=sms`). Once per PV and day: Activitate + an email (asked for by the owner).
 */
import { createActivityOnce } from "./activity.service";
import { sendEmail } from "../notifications/mailer";
import { adminUser } from "../constants/credentials";
import { APP_BASE_URL } from "../constants/domain";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function openedEmail(args: { eventLabel: string; status: string; geoLabel: string }): string {
  const at = new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 0;color:#666;width:120px;">${label}</td><td style="color:#111;font-weight:600;">${escapeHtml(value)}</td></tr>`;
  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="color:#111;margin:0 0 16px;">Clientul a deschis procesul verbal din SMS</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${row("Eveniment", args.eventLabel)}${row("Stare PV", args.status)}${row("Când", at)}${row("Locație", args.geoLabel)}
    </table>
    <p style="margin:20px 0 0;color:#666;font-size:13px;">Primești un singur email pe zi pentru fiecare proces verbal.</p>
    <p style="margin:16px 0 0;"><a href="${APP_BASE_URL}/admin/handover" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;">Vezi procesele verbale</a></p>
  </div>`;
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
