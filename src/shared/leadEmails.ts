/*
 * Purpose: the emails the owner gets for a new request (booking configurator, quick lead, /bio
 * callback, landing form) — in the ancavisuals style: white, black, square. Each one opens with
 * the person's phone and two ready buttons, "Sună" (tel:) and "WhatsApp" (wa.me with a message
 * already written). Shared because the browser builds some of them and the server the others.
 */

const OWNER_NAME = "Daniel";

export function escapeLeadHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** "0745 111 222" / "+40 745…" / "0040…" → "40745111222" (what tel: and wa.me want). */
export function leadPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  return digits.startsWith("0") && digits.length === 10 ? `40${digits.slice(1)}` : digits;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** The WhatsApp message the owner sends with one tap. */
export function leadWhatsappText(input: { name?: string; eventType?: string; date?: string }): string {
  const hello = input.name?.trim() ? `Bună ziua, ${firstName(input.name)}!` : "Bună ziua!";
  const about = input.eventType
    ? ` Am primit cererea dumneavoastră pentru ${input.eventType.toLowerCase()}${input.date ? ` din ${input.date}` : ""}.`
    : " Am primit cererea dumneavoastră de pe site.";
  return `${hello} Sunt ${OWNER_NAME} de la Anca Visuals.${about} Când vă pot suna ca să vorbim despre detalii?`;
}

type LeadEmailInput = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  phone?: string;
  whatsappText?: string;
  /** [label, value] — values are plain text, escaped here; empty values are skipped. */
  fields: [string, string | number | null | undefined][];
  note?: string;
};

const SANS = "Arial, Helvetica, sans-serif";

function contactBlock(phone: string, whatsappText: string): string {
  const digits = leadPhoneDigits(phone);
  const button = (href: string, label: string, dark: boolean) =>
    `<td style="padding:0 8px 0 0;"><a href="${href}" style="display:inline-block;padding:14px 22px;${dark ? "background:#111;color:#fff;" : "background:#fff;color:#111;"}border:1px solid #111;text-decoration:none;font-family:${SANS};font-size:12px;letter-spacing:2px;text-transform:uppercase;">${label}</a></td>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #111;margin:0 0 24px;">
      <tr><td style="padding:20px 22px;">
        <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#666;margin:0 0 6px;">Telefon</div>
        <div style="font-family:${SANS};font-size:24px;color:#111;margin:0 0 16px;"><a href="tel:+${digits}" style="color:#111;text-decoration:none;">${escapeLeadHtml(phone)}</a></div>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          ${button(`tel:+${digits}`, "Sună", true)}
          ${button(`https://wa.me/${digits}?text=${encodeURIComponent(whatsappText)}`, "WhatsApp", false)}
        </tr></table>
      </td></tr>
    </table>`;
}

export function leadEmailHtml({ eyebrow, title, subtitle, phone, whatsappText, fields, note }: LeadEmailInput): string {
  const rows = fields
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([label, value], index) => `
      <tr>
        <td style="padding:12px 16px;${index ? "border-top:1px solid #e5e5e5;" : ""}font-family:${SANS};font-size:12px;color:#666;width:38%;vertical-align:top;">${escapeLeadHtml(label)}</td>
        <td style="padding:12px 16px;${index ? "border-top:1px solid #e5e5e5;" : ""}font-family:${SANS};font-size:14px;color:#111;vertical-align:top;">${escapeLeadHtml(value).replace(/\n/g, "<br>")}</td>
      </tr>`)
    .join("");
  return `
    <div style="font-family:${SANS};max-width:600px;margin:0 auto;padding:36px 24px;background:#fff;color:#111;">
      <div style="font-size:12px;letter-spacing:5px;color:#111;margin:0 0 14px;">ANCA VISUALS</div>
      <hr style="border:none;border-top:1px solid #111;margin:0 0 28px;" />
      <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#666;margin:0 0 8px;">${escapeLeadHtml(eyebrow)}</div>
      <h1 style="font-size:26px;font-weight:400;line-height:1.25;color:#111;margin:0 0 6px;">${escapeLeadHtml(title)}</h1>
      ${subtitle ? `<div style="font-size:14px;color:#555;margin:0 0 24px;">${escapeLeadHtml(subtitle)}</div>` : `<div style="height:18px;"></div>`}
      ${phone ? contactBlock(phone, whatsappText ?? leadWhatsappText({})) : ""}
      ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;background:#fafafa;border-collapse:collapse;">${rows}</table>` : ""}
      ${note ? `<p style="font-size:12px;line-height:1.6;color:#777;margin:18px 0 0;">${escapeLeadHtml(note)}</p>` : ""}
    </div>`;
}

/* ---- the booking configurator and /bio (built in the browser, sent through /triggerEvent) ---- */

export const buildHtmlFinal = (args: {
  selectedFormattedDate: string;
  eventType: string;
  fullName: string;
  phone: string;
  location: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
  durationHours: number | null;
  totalPrice: number;
  selectedPackages: string[];
  showCustom: boolean;
  photo: boolean;
  video: boolean;
}) => leadEmailHtml({
  eyebrow: "Cerere nouă · Configurator",
  title: args.fullName || "Cerere nouă",
  subtitle: `${args.eventType} · ${args.selectedFormattedDate}`,
  phone: args.phone,
  whatsappText: leadWhatsappText({ name: args.fullName, eventType: args.eventType, date: args.selectedFormattedDate }),
  fields: [
    ["Data", args.selectedFormattedDate],
    ["Eveniment", args.eventType],
    ["Locație", args.location],
    ["Interval", `${args.startTime} – ${args.endTime}${args.overnight ? " (peste miezul nopții)" : ""}`],
    ["Durată estimată", `${args.durationHours ?? "-"} h`],
    ["Pachete", args.selectedPackages.join(", ") || "-"],
    ...(args.showCustom ? [["Custom", `foto ${args.photo ? "da" : "nu"}, video ${args.video ? "da" : "nu"}`] as [string, string]] : []),
    ["Preț estimativ", `${Number(args.totalPrice).toLocaleString("ro-RO")} EUR`],
  ],
});

export const buildQuickLeadHtml = (args: { selectedFormattedDate: string; eventType: string; fullName: string; phone: string }) => leadEmailHtml({
  eyebrow: "Lead rapid · Configurator",
  title: args.fullName || "Lead rapid",
  subtitle: `${args.eventType} · ${args.selectedFormattedDate}`,
  phone: args.phone,
  whatsappText: leadWhatsappText({ name: args.fullName, eventType: args.eventType, date: args.selectedFormattedDate }),
  fields: [
    ["Data (aleasă până acum)", args.selectedFormattedDate],
    ["Eveniment", args.eventType],
    ["A acceptat salvarea datelor", "Da"],
  ],
  note: "Trimis la finalul pasului 3 (contact), chiar dacă vizitatorul nu a terminat configuratorul.",
});

export const buildBioCallbackHtml = (phone: string) => leadEmailHtml({
  eyebrow: "Cerere de apel · /bio",
  title: "Vrea să fie sunat",
  subtitle: "A lăsat numărul din pagina /bio.",
  phone,
  whatsappText: leadWhatsappText({}),
  fields: [],
});
