import { Router } from "express";
import type { Request, Response } from "express";
import { createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { BUNNY_ACCESS_KEY_HEADER, BUNNY_STORAGE_BASE_URL, getBunnyStorageZone, getBunnyStoragePassword } from "../constants/bunny";

const router = Router();
const COLLECTION = "bankStatements";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

type ExtractedEntry = {
  date: string;
  direction: "in" | "out";
  amount: number;
  currency: "RON" | "EUR";
  counterparty: string | null;
  description: string | null;
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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function safeCurrency(value: unknown): "RON" | "EUR" {
  return String(value ?? "").toUpperCase() === "EUR" ? "EUR" : "RON";
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

type Candidate = { entryIndex: number; id: string; label: string; fileUrl: string | null; score: number };

function invoiceCandidatesForEntry(entryIndex: number, entry: ExtractedEntry, invoices: Array<Record<string, unknown>>): Candidate[] {
  const counterparty = normalizeText(entry.counterparty);
  const description = normalizeText(entry.description);
  const candidates: Candidate[] = [];

  for (const invoice of invoices) {
    const id = String(invoice.id ?? "");

    const totalAmount = Number(invoice.totalAmount ?? 0);
    const currency = safeCurrency(invoice.currency);
    const date = invoice.date instanceof Timestamp ? invoice.date.toDate().toISOString() : String(invoice.date ?? "");
    if (!amountsEqual(entry.amount, totalAmount) || currency !== entry.currency || !date) continue;

    const clientName = String(invoice.clientName ?? "");
    const scoreDate = daysBetween(entry.date, date) <= 7 ? (daysBetween(entry.date, date) <= 2 ? 4 : 2) : 0;
    const scoreText = includesSoft(counterparty, normalizeText(clientName)) || includesSoft(description, normalizeText(clientName)) ? 3 : 0;
    // Suma+moneda identice nu sunt suficiente — fără proximitate de dată SAU
    // asemănare de nume, e prea probabil o coincidență (ex. transfer către un
    // cont/pocket personal cu aceeași sumă ca o factură nelegată).
    if (scoreDate === 0 && scoreText === 0) continue;

    candidates.push({
      entryIndex,
      id,
      label: `Factură ${String(invoice.series ?? "")}-${String(invoice.invoiceNumber ?? "")} · ${clientName || "client necunoscut"}`,
      fileUrl: null,
      score: 5 + scoreDate + scoreText,
    });
  }

  return candidates;
}

function expenseCandidatesForEntry(entryIndex: number, entry: ExtractedEntry, expenses: Array<Record<string, unknown>>): Candidate[] {
  const counterparty = normalizeText(entry.counterparty);
  const description = normalizeText(entry.description);
  const candidates: Candidate[] = [];

  for (const expense of expenses) {
    const id = String(expense.id ?? "");

    const amount = Number(expense.amount ?? 0);
    const currency = safeCurrency(expense.currency);
    const date = expense.date instanceof Timestamp ? expense.date.toDate().toISOString() : String(expense.date ?? "");
    if (!amountsEqual(entry.amount, amount) || currency !== entry.currency || !date) continue;

    const supplier = String(expense.supplier ?? "");
    const expDescription = String(expense.description ?? "");
    const scoreDate = daysBetween(entry.date, date) <= 10 ? (daysBetween(entry.date, date) <= 3 ? 4 : 2) : 0;
    const scoreText =
      includesSoft(counterparty, normalizeText(supplier)) ||
      includesSoft(description, normalizeText(supplier)) ||
      includesSoft(description, normalizeText(expDescription))
        ? 3
        : 0;
    // Suma+moneda identice nu sunt suficiente — fără proximitate de dată SAU
    // asemănare de nume, e prea probabil o coincidență (ex. transfer către un
    // cont/pocket personal cu aceeași sumă ca o cheltuială nelegată).
    if (scoreDate === 0 && scoreText === 0) continue;

    const factura = expense.factura as { url?: string } | null;
    const chitanta = expense.chitanta as { url?: string } | null;
    candidates.push({
      entryIndex,
      id,
      label: `Cheltuială · ${supplier || expDescription || "fără descriere"}`,
      fileUrl: factura?.url ?? chitanta?.url ?? null,
      score: 5 + scoreDate + scoreText,
    });
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
  usedExpenseIds: Set<string>
): Promise<Map<number, ReviewCandidate[]>> {
  const reviewByEntry = new Map<number, ReviewCandidate[]>();

  type Pending = {
    entryIndex: number;
    entry: MatchableEntry;
    direction: "in" | "out";
    candidates: Array<{ id: string; label: string; date: string }>;
  };
  const pending: Pending[] = [];

  entries.forEach((entry, entryIndex) => {
    if (entry.dismissed) return;

    if (entry.direction === "in" && !assignedInvoices.has(entryIndex)) {
      const candidates = invoices
        .filter((inv) => !usedInvoiceIds.has(String(inv.id)) && amountsEqual(entry.amount, Number(inv.totalAmount ?? 0)) && safeCurrency(inv.currency) === entry.currency)
        .map((inv) => ({
          id: String(inv.id),
          label: String(inv.clientName ?? "") || "client necunoscut",
          date: inv.date instanceof Timestamp ? inv.date.toDate().toISOString().slice(0, 10) : String(inv.date ?? ""),
        }));
      if (candidates.length) pending.push({ entryIndex, entry, direction: "in", candidates });
    }

    if (entry.direction === "out" && !assignedExpenses.has(entryIndex)) {
      const candidates = expenses
        .filter((exp) => !usedExpenseIds.has(String(exp.id)) && amountsEqual(entry.amount, Number(exp.amount ?? 0)) && safeCurrency(exp.currency) === entry.currency)
        .map((exp) => ({
          id: String(exp.id),
          label: String(exp.supplier ?? exp.description ?? "") || "furnizor necunoscut",
          date: exp.date instanceof Timestamp ? exp.date.toDate().toISOString().slice(0, 10) : String(exp.date ?? ""),
        }));
      if (candidates.length) pending.push({ entryIndex, entry, direction: "out", candidates });
    }
  });

  if (!pending.length) return reviewByEntry;

  const payload = pending.map((p) => ({
    entryIndex: p.entryIndex,
    tranzactie: { data: p.entry.date, suma: p.entry.amount, moneda: p.entry.currency, parte: p.entry.counterparty, descriere: p.entry.description },
    candidati: p.candidates,
  }));

  let decisions: Array<{ entryIndex: number; decision: "match" | "no_match" | "uncertain"; candidateId?: string | null }> = [];
  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Ești un contabil care reconciliază un extras de cont cu registrul de facturi/cheltuieli al firmei. Pentru fiecare caz de mai jos, suma și moneda tranzacției sunt DEJA identice cu fiecare candidat listat — decizia ta se bazează exclusiv pe cât de plauzibil e că "parte"/"descriere" din tranzacție și candidatul reprezintă aceeași operațiune reală.

Reguli:
- Tolerează diferențe mici de scriere (diacritice, erori OCR, formă juridică lipsă/prezentă — ex. "SRL").
- O dată contabilă diferită de data plății (până la câteva săptămâni) e normală pentru facturi/abonamente și NU exclude o potrivire, dacă numele se potrivesc rezonabil.
- NU asocia doar pentru că suma coincide dacă numele/descrierea sunt complet diferite sau lipsesc (ex. un transfer personal generic cu o sumă rotundă nu e automat o factură reală) — în acel caz răspunde "no_match".
- Dacă nu ești sigur, răspunde "uncertain" — un om va decide manual. Nu ghici.

Cazuri: ${JSON.stringify(payload)}

Răspunde DOAR cu JSON valid, fără explicații: {"decisions": [{"entryIndex": number, "decision": "match" | "no_match" | "uncertain", "candidateId": string sau null}]}`,
        },
      ],
    });
    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as { decisions?: typeof decisions }) : {};
    decisions = parsed.decisions ?? [];
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
          const factura = expense?.factura as { url?: string } | null;
          const chitanta = expense?.chitanta as { url?: string } | null;
          assignedExpenses.set(p.entryIndex, { entryIndex: p.entryIndex, id: candidate.id, label: `Cheltuială · ${candidate.label}`, fileUrl: factura?.url ?? chitanta?.url ?? null, score: Infinity });
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

async function matchStatementEntries(entries: MatchableEntry[], year: number, excludeStatementId?: string): Promise<StoredEntry[]> {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);
  const db = firestore();
  const [invoicesSnapshot, expensesSnapshot] = await Promise.all([
    db.collection("invoices")
      .where("date", ">=", Timestamp.fromDate(startDate))
      .where("date", "<", Timestamp.fromDate(endDate))
      .get(),
    db.collection("expenses")
      .where("date", ">=", Timestamp.fromDate(startDate))
      .where("date", "<", Timestamp.fromDate(endDate))
      .get(),
  ]);

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
      if (!invoice) return;
      const totalAmount = Number(invoice.totalAmount ?? 0);
      const currency = safeCurrency(invoice.currency);
      if (!amountsEqual(entry.amount, totalAmount) || currency !== entry.currency) return;
      const clientName = String(invoice.clientName ?? "");
      keptInvoiceMatches.set(entryIndex, {
        entryIndex,
        id: entry.matchedId,
        label: `Factură ${String(invoice.series ?? "")}-${String(invoice.invoiceNumber ?? "")} · ${clientName || "client necunoscut"}`,
        fileUrl: null,
        score: Infinity,
      });
      usedInvoiceIds.add(entry.matchedId);
    }

    if (entry.direction === "out" && entry.matchedType === "expense" && entry.matchedId) {
      const expense = expenses.find((exp) => String(exp.id) === entry.matchedId);
      if (!expense) return;
      const amount = Number(expense.amount ?? 0);
      const currency = safeCurrency(expense.currency);
      if (!amountsEqual(entry.amount, amount) || currency !== entry.currency) return;
      const supplier = String(expense.supplier ?? "");
      const expDescription = String(expense.description ?? "");
      const factura = expense.factura as { url?: string } | null;
      const chitanta = expense.chitanta as { url?: string } | null;
      keptExpenseMatches.set(entryIndex, {
        entryIndex,
        id: entry.matchedId,
        label: `Cheltuială · ${supplier || expDescription || "fără descriere"}`,
        fileUrl: factura?.url ?? chitanta?.url ?? null,
        score: Infinity,
      });
      usedExpenseIds.add(entry.matchedId);
    }
  });

  const invoiceCandidates = entries.flatMap((entry, entryIndex) =>
    entry.direction === "in" && !keptInvoiceMatches.has(entryIndex) ? invoiceCandidatesForEntry(entryIndex, entry, invoices) : []
  );
  const expenseCandidates = entries.flatMap((entry, entryIndex) =>
    entry.direction === "out" && !keptExpenseMatches.has(entryIndex) ? expenseCandidatesForEntry(entryIndex, entry, expenses) : []
  );

  const assignedInvoices = assignBestCandidates(invoiceCandidates, usedInvoiceIds);
  const assignedExpenses = assignBestCandidates(expenseCandidates, usedExpenseIds);
  for (const [entryIndex, candidate] of keptInvoiceMatches) assignedInvoices.set(entryIndex, candidate);
  for (const [entryIndex, candidate] of keptExpenseMatches) assignedExpenses.set(entryIndex, candidate);

  const reviewByEntry = await resolveAmbiguousMatches(entries, invoices, expenses, assignedInvoices, assignedExpenses, usedInvoiceIds, usedExpenseIds);

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

router.post("/upload-analyze", requireFirebaseAuth, requireSupremeAdmin, upload.single("file"), async (req: Request, res: Response) => {
  const file = req.file;
  const { year, account: rawAccount } = req.body as { year?: string; account?: string };
  const account = String(rawAccount ?? "").trim() || DEFAULT_ACCOUNT;

  if (!file) {
    res.status(400).json({ error: "Fișier lipsă." });
    return;
  }

  const mediaType = file.mimetype || "application/octet-stream";
  const isImage = mediaType.startsWith("image/");
  const isPdf = mediaType === "application/pdf";
  if (!isImage && !isPdf) {
    res.status(400).json({ error: "Sunt acceptate doar imagini sau PDF." });
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

    const uploaded = await uploadStatementFile(file, year);
    const contentBlock = isImage
      ? ({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: file.buffer.toString("base64"),
          },
        } as const)
      : ({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: file.buffer.toString("base64"),
          },
        } as const);

    const message = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: `Analizezi un extras de cont bancar din România. Extrage TOATE tranzacțiile lizibile din document.

Returnează DOAR JSON valid, fără explicații:
{
  "statementDate": "YYYY-MM-DD sau prima zi din lună dacă nu este clară",
  "entries": [
    {
      "date": "YYYY-MM-DD",
      "direction": "in" sau "out",
      "amount": 123.45,
      "currency": "RON" sau "EUR",
      "counterparty": "numele persoanei/firmei dacă apare, altfel null",
      "description": "descrierea tranzacției dacă apare, altfel null"
    }
  ]
}

Reguli:
1. Extrage toate entry-urile, nu doar un eșantion.
2. Pentru încasări folosește "in", pentru plăți folosește "out".
3. Nu inventa. Dacă lipsesc detalii, pune null.
4. Dacă documentul are mai multe pagini, combină toate entry-urile într-o singură listă.
5. Păstrează sumele cu 2 zecimale.
6. Ignoră soldurile zilnice/intermediare și antetele; extrage doar tranzacțiile reale.`,
            },
          ],
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";

    if (message.stop_reason === "max_tokens") {
      res.status(422).json({
        error: "Extrasul are prea multe tranzacții pentru a fi procesat într-un singur pas. Împarte fișierul PDF în două și reîncearcă.",
      });
      return;
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed: { statementDate?: unknown; entries?: unknown[] };
    try {
      parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as { statementDate?: unknown; entries?: unknown[] }) : {};
    } catch (parseError) {
      console.error("[bank-statements] JSON parse failed:", parseError, raw.slice(0, 500));
      res.status(422).json({ error: "AI a răspuns cu JSON invalid. Reîncearcă, sau împarte extrasul în fișiere mai mici." });
      return;
    }

    const extractedEntries: ExtractedEntry[] = Array.isArray(parsed.entries)
      ? parsed.entries
          .map((entry) => {
            const date = safeDate((entry as Record<string, unknown>).date);
            const direction = safeDirection((entry as Record<string, unknown>).direction);
            const amount = safeAmount((entry as Record<string, unknown>).amount);
            if (!date || !direction || amount == null) return null;
            return {
              date,
              direction,
              amount,
              currency: safeCurrency((entry as Record<string, unknown>).currency),
              counterparty: safeOptionalText((entry as Record<string, unknown>).counterparty),
              description: safeOptionalText((entry as Record<string, unknown>).description),
            };
          })
          .filter((entry): entry is ExtractedEntry => Boolean(entry))
      : [];

    if (!Array.isArray(parsed.entries)) {
      res.status(422).json({ error: "AI nu a reușit să extragă tranzacții din extras." });
      return;
    }

    const inferredYear = Number(year) || new Date().getFullYear();
    const entries: StoredEntry[] = await matchStatementEntries(extractedEntries, inferredYear);

    const statementDate = safeDate(parsed.statementDate) ?? `${inferredYear}-01-01`;
    const unmatchedCount = entries.filter((entry) => entry.justificationStatus === "unmatched").length;
    const reviewCount = entries.filter((entry) => entry.justificationStatus === "review").length;
    const docRef = await db.collection(COLLECTION).add({
      statementDate: Timestamp.fromDate(new Date(statementDate)),
      year: Number(statementDate.slice(0, 4)),
      account,
      file: uploaded,
      fileHash,
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
        entries,
        unmatchedCount,
        reviewCount,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
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

    let label: string;
    let fileUrl: string | null;
    if (type === "invoice") {
      const clientName = String(target.clientName ?? "");
      label = `Factură ${String(target.series ?? "")}-${String(target.invoiceNumber ?? "")} · ${clientName || "client necunoscut"}`;
      fileUrl = null;
    } else {
      const supplier = String(target.supplier ?? "");
      const expDescription = String(target.description ?? "");
      const factura = target.factura as { url?: string } | null;
      const chitanta = target.chitanta as { url?: string } | null;
      label = `Cheltuială · ${supplier || expDescription || "fără descriere"}`;
      fileUrl = factura?.url ?? chitanta?.url ?? null;
    }

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

    res.json({
      statement: {
        id: doc.id,
        statementDate: (data.statementDate as Timestamp).toDate().toISOString(),
        year: Number(data.year) || new Date().getFullYear(),
        account: (data.account as string | undefined) || DEFAULT_ACCOUNT,
        file: data.file,
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
