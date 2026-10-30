import { sendEmail } from "../mailer";
import { adminUser } from "../../constants/credentials";
import { APP_BASE_URL } from "../../constants/domain";
import { brandEmail, emailButton, emailStrong } from "./emailBrand";

interface ModerationSubmittedOptions {
  moderatorEmail: string;
  albumSlug: string;
  photoCount: number;
  note: string;
}

export function moderationSubmittedEmail({ moderatorEmail, albumSlug, photoCount, note }: ModerationSubmittedOptions): { subject: string; html: string } {
  return {
    subject: `[Moderare] ${photoCount} poze propuse spre ștergere — album "${albumSlug}"`,
    html: brandEmail(`
      <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
        Moderatorul ${emailStrong(moderatorEmail)} a propus ștergerea a
        ${emailStrong(`${photoCount} poze`)} din albumul ${emailStrong(albumSlug)}.
      </p>
      ${note ? `<p style="color: #333; font-size: 14px; line-height: 1.6; margin: 0 0 16px; padding: 12px 16px; border-left: 2px solid #111; background: #f5f5f5;">${note}</p>` : ""}
      ${emailButton(`${APP_BASE_URL}/admin/moderare`, "Deschide moderarea")}
    `),
  };
}

export async function sendModerationSubmittedEmail(options: ModerationSubmittedOptions): Promise<void> {
  await sendEmail({ to: adminUser.email, ...moderationSubmittedEmail(options) });
}

interface ModerationResultOptions {
  to: string;
  albumSlug: string;
  deletedPhotos: string[];
  keptPhotos: string[];
}

const photoList = (filenames: string[], color: string) =>
  filenames.length > 0
    ? `<ul style="color: ${color}; font-size: 13px; line-height: 1.6;">${filenames.map((filename) => `<li>${filename}</li>`).join("")}</ul>`
    : `<p style="color: #888; font-size: 13px;">—</p>`;

const label = (text: string, margin: string) =>
  `<p style="color: #111; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin: ${margin};">${text}</p>`;

export function moderationResultEmail({ albumSlug, deletedPhotos, keptPhotos }: Omit<ModerationResultOptions, "to">): { subject: string; html: string } {
  return {
    subject: `[Moderare] Decizie album "${albumSlug}" — ${deletedPhotos.length} poze șterse`,
    html: brandEmail(`
      <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Propunerea ta de moderare pentru albumul ${emailStrong(albumSlug)} a fost procesată.
      </p>
      ${label(`Poze șterse definitiv (${deletedPhotos.length})`, "0 0 6px")}
      ${photoList(deletedPhotos, "#111")}
      ${label(`Poze păstrate (${keptPhotos.length})`, "24px 0 6px")}
      ${photoList(keptPhotos, "#555")}
    `),
  };
}

export async function sendModerationResultEmail({ to, ...options }: ModerationResultOptions): Promise<void> {
  await sendEmail({ to, ...moderationResultEmail(options) });
}
