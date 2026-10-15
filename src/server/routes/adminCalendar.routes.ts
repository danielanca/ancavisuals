import { Router } from "express";
import { firestore } from "../firestore";
import { expandEventDates } from "../utils/expandEventDates";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";

const CONFIRMED_STATUSES = new Set(["confirmat", "finalizat"]);

const router = Router();

router.get("/booked-dates", requireFirebaseAuth, requireSupremeAdmin, async (_req, res) => {
  try {
    const db = firestore();
    const snapshot = await db.collection("adminEvents").get();

    // `excludeFromCalendar` = offered again: the public availability check shows the date free.
    const dates: { date: string; note: string; eventId: string; clientName: string; eventType: string; total: number | null; excludeFromCalendar: boolean }[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!CONFIRMED_STATUSES.has(data.status)) continue;

      const label = data.typeLabel || data.type || "Eveniment";
      const note = [label, data.client?.fullName].filter(Boolean).join(" — ");

      const total = Number(data.pricing?.total);
      for (const date of expandEventDates(data)) {
        dates.push({
          date,
          note,
          eventId: doc.id,
          clientName: String(data.client?.fullName ?? ""),
          eventType: String(label),
          total: Number.isFinite(total) && total > 0 ? total : null,
          excludeFromCalendar: data.excludeFromCalendar === true,
        });
      }
    }

    res.json({ dates });
  } catch (e) {
    console.error("[adminCalendar] getBookedDates failed:", e);
    res.status(500).json({ error: "Nu s-au putut încărca datele." });
  }
});

export default router;
