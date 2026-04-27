import { Router } from "express";
import type { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { generateRouteSheetPDF, generateMonthlyRouteSheetPDF } from "../services/routeSheet.pdf";

const router = Router();

const SETTINGS_COLLECTION = "settings";
const VEHICLE_DOC = "vehicle";
const SHEETS_COLLECTION = "routeSheets";

// GET /vehicle-settings
router.get("/vehicle-settings", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection(SETTINGS_COLLECTION).doc(VEHICLE_DOC).get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PUT /vehicle-settings
router.put("/vehicle-settings", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection(SETTINGS_COLLECTION).doc(VEHICLE_DOC).set(req.body, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET / — list all sheets
router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db.collection(SHEETS_COLLECTION).orderBy("date", "desc").get();
    const sheets = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate().toISOString(),
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      };
    });
    res.json({ sheets });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST / — create sheet
router.post("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { date, departure, destination, purpose, kmDus, kmIntors, eventId, eventName } = req.body as {
    date: string;
    departure: string;
    destination: string;
    purpose: string;
    kmDus: number;
    kmIntors: number;
    eventId?: string;
    eventName?: string;
  };

  if (!date || !departure || !destination || !purpose || kmDus == null || kmIntors == null) {
    res.status(400).json({ error: "Câmpuri obligatorii lipsă." });
    return;
  }

  try {
    const db = firestore();
    const kmTotal = Number(kmDus) + Number(kmIntors);

    const vehicleDoc = await db.collection(SETTINGS_COLLECTION).doc(VEHICLE_DOC).get();
    const vehicle = vehicleDoc.exists ? vehicleDoc.data()! : {};
    const fuelConsumed = vehicle.fuelConsumption
      ? Math.round((kmTotal * Number(vehicle.fuelConsumption)) / 100 * 100) / 100
      : null;

    const countSnapshot = await db.collection(SHEETS_COLLECTION).count().get();
    const sheetNumber = (countSnapshot.data().count ?? 0) + 1;

    const docRef = await db.collection(SHEETS_COLLECTION).add({
      sheetNumber,
      date: Timestamp.fromDate(new Date(date)),
      departure,
      destination,
      purpose,
      kmDus: Number(kmDus),
      kmIntors: Number(kmIntors),
      kmTotal,
      fuelConsumed,
      eventId: eventId ?? null,
      eventName: eventName ?? null,
      createdAt: Timestamp.now(),
    });

    res.status(201).json({ id: docRef.id, sheetNumber });
  } catch (error) {
    console.error("[route-sheets] POST / failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /:id
router.delete("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection(SHEETS_COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /pdf/monthly — generate monthly PDF (must be before /:id/pdf)
router.post("/pdf/monthly", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { year, month } = req.body as { year: number; month: number };
  if (!year || !month) {
    res.status(400).json({ error: "year și month sunt obligatorii." });
    return;
  }

  try {
    const db = firestore();

    const vehicleDoc = await db.collection(SETTINGS_COLLECTION).doc(VEHICLE_DOC).get();
    const vehicle = vehicleDoc.exists ? vehicleDoc.data()! : {};

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const snapshot = await db
      .collection(SHEETS_COLLECTION)
      .where("date", ">=", Timestamp.fromDate(startDate))
      .where("date", "<", Timestamp.fromDate(endDate))
      .orderBy("date", "asc")
      .get();

    const sheets = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, ...data, date: (data.date as Timestamp).toDate().toISOString() };
    });

    if (sheets.length === 0) {
      res.status(404).json({ error: "Nicio foaie pentru luna selectată." });
      return;
    }

    const pdfBuffer = await generateMonthlyRouteSheetPDF({ vehicle, sheets, year, month });
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="foi-parcurs-${year}-${String(month).padStart(2, "0")}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[route-sheets] POST /pdf/monthly failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /:id/pdf — generate single PDF
router.get("/:id/pdf", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();

    const [sheetDoc, vehicleDoc] = await Promise.all([
      db.collection(SHEETS_COLLECTION).doc(req.params.id).get(),
      db.collection(SETTINGS_COLLECTION).doc(VEHICLE_DOC).get(),
    ]);

    if (!sheetDoc.exists) {
      res.status(404).json({ error: "Foaia nu a fost găsită." });
      return;
    }

    const data = sheetDoc.data()!;
    const sheet: Record<string, unknown> = { id: sheetDoc.id, ...data, date: (data.date as Timestamp).toDate().toISOString() };
    const vehicle = vehicleDoc.exists ? vehicleDoc.data()! : {};

    const pdfBuffer = await generateRouteSheetPDF({ vehicle, sheet });
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="foaie-parcurs-${sheet.sheetNumber ?? sheetDoc.id}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[route-sheets] GET /:id/pdf failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
