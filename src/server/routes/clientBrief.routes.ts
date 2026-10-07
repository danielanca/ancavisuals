import express, { type Response } from "express";
import { randomBytes } from "crypto";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { emptyBriefAnswers, getBriefMoments, validateBriefAnswers, type ClientBrief, type TodayBriefEvent } from "../../shared/clientBrief/clientBrief";

import { expandEventDates } from "../utils/expandEventDates";

const router = express.Router();
const collection = "eventClientBriefs";
const tokens = "eventClientBriefTokens";
class BriefError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function fail(res: Response, error: unknown) {
  if (error instanceof BriefError) { res.status(error.status).json({ error: error.message }); return; }
  console.error("[clientBrief]", error);
  res.status(500).json({ error: "Brief-ul nu a putut fi procesat. Încercați din nou." });
}
function dateString(value: unknown): string | null {
  if (!value) return null;
  const date = typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate() : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function publicBrief(data: ClientBrief): ClientBrief {
  return {
    clientName: data.clientName, eventType: data.eventType, eventDate: data.eventDate,
    moments: data.moments, answers: data.answers, status: data.status,
    revision: data.revision, updatedAt: data.updatedAt, submittedAt: data.submittedAt,
  };
}
router.get("/admin/today", requireFirebaseAuth, requireSupremeAdmin, async (_req, res) => {
  try {
    const db = firestore();
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const day = ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
    const snapshot = await db.collection("adminEvents").get();
    const today = snapshot.docs.filter(doc => {
      const data = doc.data();
      return ["confirmat", "finalizat"].includes(data.status) && expandEventDates({
        ...data, eventDate: dateString(data.eventDate), eventEndDate: dateString(data.eventEndDate),
      }).includes(day);
    });
    const events: TodayBriefEvent[] = await Promise.all(today.map(async doc => {
      const data = doc.data();
      const brief = await db.collection(collection).doc(doc.id).get();
      return {
        id: doc.id, clientName: data.client?.fullName ?? "Client", eventType: data.typeLabel || data.type || "Eveniment",
        eventDate: dateString(data.eventDate), phone: data.client?.phone ?? "",
        services: Array.isArray(data.services) ? data.services.map((service: { name?: string }) => service.name).filter((name: unknown): name is string => typeof name === "string") : [],
        brief: brief.exists ? publicBrief(brief.data() as ClientBrief) : null,
      };
    }));
    events.sort((a, b) => a.clientName.localeCompare(b.clientName, "ro"));
    res.set("Cache-Control", "no-store").json({ day, events });
  } catch (error) { fail(res, error); }
});
router.post("/admin/events/:eventId", requireFirebaseAuth, requireSupremeAdmin, async (req, res) => {
  try {
    const db = firestore();
    const ref = db.collection(collection).doc(req.params.eventId);
    const result = await db.runTransaction(async tx => {
      const event = await tx.get(db.collection("adminEvents").doc(req.params.eventId));
      if (!event.exists) throw new BriefError(404, "Evenimentul nu există.");
      const existing = await tx.get(ref);
      if (existing.exists) return existing.data()!;
      const source = event.data()!;
      const token = randomBytes(32).toString("hex");
      const data = {
        clientName: source.client?.fullName ?? "Client", eventType: source.typeLabel || source.type || "Eveniment",
        eventDate: dateString(source.eventDate), moments: getBriefMoments(source.type),
        answers: emptyBriefAnswers(), status: "draft", revision: 0,
        updatedAt: new Date().toISOString(), submittedAt: null, token,
      };
      tx.set(ref, data);
      tx.set(db.collection(tokens).doc(token), { eventId: req.params.eventId });
      return data;
    });
    res.json({ brief: { ...publicBrief(result as ClientBrief), url: `/brief-client/${result.token}` } });
  } catch (error) { fail(res, error); }
});
router.get("/admin/events/:eventId", requireFirebaseAuth, requireSupremeAdmin, async (req, res) => {
  try {
    const db = firestore();
    const [event, brief] = await Promise.all([
      db.collection("adminEvents").doc(req.params.eventId).get(),
      db.collection(collection).doc(req.params.eventId).get(),
    ]);
    if (!event.exists || !brief.exists) throw new BriefError(404, "Brief-ul nu există.");
    const data = brief.data()!;
    res.set("Cache-Control", "no-store").json({ brief: { ...publicBrief(data as ClientBrief), url: `/brief-client/${data.token}` } });
  } catch (error) { fail(res, error); }
});
async function resolveToken(token: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new BriefError(404, "Linkul de brief nu este disponibil.");
  const link = await firestore().collection(tokens).doc(token).get();
  if (!link.exists) throw new BriefError(404, "Linkul de brief nu este disponibil.");
  return link.data()!.eventId;
}
router.get("/:token", async (req, res) => {
  try {
    const eventId = await resolveToken(req.params.token);
    const db = firestore();
    const [event, brief] = await Promise.all([
      db.collection("adminEvents").doc(eventId).get(), db.collection(collection).doc(eventId).get(),
    ]);
    if (!event.exists || !brief.exists) throw new BriefError(404, "Linkul de brief nu este disponibil.");
    res.set("Cache-Control", "no-store").json({ brief: publicBrief(brief.data() as ClientBrief) });
  } catch (error) { fail(res, error); }
});
router.put("/:token", async (req, res) => {
  try {
    const eventId = await resolveToken(req.params.token);
    if (!["draft", "completed"].includes(req.body?.status) || !Number.isInteger(req.body?.revision)) throw new BriefError(400, "Cerere invalidă.");
    const db = firestore();
    const ref = db.collection(collection).doc(eventId);
    const brief = await db.runTransaction(async tx => {
      const [event, snapshot] = await Promise.all([tx.get(db.collection("adminEvents").doc(eventId)), tx.get(ref)]);
      if (!event.exists || !snapshot.exists) throw new BriefError(404, "Linkul de brief nu este disponibil.");
      const data = snapshot.data() as ClientBrief;
      if (req.body.revision !== data.revision) throw new BriefError(409, "Brief-ul a fost actualizat în altă fereastră. Reîncărcați pagina înainte de a salva.");
      let answers;
      try { answers = validateBriefAnswers(req.body.answers, data.moments); }
      catch (error) { throw new BriefError(400, error instanceof Error ? error.message : "Răspunsuri invalide."); }
      if (req.body.status === "completed" && !answers.priorities) throw new BriefError(400, "Spuneți-ne ce este cel mai important pentru voi înainte de a trimite brief-ul.");
      const now = new Date().toISOString();
      const updated = { ...data, answers, status: req.body.status as ClientBrief["status"], revision: data.revision + 1, updatedAt: now, submittedAt: req.body.status === "completed" ? now : null };
      tx.update(ref, { answers, status: updated.status, revision: updated.revision, updatedAt: now, submittedAt: updated.submittedAt });
      return publicBrief(updated);
    });
    res.json({ brief });
  } catch (error) { fail(res, error); }
});
export default router;
