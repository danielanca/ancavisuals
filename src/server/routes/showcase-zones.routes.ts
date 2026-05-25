import express, { type Request, type Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";

const router = express.Router();
const COLLECTION = "showcase_zones";

router.get("/:id/sources", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();

    const [proposalsSnap, assetsSnap] = await Promise.all([
      db.collection("instagramProposals").where("status", "==", "accepted").get(),
      db.collection("offer_media_assets").get(),
    ]);

    const proposals = proposalsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        photoUrl: String(data.photoUrl ?? ""),
        albumSlug: String(data.albumSlug ?? ""),
        fileName: String(data.fileName ?? ""),
      };
    });

    const assets = assetsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        url: String(data.url ?? ""),
        label: String(data.label ?? ""),
        serviceId: String(data.serviceId ?? ""),
      };
    });

    res.json({ proposals, assets });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const db = firestore();
    const doc = await db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) {
      res.json({ photos: [] });
      return;
    }
    const data = doc.data();
    const photos = Array.isArray(data?.photos)
      ? (data.photos as Array<{ url?: unknown }>).map((p) => String(p.url ?? "")).filter(Boolean)
      : [];
    res.json({ photos });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { label, photos } = req.body as {
    label?: string;
    photos: Array<{ url: string; sourceType: "proposal" | "media_asset" | "manual"; sourceId?: string }>;
  };

  if (!Array.isArray(photos)) {
    res.status(400).json({ error: "photos este obligatoriu." });
    return;
  }

  try {
    const db = firestore();
    const docRef = db.collection(COLLECTION).doc(id);
    const update: Record<string, unknown> = {
      photos,
      updatedAt: Timestamp.now(),
    };
    if (label !== undefined) update.label = label;
    await docRef.set(update, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
