import { mailer } from "../mailer";
import { brandEmail, copyIcon, copyPageUrl } from "./emailBrand";
import { adminUser, emailAuth } from "../../constants/credentials";
import { APP_BASE_URL } from "../../constants/domain";

const emailWrap = brandEmail;

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

  const clientHtml = emailWrap(`
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
      <a href="${link}" style="display:inline-block;background-color:#111;color:#fff;padding:14px 36px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:1px;">Semnează Contractul</a>
    </div>
    <p style="color: #aaa; font-size: 11px; text-align: center;">
      Sau accesați direct:<br/>
      <a href="${link}" style="color: #111; word-break: break-all;">${link}</a>
    </p>
  `);

  await mailer.sendMail({
    from: emailAuth.email,
    to,
    subject: `Contract servicii foto/video — ${eventType} ${formattedDate}`,
    html: clientHtml,
  });

  await mailer.sendMail({
    from: emailAuth.email,
    to: adminUser.email,
    subject: `[Copie] Link contract trimis — ${eventType} ${formattedDate} — ${to}`,
    html: clientHtml,
  });
}

interface SignedContractEmailOptions {
  to: string;
  eventType: string;
  eventDate: string;
  clientName: string;
  pdfUrl: string;
  hasPdf?: boolean;
  /** Extra details shown only in the admin copy. */
  admin?: SignedContractAdminDetails;
}

export interface SignedContractAdminDetails {
  contractId?: string;
  clientPhone?: string;
  eventLocation?: string;
  priceTotal?: number;
  priceAdvance?: number;
  currency?: string;
  signedAt?: string;
  signedFrom?: string;
}

// Signed-contract emails (owner, 2026-10-25): square, monochrome "ancavisuals style" (no rounded
// corners, no gold/green). The client gets a warm "cream & ink" letter,
// the admin a compact summary card with the details and quick actions. Table layout + inline
// styles only, so Gmail / Outlook / Apple Mail render them the same.
const INK = "#111";
const CREAM = "#f5f5f5";
const MUTED = "#666";
const ACCENT = "#111";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function whatsappUrl(phone: string): string | null {
  const digits = phone.trim().replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (digits.startsWith("0") && digits.length >= 10) return `https://wa.me/40${digits.slice(1)}`;
  if (digits.length >= 7) return `https://wa.me/${digits}`;
  return null;
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString("ro-RO")} ${currency}`;
}

function formatRoDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function button(href: string, label: string, variant: "dark" | "light" = "dark", size: "large" | "small" = "large"): string {
  const colors = variant === "dark"
    ? `background:${INK};color:${CREAM};border:1px solid ${INK};`
    : `background:#ffffff;color:${INK};border:1px solid #ddd;`;
  const box = size === "large" ? "padding:16px 32px;font-size:13px;" : "padding:12px 18px;font-size:11px;margin:0 8px 8px 0;";
  return `<a href="${escapeHtml(href)}" style="display:inline-block;${colors}${box}font-family:${SANS};font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;white-space:nowrap;">${label}</a>`;
}

function detailRows(rows: Array<[string, string]>): string {
  return rows.map(([label, value], index) => `
    <tr>
      <td style="padding:13px 0;${index ? "border-top:1px solid #eee;" : ""}font-family:${SANS};font-size:13px;color:${MUTED};width:38%;vertical-align:top;">${label}</td>
      <td style="padding:13px 0;${index ? "border-top:1px solid #eee;" : ""}font-family:${SANS};font-size:14px;color:${INK};font-weight:600;vertical-align:top;">${value}</td>
    </tr>`).join("");
}

/** Cream page, white letter, brand header — shared by the client-facing signed-contract emails. */
function clientLetter({ preheader, eyebrow, title, intro, details, note, cta, icon = "&#10003;" }: {
  /** The square mark above the title (default: a check). */
  icon?: string;
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  details: Array<[string, string]>;
  note: string;
  cta: string;
}): string {
  return `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CREAM};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};">
    <tr><td align="center" style="padding:36px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td align="center" style="padding:0 0 28px;">
          <div style="font-family:${SERIF};font-size:22px;letter-spacing:6px;color:${INK};">ANCA VISUALS</div>
          <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;color:${MUTED};margin-top:6px;text-transform:uppercase;">Fotografie &amp; Videografie</div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:44px 36px;border:1px solid ${INK};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <div style="width:52px;height:52px;line-height:52px;background:${INK};color:${CREAM};font-size:26px;text-align:center;font-family:${SANS};">${icon}</div>
              <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:3px;color:${ACCENT};text-transform:uppercase;margin-top:22px;">${eyebrow}</div>
              <h1 style="font-family:${SERIF};font-size:30px;line-height:1.25;font-weight:400;color:${INK};margin:10px 0 0;">${title}</h1>
            </td></tr>
            <tr><td style="padding-top:22px;font-family:${SANS};font-size:15px;line-height:1.7;color:#444;text-align:center;">${intro}</td></tr>
            <tr><td style="padding-top:28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border:1px solid #e5e5e5;">
                <tr><td style="padding:6px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows(details)}</table>
                </td></tr>
              </table>
            </td></tr>
            ${cta ? `<tr><td align="center" style="padding-top:32px;">${cta}</td></tr>` : ""}
            <tr><td style="padding-top:22px;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};text-align:center;">${note}</td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:28px 12px 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTED};">
          Aveți întrebări? Răspundeți direct la acest email.<br/>
          <span style="color:#999;">Anca Visuals &nbsp;·&nbsp; <a href="https://ancavisuals.ro" style="color:#999;text-decoration:none;">ancavisuals.ro</a></span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function signedContractClientHtml(options: SignedContractEmailOptions, formattedDate: string): string {
  const { eventType, clientName, pdfUrl, hasPdf = true } = options;
  return clientLetter({
    preheader: `Contractul pentru ${escapeHtml(eventType)} din ${formattedDate} este semnat.`,
    eyebrow: "Contract semnat",
    title: "Vă mulțumim!",
    intro: `${clientName ? `Bună ziua, ${escapeHtml(clientName)}!<br/>` : ""}Contractul pentru <strong style="color:${INK};">${escapeHtml(eventType)}</strong> a fost semnat cu succes. Data este rezervată și ne bucurăm să fim alături de voi.`,
    details: [
      ["Eveniment", escapeHtml(eventType)],
      ["Data", formattedDate],
      ["Semnat de", escapeHtml(clientName)],
    ],
    cta: button(pdfUrl, hasPdf ? "Descarcă contractul (PDF)" : "Vezi contractul semnat"),
    note: hasPdf
      ? "Linkul este permanent: îl puteți deschide oricând. Vă recomandăm să păstrați o copie a contractului."
      : "PDF-ul se generează chiar acum și va fi disponibil în câteva minute la același link.",
  });
}

function signedContractAdminHtml(options: SignedContractEmailOptions, formattedDate: string): string {
  const { to, eventType, clientName, pdfUrl, hasPdf = true, admin = {} } = options;
  const currency = admin.currency || "RON";
  const phone = admin.clientPhone?.trim() ?? "";
  const whatsapp = phone ? whatsappUrl(phone) : null;
  const linkStyle = `color:${INK};text-decoration:underline;text-decoration-color:#ccc;`;

  const rows: Array<[string, string]> = [
    ["Email", `<a href="mailto:${escapeHtml(to)}" style="${linkStyle}">${escapeHtml(to)}</a>`],
    ...(phone ? [["Telefon", `<a href="tel:${escapeHtml(phone)}" style="${linkStyle}">${escapeHtml(phone)}</a>`] as [string, string]] : []),
    ...(admin.eventLocation ? [["Locație", escapeHtml(admin.eventLocation)] as [string, string]] : []),
    ...(admin.priceTotal ? [["Total", formatMoney(admin.priceTotal, currency)] as [string, string]] : []),
    ...(admin.priceAdvance ? [["Avans", formatMoney(admin.priceAdvance, currency)] as [string, string]] : []),
    ...(admin.signedAt ? [["Semnat la", formatRoDateTime(admin.signedAt)] as [string, string]] : []),
    ...(admin.signedFrom ? [["Semnat din", escapeHtml(admin.signedFrom)] as [string, string]] : []),
  ];

  const actions = [
    button(pdfUrl, hasPdf ? "Descarcă PDF" : "Vezi contractul", "dark", "small"),
    ...(admin.contractId ? [button(`${APP_BASE_URL}/admin/contracts/${encodeURIComponent(admin.contractId)}/edit`, "Deschide în admin", "light", "small")] : []),
    ...(whatsapp ? [button(whatsapp, "WhatsApp client", "light", "small")] : []),
  ].join("");

  return `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(clientName)} a semnat contractul — ${escapeHtml(eventType)}, ${formattedDate}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid ${INK};">
        <tr><td style="background:${INK};padding:22px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-family:${SERIF};font-size:15px;letter-spacing:4px;color:${CREAM};">ANCA VISUALS</td>
            <td align="right"><span style="display:inline-block;background:${CREAM};color:${INK};font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:2px;padding:6px 12px;">&#10003; SEMNAT</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;">
          <div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:2px;color:${ACCENT};text-transform:uppercase;">Contract nou semnat</div>
          <h1 style="font-family:${SERIF};font-size:26px;line-height:1.3;font-weight:400;color:${INK};margin:8px 0 0;">${escapeHtml(clientName)}</h1>
          <div style="font-family:${SANS};font-size:14px;color:${MUTED};margin-top:4px;">${escapeHtml(eventType)} · ${formattedDate}</div>
        </td></tr>
        <tr><td style="padding:12px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows(rows)}</table>
        </td></tr>
        <tr><td style="padding:20px 20px 20px 28px;">
          <div>${actions}</div>
          ${hasPdf ? "" : `<p style="font-family:${SANS};font-size:12px;color:#111;margin:14px 0 0;">PDF-ul nu s-a generat încă; linkul duce la pagina contractului.</p>`}
        </td></tr>
      </table>
      <div style="font-family:${SANS};font-size:11px;color:#999;margin-top:14px;">Clientul a primit separat emailul de confirmare.</div>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendSignedContractEmail(options: SignedContractEmailOptions): Promise<void> {
  const { to, eventType, eventDate, clientName } = options;
  const formattedDate = formatRoDate(eventDate);

  await mailer.sendMail({
    from: emailAuth.email,
    to,
    subject: `Contract semnat — ${eventType} ${formattedDate}`,
    html: signedContractClientHtml(options, formattedDate),
  });

  await mailer.sendMail({
    from: emailAuth.email,
    to: adminUser.email,
    subject: `[Admin] Contract semnat — ${eventType} ${formattedDate} — ${clientName}`,
    html: signedContractAdminHtml(options, formattedDate),
  });
}

export interface BankTransferEmailOptions {
  to: string;
  clientName: string;
  eventType: string;
  eventDate: string;
  beneficiaryName: string;
  iban: string;
  /** What to pay now: the advance, or the whole price when the contract has no advance. */
  amount: number;
  currency: string;
  isAdvance: boolean;
  /** When it is due, as written in the contract (free text). */
  dueDate?: string;
  /** Lei for one euro (BNR, today) — shown as the lei equivalent on EUR contracts. */
  eurRate?: number;
  /** The day of that BNR rate (YYYY-MM-DD). */
  eurRateDate?: string;
}

/** "12.09.2026 - Nuntă": what the client writes as the transfer's description (owner). */
export function paymentReference(eventDate: string, eventType: string): string {
  const d = new Date(eventDate);
  const date = isNaN(d.getTime())
    ? eventDate
    : d.toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest", day: "2-digit", month: "2-digit", year: "numeric" });
  return `${date} - ${eventType}`.trim();
}

/**
 * The name the client types as the transfer's beneficiary: the person, without "PFA" (owner,
 * 2026-10-28 — the Revolut account is in his name). The contract and invoices keep the full name.
 */
export function transferBeneficiaryName(name: string): string {
  return name.replace(/(^|\s)P\.?F\.?A\.?(?=\s|$)/gi, " ").replace(/\s+/g, " ").trim();
}

/** RO49 AAAA 1B31 ... — easier to read and copy than one long run. */
function groupIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
}

export function bankTransferEmailHtml(options: BankTransferEmailOptions): string {
  const { clientName, eventType, eventDate, beneficiaryName, iban, amount, currency, isAdvance, dueDate, eurRate, eurRateDate } = options;
  const formattedDate = formatRoDate(eventDate);
  const reference = paymentReference(eventDate, eventType);
  const beneficiary = transferBeneficiaryName(beneficiaryName);
  const isEur = currency.toUpperCase() === "EUR";
  const lei = isEur && eurRate ? Math.round(amount * eurRate) : null;
  const mono = `font-family:'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:0.5px;`;
  // Each "copiază" opens /copiaza with every field, copying the one tapped (emails can't run scripts).
  const copyFields: [string, string][] = [
    ["Beneficiar", beneficiary],
    ["IBAN", iban.replace(/\s+/g, "").toUpperCase()],
    ["Sumă", String(amount)],
    ["Descriere", reference],
  ];
  const copy = (label: string) => copyIcon(copyPageUrl(copyFields, label));
  const amountText = `${formatMoney(amount, currency)}${lei ? `<br/><span style="font-weight:400;color:${MUTED};font-size:13px;">sau ${formatMoney(lei, "lei")} (curs BNR ${eurRateDate ? `din ${escapeHtml(eurRateDate.split("-").reverse().join("."))}, ` : ""}${eurRate!.toLocaleString("ro-RO", { maximumFractionDigits: 4 })} lei/€)</span>` : ""}`;
  return clientLetter({
    icon: "&#8644;",
    preheader: `Datele pentru plata ${isAdvance ? "avansului" : "contractului"}: ${escapeHtml(beneficiary)}, ${escapeHtml(groupIban(iban))}.`,
    eyebrow: isAdvance ? "Plata avansului" : "Plata contractului",
    title: "Datele pentru transfer",
    intro: `${clientName ? `Bună ziua, ${escapeHtml(clientName)}!<br/>` : ""}Mai jos găsiți contul în care puteți face plata pentru <strong style="color:${INK};">${escapeHtml(eventType)}</strong> din ${formattedDate}.${isAdvance ? " Contractul intră în vigoare la primirea avansului." : ""}`,
    details: [
      ["Beneficiar", `${escapeHtml(beneficiary)}${copy("Beneficiar")}`],
      ["IBAN", `<span style="${mono}">${escapeHtml(groupIban(iban))}</span>${copy("IBAN")}`],
      [isAdvance ? "Avans" : "Sumă", `${amountText}${copy("Sumă")}`],
      ...(dueDate ? [["Scadent la", escapeHtml(dueDate)] as [string, string]] : []),
      ["Descriere plată", `<span style="${mono}">${escapeHtml(reference)}</span>${copy("Descriere")}`],
    ],
    cta: "",
    note: `${isEur ? "Puteți plăti în euro sau echivalentul în lei, în același cont. " : ""}Vă rugăm să treceți la descriere exact <strong style="color:${INK};">${escapeHtml(reference)}</strong>, ca să găsim plata ușor.`,
  });
}

/** After signing, when the contract is paid by bank transfer (owner): where and what to pay — to the client, then a copy to the owner. */
export async function sendBankTransferEmail(options: BankTransferEmailOptions): Promise<void> {
  const subject = `Date pentru plată — ${options.eventType} ${formatRoDate(options.eventDate)}`;
  const html = bankTransferEmailHtml(options);
  await mailer.sendMail({ from: emailAuth.email, to: options.to, subject, html });
  await mailer.sendMail({
    from: emailAuth.email,
    to: adminUser.email,
    subject: `[Copie] ${subject} — ${options.clientName} (${options.to})`,
    html,
  });
}

/** Client signed first; the provider has now signed too — send the final, fully signed PDF. */
export async function sendFullySignedContractEmail(options: SignedContractEmailOptions): Promise<void> {
  const { to, eventType, eventDate, clientName, pdfUrl, hasPdf = true } = options;
  const formattedDate = formatRoDate(eventDate);
  const html = clientLetter({
    preheader: `Contractul pentru ${escapeHtml(eventType)} din ${formattedDate} este semnat de ambele părți.`,
    eyebrow: "Semnat de ambele părți",
    title: "Contractul final este gata",
    intro: `${clientName ? `Bună ziua, ${escapeHtml(clientName)}!<br/>` : ""}Contractul pentru <strong style="color:${INK};">${escapeHtml(eventType)}</strong> a fost semnat și de Anca Visuals, deci este acum semnat de ambele părți.`,
    details: [
      ["Eveniment", escapeHtml(eventType)],
      ["Data", formattedDate],
      ["Semnături", "Client · Anca Visuals"],
    ],
    cta: button(pdfUrl, hasPdf ? "Descarcă contractul final" : "Vezi contractul"),
    note: hasPdf
      ? "Aceasta este varianta finală, cu ambele semnături. Vă recomandăm să o păstrați."
      : "Varianta finală se generează chiar acum și va fi disponibilă în câteva minute la același link.",
  });

  await mailer.sendMail({
    from: emailAuth.email,
    to,
    subject: `Contract semnat de ambele părți — ${eventType} ${formattedDate}`,
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

  const html = brandEmail(`
    <p style="color: #111; font-weight: 700; font-size: 15px; margin-bottom: 6px;">⚠ Contract șters definitiv</p>
    <p style="color: #555; font-size: 13px; margin-bottom: 24px;">
      Acest email conține detaliile contractului șters, pentru arhivă personală.
      Dacă ștergerea a fost accidentală, contactează imediat furnizorul de hosting pentru recuperare din backup.
    </p>
    <table style="width: 100%; border-collapse: collapse; background: #fafafa; margin-bottom: 20px;">
      <tbody>${tableRows}</tbody>
    </table>
    ${pdfUrl ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${pdfUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 28px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:1px;">Descarcă PDF-ul contractului</a>
      <p style="color: #aaa; font-size: 11px; margin-top: 8px;">Linkul poate expira. Salvează PDF-ul dacă ai nevoie de el.</p>
    </div>` : `<p style="color: #aaa; font-size: 12px; text-align: center;">PDF-ul nu era disponibil pentru acest contract.</p>`}
  `);

  await mailer.sendMail({
    from: emailAuth.email,
    to: adminUser.email,
    subject: `[Șters] Contract ${eventType} — ${eventDate} — ${clientEmail}`,
    html,
  });
}

interface ContractReminderEmailOptions {
  to: string;
  token: string;
  eventType: string;
  eventDate: string;
  baseUrl: string;
}

export async function sendContractReminderEmail(options: ContractReminderEmailOptions): Promise<void> {
  const { to, token, eventType, eventDate, baseUrl } = options;
  const link = `${baseUrl}/contract/${token}`;
  const formattedDate = formatRoDate(eventDate);

  const html = emailWrap(`
    <p style="color: #333; margin-bottom: 12px;">Bună ziua,</p>
    <p style="color: #333; margin-bottom: 12px;">
      Vă trimitem un scurt reminder că contractul pentru evenimentul
      <strong>${eventType}</strong> din data de <strong>${formattedDate}</strong>
      nu a fost semnat încă.
    </p>
    <p style="color: #555; margin-bottom: 28px;">
      Vă rugăm să accesați link-ul de mai jos pentru a semna contractul. Procesul durează doar câteva minute.
    </p>
    <div style="text-align: center; margin-bottom: 28px;">
      <a href="${link}" style="display:inline-block;background-color:#111;color:#fff;padding:14px 36px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:1px;">Semnează Contractul</a>
    </div>
    <p style="color: #aaa; font-size: 11px; text-align: center;">
      Sau accesați direct:<br/>
      <a href="${link}" style="color: #111; word-break: break-all;">${link}</a>
    </p>
  `);

  await mailer.sendMail({
    from: emailAuth.email,
    to,
    subject: `Reminder: Contract nesemnat — ${eventType} ${formattedDate}`,
    html,
  });

  await mailer.sendMail({
    from: emailAuth.email,
    to: adminUser.email,
    subject: `[Copie] Reminder trimis — ${eventType} ${formattedDate} — ${to}`,
    html,
  });
}

function formatRoDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
}
