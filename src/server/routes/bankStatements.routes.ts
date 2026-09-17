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

type StoredEntry = ExtractedEntry & {
  justificationStatus: "matched" | "unmatched";
  matchedType: "invoice" | "expense" | null;
  matchedId: string | null;
  matchedLabel: string | null;
  matchedFileUrl: string | null;
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

function pickBestInvoice(entry: ExtractedEntry, invoices: Array<Record<string, unknown>>, usedIds: Set<string>) {
  const counterparty = normalizeText(entry.counterparty);
  const description = normalizeText(entry.description);
  let best: { id: string; label: string; fileUrl: string | null; score: number } | null = null;

  for (const invoice of invoices) {
    const id = String(invoice.id ?? "");
    if (usedIds.has(id)) continue; // deja folosită ca justificare pentru altă tranzacție

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
    const score = 5 + scoreDate + scoreText;

    if (!best || score > best.score) {
      best = {
        id,
        label: `Factură ${String(invoice.series ?? "")}-${String(invoice.invoiceNumber ?? "")} · ${clientName || "client necunoscut"}`,
        fileUrl: null,
        score,
      };
    }
  }

  return best;
}

function pickBestExpense(entry: ExtractedEntry, expenses: Array<Record<string, unknown>>, usedIds: Set<string>) {
  const counterparty = normalizeText(entry.counterparty);
  const description = normalizeText(entry.description);
  let best: { id: string; label: string; fileUrl: string | null; score: number } | null = null;

  for (const expense of expenses) {
    const id = String(expense.id ?? "");
    if (usedIds.has(id)) continue; // deja folosită ca justificare pentru altă tranzacție

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
    const score = 5 + scoreDate + scoreText;

    if (!best || score > best.score) {
      const factura = expense.factura as { url?: string } | null;
      const chitanta = expense.chitanta as { url?: string } | null;
      best = {
        id,
        label: `Cheltuială · ${supplier || expDescription || "fără descriere"}`,
        fileUrl: factura?.url ?? chitanta?.url ?? null,
        score,
      };
    }
  }

  return best;
}

async function matchStatementEntries(entries: ExtractedEntry[], year: number, excludeStatementId?: string): Promise<StoredEntry[]> {
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

  const invoices = invoicesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const expenses = expensesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

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

  return entries.map((entry) => {
    if (entry.direction === "in") {
      const match = pickBestInvoice(entry, invoices, usedInvoiceIds);
      if (match) usedInvoiceIds.add(match.id);
      return {
        ...entry,
        justificationStatus: match ? "matched" : "unmatched",
        matchedType: match ? "invoice" : null,
        matchedId: match?.id ?? null,
        matchedLabel: match?.label ?? null,
        matchedFileUrl: match?.fileUrl ?? null,
      };
    }

    const match = pickBestExpense(entry, expenses, usedExpenseIds);
    if (match) usedExpenseIds.add(match.id);
    return {
      ...entry,
      justificationStatus: match ? "matched" : "unmatched",
      matchedType: match ? "expense" : null,
      matchedId: match?.id ?? null,
      matchedLabel: match?.label ?? null,
      matchedFileUrl: match?.fileUrl ?? null,
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
    const docRef = await db.collection(COLLECTION).add({
      statementDate: Timestamp.fromDate(new Date(statementDate)),
      year: Number(statementDate.slice(0, 4)),
      account,
      file: uploaded,
      fileHash,
      entries,
      unmatchedCount: entries.filter((entry) => entry.justificationStatus === "unmatched").length,
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
        unmatchedCount: entries.filter((entry) => entry.justificationStatus === "unmatched").length,
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

    await db.collection(COLLECTION).doc(req.params.id).update({ entries, unmatchedCount });

    res.json({
      statement: {
        id: doc.id,
        statementDate: (data.statementDate as Timestamp).toDate().toISOString(),
        year,
        account: (data.account as string | undefined) || DEFAULT_ACCOUNT,
        file: data.file,
        entries,
        unmatchedCount,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      },
    });
  } catch (error) {
    console.error("[bank-statements] POST /:id/rematch failed:", error);
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
