import { Router } from "express";
import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { APP_BASE_URL } from "../constants/domain";
import {
  buildFamilyCalendarIcs, familyCalendarIcsPath, helperEvents, type FamilyCalendarData, type FamilyCalendarViewer,
} from "../../shared/familyCalendar";
import { familyCalendarTokenViewer, getFamilyCalendarSettings, loadFamilyCalendarEvents } from "../services/familyCalendar.service";
import { cancelFamilyTimeRequest, createFamilyTimeRequest, listFamilyTimeRequests } from "../services/familyTime.service";
import {
  FAMILY_SESSION_COOKIE, endFamilySession, familySessionViewer, readCookie, requestFamilyLoginCode, sessionCookie, verifyFamilyLogin,
} from "../services/familyCalendarAuth.service";

// Family calendar for Estera (mounted at /api/family-calendar). The page /zile-ocupate signs in
// with her email + a one-time code (httpOnly session cookie); the owner, signed in to the admin,
// sees it too. Salomeea (the helper) signs in the same way but only gets the events she's
// assigned to, without prices or family time. Calendar apps can't sign in, so the .ics feeds keep
// their secret token links (one for Estera, one for the helper).
const router = Router();
const SUPREME_ADMIN_EMAIL = "ancadaniel1994@gmail.com";
const secureCookies = () => process.env.NODE_ENV === "production";

async function isOwner(req: Request): Promise<boolean> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  try {
    return (await getAuth().verifyIdToken(header.slice(7))).email === SUPREME_ADMIN_EMAIL;
  } catch {
    return false;
  }
}

const viewerOf = async (req: Request): Promise<FamilyCalendarViewer | null> =>
  (await familySessionViewer(readCookie(req.headers.cookie, FAMILY_SESSION_COOKIE))) ?? ((await isOwner(req)) ? "family" : null);

/** Family time is between Estera and the owner: the helper can't ask for it. */
async function requireFamily(req: Request, res: Response): Promise<boolean> {
  const viewer = await viewerOf(req);
  if (!viewer) res.status(401).json({ error: "Intră cu emailul tău." });
  else if (viewer !== "family") res.status(403).json({ error: "Nu ai acces la cererile pentru familie." });
  return viewer === "family";
}

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  next();
});

router.post("/login/request", async (req: Request, res: Response) => {
  try {
    const result = await requestFamilyLoginCode(req.body?.email);
    if (result.ok) {
      res.json({ ok: true, channel: result.channel });
    } else if (result.reason === "wrong-email") {
      res.status(403).json({ error: "Acest email sau număr de telefon nu are acces la calendar." });
    } else if (result.reason === "too-soon") {
      res.status(429).json({ error: `Ți-am trimis deja un cod. Poți cere altul în ${Math.ceil((result.retryInMs ?? 0) / 1000)} secunde.` });
    } else {
      res.status(429).json({ error: "Prea multe coduri cerute. Încearcă din nou peste o oră." });
    }
  } catch (e) {
    console.error("[familyCalendar] login code failed:", e);
    res.status(500).json({ error: "Codul nu a putut fi trimis. Încearcă din nou." });
  }
});

router.post("/login/verify", async (req: Request, res: Response) => {
  try {
    const result = await verifyFamilyLogin({ email: req.body?.email, code: req.body?.code, magic: req.body?.magic });
    if (!result.ok) {
      const error = result.reason === "expired" ? "Codul a expirat. Cere unul nou."
        : result.reason === "too-many" ? "Prea multe încercări. Cere un cod nou."
        : "Codul nu e corect.";
      res.status(401).json({ error, reason: result.reason });
      return;
    }
    res.setHeader("Set-Cookie", sessionCookie(result.session, secureCookies()));
    res.json({ ok: true });
  } catch (e) {
    console.error("[familyCalendar] login verify failed:", e);
    res.status(500).json({ error: "Nu te-am putut conecta. Încearcă din nou." });
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  try {
    await endFamilySession(readCookie(req.headers.cookie, FAMILY_SESSION_COOKIE));
  } catch (e) {
    console.error("[familyCalendar] logout failed:", e);
  }
  res.setHeader("Set-Cookie", sessionCookie(null, secureCookies()));
  res.json({ ok: true });
});

router.get("/events", async (req: Request, res: Response) => {
  try {
    const viewer = await viewerOf(req);
    if (!viewer) {
      res.status(401).json({ error: "Intră cu emailul tău." });
      return;
    }
    const settings = await getFamilyCalendarSettings();
    const events = await loadFamilyCalendarEvents();
    const data: FamilyCalendarData = viewer === "helper"
      ? {
        viewer,
        events: helperEvents(events, settings.helperEventIds),
        familyTime: [],
        icsUrl: `${APP_BASE_URL}${familyCalendarIcsPath(settings.helperToken)}`,
        generatedAt: new Date().toISOString(),
      }
      : {
        viewer,
        events,
        familyTime: await listFamilyTimeRequests(),
        icsUrl: `${APP_BASE_URL}${familyCalendarIcsPath(settings.token)}`,
        generatedAt: new Date().toISOString(),
      };
    res.json(data);
  } catch (e) {
    console.error("[familyCalendar] events failed:", e);
    res.status(500).json({ error: "Calendarul nu a putut fi încărcat." });
  }
});

// "Timp pentru familie": Estera asks for a day or a range; the owner gets an email.
router.post("/family-time", async (req: Request, res: Response) => {
  try {
    if (!(await requireFamily(req, res))) return;
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
    const result = await createFamilyTimeRequest(req.body ?? {}, today);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ request: result.request });
  } catch (e) {
    console.error("[familyCalendar] family time request failed:", e);
    res.status(500).json({ error: "Cererea nu a putut fi trimisă. Încearcă din nou." });
  }
});

router.delete("/family-time/:id", async (req: Request, res: Response) => {
  try {
    if (!(await requireFamily(req, res))) return;
    if (!(await cancelFamilyTimeRequest(req.params.id))) {
      res.status(409).json({ error: "Cererea a primit deja răspuns sau nu mai există." });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[familyCalendar] family time cancel failed:", e);
    res.status(500).json({ error: "Cererea nu a putut fi retrasă." });
  }
});

router.get("/:token/calendar.ics", async (req: Request, res: Response) => {
  try {
    const viewer = await familyCalendarTokenViewer(req.params.token);
    if (!viewer) {
      res.status(404).send("Linkul nu mai este valid.");
      return;
    }
    const events = await loadFamilyCalendarEvents();
    const ics = viewer === "helper"
      ? buildFamilyCalendarIcs(helperEvents(events, (await getFamilyCalendarSettings()).helperEventIds), new Date())
      : buildFamilyCalendarIcs(events, new Date(), await listFamilyTimeRequests());
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="evenimente-ancavisuals.ics"');
    res.send(ics);
  } catch (e) {
    console.error("[familyCalendar] ics failed:", e);
    res.status(500).send("Calendarul nu a putut fi încărcat.");
  }
});

export default router;
