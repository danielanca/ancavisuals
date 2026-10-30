import { sendEmail } from "../mailer";
import { adminUser } from "../../constants/credentials";
import { APP_BASE_URL } from "../../constants/domain";
import { brandEmail, emailButton, emailStrong } from "./emailBrand";

const paragraph = (text: string) => `<p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${text}</p>`;

interface ProposalSubmittedOptions {
  proposerEmail: string;
  photoCount: number;
}

export function inspirationProposalSubmittedEmail({ proposerEmail, photoCount }: ProposalSubmittedOptions): { subject: string; html: string } {
  return {
    subject: `[Inspirație] ${photoCount} ${photoCount === 1 ? "poză propusă" : "poze propuse"} de ${proposerEmail}`,
    html: brandEmail(`
      ${paragraph(`${emailStrong(proposerEmail)} a propus ${emailStrong(`${photoCount} ${photoCount === 1 ? "poză" : "poze"}`)} pentru galeria de inspirație.`)}
      ${emailButton(`${APP_BASE_URL}/admin/inspiration`, "Revizuiește propunerile")}
    `),
  };
}

export async function sendInspirationProposalSubmittedEmail(options: ProposalSubmittedOptions): Promise<void> {
  await sendEmail({ to: adminUser.email, ...inspirationProposalSubmittedEmail(options) });
}

interface ProposalReviewOptions {
  to: string;
  action: "approve" | "reject";
  photoUrl: string;
  rejectionReason: string;
}

const photo = (photoUrl: string, alt: string) => `
  <div style="text-align: center; margin: 24px 0;">
    <img src="${photoUrl}" alt="${alt}" style="max-width: 100%; max-height: 300px; border: 1px solid #111;" />
  </div>`;

export function inspirationProposalReviewEmail({ action, photoUrl, rejectionReason }: Omit<ProposalReviewOptions, "to">): { subject: string; html: string } {
  if (action === "approve") {
    return {
      subject: "[Inspirație] Poza ta a fost acceptată! ✓",
      html: brandEmail(`
        ${paragraph(`Felicitări! Poza ta propusă a fost ${emailStrong("acceptată")} și a fost adăugată în galeria de inspirație.`)}
        ${photo(photoUrl, "Poza acceptată")}
      `),
    };
  }
  const reason = rejectionReason.trim() ? rejectionReason : "Poza nu corespunde stilului galeriei de inspirație.";
  return {
    subject: "[Inspirație] Poza ta nu a fost acceptată",
    html: brandEmail(`
      ${paragraph("Din păcate, poza ta propusă nu a fost acceptată în galeria de inspirație.")}
      ${photo(photoUrl, "Poza respinsă")}
      <p style="color: #111; font-size: 13px; line-height: 1.6; margin: 0 0 16px; padding: 12px 16px; border-left: 2px solid #111; background: #f5f5f5;">
        <strong>Motiv:</strong> ${reason}
      </p>
      <p style="color: #555; font-size: 13px; margin: 0;">Poți propune alte poze oricând din secțiunea „Propune Poze”.</p>
    `),
  };
}

export async function sendInspirationProposalReviewEmail({ to, ...options }: ProposalReviewOptions): Promise<void> {
  await sendEmail({ to, ...inspirationProposalReviewEmail(options) });
}
