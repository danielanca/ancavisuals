import puppeteer from "puppeteer";

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.setContent(buildInvoiceHTML(data), { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export interface InvoiceData {
  // Emitent (PFA)
  issuerName: string;
  issuerCIF: string;
  issuerAddress: string;
  issuerCity: string;
  issuerCounty: string;
  issuerPostalCode: string;
  issuerIBAN: string;

  // Cumpărător
  buyerName: string;
  buyerCIF?: string;

  // Factură
  invoiceNumber: string;
  invoiceDate: string;   // YYYY-MM-DD
  dueDate: string;       // YYYY-MM-DD
  currency: string;
  description: string;
  amount: number;

  // Context eveniment (afișat în factură)
  eventType?: string;
  eventDate?: string;
}

// ── XML e-Factura UBL 2.1 (CIUS-RO) ────────────────────────────────────────

export function generateInvoiceXML(d: InvoiceData): string {
  const amt = d.amount.toFixed(2);
  const cifRO = d.issuerCIF;
  const buyerCIF = d.buyerCIF ? (d.buyerCIF.startsWith("RO") ? d.buyerCIF : d.buyerCIF) : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">

  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${escXML(d.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${d.invoiceDate}</cbc:IssueDate>
  <cbc:DueDate>${d.dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${d.currency}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>${d.currency}</cbc:TaxCurrencyCode>

  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escXML(d.issuerName)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escXML(d.issuerAddress)}</cbc:StreetName>
        <cbc:CityName>${escXML(d.issuerCity)}</cbc:CityName>
        <cbc:PostalZone>${escXML(d.issuerPostalCode)}</cbc:PostalZone>
        <cbc:CountrySubentity>${escXML(d.issuerCounty)}</cbc:CountrySubentity>
        <cac:Country><cbc:IdentificationCode>RO</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escXML(cifRO)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escXML(d.issuerName)}</cbc:RegistrationName>
        <cbc:CompanyID>${escXML(cifRO)}</cbc:CompanyID>
      </cac:PartyLegalEntity>
      ${d.issuerIBAN ? `<cac:Contact><cbc:ID>${escXML(d.issuerIBAN)}</cbc:ID></cac:Contact>` : ""}
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escXML(d.buyerName)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cac:Country><cbc:IdentificationCode>RO</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${buyerCIF ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${escXML(buyerCIF)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escXML(d.buyerName)}</cbc:RegistrationName>
        <cbc:CompanyID>${escXML(buyerCIF)}</cbc:CompanyID>
      </cac:PartyLegalEntity>` : `<cac:PartyLegalEntity>
        <cbc:RegistrationName>${escXML(d.buyerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>`}
    </cac:Party>
  </cac:AccountingCustomerParty>

  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    ${d.issuerIBAN ? `<cac:PayeeFinancialAccount><cbc:ID>${escXML(d.issuerIBAN)}</cbc:ID></cac:PayeeFinancialAccount>` : ""}
  </cac:PaymentMeans>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${d.currency}">0.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${d.currency}">${amt}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${d.currency}">0.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>O</cbc:ID>
        <cbc:TaxExemptionReasonCode>VATEX-EU-O</cbc:TaxExemptionReasonCode>
        <cbc:TaxExemptionReason>Neplătitor TVA</cbc:TaxExemptionReason>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${d.currency}">${amt}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${d.currency}">${amt}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${d.currency}">${amt}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${d.currency}">${amt}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${d.currency}">${amt}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${escXML(d.description)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>O</cbc:ID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${d.currency}">${amt}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>

</Invoice>`;
}

// ── HTML → PDF ───────────────────────────────────────────────────────────────

export function buildInvoiceHTML(d: InvoiceData): string {
  const fmt = (n: number) =>
    n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtDate = (iso: string) => {
    const [y, m, day] = iso.split("-");
    return `${day}.${m}.${y}`;
  };

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }
  .page { padding: 32px 40px; max-width: 794px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 24px; }
  .logo { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  .invoice-label { text-align: right; }
  .invoice-label .title { font-size: 28px; font-weight: 300; color: #111; letter-spacing: 2px; text-transform: uppercase; }
  .invoice-label .number { font-size: 14px; font-weight: 600; color: #555; margin-top: 4px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 28px; }
  .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 8px; }
  .party-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
  .party-detail { font-size: 11px; color: #555; line-height: 1.6; }
  .dates { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; padding: 16px; background: #f8f8f8; border-radius: 8px; }
  .date-item { }
  .date-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
  .date-value { font-size: 13px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { border-bottom: 2px solid #111; }
  thead th { padding: 10px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; }
  thead th:last-child { text-align: right; }
  tbody tr { border-bottom: 1px solid #eee; }
  tbody td { padding: 12px 8px; font-size: 12px; }
  tbody td:last-child { text-align: right; font-weight: 600; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .totals-box { width: 260px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px solid #eee; }
  .totals-row.total { font-size: 15px; font-weight: 700; border-bottom: none; padding-top: 12px; }
  .footer { border-top: 1px solid #ddd; padding-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .footer-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
  .footer-value { font-size: 12px; font-family: monospace; }
  .vat-notice { font-size: 10px; color: #888; font-style: italic; margin-top: 16px; grid-column: 1 / -1; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      <div class="logo">${escHTML(d.issuerName)}</div>
      <div style="font-size:11px;color:#555;margin-top:6px;">${escHTML(d.issuerAddress)}, ${escHTML(d.issuerCity)}</div>
      <div style="font-size:11px;color:#555;">CIF: ${escHTML(d.issuerCIF)}</div>
    </div>
    <div class="invoice-label">
      <div class="title">Factură</div>
      <div class="number">${escHTML(d.invoiceNumber)}</div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">Furnizor</div>
      <div class="party-name">${escHTML(d.issuerName)}</div>
      <div class="party-detail">
        CIF: ${escHTML(d.issuerCIF)}<br>
        ${escHTML(d.issuerAddress)}<br>
        ${escHTML(d.issuerCity)}${d.issuerCounty ? `, ${escHTML(d.issuerCounty)}` : ""}${d.issuerPostalCode ? ` ${escHTML(d.issuerPostalCode)}` : ""}
      </div>
    </div>
    <div>
      <div class="party-label">Client</div>
      <div class="party-name">${escHTML(d.buyerName)}</div>
      ${d.buyerCIF ? `<div class="party-detail">CIF/CNP: ${escHTML(d.buyerCIF)}</div>` : ""}
    </div>
  </div>

  <div class="dates">
    <div class="date-item">
      <div class="date-label">Data facturii</div>
      <div class="date-value">${fmtDate(d.invoiceDate)}</div>
    </div>
    <div class="date-item">
      <div class="date-label">Scadență</div>
      <div class="date-value">${fmtDate(d.dueDate)}</div>
    </div>
    ${d.eventDate ? `<div class="date-item">
      <div class="date-label">Data evenimentului</div>
      <div class="date-value">${fmtDate(d.eventDate)}</div>
    </div>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:50px">#</th>
        <th>Descriere</th>
        <th style="width:80px;text-align:right">Cantitate</th>
        <th style="width:110px;text-align:right">Preț (${d.currency})</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>${escHTML(d.description)}</td>
        <td style="text-align:right">1</td>
        <td>${fmt(d.amount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${fmt(d.amount)} ${d.currency}</span>
      </div>
      <div class="totals-row">
        <span>TVA</span>
        <span>0.00 ${d.currency}</span>
      </div>
      <div class="totals-row total">
        <span>Total de plată</span>
        <span>${fmt(d.amount)} ${d.currency}</span>
      </div>
    </div>
  </div>

  <div class="footer">
    ${d.issuerIBAN ? `<div>
      <div class="footer-label">Cont bancar (IBAN)</div>
      <div class="footer-value">${escHTML(d.issuerIBAN)}</div>
    </div>` : "<div></div>"}
    <div>
      <div class="footer-label">Modalitate de plată</div>
      <div class="footer-value">Transfer bancar</div>
    </div>
    <div class="vat-notice">Neplătitor de TVA conform art. 310 din Codul Fiscal.</div>
  </div>

</div>
</body>
</html>`;
}

function escXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
