import { mailer } from "../mailer";
import { adminUser, emailAuth } from "../../constants/credentials";

const EMAIL_HEADER = `
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="color: #c9a96e; font-weight: 300; letter-spacing: 3px; font-size: 20px; margin: 0;">ANCA VISUALS</h2>
    <p style="color: #999; font-size: 11px; letter-spacing: 1px; margin: 4px 0 0; text-transform: uppercase;">Fotografie & Videografie</p>
  </div>
  <hr style="border: none; border-top: 1px solid #c9a96e; margin: 0 0 28px;" />`;

const EMAIL_FOOTER = `
  <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px;" />
  <p style="color: #bbb; font-size: 10px; text-align: center; margin: 0;">
    Anca Visuals &nbsp;•&nbsp; ancadaniel1994@gmail.com
  </p>`;

function emailWrap(body: string): string {
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #fff;">${EMAIL_HEADER}${body}${EMAIL_FOOTER}</div>`;
}

function formatRoDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
}

interface HandoverLinkEmailOptions {
  to: string;
  token: string;
  eventType: string;
  eventDate: string;
  baseUrl: string;
}

export async function sendHandoverLinkEmail(options: HandoverLinkEmailOptions): Promise<void> {
  const { to, token, eventType, eventDate, baseUrl } = options;
  const link = `${baseUrl}/proces-verbal/${token}`;
  const formattedDate = formatRoDate(eventDate);

  const clientHtml = emailWrap(`
    <p style="color: #333; margin-bottom: 12px;">Bună ziua,</p>
    <p style="color: #333; margin-bottom: 12px;">
      Materialele foto/video pentru evenimentul <strong>${eventType}</strong> din data de
      <strong>${formattedDate}</strong> sunt gata! Vă rugăm să confirmați primirea link-ului digital
      semnând Procesul Verbal de predare-primire.
    </p>
    <p style="color: #555; margin-bottom: 28px;">
      Accesați link-ul de mai jos, citiți documentul și semnați electronic.
    </p>
    <div style="text-align: center; margin-bottom: 28px;">
      <a href="${link}" style="display:inline-block;background-color:#c9a96e;color:#fff;padding:14px 36px;text-decoration:none;border-radius:4px;font-size:15px;font-weight:600;letter-spacing:1px;">Semnează Procesul Verbal</a>
    </div>
    <p style="color: #aaa; font-size: 11px; text-align: center;">
      Sau accesați direct:<br/>
      <a href="${link}" style="color: #c9a96e; word-break: break-all;">${link}</a>
    </p>
  `);

  await mailer.sendMail({
    from: emailAuth.email,
    to,
    subject: `Proces Verbal predare materiale — ${eventType} ${formattedDate}`,
    html: clientHtml,
  });

  await mailer.sendMail({
    from: emailAuth.email,
    to: adminUser.email,
    subject: `[Copie] Link PV trimis — ${eventType} ${formattedDate} — ${to}`,
    html: clientHtml,
  });
}

interface SignedHandoverEmailOptions {
  to: string;
  eventType: string;
  eventDate: string;
  clientName: string;
  pdfUrl: string;
  hasPdf?: boolean;
}

export async function sendSignedHandoverEmail(options: SignedHandoverEmailOptions): Promise<void> {
  const { to, eventType, eventDate, clientName, pdfUrl, hasPdf = true } = options;
  const formattedDate = formatRoDate(eventDate);

  const buttonLabel = hasPdf ? "Descarcă Procesul Verbal PDF" : "Vezi Procesul Verbal Semnat";
  const bodyText = hasPdf
    ? "Puteți descărca procesul verbal semnat accesând butonul de mai jos. Link-ul este permanent și poate fi accesat oricând."
    : "Procesul verbal a fost semnat. PDF-ul se generează — îl puteți accesa în curând accesând link-ul de mai jos.";

  const html = emailWrap(`
    <p style="color: #333; margin-bottom: 12px;">
      Procesul verbal pentru evenimentul <strong>${eventType}</strong> din <strong>${formattedDate}</strong>
      a fost semnat cu succes de <strong>${clientName}</strong>.
    </p>
    <p style="color: #555; margin-bottom: 28px;">${bodyText}</p>
    <div style="text-align: center; margin-bottom: 28px;">
      <a href="${pdfUrl}" style="display:inline-block;background-color:#c9a96e;color:#fff;padding:14px 36px;text-decoration:none;border-radius:4px;font-size:15px;font-weight:600;letter-spacing:1px;">${buttonLabel}</a>
    </div>
  `);

  await mailer.sendMail({
    from: emailAuth.email,
    to,
    subject: `Proces Verbal semnat — ${eventType} ${formattedDate}`,
    html,
  });

  await mailer.sendMail({
    from: emailAuth.email,
    to: adminUser.email,
    subject: `[Admin] Proces Verbal semnat — ${eventType} ${formattedDate} — ${clientName}`,
    html,
  });
}

interface HandoverReminderEmailOptions {
  to: string;
  token: string;
  eventType: string;
  eventDate: string;
  baseUrl: string;
}

export async function sendHandoverReminderEmail(options: HandoverReminderEmailOptions): Promise<void> {
  const { to, token, eventType, eventDate, baseUrl } = options;
  const link = `${baseUrl}/proces-verbal/${token}`;
  const formattedDate = formatRoDate(eventDate);

  const html = emailWrap(`
    <p style="color: #333; margin-bottom: 12px;">Bună ziua,</p>
    <p style="color: #333; margin-bottom: 12px;">
      Vă trimitem un scurt reminder: procesul verbal de predare-primire materiale pentru evenimentul
      <strong>${eventType}</strong> din data de <strong>${formattedDate}</strong> nu a fost semnat încă.
    </p>
    <p style="color: #555; margin-bottom: 28px;">
      Vă rugăm să accesați link-ul de mai jos pentru a semna. Procesul durează doar câteva minute.
    </p>
    <div style="text-align: center; margin-bottom: 28px;">
      <a href="${link}" style="display:inline-block;background-color:#c9a96e;color:#fff;padding:14px 36px;text-decoration:none;border-radius:4px;font-size:15px;font-weight:600;letter-spacing:1px;">Semnează Procesul Verbal</a>
    </div>
    <p style="color: #aaa; font-size: 11px; text-align: center;">
      Sau accesați direct:<br/>
      <a href="${link}" style="color: #c9a96e; word-break: break-all;">${link}</a>
    </p>
  `);

  await mailer.sendMail({
    from: emailAuth.email,
    to,
    subject: `Reminder: Proces Verbal nesemnat — ${eventType} ${formattedDate}`,
    html,
  });

  await mailer.sendMail({
    from: emailAuth.email,
    to: adminUser.email,
    subject: `[Copie] Reminder PV trimis — ${eventType} ${formattedDate} — ${to}`,
    html,
  });
}
