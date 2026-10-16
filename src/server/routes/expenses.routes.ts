import { createAnthropicClient } from "../lib/anthropicClient";
import { Router } from "express";
import type { Request, Response } from "express";
import { createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import type Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { BUNNY_ACCESS_KEY_HEADER, BUNNY_STORAGE_BASE_URL, getBunnyStorageZone, getBunnyStoragePassword } from "../constants/bunny";
import { requestStructured } from "../lib/claudeStructured";
import { isSupportedImageUpload, prepareImageBlocks } from "../lib/visionImage";
import { findExpenseDuplicate, normalizeCif, type ExpenseDuplicateMatch, type ExpenseIdentity } from "../../shared/finance/expenseDuplicates";
import { RECEIPT_SCHEMA, buildReceiptPrompt, validateScannedReceipt, type ScannedReceipt } from "../services/receiptScan";

const router = Router();
const COLLECTION = "expenses";
const anthropic = createAnthropicClient("Scanare bonuri și facturi", { apiKey: process.env.ANTHROPIC_API_KEY });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

type StoredExpense = ExpenseIdentity & { id: string };

function toDateValue(value: unknown): Date | string | null {
  if (value && typeof (value as Timestamp).toDate === "function") return (value as Timestamp).toDate();
  return (value as Date | string | null | undefined) ?? null;
}

function comparableValue(value: unknown): unknown {
  const date = toDateValue(value);
  return date instanceof Date ? date.getTime() : value ?? null;
}

function toStoredExpense(doc: FirebaseFirestore.QueryDocumentSnapshot): StoredExpense {
  const data = doc.data();
  return { id: doc.id, date: toDateValue(data.date), supplier: data.supplier ?? null, supplierCif: data.supplierCif ?? null, invoiceNumber: data.invoiceNumber ?? null, amount: data.amount ?? null, currency: data.currency ?? null };
}

// Răspunsul 409 pentru duplicat: „certain” blochează mereu, „probable” doar
// până când adminul confirmă explicit (confirmPossibleDuplicate).
function duplicateResponse(match: ExpenseDuplicateMatch<StoredExpense>, invoiceNumber: unknown) {
  if (match.level === "certain") {
    return { error: "DUPLICATE_INVOICE_NUMBER", existingId: match.expense.id, level: match.level, message: `Factura "${String(invoiceNumber ?? "")}" este deja înregistrată în registru.` };
  }
  return { error: "POSSIBLE_DUPLICATE", existingId: match.expense.id, level: match.level, message: "Există deja o cheltuială de la același furnizor, cu aceeași sumă și dată apropiată." };
}

// POST /upload-doc — upload a receipt/invoice file to Bunny CDN
router.post("/upload-doc", requireFirebaseAuth, requireSupremeAdmin, upload.single("file"), async (req: Request, res: Response) => {
  const file = req.file;
  const { year, month } = req.body as { year?: string; month?: string };

  if (!file) {
    res.status(400).json({ error: "Fișier lipsă." });
    return;
  }

  const fileHash = createHash("sha256").update(new Uint8Array(file.buffer)).digest("hex");

  const safeFileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const folder = year && month ? `expenses/${year}/${month}` : "expenses";
  const storageZone = getBunnyStorageZone();
  const password = getBunnyStoragePassword();
  const uploadUrl = `${BUNNY_STORAGE_BASE_URL}/${storageZone}/${folder}/${safeFileName}`;

  try {
    const db = firestore();
    const [facturaSnap, chitantaSnap] = await Promise.all([
      db.collection(COLLECTION).where("factura.hash", "==", fileHash).limit(1).get(),
      db.collection(COLLECTION).where("chitanta.hash", "==", fileHash).limit(1).get(),
    ]);
    const existingDoc = facturaSnap.docs[0] ?? chitantaSnap.docs[0];
    const duplicateExpenseId = existingDoc?.id ?? null;

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { [BUNNY_ACCESS_KEY_HEADER]: password, "Content-Type": "application/octet-stream" },
      body: file.buffer,
    });

    if (!response.ok) {
      res.status(500).json({ error: `Bunny upload failed: ${response.status}` });
      return;
    }

    const cdnDomain = process.env.BUNNY_CDN_DOMAIN ?? "";
    const url = `${cdnDomain}/${folder}/${safeFileName}`;
    res.json({ url, name: file.originalname, hash: fileHash, duplicateExpenseId });
  } catch (error) {
    console.error("[expenses] POST /upload-doc failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /scan-receipt — AI extraction from image or PDF
router.post("/scan-receipt", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { fileBase64, mediaType: rawMediaType } = req.body as { fileBase64: string; mediaType: string };

  if (!fileBase64) {
    res.status(400).json({ error: "fileBase64 este obligatoriu." });
    return;
  }

  try {
    const buffer = Buffer.from(fileBase64, "base64");
    const mediaType = String(rawMediaType ?? "");
    const isPdf = mediaType === "application/pdf" || buffer.subarray(0, 4).toString("latin1") === "%PDF";
    const isImage = !isPdf && isSupportedImageUpload(buffer, mediaType);

    if (!isImage && !isPdf) {
      res.status(400).json({ error: "Tip fișier nesuportat. Folosiți JPG, PNG, HEIC sau PDF." });
      return;
    }

    const documentBlocks: Anthropic.ContentBlockParam[] = isPdf
      ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }]
      : await prepareImageBlocks(buffer, mediaType);

    const { data, stopReason } = await requestStructured<ScannedReceipt>(anthropic, {
      operation: "Citire bon / factură",
      maxTokens: 16000,
      timeoutMs: 80_000,
      schema: RECEIPT_SCHEMA,
      messages: [
        {
          role: "user",
          content: [
            ...documentBlocks,
            { type: "text", text: buildReceiptPrompt(documentBlocks.length) },
          ],
        },
      ],
    });

    if (!data) {
      res.status(422).json({ error: stopReason === "refusal" ? "AI a refuzat documentul. Completează manual." : "AI nu a putut citi documentul. Încearcă o poză mai clară." });
      return;
    }

    res.json(validateScannedReceipt(data));
  } catch (error) {
    console.error("[expenses] POST /scan-receipt failed:", error);
    let message = "Eroare necunoscută";
    if (error instanceof Error) {
      message = error.message;
      const anyError = error as unknown as Record<string, unknown>;
      if (anyError.status) message = `[${anyError.status}] ${message}`;
      if (anyError.error && typeof anyError.error === "object") {
        const inner = anyError.error as Record<string, unknown>;
        if (inner.message) message += ` — ${inner.message}`;
      }
    } else {
      message = String(error);
    }
    res.status(500).json({ error: message });
  }
});

// GET / — list expenses, optional ?year= and ?month=
router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { year, month, monthFrom, monthTo } = req.query as { year?: string; month?: string; monthFrom?: string; monthTo?: string };

    let query = db.collection(COLLECTION).orderBy("date", "desc") as FirebaseFirestore.Query;

    if (year && monthFrom && monthTo) {
      const startDate = new Date(Number(year), Number(monthFrom) - 1, 1);
      const endDate = new Date(Number(year), Number(monthTo), 1);
      query = query
        .where("date", ">=", Timestamp.fromDate(startDate))
        .where("date", "<", Timestamp.fromDate(endDate));
    } else if (year && month) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 1);
      query = query
        .where("date", ">=", Timestamp.fromDate(startDate))
        .where("date", "<", Timestamp.fromDate(endDate));
    } else if (year) {
      const startDate = new Date(Number(year), 0, 1);
      const endDate = new Date(Number(year) + 1, 0, 1);
      query = query
        .where("date", ">=", Timestamp.fromDate(startDate))
        .where("date", "<", Timestamp.fromDate(endDate));
    }

    const snapshot = await query.get();
    const expenses = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate().toISOString(),
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      };
    });

    res.json({ expenses });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST / — create expense
router.post("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { date, category, description, supplier, amount, currency, exchangeRate, originalAmount, originalCurrency, deductibility, deductibleAmount: deductibleAmountInput, invoiceNumber, supplierCif, confirmPossibleDuplicate, factura, chitanta } = req.body as {
    date: string;
    category: string;
    description?: string;
    supplier?: string;
    amount: number;
    currency?: "RON" | "EUR" | "USD";
    exchangeRate?: number;
    originalAmount?: number;
    originalCurrency?: "USD";
    deductibility: number;
    // When set, this fixed sum (already in the stored currency) is the deductible
    // part — used for invoices where only a portion of the total is deductible
    // (e.g. a phone bill with several lines). Overrides the percentage.
    deductibleAmount?: number;
    invoiceNumber?: string;
    supplierCif?: string | null;
    confirmPossibleDuplicate?: boolean;
    factura?: { url: string; name: string; hash?: string } | null;
    chitanta?: { url: string; name: string; hash?: string } | null;
  };

  if (!date || !category || amount == null || (deductibility == null && deductibleAmountInput == null)) {
    res.status(400).json({ error: "Câmpuri obligatorii lipsă." });
    return;
  }

  if (currency !== undefined && !["RON", "EUR", "USD"].includes(currency)) {
    res.status(400).json({ error: "Moneda trebuie să fie RON, EUR sau USD." });
    return;
  }
  if (currency === "USD" && (!Number.isFinite(Number(exchangeRate)) || Number(exchangeRate) <= 0)) {
    res.status(400).json({ error: "Pentru USD, cursul valutar este obligatoriu și trebuie să fie mai mare decât zero." });
    return;
  }

  try {
    const db = firestore();

    // Dedup check 1: hash-based (exact same file content)
    const hashesToCheck = [factura?.hash, chitanta?.hash].filter(Boolean) as string[];
    for (const hash of hashesToCheck) {
      const [facturaMatch, chitantaMatch] = await Promise.all([
        db.collection(COLLECTION).where("factura.hash", "==", hash).limit(1).get(),
        db.collection(COLLECTION).where("chitanta.hash", "==", hash).limit(1).get(),
      ]);
      const existing = facturaMatch.docs[0] ?? chitantaMatch.docs[0];
      if (existing) {
        res.status(409).json({ error: "DUPLICATE_FILE", existingId: existing.id, message: "Fișier identic deja înregistrat." });
        return;
      }
    }

    // Dedup check 2: invoice identity across the whole (small) register —
    // normalized invoice number + supplier (CIF when known), plus the
    // "same supplier, same amount, near date" heuristic for documents without
    // a number (e.g. the same invoice uploaded once as photo, once as PDF).
    const sourceCurrencyForCheck = currency ?? "RON";
    const amountForCheck = sourceCurrencyForCheck === "USD" ? Number(amount) * Number(exchangeRate) : Number(amount);
    if (invoiceNumber || supplier || supplierCif) {
      const expensesSnapshot = await db.collection(COLLECTION).get();
      const match = findExpenseDuplicate(
        { date, supplier, supplierCif, invoiceNumber, amount: amountForCheck, currency: sourceCurrencyForCheck === "USD" ? "RON" : sourceCurrencyForCheck },
        expensesSnapshot.docs.map(toStoredExpense),
      );
      if (match && (match.level === "certain" || confirmPossibleDuplicate !== true)) {
        res.status(409).json(duplicateResponse(match, invoiceNumber));
        return;
      }
    }

    const sourceCurrency = currency ?? "RON";
    const numAmount = sourceCurrency === "USD" ? Number(amount) * Number(exchangeRate) : Number(amount);

    // A fixed deductible sum (clamped to [0, amount]) wins over the percentage;
    // the stored `deductibility` is then back-derived from it so reports stay
    // consistent.
    const hasManualDeductible =
      deductibleAmountInput != null && Number.isFinite(Number(deductibleAmountInput));
    let deductibleAmount: number;
    let numDeductibility: number;
    if (hasManualDeductible) {
      deductibleAmount = Math.round(Math.min(Math.max(Number(deductibleAmountInput), 0), numAmount) * 100) / 100;
      numDeductibility = numAmount > 0 ? Math.round((deductibleAmount / numAmount) * 100 * 100) / 100 : 0;
    } else {
      numDeductibility = Number(deductibility);
      deductibleAmount = Math.round((numAmount * numDeductibility) / 100 * 100) / 100;
    }

    const docRef = await db.collection(COLLECTION).add({
      date: Timestamp.fromDate(new Date(date)),
      category,
      description: description ?? null,
      supplier: supplier ?? null,
      amount: numAmount,
      currency: sourceCurrency === "USD" ? "RON" : sourceCurrency,
      deductibility: numDeductibility,
      deductibleAmount,
      invoiceNumber: invoiceNumber?.trim() ?? null,
      supplierCif: normalizeCif(supplierCif) || null,
      originalAmount: sourceCurrency === "USD" ? Number(originalAmount ?? amount) : null,
      originalCurrency: sourceCurrency === "USD" ? "USD" : null,
      exchangeRate: sourceCurrency === "USD" ? Number(exchangeRate) : null,
      factura: factura ? { url: factura.url, name: factura.name, hash: factura.hash ?? null } : null,
      chitanta: chitanta ? { url: chitanta.url, name: chitanta.name, hash: chitanta.hash ?? null } : null,
      createdAt: Timestamp.now(),
    });

    res.status(201).json({ id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /:id — edit an existing expense, preserving omitted fields/documents.
router.patch("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const fields = ["date", "category", "description", "supplier", "amount", "currency", "originalAmount", "originalCurrency", "exchangeRate", "invoiceNumber", "supplierCif", "factura", "chitanta", "deductibleAmount", "deductibility"];
    const patch: Record<string, unknown> = {};
    for (const field of fields) if (Object.prototype.hasOwnProperty.call(body, field)) patch[field] = body[field];
    if (!Object.keys(patch).length) { res.status(400).json({ error: "Trimite câmpurile de modificat." }); return; }
    const db = firestore();
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) { res.status(404).json({ error: "Cheltuiala nu a fost găsită." }); return; }
    const current = snap.data() ?? {};
    if ("date" in patch) {
      if (typeof patch.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(patch.date) || !Number.isFinite(Date.parse(patch.date)) || new Date(patch.date).toISOString().slice(0, 10) !== patch.date) {
        res.status(400).json({ error: "Data cheltuielii este invalidă." }); return;
      }
      patch.date = Timestamp.fromDate(new Date(patch.date));
    }
    for (const field of ["category", "description", "supplier", "invoiceNumber", "supplierCif"]) {
      if (!(field in patch)) continue;
      const value = patch[field];
      if ((value !== null && typeof value !== "string") || (field === "category" && (typeof value !== "string" || !value.trim()))) {
        res.status(400).json({ error: "Datele cheltuielii sunt invalide." }); return;
      }
      patch[field] = typeof value === "string" ? value.trim() || null : null;
    }
    const next = { ...current, ...patch };
    const total = Number(next.amount);
    if (!Number.isFinite(total) || total <= 0 || !["RON", "EUR"].includes(next.currency ?? "RON")) {
      res.status(400).json({ error: "Suma trebuie să fie pozitivă, în RON sau EUR. Pentru USD folosește conversia în RON." }); return;
    }
    if ("amount" in patch) patch.amount = total;
    if (next.originalCurrency === "USD" && (!Number.isFinite(Number(next.originalAmount)) || Number(next.originalAmount) <= 0 || !Number.isFinite(Number(next.exchangeRate)) || Number(next.exchangeRate) <= 0)) {
      res.status(400).json({ error: "Suma și cursul USD sunt invalide." }); return;
    }
    for (const field of ["factura", "chitanta"]) {
      if (!(field in patch) || patch[field] === null) continue;
      const doc = patch[field] as { url?: unknown; name?: unknown; hash?: unknown } | undefined;
      let validUrl = false;
      try { const url = new URL(typeof doc?.url === "string" ? doc.url : ""); validUrl = ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { /* invalid URL */ }
      if (!validUrl || typeof doc?.name !== "string" || !doc.name.trim() || (doc.hash != null && typeof doc.hash !== "string")) {
        res.status(400).json({ error: "Documentul atașat este invalid." }); return;
      }
      patch[field] = { url: doc.url, name: doc.name, hash: doc.hash ?? null };
      if (doc.hash) {
        const matches = await Promise.all([db.collection(COLLECTION).where("factura.hash", "==", doc.hash).get(), db.collection(COLLECTION).where("chitanta.hash", "==", doc.hash).get()]);
        const duplicate = matches.flatMap((match) => match.docs).find((item) => item.id !== req.params.id);
        if (duplicate) { res.status(409).json({ error: "DUPLICATE_FILE", existingId: duplicate.id, message: "Fișier deja atașat altei cheltuieli." }); return; }
      }
    }
    if ("supplierCif" in patch) patch.supplierCif = normalizeCif(patch.supplierCif) || null;
    // Re-check identity only when an identifying field really changed, so
    // attaching a document to an old record never trips over legacy near-duplicates.
    const identityChanged = ["invoiceNumber", "supplier", "supplierCif", "amount", "currency", "date"].some((field) => {
      if (!(field in patch)) return false;
      return comparableValue(current[field]) !== comparableValue(patch[field]);
    });
    if (identityChanged) {
      const all = await db.collection(COLLECTION).get();
      const nextDate = toDateValue(next.date);
      const match = findExpenseDuplicate(
        { id: req.params.id, date: nextDate, supplier: next.supplier, supplierCif: next.supplierCif, invoiceNumber: next.invoiceNumber, amount: total, currency: next.currency ?? "RON" },
        all.docs.map(toStoredExpense),
      );
      if (match && (match.level === "certain" || body.confirmPossibleDuplicate !== true)) {
        res.status(409).json(duplicateResponse(match, next.invoiceNumber)); return;
      }
    }
    const hasAmount = "deductibleAmount" in patch;
    const hasPercent = "deductibility" in patch;
    if ((hasAmount && (patch.deductibleAmount == null || !Number.isFinite(Number(patch.deductibleAmount)))) || (hasPercent && (patch.deductibility == null || !Number.isFinite(Number(patch.deductibility))))) {
      res.status(400).json({ error: "Valoarea deductibilă este invalidă." }); return;
    }
    if (hasAmount || hasPercent || "amount" in patch) {
      const deductible = hasAmount ? Math.min(Math.max(Number(patch.deductibleAmount), 0), total) : total * Math.min(Math.max(Number(next.deductibility ?? 0), 0), 100) / 100;
      patch.deductibleAmount = Math.round(deductible * 100) / 100;
      patch.deductibility = Math.round(Number(patch.deductibleAmount) / total * 10000) / 100;
    }
    await ref.update(patch);
    res.json({ id: req.params.id, ...patch, ...(patch.date ? { date: (patch.date as Timestamp).toDate().toISOString() } : {}) });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /:id
router.delete("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
