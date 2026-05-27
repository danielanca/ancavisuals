import { Router, type Request, type Response } from "express";
import multer from "multer";
import { FieldValue } from "firebase-admin/firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { firestore } from "../firestore";
import { getBunnyStorageKey, buildBunnyStorageUrl, BUNNY_ACCESS_KEY_HEADER } from "../constants/bunny";

const router = Router();
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const COLLECTION = "campaignPages";

function bunnyPublicUrl(path: string): string {
  return `${process.env.BUNNY_CDN_DOMAIN ?? ""}/${path}`;
}

async function uploadToBunny(buffer: Buffer, bunnyPath: string, contentType: string): Promise<void> {
  const response = await fetch(buildBunnyStorageUrl(bunnyPath), {
    method: "PUT",
    headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey(), "Content-Type": contentType },
    body: buffer,
  });
  if (!response.ok) throw new Error(`Bunny upload failed: ${response.status} ${await response.text()}`);
}

async function deleteFromBunny(bunnyPath: string): Promise<void> {
  await fetch(buildBunnyStorageUrl(bunnyPath), {
    method: "DELETE",
    headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() },
  });
}

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

router.get("/public/:slug", async (req: Request, res: Response) => {
  try {
    const doc = await firestore().collection(COLLECTION).doc(req.params.slug).get();
    if (!doc.exists) { res.status(404).json({ error: "Not found" }); return; }
    const data = doc.data()!;
    if (!data.active) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ slug: doc.id, ...data });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── ADMIN: CRUD ──────────────────────────────────────────────────────────────

router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore().collection(COLLECTION).orderBy("createdAt", "desc").get();
    const pages = snapshot.docs.map((doc) => ({ slug: doc.id, ...doc.data() }));
    res.json({ pages });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { slug, title, subtitle } = req.body as { slug: string; title: string; subtitle: string };
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      res.status(400).json({ error: "Slug invalid (folosiți doar litere mici, cifre și liniuțe)" });
      return;
    }
    const db = firestore();
    const existing = await db.collection(COLLECTION).doc(slug).get();
    if (existing.exists) { res.status(409).json({ error: "Slug-ul există deja" }); return; }
    await db.collection(COLLECTION).doc(slug).set({
      slug,
      title: title ?? "",
      subtitle: subtitle ?? "",
      ctaText: "Contactează-ne",
      whatsappNumber: "+40745469907",
      phoneNumber: "+40745469907",
      heroImageUrl: "",
      heroImageBunnyPath: "",
      heroVideoUrl: "",
      heroVideoBunnyPath: "",
      gallery: [],
      packages: [],
      testimonials: [],
      active: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json({ slug });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put("/:slug", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection(COLLECTION).doc(req.params.slug).update({
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.delete("/:slug", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection(COLLECTION).doc(req.params.slug).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── HERO IMAGE / VIDEO ───────────────────────────────────────────────────────

router.post(
  "/:slug/hero-image",
  requireFirebaseAuth,
  requireSupremeAdmin,
  imageUpload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) { res.status(400).json({ error: "Lipsește fișierul" }); return; }
    try {
      const safeFileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const bunnyPath = `campaigns/${req.params.slug}/hero-${safeFileName}`;
      await uploadToBunny(file.buffer, bunnyPath, file.mimetype);
      const url = bunnyPublicUrl(bunnyPath);
      await firestore().collection(COLLECTION).doc(req.params.slug).update({
        heroImageUrl: url,
        heroImageBunnyPath: bunnyPath,
        updatedAt: new Date().toISOString(),
      });
      res.json({ url });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }
);

router.post(
  "/:slug/hero-video",
  requireFirebaseAuth,
  requireSupremeAdmin,
  videoUpload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) { res.status(400).json({ error: "Lipsește fișierul" }); return; }
    try {
      const bunnyPath = `campaigns/${req.params.slug}/hero.mp4`;
      await uploadToBunny(file.buffer, bunnyPath, "video/mp4");
      const url = bunnyPublicUrl(bunnyPath);
      await firestore().collection(COLLECTION).doc(req.params.slug).update({
        heroVideoUrl: url,
        heroVideoBunnyPath: bunnyPath,
        updatedAt: new Date().toISOString(),
      });
      res.json({ url });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }
);

// ─── BUNNY STREAM VIDEOS (read-only picker) ───────────────────────────────────

router.get("/stream-videos", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID ?? "";
    const apiKey = process.env.BUNNY_STREAM_API_KEY ?? "";
    if (!libraryId || !apiKey) {
      res.status(500).json({ error: "Bunny Stream not configured (BUNNY_STREAM_LIBRARY_ID / BUNNY_STREAM_API_KEY missing)" });
      return;
    }
    const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos?page=1&itemsPerPage=100&orderBy=date`, {
      headers: { AccessKey: apiKey, Accept: "application/json" },
    });
    if (!response.ok) {
      res.status(502).json({ error: `Bunny Stream error: ${response.status}` });
      return;
    }
    const data = await response.json() as { items: Array<{ guid: string; title: string; thumbnailFileName: string; length: number }> };
    const cdnHostname = `vz-${libraryId}.b-cdn.net`;
    const videos = data.items.map((video) => ({
      guid: video.guid,
      title: video.title,
      thumbnailUrl: `https://${cdnHostname}/${video.guid}/${video.thumbnailFileName || "thumbnail.jpg"}`,
      embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${video.guid}`,
      length: video.length,
    }));
    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── GALLERY ─────────────────────────────────────────────────────────────────

router.post(
  "/:slug/gallery",
  requireFirebaseAuth,
  requireSupremeAdmin,
  imageUpload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) { res.status(400).json({ error: "Lipsește fișierul" }); return; }
    try {
      const safeFileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const bunnyPath = `campaigns/${req.params.slug}/gallery/${safeFileName}`;
      await uploadToBunny(file.buffer, bunnyPath, file.mimetype);
      const url = bunnyPublicUrl(bunnyPath);
      await firestore().collection(COLLECTION).doc(req.params.slug).update({
        gallery: FieldValue.arrayUnion({ url, bunnyPath }),
        updatedAt: new Date().toISOString(),
      });
      res.json({ url, bunnyPath });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }
);

router.delete("/:slug/gallery", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { url, bunnyPath } = req.body as { url: string; bunnyPath: string };
    const db = firestore();
    const doc = await db.collection(COLLECTION).doc(req.params.slug).get();
    if (!doc.exists) { res.status(404).json({ error: "Not found" }); return; }
    const data = doc.data() as { gallery: Array<{ url: string; bunnyPath: string }> };
    const newGallery = data.gallery.filter((item) => item.url !== url);
    await db.collection(COLLECTION).doc(req.params.slug).update({
      gallery: newGallery,
      updatedAt: new Date().toISOString(),
    });
    if (bunnyPath) await deleteFromBunny(bunnyPath).catch(() => {});
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── PACKAGES ────────────────────────────────────────────────────────────────

router.post("/:slug/packages", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const packageItem = { id: Date.now().toString(), ...req.body };
    await firestore().collection(COLLECTION).doc(req.params.slug).update({
      packages: FieldValue.arrayUnion(packageItem),
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json({ id: packageItem.id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put("/:slug/packages", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection(COLLECTION).doc(req.params.slug).get();
    if (!doc.exists) { res.status(404).json({ error: "Not found" }); return; }
    const data = doc.data() as { packages: Array<Record<string, unknown>> };
    const updatedPackages = data.packages.map((pkg) =>
      pkg.id === req.body.id ? { ...pkg, ...req.body } : pkg
    );
    await db.collection(COLLECTION).doc(req.params.slug).update({
      packages: updatedPackages,
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.delete("/:slug/packages/:packageId", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection(COLLECTION).doc(req.params.slug).get();
    if (!doc.exists) { res.status(404).json({ error: "Not found" }); return; }
    const data = doc.data() as { packages: Array<{ id: string }> };
    const newPackages = data.packages.filter((pkg) => pkg.id !== req.params.packageId);
    await db.collection(COLLECTION).doc(req.params.slug).update({
      packages: newPackages,
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────

router.post("/:slug/testimonials", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const testimonial = { id: Date.now().toString(), ...req.body };
    await firestore().collection(COLLECTION).doc(req.params.slug).update({
      testimonials: FieldValue.arrayUnion(testimonial),
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json({ id: testimonial.id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.delete("/:slug/testimonials/:testimonialId", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection(COLLECTION).doc(req.params.slug).get();
    if (!doc.exists) { res.status(404).json({ error: "Not found" }); return; }
    const data = doc.data() as { testimonials: Array<{ id: string }> };
    const newTestimonials = data.testimonials.filter((item) => item.id !== req.params.testimonialId);
    await db.collection(COLLECTION).doc(req.params.slug).update({
      testimonials: newTestimonials,
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
