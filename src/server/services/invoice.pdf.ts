import puppeteer from "puppeteer";

function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + " " + currency;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface FiscalSettings {
  ownerName?: string;
  cif?: string;
  address?: string;
  iban?: string;
  bank?: string;
  invoiceSeries?: string;
}

export interface InvoiceData {
  invoiceNumber: number;
  series: string;
  invoiceRef?: string;
  date: string;
  type: "B2C" | "B2B";
  clientName: string;
  clientAddress?: string;
  clientCIF?: string;
  items: InvoiceItem[];
  totalAmount: number;
  currency: string;
  notes?: string;
}

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; line-height: 1.5; }
  .page { max-width: 794px; margin: 0 auto; padding: 18mm 16mm; }
  h1 { font-size: 16pt; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
  .invoice-ref { text-align: center; font-size: 10pt; color: #555; margin-bottom: 20px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 20px 0; }
  .party { border: 1px solid #ddd; padding: 12px 14px; border-radius: 4px; }
  .party-title { font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; font-weight: 700; }
  .party-name { font-size: 11pt; font-weight: 700; margin-bottom: 4px; }
  .party-detail { font-size: 8.5pt; color: #444; line-height: 1.6; }
  hr { border: none; border-top: 2px solid #222; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #1a1a1a; color: #fff; font-size: 8.5pt; padding: 6px 8px; text-align: left; font-weight: 600; }
  td { padding: 7px 8px; font-size: 9pt; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:nth-child(even) td { background: #f9f9f9; }
  .num { text-align: right; }
  .total-row td { font-weight: 700; font-size: 10.5pt; border-top: 2px solid #222; border-bottom: none; background: #f0f0f0; }
  .mention { margin-top: 20px; font-size: 8.5pt; color: #666; font-style: italic; border-top: 1px solid #eee; padding-top: 10px; }
  .sig-row { display: flex; gap: 40px; margin-top: 40px; }
  .sig-box { flex: 1; border-top: 1px solid #333; padding-top: 6px; }
  .sig-label { font-size: 8.5pt; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-name { font-size: 9.5pt; font-weight: 700; margin-top: 4px; }
  .footer { margin-top: 24px; font-size: 7.5pt; color: #aaa; text-align: center; }
  .badge { display: inline-block; background: #1a1a1a; color: #fff; font-size: 9pt; padding: 2px 10px; border-radius: 4px; font-weight: 700; letter-spacing: 1px; }
`;

export async function generateInvoicePDF({
  invoice,
  fiscal,
}: {
  invoice: InvoiceData;
  fiscal: FiscalSettings;
}): Promise<Buffer> {
  const invoiceRef = invoice.invoiceRef ?? `${invoice.series}-${String(invoice.invoiceNumber).padStart(4, "0")}`;

  const itemRows = invoice.items
    .map(
      (item, index) => `
    <tr>
      <td class="num">${index + 1}</td>
      <td>${esc(item.description)}</td>
      <td class="num">buc</td>
      <td class="num">${esc(item.quantity)}</td>
      <td class="num">${fmtAmount(item.unitPrice, invoice.currency)}</td>
      <td class="num">${fmtAmount(item.total, invoice.currency)}</td>
    </tr>
  `,
    )
    .join("");

  const html = `<!DOCTYPE html><html lang="ro"><head><meta charset="UTF-8">
<style>${CSS}</style></head><body><div class="page">

<h1>Factură</h1>
<p class="invoice-ref">
  Nr. <span class="badge">${esc(invoiceRef)}</span>
  &nbsp;·&nbsp; Data: ${fmtDate(invoice.date)}
  &nbsp;·&nbsp; <span style="font-size:8pt;color:#888;">${invoice.type === "B2B" ? "Persoană juridică" : "Persoană fizică"}</span>
</p>
<hr />

<div class="parties">
  <div class="party">
    <div class="party-title">Furnizor</div>
    <div class="party-name">${esc(fiscal.ownerName ?? "—")}</div>
    <div class="party-detail">
      CIF: ${esc(fiscal.cif ?? "—")}<br/>
      ${esc(fiscal.address ?? "")}<br/>
      IBAN: ${esc(fiscal.iban ?? "—")}${fiscal.bank ? `<br/>${esc(fiscal.bank)}` : ""}
    </div>
  </div>
  <div class="party">
    <div class="party-title">Beneficiar / Cumpărător</div>
    <div class="party-name">${esc(invoice.clientName)}</div>
    <div class="party-detail">
      ${invoice.type === "B2B" && invoice.clientCIF ? `CIF: ${esc(invoice.clientCIF)}<br/>` : ""}
      ${invoice.clientAddress ? esc(invoice.clientAddress) : "&nbsp;"}
    </div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:28px;">Nr.</th>
      <th>Denumire serviciu / produs</th>
      <th style="width:36px;">UM</th>
      <th style="width:50px;">Cant.</th>
      <th style="width:110px;">Preț unitar</th>
      <th style="width:110px;">Valoare</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
    <tr class="total-row">
      <td colspan="5" style="text-align:right; padding-right:12px;">TOTAL DE PLATĂ</td>
      <td class="num">${fmtAmount(invoice.totalAmount, invoice.currency)}</td>
    </tr>
  </tbody>
</table>

${invoice.notes ? `<p style="font-size:8.5pt;color:#555;margin-top:8px;font-style:italic;">${esc(invoice.notes)}</p>` : ""}

<div class="mention">
  Neplatitor de TVA conform art. 310 din Legea nr. 227/2015 privind Codul Fiscal.<br/>
  Prezenta factură reprezintă document justificativ conform reglementărilor în vigoare.
</div>

<div class="sig-row">
  <div class="sig-box">
    <div class="sig-label">Furnizor</div>
    <div style="height:44px;"></div>
    <div class="sig-name">${esc(fiscal.ownerName ?? "—")}</div>
  </div>
  <div class="sig-box">
    <div class="sig-label">Beneficiar</div>
    <div style="height:44px;"></div>
    <div class="sig-name">${esc(invoice.clientName)}</div>
  </div>
</div>

<div class="footer">Document generat electronic · ${esc(fiscal.ownerName ?? "")} · ${fmtDate(invoice.date)}</div>
</div></body></html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
