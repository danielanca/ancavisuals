import { Router, type Request, type Response } from "express";
import { createHash } from "crypto";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { loadAlbum, resolveAlbumSlug } from "../services/album.service";
import { generateFeedbackVariants } from "../services/feedbackAi.service";
import { FEEDBACK_MESSAGE_LIMIT, FEEDBACK_NAME_LIMIT, isFeedbackSlug, type ClientFeedback } from "../../shared/feedback/feedback";

const router = Router();
const COLLECTION = "clientFeedback";
const ID = /^[a-zA-Z0-9_-]{16,80}$/;
const HOUR = 60 * 60 * 1000;
class FeedbackError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function fail(res: Response, error: unknown) {
  if (error instanceof FeedbackError) { res.status(error.status).json({ error: error.message }); return; }
  console.error("[feedback] request failed", error instanceof Error ? error.name : "Unknown error");
  res.status(500).json({ error: "Nu am putut procesa cererea. Încearcă din nou." });
}
function getMessage(body: unknown) {
  const value = body && typeof body === "object" && "message" in body ? body.message : null;
  if (typeof value !== "string" || value.trim().length < 3 || value.length > FEEDBACK_MESSAGE_LIMIT) {
    throw new FeedbackError(400, `Scrie câteva cuvinte (între 3 și ${FEEDBACK_MESSAGE_LIMIT} de caractere).`);
  }
  return value.trim();
}
async function albumSlug(value: string) {
  if (!isFeedbackSlug(value)) throw new FeedbackError(400, "Link de feedback invalid.");
  const canonical = await resolveAlbumSlug(value);
  if (!await loadAlbum(canonical)) throw new FeedbackError(404, "Albumul pentru acest feedback nu există.");
  return canonical;
}
async function checkRate(tx: FirebaseFirestore.Transaction, req: Request, kind: "submit" | "ai") {
  const now = Date.now();
  const hash = createHash("sha256").update(req.ip || req.socket?.remoteAddress || "unknown").digest("hex");
  const ref = firestore().collection("feedbackRateLimits").doc(`${kind}-${hash}`);
  const doc = await tx.get(ref);
  const data = doc.data();
  const active = typeof data?.resetAt === "number" && data.resetAt > now;
  const count = active && typeof data?.count === "number" ? data.count : 0;
  if (count >= 5) throw new FeedbackError(429, "Ai făcut mai multe cereri într-un timp scurt. Te rugăm să revii peste o oră.");
  return { ref, data: { count: count + 1, resetAt: active ? data!.resetAt : now + HOUR } };
}
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

router.post("/:slug/variants", async (req, res) => {
  try {
    const message = getMessage(req.body);
    if (!process.env.ANTHROPIC_API_KEY) throw new FeedbackError(503, "Asistentul AI nu este disponibil momentan. Poți scrie și trimite feedback-ul direct.");
    const slug = await albumSlug(req.params.slug);
    await firestore().runTransaction(async tx => {
      const rate = await checkRate(tx, req, "ai");
      tx.set(rate.ref, rate.data);
    });
    const variants = await generateFeedbackVariants(message);
    res.json({ variants, albumSlug: slug });
  } catch (error) { fail(res, error); }
});

router.post("/:slug", async (req, res) => {
  try {
    const message = getMessage(req.body);
    const { name, requestId, website } = req.body as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim() || name.length > FEEDBACK_NAME_LIMIT) throw new FeedbackError(400, "Completează numele (maximum 100 de caractere).");
    if (typeof requestId !== "string" || !ID.test(requestId)) throw new FeedbackError(400, "Cerere invalidă. Reîncarcă pagina.");
    if (website) throw new FeedbackError(400, "Cerere invalidă.");
    const slug = await albumSlug(req.params.slug);
    const db = firestore();
    await db.runTransaction(async tx => {
      const ref = db.collection(COLLECTION).doc(requestId);
      const existing = await tx.get(ref);
      if (existing.exists) {
        const data = existing.data()!;
        if (data.albumSlug !== slug || data.name !== name.trim() || data.message !== message) throw new FeedbackError(409, "Această cerere a fost deja trimisă cu alt text. Reîncarcă pagina pentru un feedback nou.");
        return;
      }
      const rate = await checkRate(tx, req, "submit");
      tx.set(ref, { albumSlug: slug, name: name.trim(), message, createdAt: new Date().toISOString(), read: false });
      tx.set(rate.ref, rate.data);
    });
    res.status(201).json({ ok: true });
  } catch (error) { fail(res, error); }
});

router.get("/admin/all", requireFirebaseAuth, requireSupremeAdmin, async (req, res) => {
  try {
    const collection = firestore().collection(COLLECTION);
    let query = collection.orderBy("createdAt", "desc").limit(50);
    if (req.query.cursor !== undefined) {
      if (typeof req.query.cursor !== "string" || !ID.test(req.query.cursor)) throw new FeedbackError(400, "Cursor invalid.");
      const cursor = await collection.doc(req.query.cursor).get();
      if (!cursor.exists) throw new FeedbackError(400, "Cursor invalid.");
      query = query.startAfter(cursor);
    }
    const snapshot = await query.get();
    const feedback: ClientFeedback[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, albumSlug: data.albumSlug, name: data.name, message: data.message, createdAt: data.createdAt, read: data.read === true };
    });
    res.json({ feedback, nextCursor: snapshot.docs.length === 50 ? snapshot.docs[49].id : null });
  } catch (error) { fail(res, error); }
});
router.patch("/admin/:id/read", requireFirebaseAuth, requireSupremeAdmin, async (req, res) => {
  try {
    if (!ID.test(req.params.id)) throw new FeedbackError(400, "ID invalid.");
    const ref = firestore().collection(COLLECTION).doc(req.params.id);
    await firestore().runTransaction(async tx => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new FeedbackError(404, "Feedback-ul nu există.");
      tx.update(ref, { read: true });
    });
    res.json({ ok: true });
  } catch (error) { fail(res, error); }
});
export default router;
