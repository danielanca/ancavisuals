import { Router } from "express";
import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { APP_BASE_URL } from "../constants/domain";
import { buildFamilyCalendarIcs, familyCalendarIcsPath, type FamilyCalendarData } from "../../shared/familyCalendar";
import { getFamilyCalendarSettings, isFamilyCalendarToken, loadFamilyCalendarEvents } from "../services/familyCalendar.service";
import { cancelFamilyTimeRequest, createFamilyTimeRequest, listFamilyTimeRequests } from "../services/familyTime.service";
import {
  FAMILY_SESSION_COOKIE, endFamilySession, familySessionValid, readCookie, requestFamilyLoginCode, sessionCookie, verifyFamilyLogin,
} from "../services/familyCalendarAuth.service";

// Family calendar for Estera (mounted at /api/family-calendar). The page /zile-ocupate signs in
// with her email + a one-time code (httpOnly session cookie); the owner, signed in to the admin,
// sees it too. Calendar apps can't sign in, so the .ics feed keeps its secret token link.
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

const signedIn = async (req: Request) =>
  (await familySessionValid(readCookie(req.headers.cookie, FAMILY_SESSION_COOKIE))) || (await isOwner(req));

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  next();
});

router.post("/login/request", async (req: Request, res: Response) => {
  try {
    const result = await requestFamilyLoginCode(req.body?.email);
    if (result.ok) {
      res.json({ ok: true });
    } else if (result.reason === "wrong-email") {
      res.status(403).json({ error: "Acest email nu are acces la calendar." });
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
    if (!(await signedIn(req))) {
      res.status(401).json({ error: "Intră cu emailul tău." });
      return;
    }
    const settings = await getFamilyCalendarSettings();
    const data: FamilyCalendarData = {
      events: await loadFamilyCalendarEvents(),
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
    if (!(await signedIn(req))) {
      res.status(401).json({ error: "Intră cu emailul tău." });
      return;
    }
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
    if (!(await signedIn(req))) {
      res.status(401).json({ error: "Intră cu emailul tău." });
      return;
    }
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
    if (!(await isFamilyCalendarToken(req.params.token))) {
      res.status(404).send("Linkul nu mai este valid.");
      return;
    }
    const ics = buildFamilyCalendarIcs(await loadFamilyCalendarEvents(), new Date(), await listFamilyTimeRequests());
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="evenimente-ancavisuals.ics"');
    res.send(ics);
  } catch (e) {
    console.error("[familyCalendar] ics failed:", e);
    res.status(500).send("Calendarul nu a putut fi încărcat.");
  }
});

export default router;
