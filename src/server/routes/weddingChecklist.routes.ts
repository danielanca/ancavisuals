import { Router } from "express";
import type { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireCoupleAuth } from "../middleware/requireFirebaseAuth";
import type { CoupleAuthenticatedRequest } from "../middleware/requireFirebaseAuth";

const router = Router();

function serializeItem(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    ...data,
    completedAt: data.completedAt?.toDate?.()?.toISOString() ?? null,
    dueDate: data.dueDate?.toDate?.()?.toISOString() ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? data.updatedAt,
  };
}

function serializeCategory(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt,
  };
}

// GET / — all categories + items for this wedding
router.get("/", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const database = firestore();
    const weddingRef = database.collection("wh_weddings").doc(weddingId);

    const [categoriesSnap, itemsSnap] = await Promise.all([
      weddingRef.collection("checklistCategories").orderBy("order", "asc").get(),
      weddingRef.collection("checklistItems").get(),
    ]);

    const categories = categoriesSnap.docs.map((doc) => serializeCategory(doc.id, doc.data()));
    const items = itemsSnap.docs.map((doc) => serializeItem(doc.id, doc.data()));

    res.json({ categories, items });
  } catch (error) {
    console.error("[checklist] GET / failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca datele checklist-ului." });
  }
});

// POST /categories — add a custom category
router.post("/categories", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: "Numele categoriei este obligatoriu." });
    }

    const database = firestore();
    const weddingRef = database.collection("wh_weddings").doc(weddingId);

    const existingSnap = await weddingRef.collection("checklistCategories").get();
    const maxOrder = existingSnap.docs.reduce(
      (max, doc) => Math.max(max, doc.data().order ?? 0),
      0,
    );

    const categoryData = {
      name: name.trim(),
      order: maxOrder + 1,
      isDefault: false,
      createdAt: Timestamp.now(),
    };

    const docRef = await weddingRef.collection("checklistCategories").add(categoryData);

    res.status(201).json(serializeCategory(docRef.id, categoryData));
  } catch (error) {
    console.error("[checklist] POST /categories failed:", error);
    res.status(500).json({ error: "Nu s-a putut crea categoria." });
  }
});

// DELETE /categories/:categoryId — delete category and all its items
router.delete("/categories/:categoryId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const { categoryId } = req.params;
    const database = firestore();
    const weddingRef = database.collection("wh_weddings").doc(weddingId);

    const itemsSnap = await weddingRef
      .collection("checklistItems")
      .where("categoryId", "==", categoryId)
      .get();

    const batch = database.batch();
    itemsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(weddingRef.collection("checklistCategories").doc(categoryId));
    await batch.commit();

    res.json({ ok: true });
  } catch (error) {
    console.error("[checklist] DELETE /categories/:categoryId failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge categoria." });
  }
});

// POST /items — add an item to a category
router.post("/items", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const { categoryId, title, notes, dueDate } = req.body;

    if (!categoryId?.trim()) {
      return res.status(400).json({ error: "Categoria este obligatorie." });
    }
    if (!title?.trim()) {
      return res.status(400).json({ error: "Titlul task-ului este obligatoriu." });
    }

    const database = firestore();
    const weddingRef = database.collection("wh_weddings").doc(weddingId);

    const now = Timestamp.now();
    const itemData = {
      categoryId,
      title: title.trim(),
      notes: notes?.trim() ?? "",
      isCompleted: false,
      isDefault: false,
      completedAt: null,
      dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await weddingRef.collection("checklistItems").add(itemData);

    res.status(201).json({
      id: docRef.id,
      ...itemData,
      completedAt: null,
      dueDate: dueDate ?? null,
      createdAt: now.toDate().toISOString(),
      updatedAt: now.toDate().toISOString(),
    });
  } catch (error) {
    console.error("[checklist] POST /items failed:", error);
    res.status(500).json({ error: "Nu s-a putut adăuga task-ul." });
  }
});

// PATCH /items/:itemId — toggle complete, edit title/notes/dueDate
router.patch("/items/:itemId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const { itemId } = req.params;
    const { isCompleted, title, notes, dueDate } = req.body;

    const database = firestore();
    const weddingRef = database.collection("wh_weddings").doc(weddingId);
    const itemRef = weddingRef.collection("checklistItems").doc(itemId);

    const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };

    if (typeof isCompleted === "boolean") {
      updates.isCompleted = isCompleted;
      updates.completedAt = isCompleted ? Timestamp.now() : null;
    }
    if (title !== undefined) updates.title = title.trim();
    if (notes !== undefined) updates.notes = notes.trim();
    if (dueDate !== undefined) {
      updates.dueDate = dueDate ? Timestamp.fromDate(new Date(dueDate)) : null;
    }

    await itemRef.update(updates);
    const updatedSnap = await itemRef.get();
    const data = updatedSnap.data()!;

    res.json(serializeItem(itemId, data));
  } catch (error) {
    console.error("[checklist] PATCH /items/:itemId failed:", error);
    res.status(500).json({ error: "Nu s-a putut actualiza task-ul." });
  }
});

// DELETE /items/:itemId — delete an item
router.delete("/items/:itemId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const { itemId } = req.params;
    const database = firestore();
    await database
      .collection("wh_weddings")
      .doc(weddingId)
      .collection("checklistItems")
      .doc(itemId)
      .delete();

    res.json({ ok: true });
  } catch (error) {
    console.error("[checklist] DELETE /items/:itemId failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge task-ul." });
  }
});

export default router;
