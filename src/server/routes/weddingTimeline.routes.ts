import { Router } from "express";
import type { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireCoupleAuth } from "../middleware/requireFirebaseAuth";
import type { CoupleAuthenticatedRequest } from "../middleware/requireFirebaseAuth";

const router = Router();

const VALID_CATEGORIES = new Set(["civil", "church", "photos", "restaurant", "party", "other"]);

const ROMANIAN_TEMPLATE = [
  {
    title: "Pregătiri Mireasă",
    startTime: "08:00",
    endTime: "11:00",
    category: "photos",
    location: "Acasă / Salon",
    notes: "Machiaj, coafură, îmbrăcat rochie",
  },
  {
    title: "Pregătiri Mire",
    startTime: "09:00",
    endTime: "11:00",
    category: "photos",
    location: "Acasă / Hotel",
    notes: "Costum, accesorii, foto cu nașii",
  },
  {
    title: "Cununie Civilă",
    startTime: "11:00",
    endTime: "12:00",
    category: "civil",
    location: "Starea Civilă",
    notes: "",
  },
  {
    title: "Ședință Foto Cuplu",
    startTime: "12:00",
    endTime: "13:30",
    category: "photos",
    location: "Locație exterioară",
    notes: "",
  },
  {
    title: "Cununie Religioasă",
    startTime: "14:00",
    endTime: "15:30",
    category: "church",
    location: "Biserica",
    notes: "",
  },
  {
    title: "Foto după Biserică",
    startTime: "15:30",
    endTime: "16:30",
    category: "photos",
    location: "În fața bisericii / parc",
    notes: "",
  },
  {
    title: "Primirea Invitaților la Restaurant",
    startTime: "18:00",
    endTime: "19:00",
    category: "restaurant",
    location: "Restaurant",
    notes: "Cocktail, aperitive",
  },
  {
    title: "Cina și Petrecerea",
    startTime: "19:00",
    endTime: "23:00",
    category: "party",
    location: "Restaurant",
    notes: "Toasturi, dans, momente speciale",
  },
  {
    title: "Tăiatul Tortului",
    startTime: "23:00",
    endTime: "23:30",
    category: "restaurant",
    location: "Restaurant",
    notes: "",
  },
  {
    title: "Aruncatul Buchetului",
    startTime: "23:30",
    endTime: "00:00",
    category: "party",
    location: "Restaurant",
    notes: "",
  },
];

function serializeMoment(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    title: data.title,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location ?? "",
    notes: data.notes ?? "",
    category: data.category,
    isFromTemplate: data.isFromTemplate ?? false,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? data.updatedAt,
  };
}

function validateMomentFields(body: Record<string, unknown>) {
  const { title, startTime, endTime, category } = body;
  if (!String(title ?? "").trim()) return "Titlul momentului este obligatoriu.";
  if (!String(startTime ?? "").match(/^\d{2}:\d{2}$/)) return "Ora de start trebuie să fie în formatul HH:MM.";
  if (!String(endTime ?? "").match(/^\d{2}:\d{2}$/)) return "Ora de final trebuie să fie în formatul HH:MM.";
  if (!VALID_CATEGORIES.has(String(category ?? ""))) return "Categoria selectată este invalidă.";
  return null;
}

// GET / — all timeline moments sorted by startTime
router.get("/", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const database = firestore();
    const snap = await database
      .collection("wh_weddings")
      .doc(weddingId)
      .collection("timeline")
      .get();

    const moments = snap.docs
      .map((doc) => serializeMoment(doc.id, doc.data()))
      .sort((momentA, momentB) => {
        const [aH, aM] = momentA.startTime.split(":").map(Number);
        const [bH, bM] = momentB.startTime.split(":").map(Number);
        return aH * 60 + aM - (bH * 60 + bM);
      });

    res.json({ moments });
  } catch (error) {
    console.error("[timeline] GET / failed:", error);
    res.status(500).json({ error: "Nu s-a putut încărca timeline-ul." });
  }
});

// POST / — add a custom moment
router.post("/", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const validationError = validateMomentFields(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const { title, startTime, endTime, category, location, notes } = req.body;
    const now = Timestamp.now();
    const momentData = {
      title: String(title).trim(),
      startTime: String(startTime),
      endTime: String(endTime),
      category: String(category),
      location: String(location ?? "").trim(),
      notes: String(notes ?? "").trim(),
      isFromTemplate: false,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await firestore()
      .collection("wh_weddings")
      .doc(weddingId)
      .collection("timeline")
      .add(momentData);

    res.status(201).json(serializeMoment(docRef.id, momentData));
  } catch (error) {
    console.error("[timeline] POST / failed:", error);
    res.status(500).json({ error: "Nu s-a putut adăuga momentul." });
  }
});

// PATCH /:momentId — edit a moment
router.patch("/:momentId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const { momentId } = req.params;
    const validationError = validateMomentFields(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const { title, startTime, endTime, category, location, notes } = req.body;
    const updates = {
      title: String(title).trim(),
      startTime: String(startTime),
      endTime: String(endTime),
      category: String(category),
      location: String(location ?? "").trim(),
      notes: String(notes ?? "").trim(),
      updatedAt: Timestamp.now(),
    };

    const docRef = firestore()
      .collection("wh_weddings")
      .doc(weddingId)
      .collection("timeline")
      .doc(momentId);

    await docRef.update(updates);
    const snap = await docRef.get();

    res.json(serializeMoment(momentId, snap.data()!));
  } catch (error) {
    console.error("[timeline] PATCH /:momentId failed:", error);
    res.status(500).json({ error: "Nu s-a putut actualiza momentul." });
  }
});

// DELETE /:momentId — delete a moment
router.delete("/:momentId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const { momentId } = req.params;
    await firestore()
      .collection("wh_weddings")
      .doc(weddingId)
      .collection("timeline")
      .doc(momentId)
      .delete();

    res.json({ ok: true });
  } catch (error) {
    console.error("[timeline] DELETE /:momentId failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge momentul." });
  }
});

// POST /apply-template — batch-write Romanian template moments
router.post("/apply-template", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const database = firestore();
    const weddingRef = database.collection("wh_weddings").doc(weddingId);
    const batch = database.batch();
    const now = Timestamp.now();

    const newMoments: ReturnType<typeof serializeMoment>[] = [];

    for (const template of ROMANIAN_TEMPLATE) {
      const docRef = weddingRef.collection("timeline").doc();
      const momentData = {
        ...template,
        isFromTemplate: true,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(docRef, momentData);
      newMoments.push(serializeMoment(docRef.id, momentData));
    }

    await batch.commit();

    res.status(201).json({ moments: newMoments });
  } catch (error) {
    console.error("[timeline] POST /apply-template failed:", error);
    res.status(500).json({ error: "Nu s-a putut aplica șablonul." });
  }
});

export default router;
