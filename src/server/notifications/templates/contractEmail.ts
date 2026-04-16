import { mailer } from "../mailer";
import { adminUser, emailAuth } from "../../constants/credentials";

interface ContractLinkEmailOptions {
  to: string;
  token: string;
  eventType: string;
  eventDate: string;
  baseUrl: string;
}

export async function sendContractLinkEmail(options: ContractLinkEmailOptions): Promise<void> {
  const { to, token, eventType, eventDate, baseUrl } = options;
  const link = `${baseUrl}/contract/${token}`;
  const formattedDate = formatRoDate(eventDate);

  await mailer.sendMail({
    from: emailAuth.email,
    to,
    subject: `Contract servicii foto/video — ${eventType} ${formattedDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #fff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #c9a96e; font-weight: 300; letter-spacing: 3px; font-size: 20px; margin: 0;">ANCA VISUALS</h2>
          <p style="color: #999; font-size: 11px; letter-spacing: 1px; margin: 4px 0 0; text-transform: uppercase;">Fotografie & Videografie</p>
        </div>
        <hr style="border: none; border-top: 1px solid #c9a96e; margin: 0 0 28px;" />

        <p style="color: #333; margin-bottom: 12px;">Bună ziua,</p>
        <p style="color: #333; margin-bottom: 12px;">
          Contractul de prestări servicii foto/video pentru evenimentul
          <strong>${eventType}</strong> din data de <strong>${formattedDate}</strong>
          este gata pentru semnare.
        </p>
        <p style="color: #555; margin-bottom: 28px;">
          Vă rugăm să accesați link-ul de mai jos, să citiți cu atenție contractul,
          să completați datele personale și să semnați electronic.
        </p>

        <div style="text-align: center; margin-bottom: 28px;">
          <a href="${link}" style="
            display: inline-block;
            background-color: #c9a96e;
            color: #fff;
            padding: 14px 36px;
            text-decoration: none;
            border-radius: 4px;
            font-size: 15px;
            font-weight: 600;
            letter-spacing: 1px;
          ">Semnează Contractul</a>
        </div>

        <p style="color: #aaa; font-size: 11px; text-align: center;">
          Sau accesați direct:<br/>
          <a href="${link}" style="color: #c9a96e; word-break: break-all;">${link}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px;" />
        <p style="color: #bbb; font-size: 10px; text-align: center; margin: 0;">
          Anca Visuals &nbsp;•&nbsp; ancadaniel1994@gmail.com
        </p>
      </div>
    `,
  });
}

interface SignedContractEmailOptions {
  to: string;
  eventType: string;
  eventDate: string;
  clientName: string;
  pdfUrl: string;
}

export async function sendSignedContractEmail(options: SignedContractEmailOptions): Promise<void> {
  const { to, eventType, eventDate, clientName, pdfUrl } = options;
  const formattedDate = formatRoDate(eventDate);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #fff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #c9a96e; font-weight: 300; letter-spacing: 3px; font-size: 20px; margin: 0;">ANCA VISUALS</h2>
        <p style="color: #999; font-size: 11px; letter-spacing: 1px; margin: 4px 0 0; text-transform: uppercase;">Fotografie & Videografie</p>
      </div>
      <hr style="border: none; border-top: 1px solid #c9a96e; margin: 0 0 28px;" />

      <p style="color: #333; margin-bottom: 12px;">
        Contractul pentru evenimentul <strong>${eventType}</strong> din <strong>${formattedDate}</strong>
        a fost semnat cu succes de <strong>${clientName}</strong>.
      </p>
      <p style="color: #555; margin-bottom: 28px;">
        Puteți descărca contractul semnat accesând butonul de mai jos.
        Link-ul este permanent și poate fi accesat oricând.
      </p>

      <div style="text-align: center; margin-bottom: 28px;">
        <a href="${pdfUrl}" style="
          display: inline-block;
          background-color: #c9a96e;
          color: #fff;
          padding: 14px 36px;
          text-decoration: none;
          border-radius: 4px;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 1px;
        ">Descarcă Contractul PDF</a>
      </div>

      <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px;" />
      <p style="color: #bbb; font-size: 10px; text-align: center; margin: 0;">
        Anca Visuals &nbsp;•&nbsp; ancadaniel1994@gmail.com
      </p>
    </div>
  `;

  // Trimite la client
  await mailer.sendMail({
    from: emailAuth.email,
    to,
    subject: `Contract semnat — ${eventType} ${formattedDate}`,
    html,
  });

  // Trimite la admin
  await mailer.sendMail({
    from: emailAuth.email,
    to: adminUser.email,
    subject: `[Admin] Contract semnat — ${eventType} ${formattedDate} — ${clientName}`,
    html,
  });
}

interface DeletedContractEmailOptions {
  contract: Record<string, unknown>;
}

export async function sendContractDeletedEmail({ contract }: DeletedContractEmailOptions): Promise<void> {
  const eventType   = String(contract.eventType   ?? "—");
  const eventDate   = formatRoDate(String(contract.eventDate ?? ""));
  const clientEmail = String(contract.clientEmail ?? "—");
  const clientName  = String(contract.clientName  ?? "—");
  const priceTotal  = String(contract.priceTotal  ?? "—");
  const currency    = String(contract.currency    ?? "RON");
  const status      = String(contract.status      ?? "—");
  const contractId  = String(contract.id          ?? "—");
  const pdfUrl      = contract.pdfUrl ? String(contract.pdfUrl) : null;

  const rows = [
    ["ID contract", contractId],
    ["Tip eveniment", eventType],
    ["Data eveniment", eventDate],
    ["Status la ștergere", status],
    ["Email client", clientEmail],
    ["Nume client", clientName || "—"],
    ["Total contract", `${priceTotal} ${currency}`],
  ];

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding: 6px 12px; color: #888; font-size: 12px; white-space: nowrap;">${label}</td>
      <td style="padding: 6px 12px; color: #1a1a1a; font-size: 12px; font-weight: 600;">${value}</td>
    </tr>`).join("");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #fff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #c9a96e; font-weight: 300; letter-spacing: 3px; font-size: 20px; margin: 0;">ANCA VISUALS</h2>
        <p style="color: #999; font-size: 11px; letter-spacing: 1px; margin: 4px 0 0; text-transform: uppercase;">Fotografie & Videografie</p>
      </div>
      <hr style="border: none; border-top: 2px solid #ef4444; margin: 0 0 28px;" />

      <p style="color: #ef4444; font-weight: 700; font-size: 15px; margin-bottom: 6px;">⚠ Contract șters definitiv</p>
      <p style="color: #555; font-size: 13px; margin-bottom: 24px;">
        Acest email conține detaliile contractului șters, pentru arhivă personală.
        Dacă ștergerea a fost accidentală, contactează imediat furnizorul de hosting pentru recuperare din backup.
      </p>

      <table style="width: 100%; border-collapse: collapse; background: #fafafa; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
        <tbody>${tableRows}</tbody>
      </table>

      ${pdfUrl ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${pdfUrl}" style="
          display: inline-block; background: #c9a96e; color: #fff;
          padding: 12px 28px; text-decoration: none; border-radius: 4px;
          font-size: 13px; font-weight: 600; letter-spacing: 1px;
        ">Descarcă PDF-ul contractului</a>
        <p style="color: #aaa; font-size: 11px; margin-top: 8px;">
          Linkul poate expira. Salvează PDF-ul dacă ai nevoie de el.
        </p>
      </div>` : `
      <p style="color: #aaa; font-size: 12px; text-align: center;">
        PDF-ul nu era disponibil pentru acest contract.
      </p>`}

      <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px;" />
      <p style="color: #bbb; font-size: 10px; text-align: center; margin: 0;">
        Anca Visuals &nbsp;•&nbsp; ancadaniel1994@gmail.com
      </p>
    </div>
  `;

  await mailer.sendMail({
    from: emailAuth.email,
    to: adminUser.email,
    subject: `[Șters] Contract ${eventType} — ${eventDate} — ${clientEmail}`,
    html,
  });
}

function formatRoDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
}
