import { sendEmail } from "../mailer";
import { adminUser } from "../../constants/credentials";

const brandHeader = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #fff;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: #c9a96e; font-weight: 300; letter-spacing: 3px; font-size: 20px; margin: 0;">ANCA VISUALS</h2>
      <p style="color: #999; font-size: 11px; letter-spacing: 1px; margin: 4px 0 0; text-transform: uppercase;">Fotografie &amp; Videografie</p>
    </div>
    <hr style="border: none; border-top: 1px solid #c9a96e; margin: 0 0 28px;" />
`;

const brandFooter = `
    <p style="color: #aaa; font-size: 11px; text-align: center; margin-top: 32px;">Anca Visuals · ancavisuals.ro</p>
  </div>
`;

interface ModerationSubmittedOptions {
  moderatorEmail: string;
  albumSlug: string;
  photoCount: number;
  note: string;
}

export async function sendModerationSubmittedEmail(options: ModerationSubmittedOptions): Promise<void> {
  const { moderatorEmail, albumSlug, photoCount, note } = options;
  const reviewLink = "https://ancavisuals.ro/admin/moderare";

  await sendEmail({
    to: adminUser.email,
    subject: `[Moderare] ${photoCount} poze propuse spre ștergere — album "${albumSlug}"`,
    html: `
      ${brandHeader}
      <p style="color: #333; margin-bottom: 12px;">
        Moderatorul <strong>${moderatorEmail}</strong> a propus ștergerea a
        <strong>${photoCount} poze</strong> din albumul <strong>${albumSlug}</strong>.
      </p>
      ${note ? `<p style="color: #555; margin-bottom: 12px; font-style: italic;">"${note}"</p>` : ""}
      <div style="text-align: center; margin: 28px 0;">
        <a href="${reviewLink}"
           style="display: inline-block; padding: 14px 32px; background: #c9a96e; color: #fff; text-decoration: none; border-radius: 4px; font-size: 15px; letter-spacing: 1px;">
          Deschide moderarea
        </a>
      </div>
      ${brandFooter}
    `,
  });
}

interface ModerationResultOptions {
  to: string;
  albumSlug: string;
  deletedPhotos: string[];
  keptPhotos: string[];
}

export async function sendModerationResultEmail(options: ModerationResultOptions): Promise<void> {
  const { to, albumSlug, deletedPhotos, keptPhotos } = options;

  const deletedList =
    deletedPhotos.length > 0
      ? `<ul style="color: #c0392b; font-size: 13px;">${deletedPhotos.map((filename) => `<li>${filename}</li>`).join("")}</ul>`
      : `<p style="color: #888; font-size: 13px;">—</p>`;

  const keptList =
    keptPhotos.length > 0
      ? `<ul style="color: #555; font-size: 13px;">${keptPhotos.map((filename) => `<li>${filename}</li>`).join("")}</ul>`
      : `<p style="color: #888; font-size: 13px;">—</p>`;

  await sendEmail({
    to,
    subject: `[Moderare] Decizie album "${albumSlug}" — ${deletedPhotos.length} poze șterse`,
    html: `
      ${brandHeader}
      <p style="color: #333; margin-bottom: 16px;">
        Propunerea ta de moderare pentru albumul <strong>${albumSlug}</strong> a fost procesată.
      </p>
      <p style="color: #333; font-weight: bold; margin-bottom: 6px;">Poze șterse definitiv (${deletedPhotos.length}):</p>
      ${deletedList}
      <p style="color: #333; font-weight: bold; margin-top: 16px; margin-bottom: 6px;">Poze păstrate (${keptPhotos.length}):</p>
      ${keptList}
      ${brandFooter}
    `,
  });
}
