import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { BUNNY_STORAGE_BASE_URL, getBunnyStorageZone, getBunnyStoragePassword, BUNNY_ACCESS_KEY_HEADER } from "../constants/bunny";

const router = Router();
const COLLECTION = "siteReviews";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

type ReviewCategory = "wedding" | "oferta";
type ReviewPhoto = { url: string; name: string };

async function uploadReviewPhoto(file: Express.Multer.File): Promise<ReviewPhoto> {
  const safeFileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const storageZone = getBunnyStorageZone();
  const password = getBunnyStoragePassword();
  const uploadUrl = `${BUNNY_STORAGE_BASE_URL}/${storageZone}/reviews/${safeFileName}`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { [BUNNY_ACCESS_KEY_HEADER]: password, "Content-Type": "application/octet-stream" },
    body: file.buffer,
  });
  if (!response.ok) throw new Error(`Bunny upload failed: ${response.status}`);

  const cdnDomain = process.env.BUNNY_CDN_DOMAIN ?? "";
  return { url: `${cdnDomain}/reviews/${safeFileName}`, name: file.originalname };
}

function serializeReview(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    author: (data.author as string) ?? "",
    date: (data.date as string) ?? "",
    rating: (data.rating as number) ?? 5,
    text: (data.text as string) ?? "",
    photo: (data.photo as ReviewPhoto | null) ?? null,
    verified: data.verified === true,
    category: (data.category as ReviewCategory) ?? "wedding",
    offerSlug: (data.offerSlug as string | null) ?? null,
    order: typeof data.order === "number" ? data.order : 0,
  };
}

// GET /api/reviews?category=wedding — recenzii pentru paginile de oraș/foto-video
// GET /api/reviews?category=oferta&offerSlug=olx — recenzii pentru o pagină de ofertă anume
// (o recenzie de tip "oferta" fără offerSlug apare pe TOATE paginile de ofertă)
router.get("/", async (req: Request, res: Response) => {
  const category: ReviewCategory = req.query.category === "oferta" ? "oferta" : "wedding";
  const offerSlug = typeof req.query.offerSlug === "string" ? req.query.offerSlug.trim() : "";

  try {
    const snapshot = await firestore().collection(COLLECTION).where("category", "==", category).get();
    let reviews = snapshot.docs.map(serializeReview);
    if (category === "oferta") {
      reviews = reviews.filter((r) => !r.offerSlug || r.offerSlug === offerSlug);
    }
    reviews.sort((a, b) => (b.order - a.order) || b.date.localeCompare(a.date));
    res.json({ reviews });
  } catch (error) {
    console.error("[reviews] GET / failed:", error);
    res.status(500).json({ error: "Recenziile nu au putut fi încărcate." });
  }
});

router.get("/admin/all", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore().collection(COLLECTION).orderBy("order", "desc").get();
    res.json({ reviews: snapshot.docs.map(serializeReview) });
  } catch (error) {
    console.error("[reviews] GET /admin/all failed:", error);
    res.status(500).json({ error: "Recenziile nu au putut fi încărcate." });
  }
});

router.post("/admin", requireFirebaseAuth, requireSupremeAdmin, upload.single("photo"), async (req: Request, res: Response) => {
  const { author, date, rating, text, category, offerSlug, verified } = req.body as Record<string, string | undefined>;
  if (!author?.trim() || !text?.trim()) {
    res.status(400).json({ error: "Nume și text sunt obligatorii." });
    return;
  }

  try {
    const photo = req.file ? await uploadReviewPhoto(req.file) : null;
    const docRef = await firestore().collection(COLLECTION).add({
      author: author.trim(),
      date: date?.trim() || new Date().toISOString().slice(0, 10),
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
      text: text.trim(),
      photo,
      verified: verified === "true",
      category: category === "oferta" ? "oferta" : "wedding",
      offerSlug: category === "oferta" && offerSlug?.trim() ? offerSlug.trim() : null,
      order: Date.now(),
      createdAt: Timestamp.now(),
    });
    const doc = await docRef.get();
    res.status(201).json({ review: serializeReview(doc) });
  } catch (error) {
    console.error("[reviews] POST /admin failed:", error);
    res.status(500).json({ error: "Recenzia nu a putut fi salvată." });
  }
});

router.put("/admin/:id", requireFirebaseAuth, requireSupremeAdmin, upload.single("photo"), async (req: Request, res: Response) => {
  const { author, date, rating, text, category, offerSlug, verified, removePhoto } = req.body as Record<string, string | undefined>;
  try {
    const ref = firestore().collection(COLLECTION).doc(req.params.id);
    const update: Record<string, unknown> = {};
    if (author !== undefined) update.author = author.trim();
    if (date !== undefined) update.date = date.trim();
    if (rating !== undefined) update.rating = Math.min(5, Math.max(1, Number(rating) || 5));
    if (text !== undefined) update.text = text.trim();
    if (category !== undefined) update.category = category === "oferta" ? "oferta" : "wedding";
    if (offerSlug !== undefined) update.offerSlug = category === "oferta" && offerSlug?.trim() ? offerSlug.trim() : null;
    if (verified !== undefined) update.verified = verified === "true";
    if (req.file) update.photo = await uploadReviewPhoto(req.file);
    else if (removePhoto === "true") update.photo = null;

    await ref.update(update);
    const doc = await ref.get();
    res.json({ review: serializeReview(doc) });
  } catch (error) {
    console.error("[reviews] PUT /admin/:id failed:", error);
    res.status(500).json({ error: "Recenzia nu a putut fi actualizată." });
  }
});

router.delete("/admin/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[reviews] DELETE /admin/:id failed:", error);
    res.status(500).json({ error: "Recenzia nu a putut fi ștearsă." });
  }
});

export default router;
