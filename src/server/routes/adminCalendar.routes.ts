import { Router } from "express";
import { firestore } from "../firestore";
import { expandEventDates } from "../utils/expandEventDates";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { APP_BASE_URL } from "../constants/domain";
import { FAMILY_CALENDAR_PAGE, familyCalendarIcsPath } from "../../shared/familyCalendar";
import { endAllFamilySessions } from "../services/familyCalendarAuth.service";
import { decideFamilyTimeRequest, deleteFamilyTimeRequest, listFamilyTimeRequests } from "../services/familyTime.service";
import {
  getFamilyCalendarSettings, rotateFamilyCalendarToken, sendFamilyCalendarEmail, updateFamilyCalendarSettings,
} from "../services/familyCalendar.service";

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

// --- Calendarul pentru Estera (/admin/calendar-familie): pagina /zile-ocupate (login cu cod pe
// email), feed-ul .ics cu link secret, emailurile și cererile ei de timp pentru familie ---

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function familyCalendarState() {
  const settings = await getFamilyCalendarSettings();
  return {
    pageUrl: `${APP_BASE_URL}${FAMILY_CALENDAR_PAGE}`,
    icsUrl: `${APP_BASE_URL}${familyCalendarIcsPath(settings.token)}`,
    recipientEmail: settings.recipientEmail,
    weeklyEmail: settings.weeklyEmail,
    lastEmailAt: settings.lastEmailAt,
  };
}

router.get("/family-calendar", requireFirebaseAuth, requireSupremeAdmin, async (_req, res) => {
  try {
    res.json(await familyCalendarState());
  } catch (e) {
    console.error("[adminCalendar] family calendar failed:", e);
    res.status(500).json({ error: "Nu s-a putut încărca calendarul." });
  }
});

router.patch("/family-calendar", requireFirebaseAuth, requireSupremeAdmin, async (req, res) => {
  const { recipientEmail, weeklyEmail } = req.body ?? {};
  if (recipientEmail !== undefined && (typeof recipientEmail !== "string" || !EMAIL_PATTERN.test(recipientEmail.trim()))) {
    res.status(400).json({ error: "Adresa de email nu e validă." });
    return;
  }
  if (weeklyEmail !== undefined && typeof weeklyEmail !== "boolean") {
    res.status(400).json({ error: "weeklyEmail trebuie să fie true sau false." });
    return;
  }
  try {
    await updateFamilyCalendarSettings({
      ...(recipientEmail !== undefined ? { recipientEmail: recipientEmail.trim() } : {}),
      ...(weeklyEmail !== undefined ? { weeklyEmail } : {}),
    });
    res.json(await familyCalendarState());
  } catch (e) {
    console.error("[adminCalendar] family calendar update failed:", e);
    res.status(500).json({ error: "Nu s-au putut salva setările." });
  }
});

router.post("/family-calendar/rotate", requireFirebaseAuth, requireSupremeAdmin, async (_req, res) => {
  try {
    await rotateFamilyCalendarToken();
    res.json(await familyCalendarState());
  } catch (e) {
    console.error("[adminCalendar] family calendar rotate failed:", e);
    res.status(500).json({ error: "Nu s-a putut face un link nou." });
  }
});

router.post("/family-calendar/send-email", requireFirebaseAuth, requireSupremeAdmin, async (_req, res) => {
  try {
    const sent = await sendFamilyCalendarEmail();
    res.json({ ...sent, ...(await familyCalendarState()) });
  } catch (e) {
    console.error("[adminCalendar] family calendar email failed:", e);
    res.status(500).json({ error: "Emailul nu a putut fi trimis." });
  }
});

router.post("/family-calendar/sign-out-all", requireFirebaseAuth, requireSupremeAdmin, async (_req, res) => {
  try {
    res.json({ signedOut: await endAllFamilySessions() });
  } catch (e) {
    console.error("[adminCalendar] family sign-out failed:", e);
    res.status(500).json({ error: "Nu s-a putut face deconectarea." });
  }
});

router.get("/family-time", requireFirebaseAuth, requireSupremeAdmin, async (_req, res) => {
  try {
    res.json({ requests: await listFamilyTimeRequests() });
  } catch (e) {
    console.error("[adminCalendar] family time list failed:", e);
    res.status(500).json({ error: "Nu s-au putut încărca cererile." });
  }
});

router.post("/family-time/:id/decision", requireFirebaseAuth, requireSupremeAdmin, async (req, res) => {
  const { status, reply } = req.body ?? {};
  if (status !== "approved" && status !== "rejected") {
    res.status(400).json({ error: "Alege Aprobă sau Refuză." });
    return;
  }
  try {
    const request = await decideFamilyTimeRequest(req.params.id, status, typeof reply === "string" ? reply : "");
    if (!request) {
      res.status(404).json({ error: "Cererea nu mai există." });
      return;
    }
    res.json({ request });
  } catch (e) {
    console.error("[adminCalendar] family time decision failed:", e);
    res.status(500).json({ error: "Răspunsul nu a putut fi salvat." });
  }
});

router.delete("/family-time/:id", requireFirebaseAuth, requireSupremeAdmin, async (req, res) => {
  try {
    if (!(await deleteFamilyTimeRequest(req.params.id))) {
      res.status(404).json({ error: "Cererea nu mai există." });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[adminCalendar] family time delete failed:", e);
    res.status(500).json({ error: "Cererea nu a putut fi ștearsă." });
  }
});

export default router;
