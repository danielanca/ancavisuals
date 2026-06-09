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

async function extractStepsFromPhoto(buffer: Buffer): Promise<number> {
  const jpegBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 50,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegBuffer.toString("base64") } },
        {
          type: "text",
          text: "Aceasta este o captură de ecran din aplicația Health (iPhone/Android/ceas Garmin/Samsung etc.). Extrage numărul TOTAL de pași înregistrați azi. Returnează DOAR cifra întreagă, fără text, spații sau unități. Exemplu: 8432. Dacă nu poți identifica pașii, returnează 0.",
        },
      ],
    }],
  });
  const rawText = message.content[0].type === "text" ? message.content[0].text.trim() : "0";
  const steps = parseInt(rawText.replace(/[^0-9]/g, ""), 10);
  return isNaN(steps) ? 0 : steps;
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
    if (!existing.exists) {
      if (payload.currentWeight) payload.startWeight = payload.currentWeight;
      payload.createdAt = TODAY();
    } else if (payload.onboardingComplete && !existing.data()?.createdAt) {
      // Backfill createdAt for profiles that completed onboarding before this field existed
      payload.createdAt = TODAY();
    }
    await docRef.set(payload, { merge: true });
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
      const steps = await extractStepsFromPhoto(buffer);
      if (steps === 0) {
        res.status(422).json({ error: "Nu am putut extrage pașii din poză. Asigură-te că ecranul e clar și numărul de pași e vizibil." });
        return;
      }

      const date = reqDate || TODAY();
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

      if (!buffer && !note) {
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

export default router;
