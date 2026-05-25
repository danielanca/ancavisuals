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
const COLLECTION = "expenses";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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
  const { fileBase64, mediaType } = req.body as { fileBase64: string; mediaType: string };

  if (!fileBase64 || !mediaType) {
    res.status(400).json({ error: "fileBase64 și mediaType sunt obligatorii." });
    return;
  }

  try {
    const isImage = mediaType.startsWith("image/");
    const isPdf = mediaType === "application/pdf";

    if (!isImage && !isPdf) {
      res.status(400).json({ error: "Tip fișier nesuportat. Folosiți JPG, PNG sau PDF." });
      return;
    }

    const contentBlock = isImage
      ? ({
          type: "image",
          source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: fileBase64 },
        } as const)
      : ({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: fileBase64 },
        } as const);

    const message = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: `Ești un asistent care extrage date din bonuri fiscale și facturi românești.
Extrage din documentul de mai sus următoarele informații și returnează DOAR un JSON valid, fără text suplimentar:
{
  "date": "YYYY-MM-DD sau null dacă nu găsești",
  "supplier": "Numele furnizorului/magazinului sau null",
  "amount": număr cu 2 zecimale sau null,
  "currency": "RON sau EUR sau null",
  "description": "Descriere scurtă a ce s-a cumpărat sau null",
  "category": "una din: combustibil, echipament, transport, software, cazare, alimentatie, marketing, altele",
  "invoiceNumber": "Seria și numărul facturii exact cum apare pe document (ex: FA-2024-001, RO 1234) sau null"
}`,
            },
          ],
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";

    let extracted: Record<string, unknown> = {};
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      extracted = {};
    }

    res.json({ extracted });
  } catch (error) {
    console.error("[expenses] POST /scan-receipt failed:", error);
    res.status(500).json({ error: String(error) });
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
  const { date, category, description, supplier, amount, currency, deductibility, invoiceNumber, factura, chitanta } = req.body as {
    date: string;
    category: string;
    description?: string;
    supplier?: string;
    amount: number;
    currency?: string;
    deductibility: number;
    invoiceNumber?: string;
    factura?: { url: string; name: string; hash?: string } | null;
    chitanta?: { url: string; name: string; hash?: string } | null;
  };

  if (!date || !category || amount == null || deductibility == null) {
    res.status(400).json({ error: "Câmpuri obligatorii lipsă." });
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

    // Dedup check 2: invoice number
    if (invoiceNumber?.trim()) {
      const invoiceSnap = await db.collection(COLLECTION).where("invoiceNumber", "==", invoiceNumber.trim()).limit(1).get();
      if (!invoiceSnap.empty) {
        res.status(409).json({ error: "DUPLICATE_INVOICE_NUMBER", existingId: invoiceSnap.docs[0].id, message: `Numărul de factură "${invoiceNumber}" există deja.` });
        return;
      }
    }

    const numAmount = Number(amount);
    const numDeductibility = Number(deductibility);
    const deductibleAmount = Math.round((numAmount * numDeductibility) / 100 * 100) / 100;

    const docRef = await db.collection(COLLECTION).add({
      date: Timestamp.fromDate(new Date(date)),
      category,
      description: description ?? null,
      supplier: supplier ?? null,
      amount: numAmount,
      currency: currency ?? "RON",
      deductibility: numDeductibility,
      deductibleAmount,
      invoiceNumber: invoiceNumber?.trim() ?? null,
      factura: factura ? { url: factura.url, name: factura.name, hash: factura.hash ?? null } : null,
      chitanta: chitanta ? { url: chitanta.url, name: chitanta.name, hash: chitanta.hash ?? null } : null,
      createdAt: Timestamp.now(),
    });

    res.status(201).json({ id: docRef.id });
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
