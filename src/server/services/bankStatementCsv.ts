/*
 * Import determinist pentru extrasele exportate ca CSV (Revolut, BT, ING etc.).
 * Sumele și datele se citesc direct din fișier — AI-ul e folosit cel mult ca să
 * recunoască ce coloană e ce, atunci când antetul nu e unul cunoscut.
 */

export type CsvColumnMapping = {
  headerRow: number;
  date: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  currency: number | null;
  description: number | null;
  counterparty: number | null;
  balance: number | null;
  state: number | null;
  fee: number | null;
  /** Monedă implicită când fișierul nu are coloană de monedă. */
  defaultCurrency: string | null;
};

export type CsvEntry = {
  date: string;
  direction: "in" | "out";
  amount: number;
  currency: string;
  counterparty: string | null;
  description: string | null;
  balanceAfter: number | null;
};

export function decodeCsvBuffer(buffer: Buffer): string {
  // Exporturile mai vechi ale băncilor românești vin uneori în Windows-1250 /
  // UTF-16. Dacă textul UTF-8 are caractere de înlocuire, încercăm latin1.
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString("utf16le");
  const utf8 = buffer.toString("utf8").replace(/^\uFEFF/, "");
  return utf8.includes("�") ? buffer.toString("latin1") : utf8;
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 20).join("\n");
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = sample.split(candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsvRows(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row.map((value) => value.trim()));
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row.map((value) => value.trim()));
  return rows;
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HEADER_SYNONYMS: Record<Exclude<keyof CsvColumnMapping, "headerRow" | "defaultCurrency">, RegExp[]> = {
  date: [/^completed date$/, /^date completed/, /^data (tranzactie|tranzactiei|operatiunii|operatiune)$/, /^data$/, /^date$/, /^started date$/, /^date started/, /^data inregistrare$/, /^booking date$/],
  amount: [/^amount$/, /^suma$/, /^valoare$/, /^total amount$/, /^suma tranzactie$/],
  debit: [/^debit$/, /^debit .*$/, /^plati$/, /^iesiri$/, /^suma debit$/],
  credit: [/^credit$/, /^credit .*$/, /^incasari$/, /^intrari$/, /^suma credit$/],
  currency: [/^currency$/, /^moneda$/, /^valuta$/, /^payment currency$/],
  description: [/^description$/, /^descriere$/, /^detalii( tranzactie)?$/, /^explicatii$/, /^reference$/, /^referinta$/, /^tranzactie$/],
  counterparty: [/^payer$/, /^beneficiar( ordonator)?$/, /^ordonator( beneficiar)?$/, /^counterparty$/, /^nume (beneficiar|platitor)$/, /^partener$/],
  balance: [/^balance$/, /^sold$/, /^sold final$/, /^sold dupa tranzactie$/],
  state: [/^state$/, /^status$/, /^stare$/],
  fee: [/^fee$/, /^comision$/],
};

/** Mapare euristică după numele coloanelor; null dacă antetul nu e recunoscut. */
export function detectCsvMapping(rows: string[][]): CsvColumnMapping | null {
  for (let headerRow = 0; headerRow < Math.min(rows.length, 30); headerRow++) {
    const headers = rows[headerRow].map(normalizeHeader);
    const find = (key: keyof typeof HEADER_SYNONYMS): number | null => {
      for (const pattern of HEADER_SYNONYMS[key]) {
        const index = headers.findIndex((header) => pattern.test(header));
        if (index >= 0) return index;
      }
      return null;
    };
    const date = find("date");
    const amount = find("amount");
    const debit = find("debit");
    const credit = find("credit");
    if (date == null || (amount == null && (debit == null || credit == null))) continue;
    return {
      headerRow,
      date,
      amount: debit != null && credit != null ? null : amount,
      debit,
      credit,
      currency: find("currency"),
      description: find("description"),
      counterparty: find("counterparty"),
      balance: find("balance"),
      state: find("state"),
      fee: find("fee"),
      defaultCurrency: null,
    };
  }
  return null;
}

/** Acceptă atât 1,234.56 cât și 1.234,56 / -12,50 / (12.50) / "12.50 RON". */
export function parseCsvAmount(value: string | undefined): number | null {
  if (!value) return null;
  let text = value.replace(/[^\d.,()+-]/g, "");
  if (!text || !/\d/.test(text)) return null;
  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  text = text.replace(/^\+/, "");
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) {
    // virgula e separatorul zecimal dacă are 1-2 cifre după ea
    text = /,\d{1,2}$/.test(text) ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else {
    text = text.replace(/,/g, "");
  }
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return Math.round((negative ? -number : number) * 100) / 100;
}

const MONTHS_RO: Record<string, number> = {
  ian: 1, jan: 1, feb: 2, mar: 3, apr: 4, mai: 5, may: 5, iun: 6, jun: 6, iul: 7, jul: 7,
  aug: 8, sep: 9, oct: 10, noi: 11, nov: 11, dec: 12,
};

export function parseCsvDate(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  const pad = (n: number) => String(n).padStart(2, "0");
  const build = (y: number, m: number, d: number) => {
    if (y < 100) y += 2000;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
  };
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return build(Number(match[1]), Number(match[2]), Number(match[3]));
  // În România formatul cu zi-lună-an e standard (inclusiv BT/ING), nu cel american.
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (match) return build(Number(match[3]), Number(match[2]), Number(match[1]));
  match = text.match(/^(\d{1,2})[\s-]([a-zA-Z]{3})[a-zA-Z]*[\s-](\d{2,4})/);
  if (match && MONTHS_RO[match[2].toLowerCase()]) return build(Number(match[3]), MONTHS_RO[match[2].toLowerCase()], Number(match[1]));
  return null;
}

function normalizeCurrencyCode(value: string | undefined | null): string | null {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return null;
  if (text === "LEI" || text === "RON" || text === "ROL") return "RON";
  return /^[A-Z]{3}$/.test(text) ? text : null;
}

const SKIPPED_STATES = /revert|declin|fail|cancel|anulat|respins|pending|in asteptare/i;

export function rowsToEntries(rows: string[][], mapping: CsvColumnMapping): { entries: CsvEntry[]; skipped: number } {
  const entries: CsvEntry[] = [];
  let skipped = 0;
  const cell = (row: string[], index: number | null) => (index == null ? undefined : row[index]);

  for (const row of rows.slice(mapping.headerRow + 1)) {
    const date = parseCsvDate(cell(row, mapping.date));
    if (!date) {
      skipped++;
      continue;
    }
    if (mapping.state != null && SKIPPED_STATES.test(cell(row, mapping.state) ?? "")) {
      skipped++;
      continue;
    }

    let signed: number | null = null;
    if (mapping.debit != null && mapping.credit != null) {
      const debit = Math.abs(parseCsvAmount(cell(row, mapping.debit)) ?? 0);
      const credit = Math.abs(parseCsvAmount(cell(row, mapping.credit)) ?? 0);
      signed = credit - debit;
    } else {
      signed = parseCsvAmount(cell(row, mapping.amount));
    }
    if (signed == null || signed === 0) {
      skipped++;
      continue;
    }

    const currency = normalizeCurrencyCode(cell(row, mapping.currency)) ?? normalizeCurrencyCode(mapping.defaultCurrency) ?? "RON";
    const description = cell(row, mapping.description) || null;
    const counterparty = cell(row, mapping.counterparty) || null;
    entries.push({
      date,
      direction: signed > 0 ? "in" : "out",
      amount: Math.abs(signed),
      currency,
      counterparty,
      description,
      balanceAfter: parseCsvAmount(cell(row, mapping.balance)),
    });

    // Revolut pune comisionul într-o coloană separată, nu ca rând propriu.
    const fee = Math.abs(parseCsvAmount(cell(row, mapping.fee)) ?? 0);
    if (fee > 0) {
      entries.push({
        date,
        direction: "out",
        amount: fee,
        currency,
        counterparty: counterparty,
        description: `Comision${description ? ` · ${description}` : ""}`,
        balanceAfter: null,
      });
    }
  }

  return { entries, skipped };
}
