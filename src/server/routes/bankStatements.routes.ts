import { Router } from "express";
import type { Request, Response } from "express";
import { createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { BUNNY_ACCESS_KEY_HEADER, BUNNY_STORAGE_BASE_URL, getBunnyStorageZone, getBunnyStoragePassword } from "../constants/bunny";
import { requestStructured } from "../lib/claudeStructured";
import { isSupportedImageUpload, prepareImageBlocks } from "../lib/visionImage";
import { getBnrYearRates } from "../services/bnrExchangeRate.service";
import { StatementExtractionError, detectCsvMappingWithAi, extractStatementWithAi, type AiStatementEntry, type Reconciliation } from "../services/bankStatementAi";
import { decodeCsvBuffer, detectCsvMapping, parseCsvRows, rowsToEntries } from "../services/bankStatementCsv";

const router = Router();
const COLLECTION = "bankStatements";
// Legături învățate din potrivirile manuale: „PETROM 1234 BUC” din extras = furnizorul „OMV Petrom”.
const ALIASES_COLLECTION = "bankCounterpartyAliases";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

type ExtractedEntry = {
  date: string;
  direction: "in" | "out";
  amount: number;
  currency: string;
  counterparty: string | null;
  description: string | null;
  // Suma/moneda originală pentru plăți cu cardul în altă monedă decât a contului.
  originalAmount?: number | null;
  originalCurrency?: string | null;
};

type ReviewCandidate = { type: "invoice" | "expense"; id: string; label: string; date: string };

type StoredEntry = ExtractedEntry & {
  justificationStatus: "matched" | "unmatched" | "review";
  matchedType: "invoice" | "expense" | null;
  matchedId: string | null;
  matchedLabel: string | null;
  matchedFileUrl: string | null;
  reviewCandidates?: ReviewCandidate[] | null;
  // Utilizatorul a confirmat manual că tranzacția asta nu corespunde niciunui
  // document (ex. transfer personal) — nu o mai propunem din nou spre
  // verificare la re-verificări viitoare.
  dismissed?: boolean;
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Plățile cu cardul includ des numărul magazinului/terminalului („PETROM 1234”,
// „LIDL 0567”) — fără cifre, același comerciant are aceeași cheie.
function counterpartyKey(value: unknown): string {
  return normalizeText(value).replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
}

function includesSoft(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  return haystack.includes(needle) || needle.includes(haystack);
}

function safeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function safeDirection(value: unknown): "in" | "out" | null {
  return value === "in" || value === "out" ? value : null;
}

// Moneda din extras se păstrează așa cum e (RON/EUR/USD/GBP...). Înainte orice
// altceva decât EUR devenea RON, iar o plată de 20 USD apărea ca 20 RON.
function normalizeCurrency(value: unknown, fallback = "RON"): string {
  const text = String(value ?? "").trim().toUpperCase();
  if (text === "LEI" || text === "RON") return "RON";
  return /^[A-Z]{3}$/.test(text) ? text : fallback;
}

function safeAmount(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function safeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function daysBetween(first: string, second: string): number {
  const a = new Date(first).getTime();
  const b = new Date(second).getTime();
  return Math.abs(a - b) / 86400000;
}

function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

function docDate(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : String(value ?? "");
}

type FxRates = (date: string, currency: string) => number | null;

// Cursuri BNR pentru anul extrasului (RON pentru 1 EUR/USD). Dacă BNR nu
// răspunde, potrivirea merge mai departe doar pe sume exacte.
async function loadFxRates(year: number): Promise<FxRates> {
  const tables: Record<string, Record<string, number>> = {};
  await Promise.all(
    (["EUR", "USD"] as const).map(async (currency) => {
      try {
        const [previous, current] = await Promise.all([getBnrYearRates(year - 1, currency).catch(() => ({})), getBnrYearRates(year, currency)]);
        tables[currency] = { ...previous, ...current };
      } catch (error) {
        console.warn(`[bank-statements] BNR ${currency} rates unavailable, FX matching disabled for it:`, error);
      }
    })
  );
  return (date, currency) => {
    if (currency === "RON") return 1;
    const table = tables[currency];
    if (!table) return null;
    const cursor = new Date(`${date.slice(0, 10)}T00:00:00Z`);
    for (let i = 0; i < 10; i++) {
      const rate = table[cursor.toISOString().slice(0, 10)];
      if (rate) return rate;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return null;
  };
}

type Money = { amount: number; currency: string };

// Toleranța pentru plăți în altă monedă: diferența de curs bancă vs BNR +
// comisionul de conversie (Revolut/carduri: de obicei sub 2-3%).
const FX_TOLERANCE = 0.03;

/**
 * "exact" = aceeași sumă în aceeași monedă (inclusiv suma originală a unei
 * plăți în valută sau suma originală USD a unei cheltuieli salvate în RON);
 * "fx" = monede diferite, dar sumele convertite la cursul BNR din ziua
 * tranzacției sunt la cel mult 3% una de alta.
 */
function amountMatch(entry: ExtractedEntry, documentAmounts: Money[], fx: FxRates): "exact" | "fx" | null {
  const entryAmounts: Money[] = [{ amount: entry.amount, currency: entry.currency }];
  if (entry.originalAmount && entry.originalCurrency) entryAmounts.push({ amount: entry.originalAmount, currency: normalizeCurrency(entry.originalCurrency) });

  for (const a of entryAmounts) {
    for (const b of documentAmounts) {
      if (a.currency === b.currency && amountsEqual(a.amount, b.amount)) return "exact";
    }
  }

  const entryRate = fx(entry.date, entry.currency);
  if (entryRate == null) return null;
  const entryRon = entry.amount * entryRate;
  for (const b of documentAmounts) {
    if (b.currency === entry.currency) continue;
    const rate = fx(entry.date, b.currency);
    if (rate == null || b.amount <= 0) continue;
    const documentRon = b.amount * rate;
    if (Math.abs(entryRon - documentRon) / documentRon <= FX_TOLERANCE) return "fx";
  }
  return null;
}

function invoiceAmounts(invoice: Record<string, unknown>): Money[] {
  return [{ amount: Number(invoice.totalAmount ?? 0), currency: normalizeCurrency(invoice.currency) }];
}

function expenseAmounts(expense: Record<string, unknown>): Money[] {
  const amounts: Money[] = [{ amount: Number(expense.amount ?? 0), currency: normalizeCurrency(expense.currency) }];
  const originalAmount = Number(expense.originalAmount ?? 0);
  if (originalAmount > 0 && expense.originalCurrency) amounts.push({ amount: originalAmount, currency: normalizeCurrency(expense.originalCurrency) });
  return amounts;
}

type Aliases = Map<string, Set<string>>; // `${type}:${counterpartyKey}` -> chei normalizate de furnizor/client

async function loadAliases(): Promise<Aliases> {
  const aliases: Aliases = new Map();
  try {
    const snapshot = await firestore().collection(ALIASES_COLLECTION).get();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const key = `${String(data.type)}:${String(data.counterpartyKey)}`;
      if (!aliases.has(key)) aliases.set(key, new Set());
      aliases.get(key)!.add(String(data.targetKey));
    }
  } catch (error) {
    console.warn("[bank-statements] could not load counterparty aliases:", error);
  }
  return aliases;
}

function aliasHit(aliases: Aliases, type: "invoice" | "expense", entry: ExtractedEntry, targetName: string): boolean {
  const target = normalizeText(targetName);
  if (!target) return false;
  for (const source of [entry.counterparty, entry.description]) {
    const key = counterpartyKey(source);
    if (key && aliases.get(`${type}:${key}`)?.has(target)) return true;
  }
  return false;
}

type MatchContext = { fx: FxRates; aliases: Aliases };

type Candidate = { entryIndex: number; id: string; label: string; fileUrl: string | null; score: number };

function invoiceLabel(invoice: Record<string, unknown>): string {
  const clientName = String(invoice.clientName ?? "");
  return `Factură ${String(invoice.series ?? "")}-${String(invoice.invoiceNumber ?? "")} · ${clientName || "client necunoscut"}`;
}

function expenseLabel(expense: Record<string, unknown>): string {
  return `Cheltuială · ${String(expense.supplier ?? "") || String(expense.description ?? "") || "fără descriere"}`;
}

function expenseFileUrl(expense: Record<string, unknown> | undefined): string | null {
  const factura = expense?.factura as { url?: string } | null;
  const chitanta = expense?.chitanta as { url?: string } | null;
  return factura?.url ?? chitanta?.url ?? null;
}

function invoiceCandidatesForEntry(entryIndex: number, entry: ExtractedEntry, invoices: Array<Record<string, unknown>>, context: MatchContext): Candidate[] {
  const counterparty = normalizeText(entry.counterparty);
  const description = normalizeText(entry.description);
  const candidates: Candidate[] = [];

  for (const invoice of invoices) {
    const id = String(invoice.id ?? "");
    const date = docDate(invoice.date);
    const match = date ? amountMatch(entry, invoiceAmounts(invoice), context.fx) : null;
    if (!match) continue;

    const clientName = String(invoice.clientName ?? "");
    const scoreDate = daysBetween(entry.date, date) <= 7 ? (daysBetween(entry.date, date) <= 2 ? 4 : 2) : 0;
    const scoreText = aliasHit(context.aliases, "invoice", entry, clientName)
      ? 4
      : includesSoft(counterparty, normalizeText(clientName)) || includesSoft(description, normalizeText(clientName)) ? 3 : 0;
    // Suma+moneda identice nu sunt suficiente — fără proximitate de dată SAU
    // asemănare de nume, e prea probabil o coincidență (ex. transfer către un
    // cont/pocket personal cu aceeași sumă ca o factură nelegată). La sume
    // apropiate doar prin conversie valutară cerem obligatoriu și numele.
    if (scoreDate === 0 && scoreText === 0) continue;
    if (match === "fx" && scoreText === 0) continue;

    candidates.push({ entryIndex, id, label: invoiceLabel(invoice), fileUrl: null, score: (match === "exact" ? 5 : 3) + scoreDate + scoreText });
  }

  return candidates;
}

function expenseCandidatesForEntry(entryIndex: number, entry: ExtractedEntry, expenses: Array<Record<string, unknown>>, context: MatchContext): Candidate[] {
  const counterparty = normalizeText(entry.counterparty);
  const description = normalizeText(entry.description);
  const candidates: Candidate[] = [];

  for (const expense of expenses) {
    const id = String(expense.id ?? "");
    const date = docDate(expense.date);
    const match = date ? amountMatch(entry, expenseAmounts(expense), context.fx) : null;
    if (!match) continue;

    const supplier = String(expense.supplier ?? "");
    const expDescription = String(expense.description ?? "");
    const scoreDate = daysBetween(entry.date, date) <= 10 ? (daysBetween(entry.date, date) <= 3 ? 4 : 2) : 0;
    const scoreText = aliasHit(context.aliases, "expense", entry, supplier)
      ? 4
      : includesSoft(counterparty, normalizeText(supplier)) ||
        includesSoft(description, normalizeText(supplier)) ||
        includesSoft(description, normalizeText(expDescription))
        ? 3
        : 0;
    // Suma+moneda identice nu sunt suficiente — fără proximitate de dată SAU
    // asemănare de nume, e prea probabil o coincidență (ex. transfer către un
    // cont/pocket personal cu aceeași sumă ca o cheltuială nelegată).
    if (scoreDate === 0 && scoreText === 0) continue;
    if (match === "fx" && scoreText === 0) continue;

    candidates.push({ entryIndex, id, label: expenseLabel(expense), fileUrl: expenseFileUrl(expense), score: (match === "exact" ? 5 : 3) + scoreDate + scoreText });
  }

  return candidates;
}

// Alocă fiecare candidat (tranzacție ↔ factură/cheltuială) global, în ordinea
// scorului descrescător, nu în ordinea cronologică a tranzacțiilor. Altfel o
// potrivire slabă (ex. sumă identică dar dată/nume nepotrivite) găsită pe o
// tranzacție mai veche "fură" documentul de la tranzacția reală, mai
// potrivită, care apare mai târziu în extras.
function assignBestCandidates(candidates: Candidate[], alreadyUsedIds: Set<string>): Map<number, Candidate> {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const claimedIds = new Set(alreadyUsedIds);
  const assignedByEntry = new Map<number, Candidate>();

  for (const candidate of sorted) {
    if (assignedByEntry.has(candidate.entryIndex)) continue; // tranzacția are deja o potrivire mai bună
    if (claimedIds.has(candidate.id)) continue; // documentul e deja alocat unei potriviri mai bune
    assignedByEntry.set(candidate.entryIndex, candidate);
    claimedIds.add(candidate.id);
  }

  return assignedByEntry;
}

type MatchableEntry = ExtractedEntry & { matchedType?: "invoice" | "expense" | null; matchedId?: string | null; dismissed?: boolean };

// Pentru tranzacțiile rămase nepotrivite după euristica de scor, dar pentru
// care există totuși document(e) cu exact aceeași sumă+monedă, îl întrebăm pe
// Claude să decidă — el poate ține cont de nume scrise diferit (erori OCR,
// diacritice, forme juridice) și de faptul că o factură/abonament poate avea o
// dată contabilă diferită de data plății din extras. Dacă nici Claude nu e
// sigur (sau apelul eșuează), cazul ajunge la "review" pentru alegere manuală
// — nu forțăm o potrivire greșită doar ca să bifăm o tranzacție.
async function resolveAmbiguousMatches(
  entries: MatchableEntry[],
  invoices: Array<Record<string, unknown>>,
  expenses: Array<Record<string, unknown>>,
  assignedInvoices: Map<number, Candidate>,
  assignedExpenses: Map<number, Candidate>,
  usedInvoiceIds: Set<string>,
  usedExpenseIds: Set<string>,
  context: MatchContext
): Promise<Map<number, ReviewCandidate[]>> {
  const reviewByEntry = new Map<number, ReviewCandidate[]>();

  type Pending = {
    entryIndex: number;
    entry: MatchableEntry;
    direction: "in" | "out";
    candidates: Array<{ id: string; label: string; date: string; amount: string }>;
  };
  const pending: Pending[] = [];

  entries.forEach((entry, entryIndex) => {
    if (entry.dismissed) return;

    if (entry.direction === "in" && !assignedInvoices.has(entryIndex)) {
      const candidates = invoices
        .filter((inv) => !usedInvoiceIds.has(String(inv.id)) && amountMatch(entry, invoiceAmounts(inv), context.fx) === "exact")
        .map((inv) => ({
          id: String(inv.id),
          label: String(inv.clientName ?? "") || "client necunoscut",
          date: docDate(inv.date).slice(0, 10),
          amount: `${Number(inv.totalAmount ?? 0).toFixed(2)} ${normalizeCurrency(inv.currency)}`,
        }));
      if (candidates.length) pending.push({ entryIndex, entry, direction: "in", candidates });
    }

    if (entry.direction === "out" && !assignedExpenses.has(entryIndex)) {
      const candidates = expenses
        .filter((exp) => !usedExpenseIds.has(String(exp.id)) && amountMatch(entry, expenseAmounts(exp), context.fx) === "exact")
        .map((exp) => ({
          id: String(exp.id),
          label: String(exp.supplier ?? exp.description ?? "") || "furnizor necunoscut",
          date: docDate(exp.date).slice(0, 10),
          amount: expenseAmounts(exp).map((m) => `${m.amount.toFixed(2)} ${m.currency}`).join(" / "),
        }));
      if (candidates.length) pending.push({ entryIndex, entry, direction: "out", candidates });
    }
  });

  if (!pending.length) return reviewByEntry;

  const payload = pending.map((p) => ({
    entryIndex: p.entryIndex,
    tranzactie: {
      data: p.entry.date,
      suma: p.entry.amount,
      moneda: p.entry.currency,
      sumaOriginala: p.entry.originalAmount && p.entry.originalCurrency ? `${p.entry.originalAmount} ${p.entry.originalCurrency}` : null,
      parte: p.entry.counterparty,
      descriere: p.entry.description,
    },
    candidati: p.candidates,
  }));

  let decisions: Array<{ entryIndex: number; decision: "match" | "no_match" | "uncertain"; candidateId: string | null }> = [];
  try {
    const result = await requestStructured<{ decisions: typeof decisions }>(anthropic, {
      schema: MATCH_DECISIONS_SCHEMA,
      maxTokens: 16000,
      effort: "medium",
      messages: [
        {
          role: "user",
          content: `Ești un contabil care reconciliază un extras de cont cu registrul de facturi/cheltuieli al firmei. Pentru fiecare caz de mai jos, suma tranzacției (sau suma ei originală, la plăți în valută) este DEJA identică cu fiecare candidat listat — decizia ta se bazează exclusiv pe cât de plauzibil e că "parte"/"descriere" din tranzacție și candidatul reprezintă aceeași operațiune reală.

Reguli:
- Tolerează diferențe mici de scriere (diacritice, erori OCR, formă juridică lipsă/prezentă — ex. "SRL"), prescurtări de procesator de plăți (ex. "PAYPAL *ADOBE", "SQ *", "GOOGLE*") și numere de magazin/terminal.
- O dată contabilă diferită de data plății (până la câteva săptămâni) e normală pentru facturi/abonamente și NU exclude o potrivire, dacă numele se potrivesc rezonabil.
- NU asocia doar pentru că suma coincide dacă numele/descrierea sunt complet diferite sau lipsesc (ex. un transfer personal generic cu o sumă rotundă nu e automat o factură reală) — în acel caz răspunde "no_match".
- Dacă nu ești sigur, răspunde "uncertain" — un om va decide manual. Nu ghici.
- candidateId e obligatoriu la "match" și null altfel.

Cazuri: ${JSON.stringify(payload)}`,
        },
      ],
    });
    decisions = result.data?.decisions ?? [];
  } catch (error) {
    console.error("[bank-statements] AI match resolution failed, sending cases to manual review:", error);
    decisions = [];
  }

  const decisionByEntry = new Map(decisions.map((d) => [d.entryIndex, d]));

  for (const p of pending) {
    const decision = decisionByEntry.get(p.entryIndex);

    if (decision?.decision === "match" && decision.candidateId) {
      const candidate = p.candidates.find((c) => c.id === decision.candidateId);
      const alreadyClaimed = p.direction === "in" ? usedInvoiceIds.has(decision.candidateId) : usedExpenseIds.has(decision.candidateId);
      if (candidate && !alreadyClaimed) {
        if (p.direction === "in") {
          assignedInvoices.set(p.entryIndex, { entryIndex: p.entryIndex, id: candidate.id, label: `Factură · ${candidate.label}`, fileUrl: null, score: Infinity });
          usedInvoiceIds.add(candidate.id);
        } else {
          const expense = expenses.find((exp) => String(exp.id) === candidate.id);
          assignedExpenses.set(p.entryIndex, { entryIndex: p.entryIndex, id: candidate.id, label: `Cheltuială · ${candidate.label}`, fileUrl: expenseFileUrl(expense), score: Infinity });
          usedExpenseIds.add(candidate.id);
        }
        continue;
      }
    }

    if (decision?.decision === "no_match") continue; // AI e sigur că nu se potrivește nimic — rămâne pur și simplu nejustificată

    // "uncertain", decizie lipsă, sau apelul AI a eșuat — trece la verificare manuală
    reviewByEntry.set(
      p.entryIndex,
      p.candidates.map((c) => ({ type: p.direction === "in" ? "invoice" : "expense", id: c.id, label: c.label, date: c.date }))
    );
  }

  return reviewByEntry;
}

const MATCH_DECISIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["decisions"],
  properties: {
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["entryIndex", "decision", "candidateId"],
        properties: {
          entryIndex: { type: "integer" },
          decision: { type: "string", enum: ["match", "no_match", "uncertain"] },
          candidateId: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
      },
    },
  },
} as const;

async function matchStatementEntries(entries: MatchableEntry[], year: number, excludeStatementId?: string): Promise<StoredEntry[]> {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);
  const db = firestore();
  const [invoicesSnapshot, expensesSnapshot, fx, aliases] = await Promise.all([
    db.collection("invoices")
      .where("date", ">=", Timestamp.fromDate(startDate))
      .where("date", "<", Timestamp.fromDate(endDate))
      .get(),
    db.collection("expenses")
      .where("date", ">=", Timestamp.fromDate(startDate))
      .where("date", "<", Timestamp.fromDate(endDate))
      .get(),
    loadFxRates(year),
    loadAliases(),
  ]);
  const context: MatchContext = { fx, aliases };

  const invoices: Array<Record<string, unknown>> = invoicesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const expenses: Array<Record<string, unknown>> = expensesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // O factură/cheltuială deja folosită ca justificare pentru o altă tranzacție
  // (din acest extras sau din altul) nu mai poate justifica și una nouă — altfel
  // o singură achiziție ar putea "acoperi" mai multe mișcări bancare coincidente
  // ca sumă (ex. două plăți de 50 RON către același furnizor).
  const otherStatementsSnapshot = await db.collection(COLLECTION).where("year", "==", year).get();
  const usedInvoiceIds = new Set<string>();
  const usedExpenseIds = new Set<string>();
  for (const doc of otherStatementsSnapshot.docs) {
    if (doc.id === excludeStatementId) continue;
    const existingEntries = (doc.data().entries as StoredEntry[]) ?? [];
    for (const existing of existingEntries) {
      if (existing.matchedType === "invoice" && existing.matchedId) usedInvoiceIds.add(existing.matchedId);
      if (existing.matchedType === "expense" && existing.matchedId) usedExpenseIds.add(existing.matchedId);
    }
  }

  // Un link deja confirmat (tranzacția era deja "matched" pe un document care
  // încă există și a cărui sumă/monedă tot corespund) e păstrat ca atare, chiar
  // dacă documentul a fost editat între timp (ex. data contabilă a unei
  // cheltuieli mutată pe perioada facturată, nu pe data plății). Altfel o
  // simplă re-verificare ar putea rupe o justificare deja bună doar pentru că
  // scorul de potrivire nu mai cade exact în fereastra de dată/text.
  const keptInvoiceMatches = new Map<number, Candidate>();
  const keptExpenseMatches = new Map<number, Candidate>();

  entries.forEach((entry, entryIndex) => {
    if (entry.direction === "in" && entry.matchedType === "invoice" && entry.matchedId) {
      const invoice = invoices.find((inv) => String(inv.id) === entry.matchedId);
      if (!invoice || !amountMatch(entry, invoiceAmounts(invoice), fx)) return;
      keptInvoiceMatches.set(entryIndex, { entryIndex, id: entry.matchedId, label: invoiceLabel(invoice), fileUrl: null, score: Infinity });
      usedInvoiceIds.add(entry.matchedId);
    }

    if (entry.direction === "out" && entry.matchedType === "expense" && entry.matchedId) {
      const expense = expenses.find((exp) => String(exp.id) === entry.matchedId);
      if (!expense || !amountMatch(entry, expenseAmounts(expense), fx)) return;
      keptExpenseMatches.set(entryIndex, { entryIndex, id: entry.matchedId, label: expenseLabel(expense), fileUrl: expenseFileUrl(expense), score: Infinity });
      usedExpenseIds.add(entry.matchedId);
    }
  });

  const invoiceCandidates = entries.flatMap((entry, entryIndex) =>
    entry.direction === "in" && !keptInvoiceMatches.has(entryIndex) ? invoiceCandidatesForEntry(entryIndex, entry, invoices, context) : []
  );
  const expenseCandidates = entries.flatMap((entry, entryIndex) =>
    entry.direction === "out" && !keptExpenseMatches.has(entryIndex) ? expenseCandidatesForEntry(entryIndex, entry, expenses, context) : []
  );

  const assignedInvoices = assignBestCandidates(invoiceCandidates, usedInvoiceIds);
  const assignedExpenses = assignBestCandidates(expenseCandidates, usedExpenseIds);
  for (const [entryIndex, candidate] of keptInvoiceMatches) assignedInvoices.set(entryIndex, candidate);
  for (const [entryIndex, candidate] of keptExpenseMatches) assignedExpenses.set(entryIndex, candidate);
  for (const candidate of assignedInvoices.values()) usedInvoiceIds.add(candidate.id);
  for (const candidate of assignedExpenses.values()) usedExpenseIds.add(candidate.id);

  const reviewByEntry = await resolveAmbiguousMatches(entries, invoices, expenses, assignedInvoices, assignedExpenses, usedInvoiceIds, usedExpenseIds, context);

  return entries.map((entry, entryIndex) => {
    const match = entry.direction === "in" ? assignedInvoices.get(entryIndex) : assignedExpenses.get(entryIndex);
    if (match) {
      return {
        ...entry,
        justificationStatus: "matched",
        matchedType: entry.direction === "in" ? "invoice" : "expense",
        matchedId: match.id,
        matchedLabel: match.label,
        matchedFileUrl: match.fileUrl,
        reviewCandidates: null,
      };
    }

    const review = !entry.dismissed ? reviewByEntry.get(entryIndex) : undefined;
    return {
      ...entry,
      justificationStatus: review && review.length ? "review" : "unmatched",
      matchedType: null,
      matchedId: null,
      matchedLabel: null,
      matchedFileUrl: null,
      reviewCandidates: review && review.length ? review : null,
    };
  });
}

async function uploadStatementFile(file: Express.Multer.File, year: string | undefined) {
  const safeFileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const folder = year ? `bank-statements/${year}` : "bank-statements";
  const storageZone = getBunnyStorageZone();
  const password = getBunnyStoragePassword();
  const uploadUrl = `${BUNNY_STORAGE_BASE_URL}/${storageZone}/${folder}/${safeFileName}`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { [BUNNY_ACCESS_KEY_HEADER]: password, "Content-Type": "application/octet-stream" },
    body: file.buffer,
  });

  if (!response.ok) {
    throw new Error(`Bunny upload failed: ${response.status}`);
  }

  const cdnDomain = process.env.BUNNY_CDN_DOMAIN ?? "";
  return { url: `${cdnDomain}/${folder}/${safeFileName}`, name: file.originalname, mediaType: file.mimetype || "application/octet-stream" };
}

const DEFAULT_ACCOUNT = "Cont principal";

router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { year, account } = req.query as { year?: string; account?: string };
    const selectedYear = year ? Number(year) : null;
    const snapshot = await db.collection(COLLECTION).orderBy("statementDate", "desc").get();
    const allStatements = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        account: (data.account as string | undefined) || DEFAULT_ACCOUNT,
        statementDate: (data.statementDate as Timestamp).toDate().toISOString(),
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      };
    });

    const accounts = [...new Set(allStatements.map((statement) => statement.account))].sort();
    const statements = allStatements.filter((statement) =>
      (selectedYear == null || Number((statement as Record<string, unknown>).year) === selectedYear) &&
      (!account || statement.account === account)
    );

    res.json({ statements, accounts });
  } catch (error) {
    console.error("[bank-statements] GET / failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

function isCsvUpload(file: Express.Multer.File): boolean {
  return /\.csv$/i.test(file.originalname) || /text\/csv|application\/vnd\.ms-excel|text\/plain/.test(file.mimetype);
}

type AnalyzedStatement = {
  source: "csv" | "ai";
  statementDate: string | null;
  entries: ExtractedEntry[];
  reconciliation: Reconciliation;
  skippedRows?: number;
};

async function analyzeCsvStatement(file: Express.Multer.File): Promise<AnalyzedStatement> {
  const rows = parseCsvRows(decodeCsvBuffer(file.buffer));
  if (rows.length < 2) throw new StatementExtractionError("Fișierul CSV e gol.", 422);

  const mapping = detectCsvMapping(rows) ?? (await detectCsvMappingWithAi(anthropic, rows));
  if (!mapping) throw new StatementExtractionError("Nu am recunoscut coloanele din CSV (dată / sumă). Exportă extrasul în format CSV standard sau încarcă PDF-ul.", 422);

  const { entries, skipped } = rowsToEntries(rows, mapping);
  if (!entries.length) throw new StatementExtractionError("CSV-ul nu conține tranzacții finalizate.", 422);

  const sortedDates = entries.map((entry) => entry.date).sort();
  return {
    source: "csv",
    statementDate: sortedDates[sortedDates.length - 1],
    entries: entries.map(({ balanceAfter: _balanceAfter, ...entry }) => ({ ...entry, originalAmount: null, originalCurrency: null })),
    reconciliation: { status: "csv", checks: [], retried: false },
    skippedRows: skipped,
  };
}

function normalizeAiEntries(entries: AiStatementEntry[]): AiStatementEntry[] {
  return entries
    .map((entry) => {
      const date = safeDate(entry.date);
      const direction = safeDirection(entry.direction);
      const amount = safeAmount(entry.amount);
      if (!date || !direction || amount == null) return null;
      const originalAmount = safeAmount(entry.originalAmount);
      const currency = normalizeCurrency(entry.currency);
      const originalCurrency = originalAmount != null && entry.originalCurrency ? normalizeCurrency(entry.originalCurrency) : null;
      return {
        date,
        direction,
        amount,
        currency,
        counterparty: safeOptionalText(entry.counterparty),
        description: safeOptionalText(entry.description),
        originalAmount: originalCurrency && originalCurrency !== currency ? originalAmount : null,
        originalCurrency: originalCurrency && originalCurrency !== currency ? originalCurrency : null,
      };
    })
    .filter((entry): entry is AiStatementEntry => Boolean(entry));
}

async function analyzeDocumentStatement(file: Express.Multer.File, isPdf: boolean): Promise<AnalyzedStatement> {
  const documentBlocks: Anthropic.ContentBlockParam[] = isPdf
    ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.buffer.toString("base64") } }]
    : await prepareImageBlocks(file.buffer, file.mimetype || "");
  const result = await extractStatementWithAi(anthropic, documentBlocks, normalizeAiEntries);
  return { source: "ai", statementDate: safeDate(result.statementDate), entries: result.entries, reconciliation: result.reconciliation };
}

router.post("/upload-analyze", requireFirebaseAuth, requireSupremeAdmin, upload.single("file"), async (req: Request, res: Response) => {
  const file = req.file;
  const { year, account: rawAccount } = req.body as { year?: string; account?: string };
  const account = String(rawAccount ?? "").trim() || DEFAULT_ACCOUNT;

  if (!file) {
    res.status(400).json({ error: "Fișier lipsă." });
    return;
  }

  const mediaType = file.mimetype || "application/octet-stream";
  const isPdf = mediaType === "application/pdf" || file.buffer.subarray(0, 4).toString("latin1") === "%PDF";
  const isCsv = !isPdf && isCsvUpload(file);
  const isImage = !isPdf && !isCsv && isSupportedImageUpload(file.buffer, mediaType);
  if (!isImage && !isPdf && !isCsv) {
    res.status(400).json({ error: "Sunt acceptate doar CSV, PDF sau imagini." });
    return;
  }

  try {
    const fileHash = createHash("sha256").update(new Uint8Array(file.buffer)).digest("hex");
    const db = firestore();
    const duplicate = await db.collection(COLLECTION).where("fileHash", "==", fileHash).limit(1).get();
    if (!duplicate.empty) {
      const existing = duplicate.docs[0];
      const existingData = existing.data();
      res.status(409).json({
        error: "Acest extras a fost deja încărcat.",
        existingStatement: {
          id: existing.id,
          statementDate: (existingData.statementDate as Timestamp).toDate().toISOString(),
          fileName: existingData.file?.name ?? null,
        },
      });
      return;
    }

    const analyzed = isCsv ? await analyzeCsvStatement(file) : await analyzeDocumentStatement(file, isPdf);
    const uploaded = await uploadStatementFile(file, year);

    const inferredYear = Number(year) || new Date().getFullYear();
    const entries: StoredEntry[] = await matchStatementEntries(analyzed.entries, inferredYear);

    const statementDate = analyzed.statementDate ?? `${inferredYear}-01-01`;
    const unmatchedCount = entries.filter((entry) => entry.justificationStatus === "unmatched").length;
    const reviewCount = entries.filter((entry) => entry.justificationStatus === "review").length;
    const docRef = await db.collection(COLLECTION).add({
      statementDate: Timestamp.fromDate(new Date(statementDate)),
      year: Number(statementDate.slice(0, 4)),
      account,
      file: uploaded,
      fileHash,
      source: analyzed.source,
      reconciliation: analyzed.reconciliation,
      entries,
      unmatchedCount,
      reviewCount,
      createdAt: Timestamp.now(),
    });

    res.status(201).json({
      statement: {
        id: docRef.id,
        statementDate: new Date(statementDate).toISOString(),
        year: Number(statementDate.slice(0, 4)),
        account,
        file: uploaded,
        source: analyzed.source,
        reconciliation: analyzed.reconciliation,
        entries,
        unmatchedCount,
        reviewCount,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof StatementExtractionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("[bank-statements] POST /upload-analyze failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /:id/rematch — re-run matching against current invoices/expenses, no AI re-analysis
router.post("/:id/rematch", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Extras negăsit." }); return; }

    const data = doc.data()!;
    const year = Number(data.year) || new Date().getFullYear();
    const rawEntries = (data.entries as StoredEntry[]) ?? [];
    const entries = await matchStatementEntries(rawEntries, year, req.params.id);
    const unmatchedCount = entries.filter((entry) => entry.justificationStatus === "unmatched").length;
    const reviewCount = entries.filter((entry) => entry.justificationStatus === "review").length;

    await db.collection(COLLECTION).doc(req.params.id).update({ entries, unmatchedCount, reviewCount });

    res.json({
      statement: {
        id: doc.id,
        statementDate: (data.statementDate as Timestamp).toDate().toISOString(),
        year,
        account: (data.account as string | undefined) || DEFAULT_ACCOUNT,
        file: data.file,
        source: data.source ?? "ai",
        reconciliation: data.reconciliation ?? null,
        entries,
        unmatchedCount,
        reviewCount,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      },
    });
  } catch (error) {
    console.error("[bank-statements] POST /:id/rematch failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Ține minte că numele din extras corespunde acestui furnizor/client, ca la
// următoarele extrase potrivirea să se facă automat (vezi aliasHit).
async function rememberCounterpartyAlias(type: "invoice" | "expense", entry: ExtractedEntry, targetName: string) {
  const targetKey = normalizeText(targetName);
  const source = entry.counterparty ?? entry.description;
  const key = counterpartyKey(source);
  if (!targetKey || !key) return;
  try {
    const docId = createHash("sha1").update(`${type}:${key}:${targetKey}`).digest("hex");
    await firestore().collection(ALIASES_COLLECTION).doc(docId).set({
      type,
      counterpartyKey: key,
      counterpartyRaw: source,
      targetKey,
      targetName,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.warn("[bank-statements] could not save counterparty alias:", error);
  }
}

// POST /:id/entries/:entryIndex/link — leagă manual o tranzacție de o factură/cheltuială aleasă de utilizator
router.post("/:id/entries/:entryIndex/link", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const entryIndex = Number(req.params.entryIndex);
    const { type, targetId } = req.body as { type?: "invoice" | "expense"; targetId?: string };

    if (!Number.isInteger(entryIndex) || entryIndex < 0 || (type !== "invoice" && type !== "expense") || !targetId) {
      res.status(400).json({ error: "Date invalide pentru legare." });
      return;
    }

    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Extras negăsit." }); return; }

    const data = doc.data()!;
    const entries = (data.entries as StoredEntry[]) ?? [];
    const entry = entries[entryIndex];
    if (!entry) { res.status(404).json({ error: "Tranzacție negăsită." }); return; }
    if ((entry.direction === "in" && type !== "invoice") || (entry.direction === "out" && type !== "expense")) {
      res.status(400).json({ error: "Tipul de document nu corespunde sensului tranzacției." });
      return;
    }

    const targetDoc = await db.collection(type === "invoice" ? "invoices" : "expenses").doc(targetId).get();
    if (!targetDoc.exists) { res.status(404).json({ error: "Documentul ales nu mai există." }); return; }
    const target = targetDoc.data()!;

    const label = type === "invoice" ? invoiceLabel(target) : expenseLabel(target);
    const fileUrl = type === "invoice" ? null : expenseFileUrl(target);

    entries[entryIndex] = {
      ...entry,
      justificationStatus: "matched",
      matchedType: type,
      matchedId: targetId,
      matchedLabel: label,
      matchedFileUrl: fileUrl,
      reviewCandidates: null,
      dismissed: false,
    };

    const unmatchedCount = entries.filter((e) => e.justificationStatus === "unmatched").length;
    const reviewCount = entries.filter((e) => e.justificationStatus === "review").length;
    await db.collection(COLLECTION).doc(req.params.id).update({ entries, unmatchedCount, reviewCount });
    await rememberCounterpartyAlias(type, entry, type === "invoice" ? String(target.clientName ?? "") : String(target.supplier ?? ""));

    res.json({
      statement: {
        id: doc.id,
        statementDate: (data.statementDate as Timestamp).toDate().toISOString(),
        year: Number(data.year) || new Date().getFullYear(),
        account: (data.account as string | undefined) || DEFAULT_ACCOUNT,
        file: data.file,
        source: data.source ?? "ai",
        reconciliation: data.reconciliation ?? null,
        entries,
        unmatchedCount,
        reviewCount,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      },
    });
  } catch (error) {
    console.error("[bank-statements] POST /:id/entries/:entryIndex/link failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /:id/entries/:entryIndex/dismiss — confirmă manual că tranzacția nu corespunde niciunui document (ex. transfer personal)
router.post("/:id/entries/:entryIndex/dismiss", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const entryIndex = Number(req.params.entryIndex);
    if (!Number.isInteger(entryIndex) || entryIndex < 0) {
      res.status(400).json({ error: "Index invalid." });
      return;
    }

    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Extras negăsit." }); return; }

    const data = doc.data()!;
    const entries = (data.entries as StoredEntry[]) ?? [];
    const entry = entries[entryIndex];
    if (!entry) { res.status(404).json({ error: "Tranzacție negăsită." }); return; }

    entries[entryIndex] = {
      ...entry,
      justificationStatus: "unmatched",
      matchedType: null,
      matchedId: null,
      matchedLabel: null,
      matchedFileUrl: null,
      reviewCandidates: null,
      dismissed: true,
    };

    const unmatchedCount = entries.filter((e) => e.justificationStatus === "unmatched").length;
    const reviewCount = entries.filter((e) => e.justificationStatus === "review").length;
    await db.collection(COLLECTION).doc(req.params.id).update({ entries, unmatchedCount, reviewCount });

    res.json({
      statement: {
        id: doc.id,
        statementDate: (data.statementDate as Timestamp).toDate().toISOString(),
        year: Number(data.year) || new Date().getFullYear(),
        account: (data.account as string | undefined) || DEFAULT_ACCOUNT,
        file: data.file,
        source: data.source ?? "ai",
        reconciliation: data.reconciliation ?? null,
        entries,
        unmatchedCount,
        reviewCount,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      },
    });
  } catch (error) {
    console.error("[bank-statements] POST /:id/entries/:entryIndex/dismiss failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

router.delete("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[bank-statements] DELETE /:id failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /rename-account — renames an account label across every statement that has it
router.patch("/rename-account", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { oldName, newName } = req.body as { oldName?: string; newName?: string };
    if (!oldName?.trim() || !newName?.trim()) { res.status(400).json({ error: "Nume cont lipsă." }); return; }

    const db = firestore();
    const snapshot = await db.collection(COLLECTION).where("account", "==", oldName.trim()).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.update(doc.ref, { account: newName.trim() }));
    await batch.commit();

    res.json({ ok: true, updated: snapshot.size });
  } catch (error) {
    console.error("[bank-statements] PATCH /rename-account failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
