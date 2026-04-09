import { Router, Request, Response } from "express";
import { firestore } from "../firestoreInit";
import { Timestamp } from "firebase-admin/firestore";

const router = Router();

// GET /api/admin/events — toate evenimentele, sortate după eventDate
router.get("/events", async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db.collection("adminEvents").orderBy("eventDate", "asc").get();

    const events = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        eventDate: data.eventDate instanceof Timestamp ? data.eventDate.toDate().toISOString() : data.eventDate,
      };
    });

    res.json({ events });
  } catch (error) {
    console.error("[adminEvents] GET /events failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca evenimentele." });
  }
});

// POST /api/admin/events — creează eveniment nou
router.post("/events", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const body = req.body;

    if (!body.type || !body.eventDate || !body.client?.fullName) {
      return res.status(400).json({ error: "Câmpuri obligatorii lipsă: type, eventDate, client.fullName" });
    }

    const services: { name: string; price: number }[] = body.services ?? [];
    const total = services.reduce((sum, s) => sum + (s.price ?? 0), 0);
    const advanceAmount = body.pricing?.advanceAmount ?? 0;

    const newEvent = {
      type: body.type,
      status: body.status ?? "lead",
      createdAt: Timestamp.now(),
      eventDate: Timestamp.fromDate(new Date(body.eventDate)),
      client: {
        fullName: body.client.fullName,
        phone: body.client.phone ?? "",
        email: body.client.email ?? "",
      },
      services,
      pricing: {
        total,
        advanceAmount,
        advancePaid: body.pricing?.advancePaid ?? false,
        remainingAmount: total - advanceAmount,
      },
      ...(body.contractId ? { contractId: body.contractId } : {}),
      ...(body.notes ? { notes: body.notes } : {}),
    };

    const docRef = await db.collection("adminEvents").add(newEvent);
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error("[adminEvents] POST /events failed:", error);
    res.status(500).json({ error: "Nu s-a putut crea evenimentul." });
  }
});

// PATCH /api/admin/events/:id — actualizează câmpuri
router.patch("/events/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { id } = req.params;
    const updates = req.body;

    if (updates.eventDate) {
      updates.eventDate = Timestamp.fromDate(new Date(updates.eventDate));
    }

    await db.collection("adminEvents").doc(id).update(updates);
    res.json({ ok: true });
  } catch (error) {
    console.error("[adminEvents] PATCH /events/:id failed:", error);
    res.status(500).json({ error: "Nu s-a putut actualiza evenimentul." });
  }
});

// GET /api/admin/settings — goals + currency
router.get("/settings", async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("settings").doc("admin").get();

    if (!doc.exists) {
      // returnăm defaults sensibile dacă nu există încă documentul
      const defaults = {
        goals: {
          sixMonths: { targetRevenue: 15000, startDate: "2026-04-01", endDate: "2026-09-30" },
          oneYear: { targetRevenue: 30000, startDate: "2026-01-01", endDate: "2026-12-31" },
        },
        currency: "EUR",
      };
      return res.json(defaults);
    }

    res.json(doc.data());
  } catch (error) {
    console.error("[adminEvents] GET /settings failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca setările." });
  }
});

// PUT /api/admin/settings — salvează goals
router.put("/settings", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection("settings").doc("admin").set(req.body, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    console.error("[adminEvents] PUT /settings failed:", error);
    res.status(500).json({ error: "Nu s-au putut salva setările." });
  }
});

export default router;
