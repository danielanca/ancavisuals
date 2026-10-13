import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { BUNNY_STORAGE_BASE_URL, getBunnyStorageZone, getBunnyStoragePassword, BUNNY_ACCESS_KEY_HEADER } from "../constants/bunny";
import { deletePublicReview, FeedbackPublicationError, publishFeedbackReview } from "../services/feedbackPublication.service";

const router = Router();
const COLLECTION = "siteReviews";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const MAX_PHOTOS = 15;

type ReviewCategory = "wedding" | "oferta" | "both";
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
  // Recenziile vechi aveau un singur `photo`; cele noi au `photos: ReviewPhoto[]`.
  const photos = Array.isArray(data.photos)
    ? (data.photos as ReviewPhoto[])
    : data.photo
      ? [data.photo as ReviewPhoto]
      : [];
  return {
    id: doc.id,
    author: (data.author as string) ?? "",
    city: typeof data.city === "string" ? data.city : "",
    date: (data.date as string) ?? "",
    rating: data.rating === null ? null : (data.rating as number) ?? 5,
    text: (data.text as string) ?? "",
    photos,
    verified: data.verified === true,
    category: (data.category as ReviewCategory) ?? "wedding",
    offerSlug: (data.offerSlug as string | null) ?? null,
    order: typeof data.order === "number" ? data.order : 0,
  };
}

function parseAlbumPhotoUrls(value: string | undefined): ReviewPhoto[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is { url: string; name?: string } => Boolean(item && typeof item.url === "string"))
      .map(item => ({ url: item.url, name: typeof item.name === "string" ? item.name : item.url.split("/").pop() ?? "fotografie" }))
      .filter(photo => photo.url.startsWith("https://") && (!process.env.BUNNY_CDN_DOMAIN || photo.url.startsWith(`https://${process.env.BUNNY_CDN_DOMAIN}/`)));
  } catch { return []; }
}

function parseStringArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

function orderPhotos(photos: ReviewPhoto[], order: string[], fileIds: string[] = []): ReviewPhoto[] {
  if (order.length === 0) return photos;
  const byKey = new Map<string, ReviewPhoto>();
  photos.forEach(photo => byKey.set(photo.url, photo));
  fileIds.forEach((id, index) => {
    const photo = photos[photos.length - fileIds.length + index];
    if (photo) byKey.set(`file:${id}`, photo);
  });
  const ordered = order.map(key => byKey.get(key)).filter((photo): photo is ReviewPhoto => Boolean(photo));
  return ordered.length === photos.length ? ordered : [...ordered, ...photos.filter(photo => !ordered.includes(photo))];
}

// GET /api/reviews?category=wedding — recenzii pentru paginile de oraș/foto-video
// GET /api/reviews?category=oferta&offerSlug=olx — recenzii pentru o pagină de ofertă anume
// (o recenzie de tip "oferta" fără offerSlug apare pe TOATE paginile de ofertă)
router.get("/", async (req: Request, res: Response) => {
  const category: ReviewCategory = req.query.category === "oferta" ? "oferta" : "wedding";
  const offerSlug = typeof req.query.offerSlug === "string" ? req.query.offerSlug.trim() : "";

  try {
    const snapshot = await firestore().collection(COLLECTION).where("category", "in", [category, "both"]).get();
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

router.post("/admin", requireFirebaseAuth, requireSupremeAdmin, upload.array("photos", MAX_PHOTOS), async (req: Request, res: Response) => {
  const { author, city, date, rating, text, category, offerSlug, verified, sourceFeedbackId, albumPhotoUrls, photoOrder, photoFileIds } = req.body as Record<string, string | undefined>;
  if (!author?.trim() || !text?.trim()) {
    res.status(400).json({ error: "Nume și text sunt obligatorii." });
    return;
  }

  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const albumPhotos = parseAlbumPhotoUrls(albumPhotoUrls);
    const uploadedPhotos = await Promise.all(files.map(uploadReviewPhoto));
    const photos = orderPhotos([...albumPhotos, ...uploadedPhotos], parseStringArray(photoOrder), parseStringArray(photoFileIds)).slice(0, MAX_PHOTOS);
    const review = {
      author: author.trim(),
      city: city?.trim() || "",
      date: date?.trim() || new Date().toISOString().slice(0, 10),
      rating: rating === "0" || (sourceFeedbackId && !rating) ? null : Math.min(5, Math.max(1, Number(rating) || 5)),
      text: text.trim(),
      photos,
      verified: verified === "true",
      category: category === "both" ? "both" : category === "oferta" ? "oferta" : "wedding",
      offerSlug: category !== "wedding" && offerSlug?.trim() ? offerSlug.trim() : null,
      order: Date.now(),
      createdAt: Timestamp.now(),
    };
    const docRef = sourceFeedbackId
      ? await publishFeedbackReview(sourceFeedbackId, review)
      : await firestore().collection(COLLECTION).add(review);
    const doc = await docRef.get();
    res.status(201).json({ review: serializeReview(doc) });
  } catch (error) {
    if (error instanceof FeedbackPublicationError) { res.status(error.status).json({ error: error.message }); return; }
    console.error("[reviews] POST /admin failed:", error);
    res.status(500).json({ error: "Recenzia nu a putut fi salvată." });
  }
});

router.put("/admin/:id", requireFirebaseAuth, requireSupremeAdmin, upload.array("photos", MAX_PHOTOS), async (req: Request, res: Response) => {
  const { author, city, date, rating, text, category, offerSlug, verified, keepPhotoUrls, albumPhotoUrls, photoOrder, photoFileIds } = req.body as Record<string, string | undefined>;
  try {
    const ref = firestore().collection(COLLECTION).doc(req.params.id);
    const update: Record<string, unknown> = {};
    if (author !== undefined) update.author = author.trim();
    if (city !== undefined) update.city = city.trim();
    if (date !== undefined) update.date = date.trim();
    if (rating !== undefined) update.rating = rating === "0" ? null : Math.min(5, Math.max(1, Number(rating) || 5));
    if (text !== undefined) update.text = text.trim();
    if (category !== undefined) update.category = category === "both" ? "both" : category === "oferta" ? "oferta" : "wedding";
    if (offerSlug !== undefined) update.offerSlug = category !== "wedding" && offerSlug?.trim() ? offerSlug.trim() : null;
    if (category === "wedding") update.offerSlug = null;
    if (verified !== undefined) update.verified = verified === "true";

    if (keepPhotoUrls !== undefined) {
      const existingSnapshot = await ref.get();
      const existingData = existingSnapshot.data() ?? {};
      const existingPhotos: ReviewPhoto[] = Array.isArray(existingData.photos)
        ? (existingData.photos as ReviewPhoto[])
        : existingData.photo
          ? [existingData.photo as ReviewPhoto]
          : [];
      let keepUrls: string[] = [];
      try {
        const parsed = JSON.parse(keepPhotoUrls);
        if (Array.isArray(parsed)) keepUrls = parsed.filter((u): u is string => typeof u === "string");
      } catch {
        // keepPhotoUrls invalid — nu păstrăm nicio poză veche
      }
      const kept = existingPhotos.filter((p) => keepUrls.includes(p.url));
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const uploaded = await Promise.all(files.map(uploadReviewPhoto));
      const albumPhotos = parseAlbumPhotoUrls(albumPhotoUrls);
      const merged = [...kept, ...albumPhotos, ...uploaded];
      const unique = merged.filter((photo, index, all) => all.findIndex(item => item.url === photo.url) === index);
      update.photos = orderPhotos(unique, parseStringArray(photoOrder), parseStringArray(photoFileIds)).slice(0, MAX_PHOTOS);
      if ("photo" in existingData) update.photo = FieldValue.delete();
    }

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
    await deletePublicReview(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error("[reviews] DELETE /admin/:id failed:", error);
    res.status(500).json({ error: "Recenzia nu a putut fi ștearsă." });
  }
});

export default router;
