import express, { type Request, type Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin, type AuthenticatedRequest } from "../middleware/requireFirebaseAuth";

const router = express.Router();
const COLLECTION = "instagramProposals";

// POST / — propose a photo (any logged-in user)
router.post("/", requireFirebaseAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { albumSlug, photoUrl, fileName } = req.body as {
    albumSlug: string;
    photoUrl: string;
    fileName: string;
  };

  if (!albumSlug || !photoUrl || !fileName) {
    res.status(400).json({ error: "albumSlug, photoUrl și fileName sunt obligatorii." });
    return;
  }

  try {
    const db = firestore();

    const existing = await db.collection(COLLECTION)
      .where("albumSlug", "==", albumSlug)
      .where("fileName", "==", fileName)
      .where("proposedByUid", "==", authReq.firebaseUid)
      .get();

    if (!existing.empty) {
      res.json({ ok: true, id: existing.docs[0].id, alreadyProposed: true });
      return;
    }

    const docRef = await db.collection(COLLECTION).add({
      albumSlug,
      photoUrl,
      fileName,
      proposedBy: authReq.firebaseEmail,
      proposedByUid: authReq.firebaseUid,
      proposedAt: Timestamp.now(),
      status: "pending",
    });

    res.status(201).json({ ok: true, id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /admin/all — all proposals across all albums (admin only) — must be before /album/:slug
router.get("/admin/all", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db
      .collection(COLLECTION)
      .orderBy("proposedAt", "desc")
      .get();

    const proposals = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      proposedAt: (doc.data().proposedAt as Timestamp).toDate().toISOString(),
    }));

    res.json({ proposals });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /album/:slug — get proposals for an album (any logged-in user)
router.get("/album/:slug", requireFirebaseAuth, async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const db = firestore();
    const snapshot = await db.collection(COLLECTION)
      .where("albumSlug", "==", slug)
      .orderBy("proposedAt", "desc")
      .get();

    const proposals = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      proposedAt: (doc.data().proposedAt as Timestamp).toDate().toISOString(),
    }));

    res.json({ proposals });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /:id — update status (supreme admin only)
router.patch("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as { status: "pending" | "accepted" | "archived" | "rejected" };

  if (!["pending", "accepted", "archived", "rejected"].includes(status)) {
    res.status(400).json({ error: "Status invalid." });
    return;
  }

  try {
    const db = firestore();
    await db.collection(COLLECTION).doc(id).update({ status, updatedAt: Timestamp.now() });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /:id — delete proposal (supreme admin only)
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
