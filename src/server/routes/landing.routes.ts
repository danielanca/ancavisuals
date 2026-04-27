import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { firestore } from "../firestore";
import { getBunnyStorageKey, buildBunnyStorageUrl, BUNNY_ACCESS_KEY_HEADER } from "../constants/bunny";

const router = Router();

const HERO_DOC = "config";
const STATS_DOC = "config";

const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

function bunnyPublicUrl(path: string): string {
  const domain = process.env.BUNNY_CDN_DOMAIN ?? "";
  return `${domain}/${path}`;
}

async function uploadToBunny(buffer: Buffer, bunnyPath: string, contentType: string): Promise<void> {
  const key = getBunnyStorageKey();
  const url = buildBunnyStorageUrl(bunnyPath);
  const response = await fetch(url, {
    method: "PUT",
    headers: { [BUNNY_ACCESS_KEY_HEADER]: key, "Content-Type": contentType },
    body: buffer,
  });
  if (!response.ok) {
    throw new Error(`Bunny upload failed: ${response.status} ${await response.text()}`);
  }
}

async function deleteFromBunny(bunnyPath: string): Promise<void> {
  const key = getBunnyStorageKey();
  const url = buildBunnyStorageUrl(bunnyPath);
  await fetch(url, { method: "DELETE", headers: { [BUNNY_ACCESS_KEY_HEADER]: key } });
}

// ─── HERO ────────────────────────────────────────────────────────────────────

router.get("/hero", async (_req: Request, res: Response) => {
  try {
    const doc = await firestore().collection("landing_hero").doc(HERO_DOC).get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put("/hero", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection("landing_hero").doc(HERO_DOC).set(req.body, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── GALLERY ─────────────────────────────────────────────────────────────────

router.get("/gallery", async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore().collection("landing_gallery").orderBy("order", "asc").get();
    const images = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ images });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post(
  "/gallery/upload",
  requireFirebaseAuth,
  requireSupremeAdmin,
  imageUpload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Lipsește fișierul." });
      return;
    }
    try {
      const db = firestore();
      const countSnapshot = await db.collection("landing_gallery").count().get();
      const totalCount = countSnapshot.data().count ?? 0;

      const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const bunnyPath = `landing/gallery/${safeFileName}`;

      await uploadToBunny(file.buffer, bunnyPath, file.mimetype);

      const docRef = await db.collection("landing_gallery").add({
        url: bunnyPublicUrl(bunnyPath),
        bunnyPath,
        altText: (req.body.altText as string | undefined) ?? "",
        order: totalCount,
      });

      res.status(201).json({ id: docRef.id, url: bunnyPublicUrl(bunnyPath) });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }
);

router.put("/gallery/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection("landing_gallery").doc(req.params.id).update(req.body);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.delete("/gallery/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("landing_gallery").doc(req.params.id).get();
    if (doc.exists) {
      const bunnyPath = (doc.data() as Record<string, unknown>).bunnyPath as string | undefined;
      if (bunnyPath) await deleteFromBunny(bunnyPath);
    }
    await db.collection("landing_gallery").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── REVIEWS ─────────────────────────────────────────────────────────────────

router.get("/reviews", async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore().collection("landing_reviews").orderBy("pinned", "desc").get();
    const reviews = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/reviews", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const docRef = await firestore().collection("landing_reviews").add(req.body);
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put("/reviews/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection("landing_reviews").doc(req.params.id).update(req.body);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.delete("/reviews/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection("landing_reviews").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── SERVICES ────────────────────────────────────────────────────────────────

router.get("/services", async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore().collection("landing_services").orderBy("order", "asc").get();
    const services = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ services });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/services", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const docRef = await firestore().collection("landing_services").add(req.body);
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put("/services/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection("landing_services").doc(req.params.id).update(req.body);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.delete("/services/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection("landing_services").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post(
  "/services/:id/upload-image",
  requireFirebaseAuth,
  requireSupremeAdmin,
  imageUpload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Lipsește fișierul." });
      return;
    }
    try {
      const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const bunnyPath = `landing/services/${req.params.id}/${safeFileName}`;
      await uploadToBunny(file.buffer, bunnyPath, file.mimetype);
      const publicUrl = bunnyPublicUrl(bunnyPath);
      await firestore().collection("landing_services").doc(req.params.id).update({ imageUrl: publicUrl, imageBunnyPath: bunnyPath });
      res.json({ url: publicUrl });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }
);

router.post(
  "/services/:id/upload-video",
  requireFirebaseAuth,
  requireSupremeAdmin,
  videoUpload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Lipsește fișierul." });
      return;
    }
    try {
      const slug = (req.body.slug as string | undefined) ?? req.params.id;
      const safeSlug = slug.replace(/[^a-zA-Z0-9-]/g, "_");
      const bunnyPath = `landing/services/${safeSlug}.mp4`;
      await uploadToBunny(file.buffer, bunnyPath, "video/mp4");
      const publicUrl = bunnyPublicUrl(bunnyPath);
      await firestore().collection("landing_services").doc(req.params.id).update({ videoUrl: publicUrl, videoBunnyPath: bunnyPath });
      res.json({ url: publicUrl });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }
);

// ─── HERO VIDEO UPLOAD ───────────────────────────────────────────────────────

router.post(
  "/hero/upload-video",
  requireFirebaseAuth,
  requireSupremeAdmin,
  videoUpload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Lipsește fișierul." });
      return;
    }
    try {
      const bunnyPath = "landing/hero.mp4";
      await uploadToBunny(file.buffer, bunnyPath, "video/mp4");
      const publicUrl = bunnyPublicUrl(bunnyPath);
      await firestore().collection("landing_hero").doc(HERO_DOC).set({ videoUrl: publicUrl }, { merge: true });
      res.json({ url: publicUrl });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }
);

// ─── STATS ───────────────────────────────────────────────────────────────────

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const doc = await firestore().collection("landing_stats").doc(STATS_DOC).get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put("/stats", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection("landing_stats").doc(STATS_DOC).set(req.body, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── FAQ ─────────────────────────────────────────────────────────────────────

router.get("/faq", async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore().collection("landing_faq").orderBy("order", "asc").get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/faq", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const countSnapshot = await db.collection("landing_faq").count().get();
    const totalCount = countSnapshot.data().count ?? 0;
    const docRef = await db.collection("landing_faq").add({ ...req.body, order: totalCount });
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put("/faq/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection("landing_faq").doc(req.params.id).update(req.body);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.delete("/faq/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection("landing_faq").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
