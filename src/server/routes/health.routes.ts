import { Router, type Request, type Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import multer from "multer";
import sharp from "sharp";
import nodeFetch from "node-fetch";
import https from "node:https";
import { firestore } from "../firestore.js";
import type { NextFunction } from "express";
import { requireFirebaseAuth, requireEsteraOrAdmin, ESTERA_EMAIL, type AuthenticatedRequest } from "../middleware/requireFirebaseAuth.js";
import { buildBunnyStorageUrl, getBunnyStorageKey, BUNNY_ACCESS_KEY_HEADER } from "../constants/bunny.js";
import Anthropic from "@anthropic-ai/sdk";

const bunnyAgent = new https.Agent({ rejectUnauthorized: false });

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const PROFILES_COL = "health_profiles";
const WEIGHT_COL = "health_weight_logs";
const RECOMMEND_COL = "health_recommendations";
const ACTIVITY_COL = "health_activity_logs";
const PENALTIES_COL = "health_penalties";
const FOOD_COL = "health_food_logs";
const HEALTH_FOLDER = "health-activity";

const TODAY = () => new Date().toISOString().slice(0, 10);

function requireHealthAccess(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;
  const isEstera = authReq.firebaseEmail === ESTERA_EMAIL;
  if (!authReq.isSupremeAdmin && !isEstera) {
    res.status(403).json({ error: "Acces interzis" }); return;
  }
  const userId = (req.params as { userId?: string }).userId;
  if (userId && !authReq.isSupremeAdmin && userId !== "estera") {
    res.status(403).json({ error: "Acces interzis" }); return;
  }
  next();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function uploadHealthPhoto(buffer: Buffer, userId: string, date: string): Promise<string> {
  const jpegBuffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
  const filename = `${userId}-${date}-${Date.now()}.jpg`;
  const storagePath = `${HEALTH_FOLDER}/${filename}`;
  await nodeFetch(buildBunnyStorageUrl(storagePath), {
    method: "PUT",
    headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey(), "Content-Type": "image/jpeg" },
    body: jpegBuffer,
    agent: bunnyAgent,
  });
  const cdnDomain = (process.env.BUNNY_CDN_DOMAIN ?? "").replace(/\/$/, "");
  return `${cdnDomain}/${storagePath}`;
}

async function extractStepsAndDateFromPhoto(buffer: Buffer): Promise<{ steps: number; date: string | null }> {
  const jpegBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegBuffer.toString("base64") } },
        {
          type: "text",
          text: "Aceasta este o captură de ecran din aplicația Health (iPhone/Android/ceas Garmin/Samsung etc.). Extrage numărul TOTAL de pași și data afișată în poză. Returnează DOAR un JSON cu formatul: {\"steps\":8432,\"date\":\"2025-06-15\"}. Data trebuie în format YYYY-MM-DD. Dacă nu poți identifica pașii, pune 0. Dacă nu poți identifica data, pune null.",
        },
      ],
    }],
  });
  const rawText = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  console.log("[health] extractStepsAndDate rawText:", rawText);
  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as { steps?: number; date?: string | null };
    const steps = typeof parsed.steps === "number" && !isNaN(parsed.steps) ? parsed.steps : 0;
    const date = typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;
    console.log("[health] extracted steps:", steps, "date:", date);
    return { steps, date };
  } catch (e) {
    console.log("[health] JSON parse failed:", e, "rawText was:", rawText);
    const steps = parseInt(rawText.replace(/[^0-9]/g, ""), 10);
    return { steps: isNaN(steps) ? 0 : steps, date: null };
  }
}

async function getStepBank(userId: string, stepTarget: number) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStr = now.toISOString().slice(0, 7);

  // Use profile createdAt as start date so users aren't penalized for days before joining
  const profileDoc = await firestore().collection(PROFILES_COL).doc(userId).get();
  const createdAt = String(profileDoc.data()?.createdAt ?? todayStr);
  const startDate = createdAt > `${monthStr}-01` ? createdAt : `${monthStr}-01`;

  // Count days elapsed since startDate (inclusive of today)
  const startMs = new Date(startDate).getTime();
  const todayMs = new Date(todayStr).getTime();
  const daysElapsed = Math.floor((todayMs - startMs) / 86400000) + 1;

  const snap = await firestore().collection(ACTIVITY_COL)
    .where("userId", "==", userId)
    .get();
  const relevantEntries = snap.docs
    .map((doc) => doc.data())
    .filter((entry) => {
      const date = String(entry.date ?? "");
      return date >= startDate && date <= todayStr;
    });
  const totalSteps = relevantEntries.reduce((sum, entry) => sum + ((entry.steps as number) || 0), 0);
  const daysLogged = relevantEntries.length;
  const bank = totalSteps - stepTarget * daysElapsed;
  const penaltySteps = bank < 0 ? Math.abs(bank) : 0;
  const penaltyDays = penaltySteps / stepTarget;
  const penaltyAmount = Math.round((penaltySteps / stepTarget) * 5 * 100) / 100;
  return { totalSteps, daysLogged, daysElapsed, bank, penaltyDays, penaltyAmount };
}

// ── PROFILES ──────────────────────────────────────────────────────────────────

router.get("/profiles", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const snap = await firestore().collection(PROFILES_COL).get();
    const profiles: Record<string, unknown> = {};
    snap.docs.forEach((doc) => {
      if (authReq.isSupremeAdmin || doc.id === "estera") {
        profiles[doc.id] = { id: doc.id, ...doc.data() };
      }
    });
    res.json({ profiles });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put("/profiles/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const docRef = db.collection(PROFILES_COL).doc(req.params.userId);
    const existing = await docRef.get();
    const payload = { ...req.body };
    const isNew = !existing.exists;
    if (isNew) {
      if (payload.currentWeight) payload.startWeight = payload.currentWeight;
      payload.createdAt = TODAY();
    } else if (payload.onboardingComplete && !existing.data()?.createdAt) {
      payload.createdAt = TODAY();
    }
    await docRef.set(payload, { merge: true });

    // Seed weight log on profile creation or first onboarding completion so latestWeight is never null
    if (payload.currentWeight && (isNew || (!existing.data()?.onboardingComplete && payload.onboardingComplete))) {
      const today = TODAY();
      const weightRef = db.collection(WEIGHT_COL).doc(`${req.params.userId}_${today}`);
      const weightDoc = await weightRef.get();
      if (!weightDoc.exists) {
        await weightRef.set({
          userId: req.params.userId,
          weight: parseFloat(String(payload.currentWeight)),
          date: today,
          loggedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ── WEIGHT LOGS ───────────────────────────────────────────────────────────────

router.post("/weight/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const { weight, date } = req.body as { weight: number; date?: string };
    if (!weight || weight < 20 || weight > 300) {
      res.status(400).json({ error: "Greutate invalidă." }); return;
    }
    const day = date ?? TODAY();
    await firestore().collection(WEIGHT_COL).doc(`${req.params.userId}_${day}`).set({
      userId: req.params.userId, weight, date: day, loggedAt: FieldValue.serverTimestamp(),
    });
    res.json({ ok: true, date: day, weight });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/weight/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const snap = await firestore().collection(WEIGHT_COL)
      .where("userId", "==", req.params.userId)
      .limit(90)
      .get();
    const entries = snap.docs.map((doc) => doc.data()).sort((a, b) =>
      String(b.date ?? "").localeCompare(String(a.date ?? ""))
    );
    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ── ACTIVITY / STEPS ──────────────────────────────────────────────────────────

router.post(
  "/activity/:userId",
  requireFirebaseAuth,
  requireHealthAccess,
  async (req: Request, res: Response) => {
    try {
      const { photoBase64, date: reqDate } = req.body as { photoBase64?: string; date?: string };
      if (!photoBase64) { res.status(400).json({ error: "Lipsește poza." }); return; }

      const buffer = Buffer.from(photoBase64, "base64");
      const { steps, date: photoDate } = await extractStepsAndDateFromPhoto(buffer);
      if (steps === 0) {
        res.status(422).json({ error: "Nu am putut extrage pașii din poză. Asigură-te că ecranul e clar și numărul de pași e vizibil." });
        return;
      }
      if (!photoDate) {
        res.status(422).json({ error: "Nu am putut extrage data din poză. Asigură-te că data e vizibilă în captură." });
        return;
      }

      const date = photoDate;
      const photoUrl = await uploadHealthPhoto(buffer, req.params.userId, `${date}-${Date.now()}`);

      const docRef = firestore().collection(ACTIVITY_COL).doc(`${req.params.userId}_${date}`);
      const existingDoc = await docRef.get();
      const rawData = existingDoc.exists ? existingDoc.data() : null;

      // Backwards compat: old docs have flat structure, new ones have entries array
      type StepEntry = { steps: number; photoUrl: string; loggedAt: string };
      const existingEntries: StepEntry[] = rawData?.entries
        ? (rawData.entries as StepEntry[])
        : rawData?.steps
          ? [{ steps: rawData.steps as number, photoUrl: String(rawData.photoUrl ?? ""), loggedAt: String(rawData.loggedAt ?? "") }]
          : [];

      const newEntry: StepEntry = { steps, photoUrl, loggedAt: new Date().toISOString() };
      const allEntries = [...existingEntries, newEntry];
      const maxSteps = Math.max(...allEntries.map((e) => e.steps));
      const prevMax = existingEntries.length > 0 ? Math.max(...existingEntries.map((e) => e.steps)) : 0;
      const delta = steps - prevMax;

      await docRef.set({
        userId: req.params.userId, date, steps: maxSteps, entries: allEntries, loggedAt: FieldValue.serverTimestamp(),
      });

      res.json({ ok: true, steps, maxSteps, delta: delta > 0 ? delta : 0, date, photoUrl, entries: allEntries });
    } catch (error) {
      console.error("[health] activity error:", error);
      res.status(500).json({ error: String(error) });
    }
  }
);

router.get("/activity/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const snap = await firestore().collection(ACTIVITY_COL)
      .where("userId", "==", req.params.userId)
      .limit(90)
      .get();
    const entries = snap.docs.map((doc) => doc.data()).sort((a, b) =>
      String(b.date ?? "").localeCompare(String(a.date ?? ""))
    );
    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/bank/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const profileDoc = await firestore().collection(PROFILES_COL).doc(req.params.userId).get();
    const stepTarget = (profileDoc.data()?.stepTarget as number) || 8000;
    const bank = await getStepBank(req.params.userId, stepTarget);
    res.json(bank);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ── PENALTIES ─────────────────────────────────────────────────────────────────

router.get("/penalties/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const snap = await firestore().collection(PENALTIES_COL)
      .where("userId", "==", req.params.userId)
      .limit(12)
      .get();
    const penalties = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String((b as Record<string, unknown>).month ?? "").localeCompare(String((a as Record<string, unknown>).month ?? "")));
    res.json({ penalties });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/penalties/:userId/pay", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const { month } = req.body as { month: string };
    await firestore().collection(PENALTIES_COL).doc(`${req.params.userId}_${month}`).set(
      { paid: true, paidAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ── AI MEAL RECOMMENDATIONS ───────────────────────────────────────────────────

router.get("/recommend/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const today = TODAY();
    const doc = await firestore().collection(RECOMMEND_COL).doc(`${req.params.userId}_${today}`).get();
    res.json({ recommendation: doc.exists ? doc.data() : null, cached: doc.exists });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/recommend/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = firestore();

    const profileDoc = await db.collection(PROFILES_COL).doc(userId).get();
    const profile = profileDoc.data() as {
      name?: string; height?: number; targetWeight?: number; dailyCalories?: number;
      age?: number; sex?: string; activityLevel?: string;
    } | undefined;

    const weightSnap = await db.collection(WEIGHT_COL)
      .where("userId", "==", userId).orderBy("date", "desc").limit(1).get();
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
      ...recommendation, userId, date: today, generatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ recommendation: { ...recommendation, date: today }, cached: false });
  } catch (error) {
    console.error("[health] recommend error:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ── FOOD LOG ──────────────────────────────────────────────────────────────────

interface FoodAnalysis {
  food: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "low" | "medium" | "high";
  aiNote: string;
}

async function analyzeFood(buffer: Buffer | null, note: string): Promise<FoodAnalysis> {
  const content: Anthropic.MessageParam["content"] = [];

  if (buffer) {
    const jpegBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: jpegBuffer.toString("base64") },
    });
  }

  const handNote = buffer ? " Dacă există o mână vizibilă, folosește-o ca referință pentru estimarea porției." : "";
  content.push({
    type: "text",
    text: `Ești un nutriționist. Analizează ${buffer ? "fotografia cu mâncare/băutură" : "descrierea alimentului"} și estimează valorile nutriționale.
${note ? `Notă utilizator: "${note}"` : ""}${handNote}

Reguli:
- Returnează DOAR un obiect JSON brut. Fără markdown, fără code fences, fără text înainte sau după.
- Toate valorile text (food, quantity, aiNote) trebuie să fie în limba română.
- Numerele trebuie să fie întregi sau zecimale simple, fără unități în câmpurile numerice.

Format JSON (completează cu valori reale):
{"food":"numele alimentului în română","quantity":"cantitatea estimată ex. 200g sau 300ml","calories":0,"protein":0,"carbs":0,"fat":0,"confidence":"medium","aiNote":"observație scurtă în română"}`,
  });

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content }],
  });

  const rawText = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
  // Strip markdown code fences if present
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown> = {};
  try {
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) as Record<string, unknown> : {};
  } catch {
    // Last resort: extract individual fields with regex
    const extract = (key: string) => cleaned.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`))?.[1] ?? "";
    const extractNum = (key: string) => parseFloat(cleaned.match(new RegExp(`"${key}"\\s*:\\s*([0-9.]+)`))?.[1] ?? "0") || 0;
    parsed = {
      food: extract("food") || "Aliment neidentificat",
      quantity: extract("quantity") || "—",
      calories: extractNum("calories"),
      protein: extractNum("protein"),
      carbs: extractNum("carbs"),
      fat: extractNum("fat"),
      confidence: "low",
      aiNote: "Estimare aproximativă",
    };
  }

  return {
    food: String(parsed.food ?? "Aliment necunoscut"),
    quantity: String(parsed.quantity ?? "—"),
    calories: Number(parsed.calories) || 0,
    protein: Number(parsed.protein) || 0,
    carbs: Number(parsed.carbs) || 0,
    fat: Number(parsed.fat) || 0,
    confidence: (["low", "medium", "high"].includes(String(parsed.confidence)) ? parsed.confidence : "medium") as FoodAnalysis["confidence"],
    aiNote: String(parsed.aiNote ?? ""),
  };
}

// Preview only — analyze without saving
router.post(
  "/food/:userId/preview",
  requireFirebaseAuth,
  requireHealthAccess,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { photoBase64, note: rawNote } = req.body as { photoBase64?: string; note?: string };
      const note = String(rawNote ?? "").trim();
      if (!photoBase64 && !note) {
        res.status(400).json({ error: "Adaugă o poză sau o notă." }); return;
      }
      const buffer = photoBase64 ? Buffer.from(photoBase64, "base64") : null;
      const analysis = await analyzeFood(buffer, note);
      // Return analysis + current day total so frontend can compute impact
      const today = TODAY();
      const snap = await firestore().collection(FOOD_COL).doc(`${userId}_${today}`).get();
      const currentCalories = snap.exists ? ((snap.data()?.totalCalories as number) ?? 0) : 0;
      res.json({ ok: true, analysis, currentCalories });
    } catch (error) {
      console.error("[health] food preview error:", error);
      res.status(500).json({ error: String(error) });
    }
  }
);

router.post(
  "/food/:userId",
  requireFirebaseAuth,
  requireHealthAccess,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { photoBase64, note: rawNote, date: rawDate, analysis: rawAnalysis } = req.body as {
        photoBase64?: string; note?: string; date?: string; analysis?: string;
      };
      const note = String(rawNote ?? "").trim();
      const date = String(rawDate ?? TODAY());
      const buffer = photoBase64 ? Buffer.from(photoBase64, "base64") : null;

      if (!buffer && !note && !rawAnalysis) {
        res.status(400).json({ error: "Adaugă o poză sau o notă." }); return;
      }

      // Accept pre-analyzed data to avoid calling Claude twice
      let analysis: FoodAnalysis;
      const preAnalyzed = rawAnalysis ? JSON.parse(rawAnalysis) as FoodAnalysis : null;
      if (preAnalyzed && preAnalyzed.food) {
        analysis = preAnalyzed;
      } else {
        analysis = await analyzeFood(buffer, note);
      }

      let photoUrl: string | null = null;
      if (buffer) {
        const entryId = Date.now().toString();
        photoUrl = await uploadHealthPhoto(buffer, userId, `food-${date}-${entryId}`);
      }

      const entryId = Date.now().toString();
      const newEntry = { id: entryId, photoUrl, note: note || null, ...analysis, loggedAt: new Date().toISOString() };

      const db = firestore();
      const docRef = db.collection(FOOD_COL).doc(`${userId}_${date}`);
      const existing = await docRef.get();
      const existingEntries = existing.exists ? ((existing.data()?.entries ?? []) as typeof newEntry[]) : [];
      const entries = [...existingEntries, newEntry];
      const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);
      const totalProtein = entries.reduce((sum, e) => sum + e.protein, 0);
      const totalCarbs = entries.reduce((sum, e) => sum + e.carbs, 0);
      const totalFat = entries.reduce((sum, e) => sum + e.fat, 0);

      await docRef.set({ userId, date, entries, totalCalories, totalProtein, totalCarbs, totalFat });
      res.json({ ok: true, entry: newEntry, totalCalories });
    } catch (error) {
      console.error("[health] food error:", error);
      res.status(500).json({ error: String(error) });
    }
  }
);

router.get("/food/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const snap = await firestore().collection(FOOD_COL)
      .where("userId", "==", req.params.userId)
      .limit(30)
      .get();
    const logs = snap.docs.map((doc) => doc.data()).sort((a, b) =>
      String(b.date ?? "").localeCompare(String(a.date ?? ""))
    );
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ── AI PATTERN ANALYSIS ──────────────────────────────────────────────────────

const PATTERNS_COL = "health_patterns";
const PATTERNS_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

router.get("/patterns/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const doc = await firestore().collection(PATTERNS_COL).doc(req.params.userId).get();
    if (!doc.exists) { res.json({ patterns: null }); return; }
    const data = doc.data() as { generatedAt?: { toMillis: () => number }; [key: string]: unknown };
    const ageMs = data.generatedAt ? Date.now() - data.generatedAt.toMillis() : Infinity;
    const stale = ageMs > PATTERNS_TTL_MS;
    res.json({ patterns: data, stale });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/patterns/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = firestore();

    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [profileDoc, weightSnap, activitySnap, foodSnap] = await Promise.all([
      db.collection(PROFILES_COL).doc(userId).get(),
      db.collection(WEIGHT_COL).where("userId", "==", userId).where("date", ">=", cutoff).get(),
      db.collection(ACTIVITY_COL).where("userId", "==", userId).where("date", ">=", cutoff).get(),
      db.collection(FOOD_COL).where("userId", "==", userId).get(),
    ]);

    const profile = profileDoc.data() as {
      name?: string; height?: number; targetWeight?: number; dailyCalories?: number;
      age?: number; sex?: string; stepTarget?: number;
    } | undefined;

    type WeightDoc = { date: string; weight: number };
    type ActivityDoc = { date: string; steps: number };
    type FoodDoc = { date: string; totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number };

    const weightByDate = new Map<string, number>(
      weightSnap.docs.map((d) => { const w = d.data() as WeightDoc; return [w.date, w.weight]; })
    );
    const stepsByDate = new Map<string, number>(
      activitySnap.docs.map((d) => { const a = d.data() as ActivityDoc; return [a.date, a.steps]; })
    );
    const foodByDate = new Map<string, FoodDoc>(
      foodSnap.docs
        .map((d) => d.data() as FoodDoc)
        .filter((f) => f.date >= cutoff)
        .map((f) => [f.date, f])
    );

    const sortedDates = [...new Set([...weightByDate.keys(), ...stepsByDate.keys()])]
      .filter((d) => d >= cutoff)
      .sort();

    if (sortedDates.length < 5) {
      res.status(422).json({ error: "Date insuficiente — adaugă cel puțin 5 zile de date pentru analiză." });
      return;
    }

    type DayRow = { date: string; weight: string; delta: string; steps: number; stepPct: number; cal: number; prot: number; carbs: number; fat: number };
    const rows: DayRow[] = [];
    let prevWeight: number | null = null;
    for (const date of sortedDates) {
      const weight = weightByDate.get(date) ?? null;
      const delta = weight !== null && prevWeight !== null ? weight - prevWeight : null;
      if (weight !== null) prevWeight = weight;
      const steps = stepsByDate.get(date) ?? 0;
      const food = foodByDate.get(date);
      rows.push({
        date,
        weight: weight !== null ? weight.toFixed(1) : "—",
        delta: delta !== null ? (delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)) : "—",
        steps,
        stepPct: profile?.stepTarget ? Math.round((steps / profile.stepTarget) * 100) : 0,
        cal: food?.totalCalories ?? 0,
        prot: food?.totalProtein ?? 0,
        carbs: food?.totalCarbs ?? 0,
        fat: food?.totalFat ?? 0,
      });
    }

    const tableText = [
      "DATA       | KG    | DELTA  | PAȘI  | %ȚINTĂ | CAL  | PROT | CARBS | GRĂS",
      ...rows.map((r) =>
        `${r.date} | ${r.weight} | ${r.delta} | ${r.steps} | ${r.stepPct}% | ${r.cal} | ${r.prot} | ${r.carbs} | ${r.fat}`
      ),
    ].join("\n");

    const weightValues = rows.map((r) => parseFloat(r.weight)).filter((w) => !isNaN(w));
    const firstWeight = weightValues[0] ?? 0;
    const lastWeight = weightValues[weightValues.length - 1] ?? 0;
    const totalChange = lastWeight - firstWeight;

    const prompt = `Ești un expert în nutriție și pierdere în greutate. Analizează datele de sănătate de mai jos și identifică PATTERN-URIle concrete care au dus la pierdere sau câștig în greutate.

PROFIL:
- Greutate țintă: ${profile?.targetWeight ?? "?"}kg
- Calorii zilnice recomandate: ${profile?.dailyCalories ?? "?"}kcal
- Țintă pași/zi: ${profile?.stepTarget ?? "?"}
- Perioadă analizată: ${rows.length} zile
- Schimbare totală: ${totalChange >= 0 ? "+" : ""}${totalChange.toFixed(2)}kg

DATE ZILNICE (ultimele ${rows.length} zile):
${tableText}

INSTRUCȚIUNI:
1. Identifică MAXIM 3 pattern-uri POZITIVE (corelații clare cu scădere în greutate)
2. Identifică MAXIM 3 pattern-uri NEGATIVE (corelații cu stagnare/creștere)
3. Calculează: schimbare ultimele 7 zile și ultimele 30 zile
4. Dă O recomandare concretă pentru MÂINE bazată pe date
5. Formulează O concluzie principală în max 20 cuvinte

Returnează DOAR JSON valid, fără text în jur:
{
  "weeklyChange": 0.0,
  "monthlyChange": 0.0,
  "direction": "losing|stalling|gaining",
  "positivePatterns": [
    { "pattern": "text scurt", "impact": "text scurt cu cifre", "emoji": "emoji" }
  ],
  "negativePatterns": [
    { "pattern": "text scurt", "impact": "text scurt cu cifre", "emoji": "emoji" }
  ],
  "todayRecommendation": "text concret actionabil",
  "keyInsight": "o concluzie în max 20 cuvinte",
  "dataPoints": ${rows.length}
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { res.status(500).json({ error: "AI nu a returnat JSON valid." }); return; }

    const patterns = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    await db.collection(PATTERNS_COL).doc(userId).set({
      ...patterns,
      userId,
      generatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ patterns: { ...patterns, userId }, stale: false });
  } catch (error) {
    console.error("[health] patterns error:", error);
    res.status(500).json({ error: String(error) });
  }
});

router.delete("/food/:userId/:date/:entryId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const { userId, date, entryId } = req.params;
    const db = firestore();
    const docRef = db.collection(FOOD_COL).doc(`${userId}_${date}`);
    const existing = await docRef.get();
    if (!existing.exists) { res.json({ ok: true }); return; }

    const entries = ((existing.data()?.entries ?? []) as Array<{ id: string; calories: number; protein: number; carbs: number; fat: number }>)
      .filter((e) => e.id !== entryId);
    const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);
    const totalProtein = entries.reduce((sum, e) => sum + e.protein, 0);
    const totalCarbs = entries.reduce((sum, e) => sum + e.carbs, 0);
    const totalFat = entries.reduce((sum, e) => sum + e.fat, 0);
    await docRef.set({ ...existing.data(), entries, totalCalories, totalProtein, totalCarbs, totalFat });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ── DAILY FORECAST ────────────────────────────────────────────────────────────

router.post("/forecast/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = firestore();
    const today = TODAY();
    const cutoff14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [profileDoc, weightSnap, activitySnap, foodSnap, todayFoodDoc, todayActivitySnap] = await Promise.all([
      db.collection(PROFILES_COL).doc(userId).get(),
      db.collection(WEIGHT_COL).where("userId", "==", userId).where("date", ">=", cutoff14).get(),
      db.collection(ACTIVITY_COL).where("userId", "==", userId).where("date", ">=", cutoff14).get(),
      db.collection(FOOD_COL).where("userId", "==", userId).get(),
      db.collection(FOOD_COL).doc(`${userId}_${today}`).get(),
      db.collection(ACTIVITY_COL).where("userId", "==", userId).where("date", "==", today).get(),
    ]);

    type ProfType = { name?: string; height?: number; targetWeight?: number; dailyCalories?: number; age?: number; sex?: string; stepTarget?: number; currentWeight?: number };
    type WDoc = { date: string; weight: number };
    type ADoc = { date: string; steps: number };
    type FDoc = { date: string; totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number };

    const profile = profileDoc.data() as ProfType | undefined;
    const weightByDate = new Map(weightSnap.docs.map((d) => { const w = d.data() as WDoc; return [w.date, w.weight]; }));
    const stepsByDate = new Map(activitySnap.docs.map((d) => { const a = d.data() as ADoc; return [a.date, a.steps]; }));
    const foodByDate = new Map(
      foodSnap.docs.map((d) => d.data() as FDoc).filter((f) => f.date >= cutoff14).map((f) => [f.date, f])
    );

    const sortedDates = [...new Set([...weightByDate.keys(), ...stepsByDate.keys()])].filter((d) => d >= cutoff14 && d < today).sort();
    const recentRows = sortedDates.slice(-10).map((date) => {
      const food = foodByDate.get(date);
      return `${date}: ${weightByDate.get(date) ?? "—"}kg | ${stepsByDate.get(date) ?? 0} pași | ${food?.totalCalories ?? 0}kcal | P:${food?.totalProtein ?? 0}g C:${food?.totalCarbs ?? 0}g G:${food?.totalFat ?? 0}g`;
    }).join("\n");

    const todayFood = todayFoodDoc.exists ? todayFoodDoc.data() as FDoc : null;
    const todaySteps = todayActivitySnap.empty ? 0 : (todayActivitySnap.docs[0].data() as ADoc).steps;
    const latestWeight = [...weightByDate.values()].at(-1) ?? profile?.currentWeight ?? 80;

    const prompt = `Ești un antrenor personal și nutriționist expert în pierdere în greutate. Vorbești în română, direct și motivant.

PROFIL UTILIZATOR:
- Greutate curentă: ${latestWeight}kg | Țintă: ${profile?.targetWeight ?? "?"}kg | De slăbit: ${Math.max(0, latestWeight - (profile?.targetWeight ?? latestWeight)).toFixed(1)}kg
- Calorii zilnice recomandate: ${profile?.dailyCalories ?? 1600}kcal
- Țintă pași/zi: ${profile?.stepTarget ?? 8000}

ULTIMELE 10 ZILE:
${recentRows || "Date insuficiente"}

AZI (${today}) până acum:
- Pași: ${todaySteps} / ${profile?.stepTarget ?? 8000}
- Mâncare logată: ${todayFood ? `${todayFood.totalCalories}kcal (P:${todayFood.totalProtein}g C:${todayFood.totalCarbs}g G:${todayFood.totalFat}g)` : "nimic logat încă"}

Generează un forecast/plan PERSONALIZAT pentru restul zilei de azi. Returnează DOAR JSON valid:
{
  "summary": "1-2 fraze despre situația de azi vs istoricul recent",
  "stepsLeft": 0,
  "caloriesLeft": 0,
  "caloriesBurned": 0,
  "movement": { "activity": "ce să faci", "duration": "cât timp", "why": "de ce asta azi" },
  "meals": [
    { "when": "Prânz/Cină/Gustare", "suggestion": "ce să mănânci", "calories": 0, "tip": "sfat specific" }
  ],
  "warning": "un risc specific de evitat azi (sau null)",
  "motivation": "mesaj motivational personalizat bazat pe trend"
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { res.status(500).json({ error: "AI nu a returnat JSON valid." }); return; }
    const forecast = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    res.json({ forecast, date: today });
  } catch (error) {
    console.error("[health] forecast error:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ── HEALTH CHAT ───────────────────────────────────────────────────────────────

interface ChatMessage { role: "user" | "assistant"; content: string; }

router.post("/chat/:userId", requireFirebaseAuth, requireHealthAccess, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { messages } = req.body as { messages?: ChatMessage[] };
    if (!messages || messages.length === 0) { res.status(400).json({ error: "Mesaje lipsă" }); return; }

    const db = firestore();
    const today = TODAY();
    const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [profileDoc, weightSnap, activitySnap, todayFoodDoc, patternsDoc] = await Promise.all([
      db.collection(PROFILES_COL).doc(userId).get(),
      db.collection(WEIGHT_COL).where("userId", "==", userId).where("date", ">=", cutoff30).orderBy("date", "desc").limit(7).get(),
      db.collection(ACTIVITY_COL).where("userId", "==", userId).where("date", ">=", cutoff30).orderBy("date", "desc").limit(7).get(),
      db.collection(FOOD_COL).doc(`${userId}_${today}`).get(),
      db.collection(PATTERNS_COL).doc(userId).get(),
    ]);

    type ProfType = { name?: string; height?: number; targetWeight?: number; dailyCalories?: number; age?: number; sex?: string; stepTarget?: number; currentWeight?: number };
    type WDoc = { date: string; weight: number };
    type ADoc = { date: string; steps: number };
    type FoodTodayDoc = { totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number };

    const profile = profileDoc.data() as ProfType | undefined;
    const recentWeights = weightSnap.docs.map((d) => { const w = d.data() as WDoc; return `${w.date}: ${w.weight}kg`; }).join(", ");
    const recentSteps = activitySnap.docs.map((d) => { const a = d.data() as ADoc; return `${a.date}: ${a.steps} pași`; }).join(", ");
    const todayFood = todayFoodDoc.exists ? todayFoodDoc.data() as FoodTodayDoc : null;
    const patterns = patternsDoc.exists ? patternsDoc.data() as { keyInsight?: string; direction?: string } : null;

    const systemPrompt = `Ești un antrenor personal și nutriționist specializat în pierdere în greutate. Vorbești EXCLUSIV despre: nutriție, sport, calorii, macronutrienți, exerciții fizice, recuperare, hidratare, somn și impactul lui asupra greutății. Refuzi politicos orice alt subiect.

DATE UTILIZATOR (${profile?.name ?? userId}):
- Greutate curentă estimată: ${weightSnap.docs[0]?.data()?.weight ?? profile?.currentWeight ?? "?"}kg
- Greutate țintă: ${profile?.targetWeight ?? "?"}kg
- Calorii zilnice: ${profile?.dailyCalories ?? 1600}kcal
- Țintă pași/zi: ${profile?.stepTarget ?? 8000}
- Vârstă: ${profile?.age ?? "?"} | Sex: ${profile?.sex ?? "?"}

GREUTĂȚI RECENTE: ${recentWeights || "indisponibil"}
PAȘI RECENȚI: ${recentSteps || "indisponibil"}
AZI MÂNCAT: ${todayFood ? `${todayFood.totalCalories}kcal (P:${todayFood.totalProtein}g C:${todayFood.totalCarbs}g G:${todayFood.totalFat}g)` : "nimic logat"}
PATTERN CHEIE: ${patterns?.keyInsight ?? "insuficiente date"}
TREND: ${patterns?.direction ?? "necunoscut"}

Răspunde concis, practic, bazat pe datele reale ale utilizatorului. Folosește cifrele din profilul lui când e relevant.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = message.content[0].type === "text" ? message.content[0].text : "";
    res.json({ reply });
  } catch (error) {
    console.error("[health] chat error:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ── FOOD CHAT ─────────────────────────────────────────────────────────────────

router.post(
  "/food/:userId/chat",
  requireFirebaseAuth,
  requireHealthAccess,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { messages, photoBase64 } = req.body as {
        messages: { role: "user" | "assistant"; content: string }[];
        photoBase64?: string;
      };

      const today = TODAY();
      const [profileDoc, foodDoc] = await Promise.all([
        firestore().collection(PROFILES_COL).doc(userId).get(),
        firestore().collection(FOOD_COL).doc(`${userId}_${today}`).get(),
      ]);

      type ProfType = { dailyCalories?: number; currentWeight?: number; targetWeight?: number };
      const profile = profileDoc.data() as ProfType | undefined;
      const currentCalories = foodDoc.exists ? ((foodDoc.data()?.totalCalories as number) ?? 0) : 0;
      const remaining = (profile?.dailyCalories ?? 1600) - currentCalories;

      const systemPrompt = `Ești un nutriționist român care ajută utilizatorul să logheze masa cu precizie maximă.

CONTEXT AZI:
- Calorii consumate: ${currentCalories} kcal din ${profile?.dailyCalories ?? 1600} kcal target
- Rămase: ${remaining} kcal

COMPORTAMENT:
1. Pune întrebări scurte și clare despre fiecare aliment: ce anume, cantitate, mod de preparare
2. Fii concis (1-2 propoziții per răspuns)
3. Ține mental o listă cu TOATE alimentele menționate până acum
4. Când utilizatorul spune că a terminat (ex: "gata", "asta e", "done") SAU când ai suficiente informații și ești rugat explicit să finalizezi, generează blocul <ANALYSIS>

FORMAT ANALYSIS — folosit DOAR când utilizatorul finalizează:
<ANALYSIS>
{"food":"Descriere scurtă masă","quantity":"Descriere cantități totale","calories":0,"protein":0,"carbs":0,"fat":0,"confidence":"high","aiNote":"observație scurtă","items":[{"name":"Aliment 1","quantity":"200g","calories":150},{"name":"Aliment 2","quantity":"1 bucată","calories":80}]}
</ANALYSIS>

Răspunde MEREU în română. NU genera blocul ANALYSIS decât când ești rugat să finalizezi sau utilizatorul spune că a terminat.`;

      const apiMessages: Anthropic.MessageParam[] = messages.slice(-20).map((m, idx) => {
        if (m.role === "user" && idx === messages.length - 1 && photoBase64) {
          return {
            role: "user" as const,
            content: [
              { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: photoBase64 } },
              { type: "text" as const, text: m.content || "Ce alimente sunt în această imagine? Ajută-mă să estimez caloriile." },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: systemPrompt,
        messages: apiMessages,
      });

      const reply = message.content[0].type === "text" ? message.content[0].text : "";

      const analysisMatch = reply.match(/<ANALYSIS>([\s\S]*?)<\/ANALYSIS>/);
      let analysis: FoodAnalysis & { items?: { name: string; quantity: string; calories: number }[] } | null = null;
      let displayMessage = reply.replace(/<ANALYSIS>[\s\S]*?<\/ANALYSIS>/g, "").trim();
      if (!displayMessage && analysisMatch) displayMessage = "Am pregătit rezumatul mesei tale. ✅";

      if (analysisMatch) {
        try {
          const parsed = JSON.parse(analysisMatch[1].trim()) as Record<string, unknown>;
          analysis = {
            food: String(parsed.food ?? "Masă"),
            quantity: String(parsed.quantity ?? "—"),
            calories: Number(parsed.calories) || 0,
            protein: Number(parsed.protein) || 0,
            carbs: Number(parsed.carbs) || 0,
            fat: Number(parsed.fat) || 0,
            confidence: (["low", "medium", "high"].includes(String(parsed.confidence)) ? parsed.confidence : "medium") as FoodAnalysis["confidence"],
            aiNote: String(parsed.aiNote ?? ""),
            items: Array.isArray(parsed.items) ? (parsed.items as { name: string; quantity: string; calories: number }[]) : [],
          };
        } catch {
          // parsing failed — return as plain text
        }
      }

      res.json({ reply: displayMessage, analysis, currentCalories });
    } catch (error) {
      console.error("[health] food chat error:", error);
      res.status(500).json({ error: String(error) });
    }
  }
);

export default router;
