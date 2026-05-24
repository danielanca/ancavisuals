import { APP_BASE_URL } from "../../constants/domain";

type CollaboratorInviteEmailOptions = {
  recipientName: string;
  albumSlug: string;
  albumUrl: string;
  inviteInstagram: boolean;
  inviteModeration: boolean;
  senderName: string;
  passwordSetupUrl?: string | null;
  isReminder?: boolean;
};

function buildPurposeText(inviteInstagram: boolean, inviteModeration: boolean): string {
  if (inviteInstagram && inviteModeration) {
    return "să alegi imaginile potrivite pentru Instagram și Media Assets, iar dacă observi cadre care nu ar trebui să rămână în album, să le marchezi pentru verificare";
  }
  if (inviteInstagram) {
    return "să alegi imaginile potrivite pentru Instagram și Media Assets";
  }
  return "să marchezi cadrele care consideri că nu ar trebui să rămână în album";
}

export function buildCollaboratorInviteSubject(options: CollaboratorInviteEmailOptions): string {
  if (options.isReminder) {
    return `Reminder: revizuirea albumului ${options.albumSlug}`;
  }
  return `Invitație pentru revizuirea selecției foto`;
}

export function buildCollaboratorInviteHtml(options: CollaboratorInviteEmailOptions): string {
  const albumLink = `${APP_BASE_URL}${options.albumUrl}`;
  const greeting = options.recipientName ? `Bună, ${options.recipientName}` : "Bună";
  const intro = options.isReminder
    ? `${options.senderName} îți reamintește invitația de a revizui selecția foto a acestui album.`
    : `${options.senderName} te invită să revizuiești selecția foto a acestui album.`;

  const helperText = buildPurposeText(options.inviteInstagram, options.inviteModeration);

  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:36px 22px;background:#ffffff;color:#232323;">
      <div style="text-align:center;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9a7d52;">Anca Visuals</p>
        <h1 style="margin:0;font-size:24px;font-weight:500;color:#2b2117;">Revizuire selecție foto</h1>
      </div>

      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">${greeting},</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">${intro}</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
        Te rugăm ${helperText}.
      </p>

      <div style="margin:28px 0;text-align:center;">
        <a href="${albumLink}" style="display:inline-block;padding:14px 26px;background:#c9a96e;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:700;letter-spacing:0.04em;">
          Deschide albumul
        </a>
      </div>

      ${options.passwordSetupUrl ? `
        <p style="margin:0 0 12px;font-size:13px;line-height:1.7;color:#6b5a49;">
          Dacă ai nevoie să îți setezi sau resetezi parola, poți folosi acest link:
        </p>
        <p style="margin:0 0 20px;font-size:13px;line-height:1.7;">
          <a href="${options.passwordSetupUrl}" style="color:#9a7d52;">Setează parola</a>
        </p>
      ` : ""}

      <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#54463a;">
        Contribuția ta ne ajută să păstrăm o selecție atent aleasă, potrivită atât pentru livrarea finală, cât și pentru utilizarea în materialele de prezentare.
      </p>

      <p style="margin:24px 0 0;font-size:14px;line-height:1.7;">
        Mulțumim,<br />
        ${options.senderName}<br />
        <span style="color:#8a8a8a;">Anca Visuals</span>
      </p>
    </div>
  `;
}

