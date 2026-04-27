import { Router } from "express";
import type { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { generateInvoicePDF } from "../services/invoice.pdf";
import type { InvoiceItem, InvoiceData } from "../services/invoice.pdf";

const router = Router();
const COLLECTION = "invoices";
const SETTINGS_COLLECTION = "settings";
const FISCAL_DOC = "fiscal";

// GET /fiscal-settings
router.get("/fiscal-settings", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection(SETTINGS_COLLECTION).doc(FISCAL_DOC).get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PUT /fiscal-settings
router.put("/fiscal-settings", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection(SETTINGS_COLLECTION).doc(FISCAL_DOC).set(req.body, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET / — list invoices, optional ?year=
router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { year } = req.query as { year?: string };

    let query = db.collection(COLLECTION).orderBy("date", "desc") as FirebaseFirestore.Query;

    if (year) {
      const startDate = new Date(Number(year), 0, 1);
      const endDate = new Date(Number(year) + 1, 0, 1);
      query = query
        .where("date", ">=", Timestamp.fromDate(startDate))
        .where("date", "<", Timestamp.fromDate(endDate));
    }

    const snapshot = await query.get();
    const invoices = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate().toISOString(),
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      };
    });

    res.json({ invoices });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST / — create invoice
router.post("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { date, type, clientName, clientAddress, clientCIF, items, totalAmount, currency, notes, eventId } = req.body as {
    date: string;
    type: "B2C" | "B2B";
    clientName: string;
    clientAddress?: string;
    clientCIF?: string;
    items: InvoiceItem[];
    totalAmount: number;
    currency?: string;
    notes?: string;
    eventId?: string;
  };

  if (!date || !type || !clientName || !items?.length || totalAmount == null) {
    res.status(400).json({ error: "Câmpuri obligatorii lipsă." });
    return;
  }

  try {
    const db = firestore();

    const fiscalDoc = await db.collection(SETTINGS_COLLECTION).doc(FISCAL_DOC).get();
    const fiscal = fiscalDoc.exists ? fiscalDoc.data()! : {};
    const series = (fiscal.invoiceSeries as string) ?? "ADE";
    const invoiceYear = new Date(date).getFullYear();

    const startOfYear = new Date(invoiceYear, 0, 1);
    const endOfYear = new Date(invoiceYear + 1, 0, 1);
    const countSnapshot = await db
      .collection(COLLECTION)
      .where("date", ">=", Timestamp.fromDate(startOfYear))
      .where("date", "<", Timestamp.fromDate(endOfYear))
      .count()
      .get();
    const invoiceNumber = (countSnapshot.data().count ?? 0) + 1;

    const docRef = await db.collection(COLLECTION).add({
      invoiceNumber,
      series,
      year: invoiceYear,
      date: Timestamp.fromDate(new Date(date)),
      type,
      clientName,
      clientAddress: clientAddress ?? null,
      clientCIF: clientCIF ?? null,
      items,
      totalAmount: Number(totalAmount),
      currency: currency ?? "RON",
      notes: notes ?? null,
      eventId: eventId ?? null,
      createdAt: Timestamp.now(),
    });

    res.status(201).json({ id: docRef.id, invoiceNumber, series });
  } catch (error) {
    console.error("[invoices] POST / failed:", error);
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

// GET /:id/pdf — generate invoice PDF
router.get("/:id/pdf", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();

    const [invoiceDoc, fiscalDoc] = await Promise.all([
      db.collection(COLLECTION).doc(req.params.id).get(),
      db.collection(SETTINGS_COLLECTION).doc(FISCAL_DOC).get(),
    ]);

    if (!invoiceDoc.exists) {
      res.status(404).json({ error: "Factura nu a fost găsită." });
      return;
    }

    const data = invoiceDoc.data()!;
    const invoice: InvoiceData = {
      invoiceNumber: data.invoiceNumber as number,
      series: data.series as string,
      date: (data.date as Timestamp).toDate().toISOString(),
      type: data.type as "B2C" | "B2B",
      clientName: data.clientName as string,
      clientAddress: data.clientAddress as string | undefined,
      clientCIF: data.clientCIF as string | undefined,
      items: data.items as InvoiceItem[],
      totalAmount: data.totalAmount as number,
      currency: data.currency as string,
      notes: data.notes as string | undefined,
    };

    const fiscal = fiscalDoc.exists ? fiscalDoc.data()! : {};
    const pdfBuffer = await generateInvoicePDF({ invoice, fiscal });
    const invoiceRef = `${invoice.series}-${String(invoice.invoiceNumber).padStart(4, "0")}`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="factura-${invoiceRef}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[invoices] GET /:id/pdf failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
