/*
 * Purpose: the shared ancavisuals email frame — black & white, square, no accent colours.
 * Templates wrap their body in brandEmail() and use emailButton() for the main action.
 */

const BRAND_HEADER = `
  <div style="text-align: center; margin-bottom: 28px;">
    <h2 style="color: #111; font-weight: 400; letter-spacing: 6px; font-size: 20px; margin: 0;">ANCA VISUALS</h2>
    <p style="color: #666; font-size: 10px; letter-spacing: 3px; margin: 8px 0 0; text-transform: uppercase;">Fotografie &amp; Videografie</p>
  </div>
  <hr style="border: none; border-top: 1px solid #111; margin: 0 0 32px;" />`;

const BRAND_FOOTER = `
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 36px 0 16px;" />
  <p style="color: #888; font-size: 10px; letter-spacing: 2px; text-align: center; text-transform: uppercase; margin: 0;">
    Anca Visuals · <a href="https://ancavisuals.ro" style="color: #888; text-decoration: none;">ancavisuals.ro</a>
  </p>`;

export function brandEmail(body: string): string {
  return `<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background: #fff; color: #111;">${BRAND_HEADER}${body}${BRAND_FOOTER}</div>`;
}

export function emailButton(href: string, label: string): string {
  return `
    <div style="text-align: center; margin: 32px 0 8px;">
      <a href="${href}" style="display: inline-block; padding: 16px 36px; background: #111; color: #fff; text-decoration: none; border-radius: 0; font-size: 12px; letter-spacing: 3px; text-transform: uppercase;">${label}</a>
    </div>`;
}

export const emailStrong = (text: string) => `<strong style="color: #111;">${text}</strong>`;

type AdminEmailInput = {
  /** Small grey line above the title ("Album", "Proces-verbal"…). */
  eyebrow: string;
  title: string;
  /** [label, value]: values are HTML (escape user input before passing it). Empty values are skipped. */
  rows: [string, string | number | null | undefined][];
  note?: string;
  /** Extra HTML under the table (a list of files, a stack trace…). */
  extra?: string;
  button?: { href: string; label: string };
};

/** An owner notification: title, a framed table of details, an optional black button. */
export function adminEmail({ eyebrow, title, rows, note, extra, button }: AdminEmailInput): string {
  const body = rows
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([label, value], index) => `
      <tr>
        <td style="padding:12px 16px;${index ? "border-top:1px solid #e5e5e5;" : ""}font-size:12px;color:#666;width:36%;vertical-align:top;">${label}</td>
        <td style="padding:12px 16px;${index ? "border-top:1px solid #e5e5e5;" : ""}font-size:14px;color:#111;vertical-align:top;word-break:break-word;">${value}</td>
      </tr>`)
    .join("");
  return brandEmail(`
    <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#666;margin:0 0 8px;">${eyebrow}</div>
    <h1 style="font-size:24px;font-weight:400;line-height:1.3;color:#111;margin:0 0 24px;">${title}</h1>
    ${body ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;background:#fafafa;border-collapse:collapse;font-family:Arial, Helvetica, sans-serif;">${body}</table>` : ""}
    ${extra ? `<div style="font-size:13px;line-height:1.6;color:#111;margin:18px 0 0;">${extra}</div>` : ""}
    ${note ? `<p style="font-size:12px;line-height:1.6;color:#777;margin:18px 0 0;">${note}</p>` : ""}
    ${button ? emailButton(button.href, button.label) : ""}
  `);
}

/** A plain list for adminEmail's `extra`: square bullets, one item per line. */
export function emailList(items: string[]): string {
  return `<ul style="margin:0;padding:0 0 0 18px;list-style:square;">${items.map((item) => `<li style="margin:0 0 4px;">${item}</li>`).join("")}</ul>`;
}

/**
 * Link for a copy icon: emails can't run scripts, so it opens /copiaza, which copies `copy` and
 * lists every field with a "Copiază" button. Values go in the hash, never to the server.
 */
export function copyPageUrl(fields: [string, string][], copy: string): string {
  const params = new URLSearchParams(fields);
  params.set("c", copy);
  return `https://ancavisuals.ro/copiaza#${params.toString()}`;
}

/** A small square "⧉ copiază" link to put next to a value. */
export function copyIcon(href: string): string {
  return `<a href="${href}" title="Copiază" style="display:inline-block;margin-left:8px;padding:2px 7px;border:1px solid #111;color:#111;text-decoration:none;font-family:Arial, Helvetica, sans-serif;font-size:11px;letter-spacing:1px;vertical-align:middle;white-space:nowrap;">&#10697; copiază</a>`;
}
