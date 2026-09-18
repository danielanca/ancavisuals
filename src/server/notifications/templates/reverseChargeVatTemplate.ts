interface ReverseChargeExpenseLine {
  date: string;
  supplier: string;
  amountRon: number;
}

interface SkippedExpenseLine {
  date: string;
  supplier: string;
  amount: number;
  currency: string;
}

interface ReverseChargeVatEmailOptions {
  periodLabel: string;
  deadlineLabel: string;
  taxableBaseRon: number;
  vatRate: number;
  vatAmountRon: number;
  lines: ReverseChargeExpenseLine[];
  skippedLines?: SkippedExpenseLine[];
}

function fmtRon(amount: number): string {
  return new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + " RON";
}

export function buildReverseChargeVatSubject({ periodLabel, deadlineLabel }: ReverseChargeVatEmailOptions): string {
  return `Decont special TVA (D301) pentru ${periodLabel} — termen ${deadlineLabel}`;
}

export function buildReverseChargeVatHtml({ periodLabel, deadlineLabel, taxableBaseRon, vatRate, vatAmountRon, lines, skippedLines = [] }: ReverseChargeVatEmailOptions): string {
  const rows = lines.map((line) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;color:#444">${line.date}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;color:#444">${line.supplier}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;color:#111;text-align:right">${fmtRon(line.amountRon)}</td>
    </tr>
  `).join("");

  const skippedBlock = skippedLines.length > 0 ? `
    <div style="background:#fff3cd;border-left:4px solid #e0a800;border-radius:4px;padding:12px 14px;margin-bottom:16px">
      <p style="margin:0 0 6px;color:#7a5c00;font-size:13px;font-weight:700">⚠️ ${skippedLines.length} cheltuial${skippedLines.length === 1 ? "ă" : "i"} nu ${skippedLines.length === 1 ? "a putut fi convertită" : "au putut fi convertite"} automat — verifică manual și adaugă-${skippedLines.length === 1 ? "o" : "le"} la bază:</p>
      ${skippedLines.map((s) => `<p style="margin:0;color:#7a5c00;font-size:12px">${s.date} · ${s.supplier} · ${s.amount} ${s.currency}</p>`).join("")}
    </div>
  ` : "";

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f9f9f9;border-radius:8px">
      <h2 style="margin:0 0 12px;color:#111">Ai de depus Decontul special de TVA (formular 301)</h2>
      <p style="margin:0 0 16px;color:#444">
        Pentru achizițiile de servicii din străinătate primite în <strong>${periodLabel}</strong> (Google, OpenAI, Bunny, Thomann etc.),
        ai obligația de autotaxare (taxare inversă) prin Decontul special de TVA — termen limită
        <strong style="color:#e04444">${deadlineLabel}</strong>.
      </p>

      <div style="background:#fff;border-left:4px solid #f4d067;border-radius:4px;padding:14px 16px;margin-bottom:16px">
        <p style="margin:0 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Bază impozabilă</p>
        <p style="margin:0 0 12px;color:#111;font-size:20px;font-weight:700">${fmtRon(taxableBaseRon)}</p>
        <p style="margin:0 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">TVA estimat (${Math.round(vatRate * 100)}%)</p>
        <p style="margin:0;color:#111;font-size:22px;font-weight:700">${fmtRon(vatAmountRon)}</p>
      </div>

      ${skippedBlock}

      ${lines.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;font-size:11px;color:#888;text-transform:uppercase">Dată</th>
            <th style="text-align:left;padding:6px 8px;font-size:11px;color:#888;text-transform:uppercase">Furnizor</th>
            <th style="text-align:right;padding:6px 8px;font-size:11px;color:#888;text-transform:uppercase">Sumă</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ` : ""}

      <p style="margin:0;color:#888;font-size:11px;font-style:italic;line-height:1.5">
        Estimare orientativă generată automat din cheltuielile înregistrate — cota de TVA și baza impozabilă trebuie confirmate
        cu un contabil înainte de depunere. Suma în EUR e convertită la cursul setat în aplicație, nu neapărat cel BNR de la
        data facturii.
      </p>
    </div>
  `;
}
