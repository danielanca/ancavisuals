import { Router } from "express";
import { firestore } from "../firestore";
import { expandEventDates } from "../utils/expandEventDates";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { APP_BASE_URL } from "../constants/domain";
import { FAMILY_CALENDAR_PAGE, familyCalendarIcsPath } from "../../shared/familyCalendar";
import { endAllFamilySessions } from "../services/familyCalendarAuth.service";
import { decideFamilyTimeRequest, deleteFamilyTimeRequest, listFamilyTimeRequests } from "../services/familyTime.service";
import {
  getFamilyCalendarSettings, loadFamilyCalendarEvents, rotateFamilyCalendarToken, sendFamilyCalendarEmail, sendHelperCalendarEmail,
  updateFamilyCalendarSettings,
} from "../services/familyCalendar.service";
import { notifyHelperAssigned, sendFamilyCalendarMessage, type ManualMessageTarget } from "../services/familyCalendarNotify.service";
import { isSmsConfigured, normalizeRomanianPhoneNumber } from "../notifications/sms";

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

// --- Calendar familie (/admin/calendar-familie): pagina /zile-ocupate (login cu cod pe
// email), feed-ul .ics cu link secret, emailurile și cererile ei de timp pentru familie; plus
// Salomeea (helper): emailul ei și evenimentele la care e asignată (le vede fără prețuri) ---

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function familyCalendarState() {
  const settings = await getFamilyCalendarSettings();
  return {
    pageUrl: `${APP_BASE_URL}${FAMILY_CALENDAR_PAGE}`,
    icsUrl: `${APP_BASE_URL}${familyCalendarIcsPath(settings.token)}`,
    recipientEmail: settings.recipientEmail,
    weeklyEmail: settings.weeklyEmail,
    lastEmailAt: settings.lastEmailAt,
    helperEmail: settings.helperEmail,
    helperEventIds: settings.helperEventIds,
    helperIcsUrl: `${APP_BASE_URL}${familyCalendarIcsPath(settings.helperToken)}`,
    recipientPhone: settings.recipientPhone,
    helperPhone: settings.helperPhone,
    reminders: settings.reminders,
    smsConfigured: isSmsConfigured(),
    calendarEvents: await loadFamilyCalendarEvents(),
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
  const { recipientEmail, weeklyEmail, helperEmail, helperEventIds, recipientPhone, helperPhone, reminders } = req.body ?? {};
  const badEmail = (email: unknown) => email !== undefined && (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim()));
  if (badEmail(recipientEmail) || badEmail(helperEmail)) {
    res.status(400).json({ error: "Adresa de email nu e validă." });
    return;
  }
  if (helperEventIds !== undefined && (!Array.isArray(helperEventIds) || helperEventIds.length > 1000
    || !helperEventIds.every((id: unknown) => typeof id === "string" && id.length > 0 && id.length <= 200))) {
    res.status(400).json({ error: "Lista de evenimente nu e validă." });
    return;
  }
  if ((weeklyEmail !== undefined && typeof weeklyEmail !== "boolean") || (reminders !== undefined && typeof reminders !== "boolean")) {
    res.status(400).json({ error: "Valoarea trebuie să fie true sau false." });
    return;
  }
  // "" clears the phone; anything else must look like a phone number.
  const phone = (value: unknown) => (value === undefined ? undefined : typeof value !== "string" ? null : value.trim() === "" ? "" : normalizeRomanianPhoneNumber(value));
  const [cleanRecipientPhone, cleanHelperPhone] = [phone(recipientPhone), phone(helperPhone)];
  if (cleanRecipientPhone === null || cleanHelperPhone === null) {
    res.status(400).json({ error: "Numărul de telefon nu pare corect." });
    return;
  }
  try {
    const before = helperEventIds !== undefined ? (await getFamilyCalendarSettings()).helperEventIds : [];
    await updateFamilyCalendarSettings({
      ...(recipientEmail !== undefined ? { recipientEmail: recipientEmail.trim() } : {}),
      ...(weeklyEmail !== undefined ? { weeklyEmail } : {}),
      ...(helperEmail !== undefined ? { helperEmail: helperEmail.trim() } : {}),
      ...(helperEventIds !== undefined ? { helperEventIds: [...new Set<string>(helperEventIds)] } : {}),
      ...(cleanRecipientPhone !== undefined ? { recipientPhone: cleanRecipientPhone } : {}),
      ...(cleanHelperPhone !== undefined ? { helperPhone: cleanHelperPhone } : {}),
      ...(reminders !== undefined ? { reminders } : {}),
    });
    // Newly ticked events: Salomeea hears right away (email + SMS); a failed message doesn't undo the save.
    const added = helperEventIds !== undefined ? (helperEventIds as string[]).filter((id) => !before.includes(id)) : [];
    const notified = added.length ? await notifyHelperAssigned(added).catch((e) => {
      console.error("[adminCalendar] helper assignment notice failed:", e);
      return null;
    }) : null;
    res.json({ ...(await familyCalendarState()), ...(notified ? { notified } : {}) });
  } catch (e) {
    console.error("[adminCalendar] family calendar update failed:", e);
    res.status(500).json({ error: "Nu s-au putut salva setările." });
  }
});

router.post("/family-calendar/rotate", requireFirebaseAuth, requireSupremeAdmin, async (req, res) => {
  try {
    await rotateFamilyCalendarToken(req.body?.viewer === "helper" ? "helper" : "family");
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

router.post("/family-calendar/send-helper-email", requireFirebaseAuth, requireSupremeAdmin, async (_req, res) => {
  try {
    const sent = await sendHelperCalendarEmail();
    res.json({ ...sent, ...(await familyCalendarState()) });
  } catch (e) {
    console.error("[adminCalendar] helper calendar email failed:", e);
    res.status(500).json({ error: "Emailul nu a putut fi trimis." });
  }
});

router.post("/family-calendar/message", requireFirebaseAuth, requireSupremeAdmin, async (req, res) => {
  const { to, text, email, sms } = req.body ?? {};
  const targets = Array.isArray(to) ? to.filter((item): item is ManualMessageTarget => item === "family" || item === "helper") : [];
  const message = typeof text === "string" ? text.trim() : "";
  if (targets.length === 0 || !message || message.length > 1000 || (email !== true && sms !== true)) {
    res.status(400).json({ error: "Alege cui trimiți, pe ce canal, și scrie mesajul (max 1000 de caractere)." });
    return;
  }
  try {
    res.json({ results: await sendFamilyCalendarMessage({ to: targets, text: message, email: email === true, sms: sms === true }) });
  } catch (e) {
    console.error("[adminCalendar] family calendar message failed:", e);
    res.status(500).json({ error: "Mesajul nu a putut fi trimis." });
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
