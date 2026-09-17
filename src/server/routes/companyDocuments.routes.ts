import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { BUNNY_ACCESS_KEY_HEADER, BUNNY_STORAGE_BASE_URL, getBunnyStorageZone, getBunnyStoragePassword } from "../constants/bunny";

const router = Router();
const COLLECTION = "companyDocuments";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET / — list all company documents, newest first
router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db.collection(COLLECTION).orderBy("uploadedAt", "desc").get();
    const documents = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        uploadedAt: (data.uploadedAt as Timestamp).toDate().toISOString(),
      };
    });
    res.json({ documents });
  } catch (error) {
    console.error("[company-documents] GET failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /upload — upload a company document (certificat constatator, CIF, etc.) to Bunny + record it
router.post("/upload", requireFirebaseAuth, requireSupremeAdmin, upload.single("file"), async (req: Request, res: Response) => {
  const file = req.file;
  const { category, label, notes } = req.body as { category?: string; label?: string; notes?: string };

  if (!file) { res.status(400).json({ error: "Fișier lipsă." }); return; }
  if (!category || !label) { res.status(400).json({ error: "Categoria și denumirea sunt obligatorii." }); return; }

  const safeFileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const storageZone = getBunnyStorageZone();
  const password = getBunnyStoragePassword();
  const uploadUrl = `${BUNNY_STORAGE_BASE_URL}/${storageZone}/company-docs/${safeFileName}`;

  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { [BUNNY_ACCESS_KEY_HEADER]: password, "Content-Type": "application/octet-stream" },
      body: file.buffer,
    });

    if (!response.ok) {
      res.status(500).json({ error: `Bunny upload failed: ${response.status}` });
      return;
    }

    const cdnDomain = process.env.BUNNY_CDN_DOMAIN ?? "";
    const fileUrl = `${cdnDomain}/company-docs/${safeFileName}`;

    const db = firestore();
    const docRef = await db.collection(COLLECTION).add({
      category,
      label,
      notes: notes || null,
      fileUrl,
      storagePath: `company-docs/${safeFileName}`,
      fileName: file.originalname,
      mediaType: file.mimetype,
      uploadedAt: Timestamp.now(),
    });

    res.json({
      id: docRef.id,
      category,
      label,
      notes: notes || null,
      fileUrl,
      fileName: file.originalname,
      mediaType: file.mimetype,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[company-documents] POST /upload failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /:id/file — proxy the private document through the authenticated admin API
router.get("/:id/file", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const snapshot = await firestore().collection(COLLECTION).doc(req.params.id).get();
    if (!snapshot.exists) { res.status(404).json({ error: "Documentul nu există." }); return; }

    const data = snapshot.data()!;
    const storagePath = String(data.storagePath ?? "");
    const fallbackPath = String(data.fileUrl ?? "").split("/company-docs/")[1];
    const path = storagePath || (fallbackPath ? `company-docs/${fallbackPath}` : "");
    if (!path) { res.status(404).json({ error: "Calea documentului nu este disponibilă." }); return; }

    const response = await fetch(`${BUNNY_STORAGE_BASE_URL}/${getBunnyStorageZone()}/${path}`, {
      headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStoragePassword() },
    });
    if (!response.ok) { res.status(502).json({ error: "Documentul nu a putut fi preluat din stocare." }); return; }

    res.setHeader("Content-Type", String(data.mediaType ?? "application/octet-stream"));
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(String(data.fileName ?? "document"))}`);
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("[company-documents] GET /:id/file failed:", error);
    res.status(500).json({ error: "Documentul nu a putut fi deschis." });
  }
});

// DELETE /:id — remove a company document record
router.delete("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[company-documents] DELETE failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
