import { Router, type Request, type Response } from "express";
import multer from "multer";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { getBunnyStorageKey, buildBunnyStorageUrl, BUNNY_ACCESS_KEY_HEADER } from "../constants/bunny";

const router = Router();
const COLLECTION = "pdfResources";
const BUNNY_FOLDER = "resources/pdf";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

function bunnyPublicUrl(bunnyPath: string): string {
  return `${process.env.BUNNY_CDN_DOMAIN ?? ""}/${bunnyPath}`;
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

// GET /featured — the PDF currently pinned as the special /bio link, if any
router.get("/featured", async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore().collection(COLLECTION).where("featuredOnBio", "==", true).limit(1).get();
    if (snapshot.empty) { res.json({ resource: null }); return; }
    const doc = snapshot.docs[0];
    const data = doc.data();
    res.json({ resource: { id: doc.id, title: data.title, url: data.url } });
  } catch (error) {
    console.error("[pdf-resources] GET /featured failed:", error);
    res.status(500).json({ error: "Nu s-a putut încărca PDF-ul recomandat." });
  }
});

// ─── ADMIN ───────────────────────────────────────────────────────────────────

// GET / — list all PDFs, newest first
router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore().collection(COLLECTION).orderBy("createdAt", "desc").get();
    const resources = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        filename: data.filename,
        url: data.url,
        size: data.size,
        featuredOnBio: data.featuredOnBio === true,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      };
    });
    res.json({ resources });
  } catch (error) {
    console.error("[pdf-resources] GET / failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca PDF-urile." });
  }
});

// POST / — upload a new PDF to Bunny + record it
router.post("/", requireFirebaseAuth, requireSupremeAdmin, upload.single("file"), async (req: Request, res: Response) => {
  const file = req.file;
  const { title } = req.body as { title?: string };

  if (!file) { res.status(400).json({ error: "Fișier lipsă." }); return; }
  if (file.mimetype !== "application/pdf") { res.status(400).json({ error: "Doar fișiere PDF sunt acceptate." }); return; }
  if (!title?.trim()) { res.status(400).json({ error: "Titlul este obligatoriu." }); return; }

  try {
    const safeFileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const bunnyPath = `${BUNNY_FOLDER}/${safeFileName}`;
    await uploadToBunny(file.buffer, bunnyPath, "application/pdf");

    const url = bunnyPublicUrl(bunnyPath);
    const db = firestore();
    const docRef = await db.collection(COLLECTION).add({
      title: title.trim(),
      filename: file.originalname,
      bunnyPath,
      url,
      size: file.size,
      featuredOnBio: false,
      createdAt: Timestamp.now(),
    });

    res.json({
      resource: {
        id: docRef.id,
        title: title.trim(),
        filename: file.originalname,
        url,
        size: file.size,
        featuredOnBio: false,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[pdf-resources] POST / failed:", error);
    res.status(500).json({ error: "Upload-ul a eșuat." });
  }
});

// PATCH /:id/feature — pin (or unpin) this PDF as the special /bio link; only one at a time
router.patch("/:id/feature", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { featured } = req.body as { featured: boolean };
    const db = firestore();
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "PDF-ul nu există." }); return; }

    if (featured) {
      const previouslyFeatured = await db.collection(COLLECTION).where("featuredOnBio", "==", true).get();
      const batch = db.batch();
      previouslyFeatured.docs.forEach((d) => batch.update(d.ref, { featuredOnBio: false }));
      batch.update(docRef, { featuredOnBio: true });
      await batch.commit();
    } else {
      await docRef.update({ featuredOnBio: false });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("[pdf-resources] PATCH /:id/feature failed:", error);
    res.status(500).json({ error: "Nu s-a putut actualiza." });
  }
});

// DELETE /:id — remove a PDF from Bunny + Firestore
router.delete("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const docRef = db.collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "PDF-ul nu există." }); return; }

    const bunnyPath = String(doc.data()?.bunnyPath ?? "");
    if (bunnyPath) await deleteFromBunny(bunnyPath);
    await docRef.delete();

    res.json({ ok: true });
  } catch (error) {
    console.error("[pdf-resources] DELETE /:id failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge PDF-ul." });
  }
});

export default router;
