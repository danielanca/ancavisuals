import { sendEmail } from "./mailer";
import { logEmail } from "../services/emailLog.service";

// The single path for every email the app means to send:
//   sendViaFunnel()  → mailer → emailLog "sent" | "failed" (error)
//   blockEmail()     → emailLog "skipped" + severity, never silent.
// A gate (bot / cooldown / country / settings…) must call blockEmail instead of
// returning early — that silent early return is what hid four months of lost
// configurator leads (2026-05-31 → 2026-10-02).

export type EmailKind =
  | "lead"          // a person left contact details — must always reach the inbox
  | "contact"       // high-intent click: WhatsApp / phone / „Contactează-ne”
  | "notification"; // FYI: offer viewed, visitor activity

export type BlockCode =
  | "bot"
  | "country"
  | "settings"
  | "duplicate"     // same session/IP already notified a moment ago
  | "admin"         // the owner's own browser
  | "local-ip";     // localhost / dev

export interface FunnelEmail {
  kind: EmailKind;
  to: string;
  subject: string;
  html?: string;
  /** Where it came from, e.g. "lead", "live:whatsapp_clicked", "offer-view". */
  source: string;
  leadId?: string;
}

// The owner's own traffic and de-duplication are expected; everything else that
// stops a lead or a contact click is an error to look at.
const OWNER_OR_DUPLICATE = new Set<BlockCode>(["admin", "local-ip", "duplicate"]);

export function blockSeverity(kind: EmailKind, code: BlockCode): "error" | "info" {
  if (kind === "notification") return "info";
  return OWNER_OR_DUPLICATE.has(code) ? "info" : "error";
}

export async function blockEmail(email: FunnelEmail, code: BlockCode, detail = ""): Promise<void> {
  const severity = blockSeverity(email.kind, code);
  const reason = detail ? `${code}: ${detail}` : code;
  await logEmail({
    to: email.to,
    subject: email.subject,
    html: email.html ?? "",
    status: "skipped",
    severity,
    reason,
    source: email.source,
    ...(email.leadId ? { leadId: email.leadId } : {}),
  });
  // In production console.error is captured into `serverErrors` (/admin/errors).
  if (severity === "error") console.error(`[email-funnel] BLOCAT (${reason}) — ${email.kind} · ${email.source} · ${email.subject}`);
}

export async function sendViaFunnel(email: FunnelEmail): Promise<void> {
  await sendEmail({
    to: email.to,
    subject: email.subject,
    html: email.html ?? "",
    source: email.source,
    ...(email.leadId ? { leadId: email.leadId } : {}),
  });
}
