import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import { canRetryEmail, describeEmailError, recordEmailDelivery, raiseEmailAlert, emailErrorDiagnostic } from "../services/emailDelivery.service";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { emailAuth } from "../constants/credentials";

// Paid Zoho Workplace/Mail plans serve SMTP from smtppro.zoho.eu (not
// smtp.zoho.eu, which is what the free plan's docs point to) — see the
// account's Settings → Mail Accounts → SMTP server configuration.
const productionTransport = nodemailer.createTransport({
  host: "smtppro.zoho.eu",
  port: 465,
  secure: true,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  auth: { user: emailAuth.email, pass: emailAuth.password },
} as SMTPTransport.Options);

const testHost = process.env.SMTP_TEST_HOST;
const testPort = process.env.SMTP_TEST_PORT ? Number(process.env.SMTP_TEST_PORT) : 587;
const testUser = process.env.SMTP_TEST_USER;
const testPass = process.env.SMTP_TEST_PASS;

const testTransport = testHost
  ? nodemailer.createTransport({
      host: testHost,
      port: testPort,
      secure: testPort === 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: { user: testUser, pass: testPass },
    } as SMTPTransport.Options)
  : null;

let testEmailMode = false;

export function setTestEmailMode(enabled: boolean): void {
  testEmailMode = enabled;
}

export function getTestEmailMode(): boolean {
  return testEmailMode;
}

export function isTestTransportAvailable(): boolean {
  return testTransport !== null;
}

export async function verifyEmailTransport(): Promise<void> {
  const transport = testEmailMode && testTransport ? testTransport : productionTransport;
  try { await transport.verify(); }
  catch (error) {
    await raiseEmailAlert({ id: randomUUID(), error: describeEmailError(error), diagnostic: emailErrorDiagnostic(error), subject: "Verificare SMTP", to: "" });
    throw error;
  }
}


interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

const CONTACT_EMAIL = "info@ancavisuals.ro";
const CONTACT_WHATSAPP_URL = "https://wa.me/40745469907";

const CONTACT_FOOTER = `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;font-family:sans-serif;font-size:13px;color:#666;">
    Ne puteți contacta prin email la <a href="mailto:${CONTACT_EMAIL}" style="color:#666;">${CONTACT_EMAIL}</a>
    sau prin <a href="${CONTACT_WHATSAPP_URL}" style="color:#666;">WhatsApp</a>.
  </div>
`;

function wrapHtml(html: string): string {
  // Already a full document (e.g. a pre-built report) — leave it as-is,
  // rather than injecting the footer into markup we don't control.
  if (html.trimStart().startsWith("<!DOCTYPE")) return html;
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="UTF-8"></head><body>${html}${CONTACT_FOOTER}</body></html>`;
}

// Display name shown in the recipient's inbox — without it, mail clients
// fall back to the local part of the address ("info") as the sender name.
const SENDER_DISPLAY_NAME = "AncaVisuals";

export async function sendEmail({ to, subject, html, from }: SendEmailOptions): Promise<void> {
  const activeTransport = testEmailMode && testTransport ? testTransport : productionTransport;
  const activeAddress = testEmailMode && testUser ? testUser : emailAuth.email;
  const activeFrom = from ?? `"${SENDER_DISPLAY_NAME}" <${activeAddress}>`;
  const id = randomUUID();
  await recordEmailDelivery(id, { to, subject, status: "pending", attempts: 0,
    transport: testEmailMode && testTransport ? "test" : "production", createdAt: new Date().toISOString() });
  for (let attempt = 1; attempt <= 3; attempt++) {
    await recordEmailDelivery(id, { attempts: attempt });
    let info: SMTPTransport.SentMessageInfo;
    try {
      info = await activeTransport.sendMail({ from: activeFrom, to, subject, html: wrapHtml(html) });
    } catch (error) {
      await raiseEmailAlert({ id: randomUUID(), error: describeEmailError(error), diagnostic: emailErrorDiagnostic(error), subject, to });
      if (canRetryEmail(error) && attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }
      const e = error as { responseCode?: number; code?: string };
      await recordEmailDelivery(id, { status: e.responseCode || e.code === "EAUTH" ? "failed" : "unknown",
        error: describeEmailError(error) });
      throw error;
    }
    // Partial acceptance must not be retried: accepted recipients would get duplicates.
    const accepted = Array.isArray(info.accepted) && info.accepted.length > 0;
    const rejected = Array.isArray(info.rejected) && info.rejected.length > 0;
    if (!accepted || rejected) {
      await raiseEmailAlert({ id: randomUUID(), error: "Unul sau mai mulți destinatari nu au fost acceptați de SMTP.", subject, to });
      await recordEmailDelivery(id, { status: accepted ? "unknown" : "failed",
        error: accepted ? "Doar o parte dintre destinatari a fost acceptată. Nu s-a reîncercat automat." : "Niciun destinatar nu a fost acceptat de SMTP." });
      throw new Error("SMTP recipient acceptance incomplete");
    }
    await recordEmailDelivery(id, { status: "accepted", messageId: String(info.messageId ?? ""), error: null });
    return;
  }
}

// Legacy templates use the same tracked delivery path.
export const mailer = { sendMail: (options: SendEmailOptions) => sendEmail(options) };
