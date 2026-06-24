import { Router, type Request, type Response } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";

const router = Router();
const COLLECTION = "equipment_categories";

interface EquipmentItem {
  id: string;
  name: string;
}

// GET /api/admin/equipment
router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore().collection(COLLECTION).orderBy("order").get();
    const categories = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ categories });
  } catch {
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/admin/equipment
router.post("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { name, serviceTag, color } = req.body as { name?: string; serviceTag?: string; color?: string };
  if (!name?.trim() || !serviceTag?.trim()) {
    res.status(400).json({ error: "Numele și serviciul sunt obligatorii." });
    return;
  }
  try {
    const lastSnap = await firestore().collection(COLLECTION).orderBy("order", "desc").limit(1).get();
    const maxOrder = lastSnap.empty ? 0 : ((lastSnap.docs[0].data().order as number) ?? 0);
    const docRef = await firestore().collection(COLLECTION).add({
      name: name.trim(),
      serviceTag: serviceTag.trim(),
      color: color ?? "#6b7280",
      items: [],
      order: maxOrder + 1,
      createdAt: Timestamp.now(),
    });
    const doc = await docRef.get();
    res.status(201).json({ category: { id: doc.id, ...doc.data() } });
  } catch {
    res.status(500).json({ error: "Eroare server." });
  }
});

// PATCH /api/admin/equipment/:id
router.patch("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { name, serviceTag, color } = req.body as { name?: string; serviceTag?: string; color?: string };
  const update: Record<string, unknown> = {};
  if (typeof name === "string") update.name = name.trim();
  if (typeof serviceTag === "string") update.serviceTag = serviceTag.trim();
  if (typeof color === "string") update.color = color;
  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "Niciun câmp de actualizat." });
    return;
  }
  try {
    await firestore().collection(COLLECTION).doc(req.params.id).update(update);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Eroare server." });
  }
});

// DELETE /api/admin/equipment/:id
router.delete("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/admin/equipment/:id/items
router.post("/:id/items", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "Numele echipamentului este obligatoriu." });
    return;
  }
  try {
    const itemId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const newItem: EquipmentItem = { id: itemId, name: name.trim() };
    await firestore().collection(COLLECTION).doc(req.params.id).update({
      items: FieldValue.arrayUnion(newItem),
    });
    res.status(201).json({ item: newItem });
  } catch {
    res.status(500).json({ error: "Eroare server." });
  }
});

// PATCH /api/admin/equipment/:id/items/:itemId
router.patch("/:id/items/:itemId", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "Noul nume este obligatoriu." });
    return;
  }
  try {
    const docRef = firestore().collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Categorie negăsită." }); return; }
    const items = (doc.data()?.items ?? []) as EquipmentItem[];
    const updated = items.map((item) =>
      item.id === req.params.itemId ? { ...item, name: name.trim() } : item
    );
    await docRef.update({ items: updated });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Eroare server." });
  }
});

// DELETE /api/admin/equipment/:id/items/:itemId
router.delete("/:id/items/:itemId", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const docRef = firestore().collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Categorie negăsită." }); return; }
    const items = (doc.data()?.items ?? []) as EquipmentItem[];
    await docRef.update({ items: items.filter((item) => item.id !== req.params.itemId) });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Eroare server." });
  }
});

export default router;
