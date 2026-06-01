import { Router, type Request, type Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "../firestore.js";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth.js";

const router = Router();
const COLLECTION = "photo_collections";

// GET /api/admin/photo-collections
router.get("/photo-collections", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snap = await db.collection(COLLECTION).orderBy("createdAt", "desc").get();
    const collections = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ collections });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/admin/photo-collections
router.post("/photo-collections", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name?.trim()) { res.status(400).json({ error: "Numele colecției este obligatoriu." }); return; }
    const db = firestore();
    const ref = await db.collection(COLLECTION).add({
      name: name.trim(),
      description: description?.trim() ?? "",
      items: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.json({ id: ref.id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /api/admin/photo-collections/:id
router.patch("/photo-collections/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, items } = req.body as {
      name?: string;
      description?: string;
      items?: Array<{ url: string; sourceType: string; sourceId?: string }>;
    };
    const db = firestore();
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description.trim();
    if (items !== undefined) update.items = items;
    await db.collection(COLLECTION).doc(req.params.id).update(update);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /api/admin/photo-collections/:id
router.delete("/photo-collections/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
