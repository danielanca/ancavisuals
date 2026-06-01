import { Router, type Request, type Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "../firestore.js";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth.js";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROFILES_COL = "health_profiles";
const WEIGHT_COL = "health_weight_logs";
const RECOMMEND_COL = "health_recommendations";

const TODAY = () => new Date().toISOString().slice(0, 10);

// ── PROFILES ──────────────────────────────────────────────────────────────────

router.get("/profiles", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snap = await db.collection(PROFILES_COL).get();
    const profiles: Record<string, unknown> = {};
    snap.docs.forEach((doc) => { profiles[doc.id] = { id: doc.id, ...doc.data() }; });
    res.json({ profiles });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put("/profiles/:userId", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection(PROFILES_COL).doc(req.params.userId).set(req.body, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ── WEIGHT LOGS ───────────────────────────────────────────────────────────────

router.post("/weight/:userId", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { weight, date } = req.body as { weight: number; date?: string };
    if (!weight || weight < 20 || weight > 300) {
      res.status(400).json({ error: "Greutate invalidă." }); return;
    }
    const day = date ?? TODAY();
    const db = firestore();
    await db.collection(WEIGHT_COL).doc(`${req.params.userId}_${day}`).set({
      userId: req.params.userId,
      weight,
      date: day,
      loggedAt: FieldValue.serverTimestamp(),
    });
    res.json({ ok: true, date: day, weight });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/weight/:userId", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const snap = await db.collection(WEIGHT_COL)
      .where("userId", "==", req.params.userId)
      .orderBy("date", "desc")
      .limit(90)
      .get();
    const entries = snap.docs.map((doc) => doc.data());
    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ── AI MEAL RECOMMENDATIONS ───────────────────────────────────────────────────

router.get("/recommend/:userId", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const today = TODAY();
    const doc = await db.collection(RECOMMEND_COL).doc(`${req.params.userId}_${today}`).get();
    if (doc.exists) {
      res.json({ recommendation: doc.data(), cached: true });
    } else {
      res.json({ recommendation: null, cached: false });
    }
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/recommend/:userId", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = firestore();

    // Get profile
    const profileDoc = await db.collection(PROFILES_COL).doc(userId).get();
    const profile = profileDoc.data() as {
      name?: string;
      height?: number;
      targetWeight?: number;
      dailyCalories?: number;
    } | undefined;

    // Get latest weight
    const weightSnap = await db.collection(WEIGHT_COL)
      .where("userId", "==", userId)
      .orderBy("date", "desc")
      .limit(1)
      .get();
    const latestWeight = weightSnap.empty ? null : (weightSnap.docs[0].data().weight as number);

    const name = profile?.name ?? userId;
    const targetWeight = profile?.targetWeight ?? 70;
    const dailyCalories = profile?.dailyCalories ?? 1600;
    const currentWeight = latestWeight ?? targetWeight + 10;
    const tolose = Math.max(0, currentWeight - targetWeight);

    const prompt = `Ești un nutriționist specializat în dietă ketogenică și mediteraneană.

Generează un plan de mese pentru AZI pentru ${name}.
- Greutate curentă: ${currentWeight} kg
- Greutate țintă: ${targetWeight} kg (mai are ${tolose.toFixed(1)} kg de slăbit)
- Calorii zilnice: ~${dailyCalories} kcal
- RESTRICȚII OBLIGATORII: fără gluten, carbohidrați redus (sub 50g net/zi)
- Preferințe: bucătărie românească/mediteraneană, preparate simple, grill/cuptor

Returnează DOAR un obiect JSON valid, fără text în jur:
{
  "breakfast": { "name": "...", "ingredients": "...", "calories": 0, "prepTime": "...", "tip": "..." },
  "lunch": { "name": "...", "ingredients": "...", "calories": 0, "prepTime": "...", "tip": "..." },
  "dinner": { "name": "...", "ingredients": "...", "calories": 0, "prepTime": "...", "tip": "..." },
  "snack": { "name": "...", "ingredients": "...", "calories": 0 },
  "totalCalories": 0,
  "waterLiters": 2.5,
  "motivationalTip": "...",
  "carbsGrams": 0
}`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { res.status(500).json({ error: "AI nu a returnat JSON valid." }); return; }

    const recommendation = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const today = TODAY();

    await db.collection(RECOMMEND_COL).doc(`${userId}_${today}`).set({
      ...recommendation,
      userId,
      date: today,
      generatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ recommendation: { ...recommendation, date: today }, cached: false });
  } catch (error) {
    console.error("[health] recommend error:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
