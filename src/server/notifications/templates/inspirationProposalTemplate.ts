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

interface ProposalSubmittedOptions {
  proposerEmail: string;
  photoCount: number;
}

export async function sendInspirationProposalSubmittedEmail(options: ProposalSubmittedOptions): Promise<void> {
  const { proposerEmail, photoCount } = options;
  const reviewLink = "https://ancavisuals.ro/admin/inspiration";

  await sendEmail({
    to: adminUser.email,
    subject: `[Inspirație] ${photoCount} ${photoCount === 1 ? "poză propusă" : "poze propuse"} de ${proposerEmail}`,
    html: `
      ${brandHeader}
      <p style="color: #333; margin-bottom: 12px;">
        <strong>${proposerEmail}</strong> a propus
        <strong>${photoCount} ${photoCount === 1 ? "poză" : "poze"}</strong> pentru galeria de inspirație.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${reviewLink}"
           style="display: inline-block; padding: 14px 32px; background: #c9a96e; color: #fff; text-decoration: none; border-radius: 4px; font-size: 15px; letter-spacing: 1px;">
          Revizuiește propunerile
        </a>
      </div>
      ${brandFooter}
    `,
  });
}

interface ProposalReviewOptions {
  to: string;
  action: "approve" | "reject";
  photoUrl: string;
  rejectionReason: string;
}

export async function sendInspirationProposalReviewEmail(options: ProposalReviewOptions): Promise<void> {
  const { to, action, photoUrl, rejectionReason } = options;

  if (action === "approve") {
    await sendEmail({
      to,
      subject: "[Inspirație] Poza ta a fost acceptată! ✓",
      html: `
        ${brandHeader}
        <p style="color: #333; margin-bottom: 16px;">
          Felicitări! Poza ta propusă a fost <strong style="color: #16a34a;">acceptată</strong> și a fost adăugată în galeria de inspirație.
        </p>
        <div style="text-align: center; margin: 20px 0;">
          <img src="${photoUrl}" alt="Poza acceptată" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 2px solid #16a34a;" />
        </div>
        ${brandFooter}
      `,
    });
  } else {
    const reason = rejectionReason.trim()
      ? rejectionReason
      : "Poza nu corespunde stilului galeriei de inspirație.";

    await sendEmail({
      to,
      subject: "[Inspirație] Poza ta nu a fost acceptată",
      html: `
        ${brandHeader}
        <p style="color: #333; margin-bottom: 16px;">
          Din păcate, poza ta propusă nu a fost acceptată în galeria de inspirație.
        </p>
        <div style="text-align: center; margin: 20px 0;">
          <img src="${photoUrl}" alt="Poza respinsă" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 2px solid #dc2626;" />
        </div>
        <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px;">
          <p style="color: #991b1b; font-size: 13px; margin: 0;">
            <strong>Motiv:</strong> ${reason}
          </p>
        </div>
        <p style="color: #555; font-size: 13px;">Poți propune alte poze oricând din secțiunea "Propune Poze".</p>
        ${brandFooter}
      `,
    });
  }
}
