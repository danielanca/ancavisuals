import { Router } from "express";
import type { Request, Response } from "express";
import { firestore } from "../firestore";
import { expandEventDates } from "../utils/expandEventDates";

const CONFIRMED_STATUSES = new Set(["confirmat", "finalizat"]);

const router = Router();

// GET /api/booked-dates — public, fără auth
router.get("/", async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db.collection("adminEvents").get();

    const dates: string[] = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!CONFIRMED_STATUSES.has(data.status)) continue;
      dates.push(...expandEventDates(data));
    }

    res.json({ dates });
  } catch (error) {
    console.error("[publicBookedDates] failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca datele." });
  }
});

export default router;
