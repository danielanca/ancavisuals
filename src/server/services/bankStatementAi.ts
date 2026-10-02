import type Anthropic from "@anthropic-ai/sdk";
import { nullable, requestStructured } from "../lib/claudeStructured";
import type { CsvColumnMapping } from "./bankStatementCsv";

export type AiStatementEntry = {
  date: string;
  direction: "in" | "out";
  amount: number;
  currency: string;
  counterparty: string | null;
  description: string | null;
  originalAmount: number | null;
  originalCurrency: string | null;
};

type AiStatement = {
  statementDate: string | null;
  balances: Array<{ currency: string; openingBalance: number | null; closingBalance: number | null }>;
  entries: AiStatementEntry[];
};

export type BalanceCheck = {
  currency: string;
  openingBalance: number;
  closingBalance: number;
  expectedNet: number;
  extractedNet: number;
  difference: number;
};

export type Reconciliation = {
  /** ok = soldurile se închid; mismatch = lipsesc/sunt în plus tranzacții; unavailable = extrasul nu arată solduri; csv = import direct din fișier */
  status: "ok" | "mismatch" | "unavailable" | "csv";
  checks: BalanceCheck[];
  retried: boolean;
};

const CURRENCY = { type: "string", description: "Cod ISO cu 3 litere: RON, EUR, USD, GBP... („LEI” = RON)" };

const STATEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["statementDate", "balances", "entries"],
  properties: {
    statementDate: nullable({ type: "string", format: "date" }),
    balances: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["currency", "openingBalance", "closingBalance"],
        properties: {
          currency: CURRENCY,
          openingBalance: nullable({ type: "number" }),
          closingBalance: nullable({ type: "number" }),
        },
      },
    },
    entries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "direction", "amount", "currency", "counterparty", "description", "originalAmount", "originalCurrency"],
        properties: {
          date: { type: "string", format: "date" },
          direction: { type: "string", enum: ["in", "out"] },
          amount: { type: "number" },
          currency: CURRENCY,
          counterparty: nullable({ type: "string" }),
          description: nullable({ type: "string" }),
          originalAmount: nullable({ type: "number" }),
          originalCurrency: nullable(CURRENCY),
        },
      },
    },
  },
} as const satisfies Record<string, unknown>;

const STATEMENT_PROMPT = `Analizezi un extras de cont bancar din România. Extrage TOATE tranzacțiile din document, de pe toate paginile.

Reguli:
1. Extrage fiecare tranzacție, nu un eșantion. Ignoră rândurile de sold (inițial/final/zilnic), subtotalurile și antetele.
2. direction: "in" pentru încasări (credit), "out" pentru plăți (debit). amount este mereu pozitiv.
3. currency = moneda contului în care s-a înregistrat suma. Dacă tranzacția a fost făcută în altă monedă (ex. plată cu cardul în USD dintr-un cont în RON), pune suma și moneda originală în originalAmount/originalCurrency; altfel null.
4. Comisioanele bancare apar ca tranzacții "out" separate, dacă extrasul le listează separat.
5. Datele sunt în format românesc ZI.LUNĂ.AN — convertește-le în YYYY-MM-DD.
6. balances: pentru fiecare monedă/cont din extras, soldul inițial și soldul final al perioadei, exact cum apar în document (null dacă nu apar).
7. statementDate = data de sfârșit a perioadei extrasului.
8. Nu inventa. Dacă lipsesc detalii, pune null.`;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Verifică dacă tranzacțiile extrase închid soldul: sold inițial + încasări −
 * plăți = sold final, pe fiecare monedă. Orice diferență înseamnă că AI-ul a
 * omis, dublat sau citit greșit cel puțin o tranzacție.
 */
export function reconcileBalances(
  balances: AiStatement["balances"],
  entries: Array<{ direction: "in" | "out"; amount: number; currency: string }>
): Omit<Reconciliation, "retried"> {
  const checks: BalanceCheck[] = [];
  for (const balance of balances) {
    if (balance.openingBalance == null || balance.closingBalance == null) continue;
    const currency = balance.currency.toUpperCase() === "LEI" ? "RON" : balance.currency.toUpperCase();
    const extractedNet = round2(
      entries
        .filter((entry) => entry.currency === currency)
        .reduce((sum, entry) => sum + (entry.direction === "in" ? entry.amount : -entry.amount), 0)
    );
    const expectedNet = round2(balance.closingBalance - balance.openingBalance);
    checks.push({
      currency,
      openingBalance: balance.openingBalance,
      closingBalance: balance.closingBalance,
      expectedNet,
      extractedNet,
      difference: round2(expectedNet - extractedNet),
    });
  }
  if (!checks.length) return { status: "unavailable", checks };
  return { status: checks.every((check) => Math.abs(check.difference) < 0.02) ? "ok" : "mismatch", checks };
}

function totalDifference(checks: BalanceCheck[]): number {
  return checks.reduce((sum, check) => sum + Math.abs(check.difference), 0);
}

export class StatementExtractionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function extractStatementWithAi(
  client: Anthropic,
  documentBlocks: Anthropic.ContentBlockParam[],
  normalizeEntries: (entries: AiStatementEntry[]) => AiStatementEntry[]
): Promise<{ statementDate: string | null; entries: AiStatementEntry[]; reconciliation: Reconciliation }> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: [...documentBlocks, { type: "text", text: STATEMENT_PROMPT }] },
  ];

  const first = await requestStructured<AiStatement>(client, { messages, schema: STATEMENT_SCHEMA, maxTokens: 64000, effort: "high" });
  if (!first.data) {
    throw new StatementExtractionError(
      first.stopReason === "max_tokens"
        ? "Extrasul are prea multe tranzacții pentru a fi procesat într-un singur pas. Împarte fișierul PDF în două și reîncearcă."
        : "AI nu a reușit să extragă tranzacții din extras.",
      422
    );
  }

  let best = { data: first.data, entries: normalizeEntries(first.data.entries) };
  let reconciliation = reconcileBalances(first.data.balances, best.entries);
  let retried = false;

  if (reconciliation.status === "mismatch") {
    // A doua trecere: îi arătăm exact unde nu se închide soldul și îi cerem să
    // recitească documentul. Păstrăm răspunsul anterior neschimbat în istoric.
    retried = true;
    const feedback = reconciliation.checks
      .filter((check) => Math.abs(check.difference) >= 0.02)
      .map((check) => `${check.currency}: sold final − sold inițial = ${check.expectedNet.toFixed(2)}, dar încasări − plăți extrase = ${check.extractedNet.toFixed(2)} (diferență ${check.difference.toFixed(2)})`)
      .join("\n");
    try {
      const second = await requestStructured<AiStatement>(client, {
        schema: STATEMENT_SCHEMA,
        maxTokens: 64000,
        effort: "high",
        messages: [
          ...messages,
          { role: "assistant", content: first.message.content },
          {
            role: "user",
            content: `Tranzacțiile extrase nu închid soldul:\n${feedback}\n\nRecitește documentul rând cu rând și caută tranzacții omise, dublate, cu sumă citită greșit sau cu sensul (in/out) inversat. Returnează lista COMPLETĂ și corectată de tranzacții, în același format.`,
          },
        ],
      });
      if (second.data) {
        const secondEntries = normalizeEntries(second.data.entries);
        const secondReconciliation = reconcileBalances(second.data.balances, secondEntries);
        if (secondReconciliation.status !== "unavailable" && totalDifference(secondReconciliation.checks) < totalDifference(reconciliation.checks)) {
          best = { data: second.data, entries: secondEntries };
          reconciliation = secondReconciliation;
        }
      }
    } catch (error) {
      console.error("[bank-statements] reconciliation retry failed, keeping first extraction:", error);
    }
  }

  return { statementDate: best.data.statementDate, entries: best.entries, reconciliation: { ...reconciliation, retried } };
}

const CSV_MAPPING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headerRow", "date", "amount", "debit", "credit", "currency", "description", "counterparty", "balance", "state", "fee", "defaultCurrency"],
  properties: {
    headerRow: { type: "integer" },
    date: { type: "integer" },
    amount: nullable({ type: "integer" }),
    debit: nullable({ type: "integer" }),
    credit: nullable({ type: "integer" }),
    currency: nullable({ type: "integer" }),
    description: nullable({ type: "integer" }),
    counterparty: nullable({ type: "integer" }),
    balance: nullable({ type: "integer" }),
    state: nullable({ type: "integer" }),
    fee: nullable({ type: "integer" }),
    defaultCurrency: nullable(CURRENCY),
  },
} as const satisfies Record<string, unknown>;

/**
 * Pentru un CSV cu antet necunoscut: AI-ul spune doar ce coloană e ce (index
 * de la 0). Sumele și datele sunt citite apoi determinist din fișier.
 */
export async function detectCsvMappingWithAi(client: Anthropic, rows: string[][]): Promise<CsvColumnMapping | null> {
  const sample = rows.slice(0, 25).map((row, index) => `${index}: ${JSON.stringify(row)}`).join("\n");
  const result = await requestStructured<CsvColumnMapping>(client, {
    schema: CSV_MAPPING_SCHEMA,
    maxTokens: 8000,
    effort: "medium",
    messages: [
      {
        role: "user",
        content: `Primele rânduri dintr-un export CSV de extras bancar (index rând: valori):\n${sample}\n\nIdentifică rândul de antet (headerRow) și indexul (de la 0) fiecărei coloane. Folosește "amount" dacă există o singură coloană cu sumă cu semn (negativ = plată); folosește "debit" + "credit" dacă plățile și încasările sunt în coloane separate (atunci amount = null). "date" = data tranzacției (preferă data decontării/finalizării dacă există ambele). "state" = coloana de status (finalizat/anulat), dacă există. "fee" = coloană separată de comision, dacă există. defaultCurrency = moneda contului dacă nu există coloană de monedă și se poate deduce din fișier, altfel null. Pune null pentru coloanele care lipsesc.`,
      },
    ],
  });
  const mapping = result.data;
  if (!mapping) return null;
  const width = Math.max(...rows.map((row) => row.length));
  const inRange = (value: number | null) => value == null || (Number.isInteger(value) && value >= 0 && value < width);
  const valid =
    mapping.headerRow >= 0 &&
    mapping.headerRow < rows.length &&
    inRange(mapping.date) &&
    [mapping.amount, mapping.debit, mapping.credit, mapping.currency, mapping.description, mapping.counterparty, mapping.balance, mapping.state, mapping.fee].every(inRange) &&
    (mapping.amount != null || (mapping.debit != null && mapping.credit != null));
  return valid ? mapping : null;
}
