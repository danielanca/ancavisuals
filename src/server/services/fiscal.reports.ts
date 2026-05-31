import puppeteer from "puppeteer";
import type { FiscalSettings } from "./invoice.pdf";

function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtAmt(amount: number): string {
  return new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

const MONTHS_RO = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"];

// ─── Shared HTML chrome ───────────────────────────────────────────────────────

function pageShell(title: string, fiscal: FiscalSettings, year: number, body: string): string {
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; padding: 24px; }
    h1 { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
    h2 { font-size: 12px; font-weight: 600; margin: 16px 0 6px; color: #333; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 14px; }
    .meta { font-size: 10px; color: #555; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #f0f0f0; font-size: 10px; font-weight: 600; padding: 5px 8px; border: 1px solid #ccc; text-align: left; }
    td { padding: 4px 8px; border: 1px solid #ddd; font-size: 10px; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .summary-box { border: 1px solid #ccc; border-radius: 4px; padding: 10px 14px; margin-bottom: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
    .kv { display: flex; justify-content: space-between; }
    .kv .k { color: #555; }
    .kv .v { font-weight: 600; }
    .green { color: #166534; }
    .red { color: #991b1b; }
    .amber { color: #92400e; }
    .footer { margin-top: 20px; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
    .disclaimer { font-size: 9px; color: #999; margin-top: 8px; font-style: italic; }
  </style>
</head><body>
  <div class="header">
    <div>
      <h1>${esc(title)}</h1>
      <div class="meta">An fiscal: ${year}</div>
    </div>
    <div class="meta" style="text-align:right">
      ${fiscal.ownerName ? `<div><b>${esc(fiscal.ownerName)}</b></div>` : ""}
      ${fiscal.cif ? `<div>CIF: ${esc(fiscal.cif)}</div>` : ""}
      ${fiscal.address ? `<div>${esc(fiscal.address)}</div>` : ""}
      <div>Generat: ${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>
  ${body}
  <div class="footer">AncaVisuals · Document generat automat · Nu înlocuiește consultanța unui expert fiscal autorizat.</div>
</body></html>`;
}

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }, printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FiscalInvoice {
  invoiceNumber: number;
  series: string;
  date: string;
  clientName: string;
  type: string;
  totalAmount: number;
  currency: string;
  notes?: string | null;
}

export interface FiscalExpense {
  date: string;
  category: string;
  supplier?: string | null;
  description?: string | null;
  invoiceNumber?: string | null;
  amount: number;
  currency: string;
  deductibility: number;
  deductibleAmount: number;
}

// ─── Raport fiscal anual ──────────────────────────────────────────────────────

export async function generateFiscalReport(params: {
  year: number;
  invoices: FiscalInvoice[];
  expenses: FiscalExpense[];
  fiscal: FiscalSettings;
  exchangeRate: number;
}): Promise<Buffer> {
  const { year, invoices, expenses, fiscal, exchangeRate } = params;

  const toRON = (amount: number, currency: string) => currency === "EUR" ? amount * exchangeRate : amount;

  const totalIncome = invoices.reduce((s, inv) => s + toRON(inv.totalAmount, inv.currency), 0);
  const totalExpenses = expenses.reduce((s, exp) => s + toRON(exp.amount, exp.currency), 0);
  const totalDeductible = expenses.reduce((s, exp) => s + toRON(exp.deductibleAmount, exp.currency), 0);
  const taxableBase = Math.max(0, totalIncome - totalDeductible);

  // Monthly breakdown
  const monthly: Record<number, { income: number; expenses: number; deductible: number }> = {};
  for (let m = 1; m <= 12; m++) monthly[m] = { income: 0, expenses: 0, deductible: 0 };
  invoices.forEach(inv => { monthly[new Date(inv.date).getMonth() + 1].income += toRON(inv.totalAmount, inv.currency); });
  expenses.forEach(exp => {
    const m = new Date(exp.date).getMonth() + 1;
    monthly[m].expenses += toRON(exp.amount, exp.currency);
    monthly[m].deductible += toRON(exp.deductibleAmount, exp.currency);
  });

  const summaryHtml = `
    <h2>Sumar anual ${year}</h2>
    <div class="summary-box">
      <div class="kv"><span class="k">Total incasări</span><span class="v green">${fmtAmt(totalIncome)} RON</span></div>
      <div class="kv"><span class="k">Total cheltuieli</span><span class="v red">${fmtAmt(totalExpenses)} RON</span></div>
      <div class="kv"><span class="k">Din care deductibile</span><span class="v amber">${fmtAmt(totalDeductible)} RON</span></div>
      <div class="kv"><span class="k">Baza impozabilă estimată</span><span class="v bold">${fmtAmt(taxableBase)} RON</span></div>
      <div class="kv"><span class="k">Nr. facturi emise</span><span class="v">${invoices.length}</span></div>
      <div class="kv"><span class="k">Nr. cheltuieli înregistrate</span><span class="v">${expenses.length}</span></div>
    </div>
    <p class="disclaimer">* Baza impozabilă = incasări − cheltuieli deductibile. Curs EUR/RON folosit: ${exchangeRate} RON. Estimare orientativă — consultați un expert fiscal.</p>`;

  const monthlyRows = Object.entries(monthly)
    .filter(([, d]) => d.income > 0 || d.expenses > 0)
    .map(([m, d]) => `
      <tr>
        <td>${MONTHS_RO[Number(m) - 1]}</td>
        <td class="right green">${d.income > 0 ? fmtAmt(d.income) : "—"}</td>
        <td class="right red">${d.expenses > 0 ? fmtAmt(d.expenses) : "—"}</td>
        <td class="right amber">${d.deductible > 0 ? fmtAmt(d.deductible) : "—"}</td>
        <td class="right">${fmtAmt(d.income - d.expenses)}</td>
      </tr>`).join("");

  const monthlyHtml = `
    <h2>Defalcare lunară (RON)</h2>
    <table>
      <thead><tr><th>Luna</th><th class="right">Incasări</th><th class="right">Cheltuieli</th><th class="right">Deductibil</th><th class="right">Sold</th></tr></thead>
      <tbody>${monthlyRows || "<tr><td colspan='5' style='text-align:center;color:#999'>Fără tranzacții</td></tr>"}</tbody>
    </table>`;

  const invoiceRows = invoices.map(inv => {
    const ref = `${inv.series}-${String(inv.invoiceNumber).padStart(4, "0")}`;
    return `<tr>
      <td>${esc(ref)}</td>
      <td>${fmtDate(inv.date)}</td>
      <td>${esc(inv.clientName)}</td>
      <td>${esc(inv.type)}</td>
      <td class="right bold">${fmtAmt(inv.totalAmount)} ${esc(inv.currency)}</td>
      <td class="right">${toRON(inv.totalAmount, inv.currency) !== inv.totalAmount ? fmtAmt(toRON(inv.totalAmount, inv.currency)) + " RON" : "—"}</td>
    </tr>`;
  }).join("");

  const invoicesHtml = `
    <h2>Facturi emise (${invoices.length})</h2>
    <table>
      <thead><tr><th>Nr. factură</th><th>Dată</th><th>Client</th><th>Tip</th><th class="right">Sumă</th><th class="right">Echiv. RON</th></tr></thead>
      <tbody>${invoiceRows || "<tr><td colspan='6' style='text-align:center;color:#999'>Nicio factură</td></tr>"}</tbody>
    </table>`;

  const expenseRows = expenses.map(exp => `<tr>
    <td>${fmtDate(exp.date)}</td>
    <td>${esc(exp.category)}</td>
    <td>${esc(exp.supplier ?? "—")}</td>
    <td>${esc(exp.invoiceNumber ?? "—")}</td>
    <td class="right">${fmtAmt(exp.amount)} ${esc(exp.currency)}</td>
    <td class="right">${exp.deductibility}%</td>
    <td class="right amber">${fmtAmt(exp.deductibleAmount)} ${esc(exp.currency)}</td>
  </tr>`).join("");

  const expensesHtml = `
    <h2>Cheltuieli înregistrate (${expenses.length})</h2>
    <table>
      <thead><tr><th>Dată</th><th>Categorie</th><th>Furnizor</th><th>Nr. factură</th><th class="right">Sumă</th><th class="right">Ded.</th><th class="right">Sumă ded.</th></tr></thead>
      <tbody>${expenseRows || "<tr><td colspan='7' style='text-align:center;color:#999'>Nicio cheltuială</td></tr>"}</tbody>
    </table>`;

  const html = pageShell(`Raport Fiscal ${year}`, fiscal, year, summaryHtml + monthlyHtml + invoicesHtml + expensesHtml);
  return htmlToPdf(html);
}

// ─── Registru de incasări și plăți ───────────────────────────────────────────

export async function generateRegistru(params: {
  year: number;
  invoices: FiscalInvoice[];
  expenses: FiscalExpense[];
  fiscal: FiscalSettings;
  exchangeRate: number;
}): Promise<Buffer> {
  const { year, invoices, expenses, fiscal, exchangeRate } = params;

  const toRON = (amount: number, currency: string) => currency === "EUR" ? amount * exchangeRate : amount;

  type Entry = { date: string; sortKey: string; doc: string; description: string; incasare: number; plata: number; };

  const entries: Entry[] = [
    ...invoices.map(inv => ({
      date: fmtDate(inv.date),
      sortKey: inv.date,
      doc: `${inv.series}-${String(inv.invoiceNumber).padStart(4, "0")}`,
      description: `Prestări servicii – ${inv.clientName}`,
      incasare: toRON(inv.totalAmount, inv.currency),
      plata: 0,
    })),
    ...expenses.map(exp => ({
      date: fmtDate(exp.date),
      sortKey: exp.date,
      doc: exp.invoiceNumber ?? "—",
      description: [exp.supplier, exp.description, exp.category].filter(Boolean).join(" · "),
      incasare: 0,
      plata: toRON(exp.amount, exp.currency),
    })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  let balance = 0;
  let nrCrt = 0;

  const rows = entries.map(entry => {
    nrCrt++;
    balance += entry.incasare - entry.plata;
    return `<tr>
      <td class="right">${nrCrt}</td>
      <td>${entry.date}</td>
      <td>${esc(entry.doc)}</td>
      <td>${esc(entry.description)}</td>
      <td class="right green">${entry.incasare > 0 ? fmtAmt(entry.incasare) : "—"}</td>
      <td class="right red">${entry.plata > 0 ? fmtAmt(entry.plata) : "—"}</td>
      <td class="right bold ${balance >= 0 ? "green" : "red"}">${fmtAmt(balance)}</td>
    </tr>`;
  }).join("");

  const totalIncasari = entries.reduce((s, e) => s + e.incasare, 0);
  const totalPlati = entries.reduce((s, e) => s + e.plata, 0);

  const totalsRow = `<tr style="background:#f0f0f0;font-weight:700">
    <td colspan="4" class="right">TOTAL</td>
    <td class="right green">${fmtAmt(totalIncasari)}</td>
    <td class="right red">${fmtAmt(totalPlati)}</td>
    <td class="right ${balance >= 0 ? "green" : "red"}">${fmtAmt(balance)}</td>
  </tr>`;

  const body = `
    <p style="margin-bottom:10px;font-size:10px;color:#555">Toate sumele sunt exprimate în RON. Curs EUR/RON: ${exchangeRate}.</p>
    <table>
      <thead>
        <tr>
          <th class="right" style="width:30px">Nr.</th>
          <th style="width:70px">Dată</th>
          <th style="width:90px">Document</th>
          <th>Explicații</th>
          <th class="right" style="width:90px">Incasări (RON)</th>
          <th class="right" style="width:90px">Plăți (RON)</th>
          <th class="right" style="width:90px">Sold (RON)</th>
        </tr>
      </thead>
      <tbody>
        ${rows || "<tr><td colspan='7' style='text-align:center;color:#999'>Fără tranzacții înregistrate</td></tr>"}
        ${totalsRow}
      </tbody>
    </table>`;

  const html = pageShell(`Registru de Incasări și Plăți ${year}`, fiscal, year, body);
  return htmlToPdf(html);
}

// ─── CSV export ───────────────────────────────────────────────────────────────

const SEP = ";";
const BOM = "﻿";

function csvRow(...cells: (string | number | null | undefined)[]): string {
  return cells.map(cell => {
    const value = String(cell ?? "");
    return value.includes(SEP) || value.includes('"') || value.includes("\n")
      ? `"${value.replace(/"/g, '""')}"`
      : value;
  }).join(SEP);
}

export function buildInvoicesCsv(invoices: FiscalInvoice[]): string {
  const header = csvRow("Nr. factură", "Serie", "Dată", "Client", "Tip", "Sumă", "Monedă", "Observații");
  const rows = invoices.map(inv =>
    csvRow(
      `${inv.series}-${String(inv.invoiceNumber).padStart(4, "0")}`,
      inv.series,
      new Date(inv.date).toLocaleDateString("ro-RO"),
      inv.clientName,
      inv.type,
      inv.totalAmount.toFixed(2).replace(".", ","),
      inv.currency,
      inv.notes ?? "",
    )
  );
  return BOM + [header, ...rows].join("\r\n");
}

export function buildExpensesCsv(expenses: FiscalExpense[]): string {
  const header = csvRow("Dată", "Categorie", "Furnizor", "Descriere", "Nr. factură", "Sumă", "Monedă", "Deductibilitate %", "Sumă deductibilă");
  const rows = expenses.map(exp =>
    csvRow(
      new Date(exp.date).toLocaleDateString("ro-RO"),
      exp.category,
      exp.supplier ?? "",
      exp.description ?? "",
      exp.invoiceNumber ?? "",
      exp.amount.toFixed(2).replace(".", ","),
      exp.currency,
      exp.deductibility,
      exp.deductibleAmount.toFixed(2).replace(".", ","),
    )
  );
  return BOM + [header, ...rows].join("\r\n");
}
