import puppeteer from "puppeteer";

const DRIVER_NAME = "ANCA DANIEL-EMANUEL";
const OWNER = "ANCA DANIEL EMANUEL PFA";

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

function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleDateString("ro-RO", { month: "long" });
}

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; line-height: 1.5; }
  .page { max-width: 794px; margin: 0 auto; padding: 18mm 16mm; }
  h1 { font-size: 13pt; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
  .subtitle { text-align: center; font-size: 9pt; color: #555; margin-bottom: 14px; }
  .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 14px; font-size: 9.5pt; }
  .header-grid .label { color: #666; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.5px; }
  .header-grid .value { font-weight: 600; }
  hr { border: none; border-top: 1px solid #999; margin: 10px 0; }
  hr.thick { border-top: 2px solid #333; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th { background: #1a1a1a; color: #fff; font-size: 8.5pt; padding: 5px 7px; text-align: left; font-weight: 600; }
  td { padding: 5px 7px; font-size: 9pt; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f7f7; }
  .num { text-align: right; }
  .total-row td { font-weight: 700; border-top: 2px solid #333; border-bottom: none; background: #f0f0f0; }
  .section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #333; margin: 12px 0 5px; }
  .detail-table td { border-bottom: 1px solid #ddd; padding: 6px 8px; }
  .detail-table .key { color: #555; font-size: 8.5pt; width: 40%; }
  .detail-table .val { font-weight: 600; }
  .sig-row { display: flex; gap: 40px; margin-top: 32px; }
  .sig-box { flex: 1; border-top: 1px solid #333; padding-top: 6px; }
  .sig-label { font-size: 8.5pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-name { font-size: 9.5pt; font-weight: 700; margin-top: 4px; }
  .footer { margin-top: 20px; font-size: 7.5pt; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
  .badge { display: inline-block; background: #1a1a1a; color: #fff; font-size: 8pt; padding: 2px 8px; border-radius: 4px; letter-spacing: 1px; }
`;

function vehicleHeader(vehicle: Record<string, unknown>): string {
  return `
    <div class="header-grid">
      <div><div class="label">Proprietar / Unitate</div><div class="value">${esc(OWNER)}</div></div>
      <div><div class="label">Conducător auto</div><div class="value">${esc(DRIVER_NAME)}</div></div>
      <div><div class="label">Nr. înmatriculare</div><div class="value">${esc(vehicle.licensePlate ?? "—")}</div></div>
      <div><div class="label">Marcă / Model</div><div class="value">${esc(vehicle.carMake ?? "—")} ${esc(vehicle.carModel ?? "")}</div></div>
      <div><div class="label">Tip carburant</div><div class="value">${esc(vehicle.fuelType ?? "—")}</div></div>
      <div><div class="label">Consum normat</div><div class="value">${vehicle.fuelConsumption ? esc(vehicle.fuelConsumption) + " L/100km" : "—"}</div></div>
    </div>
  `;
}

export async function generateRouteSheetPDF({
  vehicle,
  sheet,
}: {
  vehicle: Record<string, unknown>;
  sheet: Record<string, unknown>;
}): Promise<Buffer> {
  const kmDus = Number(sheet.kmDus ?? 0);
  const kmIntors = Number(sheet.kmIntors ?? 0);
  const kmTotal = Number(sheet.kmTotal ?? kmDus + kmIntors);
  const fuelConsumed =
    sheet.fuelConsumed != null
      ? Number(sheet.fuelConsumed)
      : vehicle.fuelConsumption
        ? Math.round((kmTotal * Number(vehicle.fuelConsumption)) / 100 * 100) / 100
        : null;

  const html = `<!DOCTYPE html><html lang="ro"><head><meta charset="UTF-8">
<style>${CSS}</style></head><body><div class="page">

<h1>Foaie de parcurs</h1>
<p class="subtitle">Nr. <span class="badge">${esc(sheet.sheetNumber ?? "—")}</span> &nbsp;·&nbsp; Data: ${fmtDate(sheet.date as string)}</p>
<hr class="thick" />

${vehicleHeader(vehicle)}
<hr />

<div class="section-title">Detalii deplasare</div>
<table class="detail-table">
  <tr><td class="key">Plecare</td><td class="val">${esc(sheet.departure)}</td></tr>
  <tr><td class="key">Destinație</td><td class="val">${esc(sheet.destination)}</td></tr>
  <tr><td class="key">Scopul deplasării</td><td class="val">${esc(sheet.purpose)}</td></tr>
  ${sheet.eventName ? `<tr><td class="key">Eveniment</td><td class="val">${esc(sheet.eventName)}</td></tr>` : ""}
</table>

<div class="section-title" style="margin-top:14px;">Consum</div>
<table>
  <thead>
    <tr>
      <th>Km dus</th>
      <th>Km întors</th>
      <th>Total km</th>
      <th>Combustibil consumat</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="num">${kmDus} km</td>
      <td class="num">${kmIntors} km</td>
      <td class="num" style="font-weight:700;">${kmTotal} km</td>
      <td class="num">${fuelConsumed != null ? fuelConsumed + " L" : "—"}</td>
    </tr>
  </tbody>
</table>

<div class="sig-row">
  <div class="sig-box">
    <div class="sig-label">Conducător auto</div>
    <div style="height:36px;"></div>
    <div class="sig-name">${esc(DRIVER_NAME)}</div>
  </div>
  <div class="sig-box">
    <div class="sig-label">Verificat / Aprobat</div>
    <div style="height:36px;"></div>
    <div class="sig-name">&nbsp;</div>
  </div>
</div>

<div class="footer">Foaie de parcurs generată automat · ${esc(OWNER)}</div>
</div></body></html>`;

  return renderPDF(html);
}

export async function generateMonthlyRouteSheetPDF({
  vehicle,
  sheets,
  year,
  month,
}: {
  vehicle: Record<string, unknown>;
  sheets: Record<string, unknown>[];
  year: number;
  month: number;
}): Promise<Buffer> {
  const totalKm = sheets.reduce((sum, sheet) => sum + Number(sheet.kmTotal ?? 0), 0);
  const totalFuel = sheets.reduce((sum, sheet) => sum + Number(sheet.fuelConsumed ?? 0), 0);

  const rows = sheets
    .map(
      (sheet, index) => `
    <tr>
      <td class="num">${index + 1}</td>
      <td>${fmtDate(sheet.date as string)}</td>
      <td>${esc(sheet.departure)}</td>
      <td>${esc(sheet.destination)}</td>
      <td>${esc(sheet.purpose)}</td>
      <td class="num">${esc(sheet.kmDus)}</td>
      <td class="num">${esc(sheet.kmIntors)}</td>
      <td class="num" style="font-weight:600;">${esc(sheet.kmTotal)}</td>
      <td class="num">${sheet.fuelConsumed != null ? esc(sheet.fuelConsumed) + " L" : "—"}</td>
    </tr>
  `,
    )
    .join("");

  const html = `<!DOCTYPE html><html lang="ro"><head><meta charset="UTF-8">
<style>
${CSS}
body { font-size: 9pt; }
th, td { padding: 4px 6px; font-size: 8.5pt; }
</style></head><body><div class="page">

<h1>Foaie de parcurs lunară</h1>
<p class="subtitle">${monthName(month)} ${year} &nbsp;·&nbsp; ${sheets.length} curse &nbsp;·&nbsp; ${esc(OWNER)}</p>
<hr class="thick" />

${vehicleHeader(vehicle)}
<hr />

<table>
  <thead>
    <tr>
      <th style="width:28px;">Nr.</th>
      <th style="width:68px;">Data</th>
      <th>Plecare</th>
      <th>Destinație</th>
      <th>Scop</th>
      <th style="width:52px;">Km dus</th>
      <th style="width:60px;">Km întors</th>
      <th style="width:56px;">Total km</th>
      <th style="width:60px;">Carburant</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="5">TOTAL</td>
      <td colspan="2"></td>
      <td class="num">${totalKm} km</td>
      <td class="num">${Math.round(totalFuel * 100) / 100} L</td>
    </tr>
  </tbody>
</table>

<div class="sig-row">
  <div class="sig-box">
    <div class="sig-label">Conducător auto</div>
    <div style="height:36px;"></div>
    <div class="sig-name">${esc(DRIVER_NAME)}</div>
  </div>
  <div class="sig-box">
    <div class="sig-label">Verificat / Aprobat</div>
    <div style="height:36px;"></div>
    <div class="sig-name">&nbsp;</div>
  </div>
</div>

<div class="footer">Foaie de parcurs lunară generată automat · ${esc(OWNER)}</div>
</div></body></html>`;

  return renderPDF(html, "A4", true);
}

async function renderPDF(html: string, format: "A4" | "A3" = "A4", landscape = false): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format,
      landscape,
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
