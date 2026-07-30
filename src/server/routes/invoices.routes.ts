import { Router } from "express";
import type { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import archiver from "archiver";
import Anthropic from "@anthropic-ai/sdk";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { generateInvoicePDF } from "../services/invoice.pdf";
import type { InvoiceItem, InvoiceData } from "../services/invoice.pdf";
import { generateInvoiceXML } from "../services/invoice.generator";
import type { InvoiceData as EFacturaData } from "../services/invoice.generator";
import { generateFiscalReport, generateRegistru, buildInvoicesCsv, buildExpensesCsv } from "../services/fiscal.reports";
import type { FiscalInvoice, FiscalExpense } from "../services/fiscal.reports";

const router = Router();
const COLLECTION = "invoices";
const SETTINGS_COLLECTION = "settings";
const FISCAL_DOC = "fiscal";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /parse-text — AI extraction of invoice fields from freely pasted text (ex: extras de cont)
router.post("/parse-text", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { text } = req.body as { text?: string };

  if (!text?.trim()) {
    res.status(400).json({ error: "Text lipsă." });
    return;
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Ești un asistent care extrage date de facturare dintr-un text liber (ex: extras de cont bancar, listă de tranzacții, notițe). Textul poate conține una sau mai multe tranzacții/încasări legate de ACELAȘI client.

Extrage din textul de mai jos și returnează DOAR un JSON valid, fără text suplimentar, în acest format:
{
  "clientName": "numele complet al persoanei/clientului sau null dacă nu apare",
  "clientCIF": "CIF/CUI firmă dacă e menționat, altfel null",
  "date": "YYYY-MM-DD — data celei mai recente tranzacții găsite, sau null",
  "currency": "RON sau EUR (dedus din text), null dacă nu e clar",
  "items": [
    { "description": "descriere scurtă a tranzacției (ex: avans, rest de plată)", "amount": număr cu 2 zecimale }
  ],
  "notes": "un rezumat scurt opțional (ex: menționează ID-urile tranzacțiilor), sau null"
}

Reguli:
- Fiecare tranzacție/încasare distinctă din text devine un element separat în "items", cu suma ei exactă.
- Nu aduna sumele tu — lasă fiecare tranzacție ca element separat; totalul se calculează automat.
- Descrierea din "items" trebuie să fie scurtă și curată, potrivită pentru a apărea pe o factură (ex: "Avans", "Rest de plată", "Servicii foto") — FĂRĂ ID-uri de tranzacție, IBAN-uri sau alte detalii tehnice.
- ID-urile de tranzacție, IBAN-urile și alte detalii tehnice pot fi menționate doar în câmpul "notes", niciodată în "items[].description".
- Dacă textul nu conține nicio sumă/tranzacție clară, returnează "items": [].

Text:
"""
${text.trim().slice(0, 8000)}
"""`,
            },
          ],
        },
      ],
    }, { timeout: 25_000 });

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
    console.error("[invoices] POST /parse-text failed:", error);
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
  const { date, dueDate, type, clientName, clientAddress, clientCity, clientCounty, clientCIF, items, totalAmount, currency, notes, eventId, eventDate, taxExchangeRate } = req.body as {
    date: string;
    dueDate?: string;
    type: "B2C" | "B2B";
    clientName: string;
    clientAddress?: string;
    clientCity?: string;
    clientCounty?: string;
    clientCIF?: string;
    items: InvoiceItem[];
    totalAmount: number;
    currency?: string;
    notes?: string;
    eventId?: string;
    eventDate?: string;
    taxExchangeRate?: number;
  };

  if (!date || !type || !clientName || !items?.length || totalAmount == null || !clientAddress?.trim() || !clientCity?.trim() || !clientCounty?.trim()) {
    res.status(400).json({ error: "Câmpuri obligatorii lipsă: adresă, oraș și județ sunt necesare." });
    return;
  }

  try {
    const db = firestore();

    const fiscalDoc = await db.collection(SETTINGS_COLLECTION).doc(FISCAL_DOC).get();
    const fiscal = fiscalDoc.exists ? fiscalDoc.data()! : {};
    const series = (fiscal.invoiceSeries as string) ?? "ADE";
    const invoiceYear = new Date(date).getFullYear();

    // Numărul crește continuu, fără resetare anuală — se resetează doar dacă seria se schimbă.
    const invoiceNumber = await db.runTransaction(async (tx) => {
      const counterRef = db.collection(SETTINGS_COLLECTION).doc("invoiceSeriesCounter");
      const counterDoc = await tx.get(counterRef);
      const counterData = counterDoc.data() ?? {};
      const next = counterData.series === series ? (Number(counterData.next) || 1) : 1;
      tx.set(counterRef, { series, next: next + 1 });
      return next;
    });
    const MONTHS_RO = ["ianuarie","februarie","martie","aprilie","mai","iunie","iulie","august","septembrie","octombrie","noiembrie","decembrie"];
    const formattedEventDate = eventDate ? (() => {
      const [year, month, day] = eventDate.split("-");
      return `${parseInt(day)}${MONTHS_RO[parseInt(month) - 1]}${year}`;
    })() : null;
    const invoiceRef = formattedEventDate
      ? `${series}-${String(invoiceNumber).padStart(4, "0")}-${formattedEventDate}`
      : `${series}-${String(invoiceNumber).padStart(4, "0")}`;

    const docRef = await db.collection(COLLECTION).add({
      invoiceNumber,
      series,
      invoiceRef,
      year: invoiceYear,
      date: Timestamp.fromDate(new Date(date)),
      type,
      clientName,
      clientAddress: clientAddress ?? null,
      clientCity: clientCity ?? null,
      clientCounty: clientCounty ?? null,
      clientCIF: clientCIF ?? null,
      items,
      totalAmount: Number(totalAmount),
      currency: currency ?? "RON",
      notes: notes ?? null,
      eventId: eventId ?? null,
      eventDate: eventDate ?? null,
      dueDate: dueDate ?? null,
      taxExchangeRate: taxExchangeRate ?? null,
      createdAt: Timestamp.now(),
    });

    res.status(201).json({ id: docRef.id, invoiceNumber, series, invoiceRef });
  } catch (error) {
    console.error("[invoices] POST / failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /:id — actualizează câmpuri editabile pe o factură existentă
router.patch("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const {
      clientName, clientAddress, clientCity, clientCounty, clientCIF,
      type, date, dueDate, items, totalAmount, currency, notes,
      taxExchangeRate, eFacturaId, invoiceRef,
    } = req.body as {
      clientName?: string;
      clientAddress?: string;
      clientCity?: string;
      clientCounty?: string;
      clientCIF?: string | null;
      type?: "B2C" | "B2B";
      date?: string;
      dueDate?: string | null;
      items?: InvoiceItem[];
      totalAmount?: number;
      currency?: string;
      notes?: string | null;
      taxExchangeRate?: number | null;
      eFacturaId?: string | null;
      invoiceRef?: string;
    };
    const update: Record<string, unknown> = {};
    if (clientName !== undefined) update.clientName = clientName.trim();
    if (clientAddress !== undefined) update.clientAddress = clientAddress.trim();
    if (clientCity !== undefined) update.clientCity = clientCity.trim();
    if (clientCounty !== undefined) update.clientCounty = clientCounty.trim();
    if (clientCIF !== undefined) update.clientCIF = clientCIF?.trim() || null;
    if (type !== undefined) update.type = type;
    if (date !== undefined) update.date = Timestamp.fromDate(new Date(date));
    if (dueDate !== undefined) update.dueDate = dueDate || null;
    if (items !== undefined) update.items = items;
    if (totalAmount !== undefined) update.totalAmount = Number(totalAmount);
    if (currency !== undefined) update.currency = currency;
    if (notes !== undefined) update.notes = notes?.trim() || null;
    if (taxExchangeRate !== undefined) update.taxExchangeRate = taxExchangeRate ?? null;
    if (eFacturaId !== undefined) update.eFacturaId = eFacturaId?.trim() || null;
    if (invoiceRef !== undefined) {
      const trimmedRef = invoiceRef.trim();
      if (!trimmedRef) { res.status(400).json({ error: "Numărul facturii nu poate fi gol." }); return; }
      update.invoiceRef = trimmedRef;
    }
    if (Object.keys(update).length === 0) { res.status(400).json({ error: "Nimic de actualizat." }); return; }
    await db.collection(COLLECTION).doc(req.params.id).update(update);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /:id/paid — marchează factura ca plătită sau neplătită
router.patch("/:id/paid", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { paid } = req.body as { paid: boolean };
    await db.collection(COLLECTION).doc(req.params.id).update({
      paid: !!paid,
      paidAt: paid ? Timestamp.now() : null,
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /:id/efactura — marchează factura ca trimisă sau netrimisă prin e-Factura
router.patch("/:id/efactura", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { eFactura } = req.body as { eFactura: boolean };
    await db.collection(COLLECTION).doc(req.params.id).update({
      eFactura: !!eFactura,
      eFacturaSentAt: eFactura ? Timestamp.now() : null,
    });
    res.json({ ok: true });
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
      invoiceRef: data.invoiceRef as string | undefined,
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
    const invoiceRef = invoice.invoiceRef ?? `${invoice.series}-${String(invoice.invoiceNumber).padStart(4, "0")}`;

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

// GET /:id/xml — generate e-Factura UBL XML for an existing invoice
router.get("/:id/xml", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const [invoiceDoc, fiscalDoc] = await Promise.all([
      db.collection(COLLECTION).doc(req.params.id).get(),
      db.collection(SETTINGS_COLLECTION).doc(FISCAL_DOC).get(),
    ]);
    if (!invoiceDoc.exists) { res.status(404).json({ error: "Factura nu a fost găsită." }); return; }

    const data = invoiceDoc.data()!;
    if (!String(data.clientCounty ?? "").trim()) {
      res.status(400).json({ error: "Județul clientului lipsește. Editați factura și completați județul înainte de a genera XML-ul e-Factura (obligatoriu conform BR-RO-110)." });
      return;
    }
    const fiscal = fiscalDoc.exists ? fiscalDoc.data()! : {};
    const invoiceDate = (data.date as Timestamp).toDate().toISOString().slice(0, 10);
    const dueDate = data.dueDate ? String(data.dueDate) : invoiceDate;
    const invoiceRef = (data.invoiceRef as string | undefined) ?? `${data.series}-${String(data.invoiceNumber).padStart(4, "0")}`;

    const efData: EFacturaData = {
      issuerName:       String(fiscal.ownerName ?? ""),
      issuerCIF:        String(fiscal.cif ?? ""),
      issuerAddress:    String(fiscal.address ?? ""),
      issuerCity:       String(fiscal.city ?? ""),
      issuerCounty:     String(fiscal.county ?? ""),
      issuerPostalCode: String(fiscal.postalCode ?? ""),
      issuerIBAN:       String(fiscal.iban ?? ""),
      buyerName:        String(data.clientName ?? ""),
      buyerCIF:         data.clientCIF ? String(data.clientCIF) : "",
      buyerAddress:     data.clientAddress ? String(data.clientAddress) : undefined,
      buyerCity:        data.clientCity ? String(data.clientCity) : undefined,
      buyerCounty:      data.clientCounty ? String(data.clientCounty) : undefined,
      invoiceNumber:    invoiceRef,
      invoiceDate,
      dueDate,
      currency:         String(data.currency ?? "RON"),
      taxExchangeRate:  data.taxExchangeRate ? Number(data.taxExchangeRate) : undefined,
      description:      (data.items as InvoiceItem[])?.[0]?.description ?? "Servicii",
      amount:           Number(data.totalAmount ?? 0),
    };

    const xml = generateInvoiceXML(efData);
    res.set({
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="efactura-${invoiceRef}.xml"`,
    });
    res.send(xml);
  } catch (error) {
    console.error("[invoices] GET /:id/xml failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ── Shared helper: fetch invoices + expenses + fiscal for a given year ────────
async function fetchFiscalData(year: number) {
  const db = firestore();
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const [invoicesSnap, expensesSnap, fiscalDoc, settingsDoc] = await Promise.all([
    db.collection(COLLECTION)
      .where("date", ">=", Timestamp.fromDate(startDate))
      .where("date", "<", Timestamp.fromDate(endDate))
      .orderBy("date", "asc").get(),
    db.collection("expenses")
      .where("date", ">=", Timestamp.fromDate(startDate))
      .where("date", "<", Timestamp.fromDate(endDate))
      .orderBy("date", "asc").get(),
    db.collection(SETTINGS_COLLECTION).doc(FISCAL_DOC).get(),
    db.collection(SETTINGS_COLLECTION).doc("admin").get(),
  ]);

  const fiscal = fiscalDoc.exists ? fiscalDoc.data()! : {};
  const exchangeRate = Number(settingsDoc.data()?.exchangeRate) || 5;

  const invoices: FiscalInvoice[] = invoicesSnap.docs.map(doc => {
    const data = doc.data();
    return {
      invoiceNumber: data.invoiceNumber as number,
      series: data.series as string,
      date: (data.date as Timestamp).toDate().toISOString(),
      clientName: data.clientName as string,
      type: data.type as string,
      totalAmount: data.totalAmount as number,
      currency: data.currency as string,
      notes: data.notes as string | null,
    };
  });

  const expenses: FiscalExpense[] = expensesSnap.docs.map(doc => {
    const data = doc.data();
    return {
      date: (data.date as Timestamp).toDate().toISOString(),
      category: data.category as string,
      supplier: data.supplier as string | null,
      description: data.description as string | null,
      invoiceNumber: data.invoiceNumber as string | null,
      amount: data.amount as number,
      currency: data.currency as string,
      deductibility: data.deductibility as number,
      deductibleAmount: data.deductibleAmount as number,
      factura: data.factura as { url: string; name: string } | null,
      chitanta: data.chitanta as { url: string; name: string } | null,
    } as FiscalExpense & { factura: { url: string; name: string } | null; chitanta: { url: string; name: string } | null };
  });

  return { invoices, expenses, fiscal, exchangeRate };
}

// GET /export-csv?year=2026 — ZIP cu două CSV-uri (facturi + cheltuieli)
router.get("/export-csv", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  try {
    const { invoices, expenses } = await fetchFiscalData(year);
    const invoicesCsv = buildInvoicesCsv(invoices);
    const expensesCsv = buildExpensesCsv(expenses);

    res.set({ "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="fiscal-csv-${year}.zip"` });
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(res);
    archive.append(invoicesCsv, { name: `facturi-emise-${year}.csv` });
    archive.append(expensesCsv, { name: `cheltuieli-${year}.csv` });
    await archive.finalize();
  } catch (error) {
    console.error("[invoices] GET /export-csv failed:", error);
    if (!res.headersSent) res.status(500).json({ error: String(error) });
  }
});

// GET /export-report?year=2026 — Raport fiscal PDF
router.get("/export-report", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  try {
    const { invoices, expenses, fiscal, exchangeRate } = await fetchFiscalData(year);
    const pdfBuffer = await generateFiscalReport({ year, invoices, expenses, fiscal, exchangeRate });
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="raport-fiscal-${year}.pdf"` });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[invoices] GET /export-report failed:", error);
    if (!res.headersSent) res.status(500).json({ error: String(error) });
  }
});

// GET /export-registru?year=2026 — Registru de incasări și plăți PDF
router.get("/export-registru", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  try {
    const { invoices, expenses, fiscal, exchangeRate } = await fetchFiscalData(year);
    const pdfBuffer = await generateRegistru({ year, invoices, expenses, fiscal, exchangeRate });
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="registru-incasari-plati-${year}.pdf"` });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[invoices] GET /export-registru failed:", error);
    if (!res.headersSent) res.status(500).json({ error: String(error) });
  }
});

// GET /export-zip?year=2026 — ZIP cu facturi emise (PDF) + documente cheltuieli
router.get("/export-zip", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const year = Number(req.query.year) || new Date().getFullYear();

  try {
    const db = firestore();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const [invoicesSnap, expensesSnap, fiscalDoc] = await Promise.all([
      db.collection(COLLECTION)
        .where("date", ">=", Timestamp.fromDate(startDate))
        .where("date", "<", Timestamp.fromDate(endDate))
        .orderBy("date", "asc")
        .get(),
      db.collection("expenses")
        .where("date", ">=", Timestamp.fromDate(startDate))
        .where("date", "<", Timestamp.fromDate(endDate))
        .orderBy("date", "asc")
        .get(),
      db.collection(SETTINGS_COLLECTION).doc(FISCAL_DOC).get(),
    ]);

    const fiscal = fiscalDoc.exists ? fiscalDoc.data()! : {};

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="fiscal-${year}.zip"`,
    });

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(res);

    // ── Facturi emise → PDF generat ──────────────────────────────────────────
    for (const doc of invoicesSnap.docs) {
      const data = doc.data();
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
      try {
        const pdfBuffer = await generateInvoicePDF({ invoice, fiscal });
        const ref = `${invoice.series}-${String(invoice.invoiceNumber).padStart(4, "0")}`;
        const safeClient = invoice.clientName.replace(/[^a-zA-Z0-9\-_ăâîșțĂÂÎȘȚ ]/g, "").trim().replace(/\s+/g, "-");
        const dateStr = invoice.date.slice(0, 10);
        archive.append(pdfBuffer, { name: `facturi-emise/${ref}-${safeClient}-${dateStr}.pdf` });
      } catch (err) {
        console.error(`[export-zip] PDF failed for invoice ${doc.id}:`, err);
      }
    }

    // ── Cheltuieli → fișiere originale de pe CDN ────────────────────────────
    for (const doc of expensesSnap.docs) {
      const data = doc.data();
      const dateStr = (data.date as Timestamp).toDate().toISOString().slice(0, 10);
      const safeSupplier = (data.supplier ?? data.category ?? "necunoscut")
        .replace(/[^a-zA-Z0-9\-_ăâîșțĂÂÎȘȚ ]/g, "").trim().replace(/\s+/g, "-");

      for (const [slot, label] of [["factura", "factura"], ["chitanta", "chitanta"]] as const) {
        const docEntry = data[slot] as { url: string; name: string } | null;
        if (!docEntry?.url) continue;
        const ext = docEntry.name.split(".").pop() ?? "pdf";
        const fileName = `cheltuieli-documente/${dateStr}-${safeSupplier}-${label}.${ext}`;
        try {
          const response = await fetch(docEntry.url);
          if (!response.ok || !response.body) continue;
          const { Readable } = await import("stream");
          archive.append(
            Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
            { name: fileName },
          );
        } catch (err) {
          console.error(`[export-zip] Fetch failed for ${fileName}:`, err);
        }
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error("[invoices] GET /export-zip failed:", error);
    if (!res.headersSent) res.status(500).json({ error: String(error) });
  }
});

export default router;
