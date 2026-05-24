import express, { type Request, type Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { sendEmail } from "../notifications/mailer";
import { adminUser } from "../constants/credentials";
import { getClientIp, fetchIpInfo } from "../utils/ipinfo";
import { APP_BASE_URL } from "../constants/domain";

const router = express.Router();
const COLLECTION = "albumSubscriptions";
const BASE_URL = APP_BASE_URL;

// POST /subscribe — subscribe email to album notifications (no auth required)
router.post("/subscribe", async (req: Request, res: Response) => {
  const { albumSlug, email } = req.body as { albumSlug?: string; email?: string };
  if (!albumSlug || !email) {
    res.status(400).json({ error: "albumSlug și email sunt obligatorii." });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const db = firestore();
    const existing = await db
      .collection(COLLECTION)
      .where("albumSlug", "==", albumSlug)
      .where("email", "==", normalizedEmail)
      .get();
    if (!existing.empty) {
      res.json({ ok: true, alreadySubscribed: true });
      return;
    }
    await db.collection(COLLECTION).add({
      albumSlug,
      email: normalizedEmail,
      subscribedAt: Timestamp.now(),
    });

    sendEmail({
      to: adminUser.email,
      subject: `🔔 Abonat nou la albumul ${albumSlug}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#111;margin:0 0 16px;">Abonat nou la notificări album</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#666;width:120px;">Album</td><td style="color:#111;font-weight:600;">${albumSlug}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Email</td><td style="color:#111;font-weight:600;">${normalizedEmail}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Data</td><td style="color:#111;">${new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}</td></tr>
          </table>
          <p style="margin:20px 0 0;">
            <a href="${BASE_URL}/media/${encodeURIComponent(albumSlug)}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Deschide albumul</a>
          </p>
        </div>
      `,
    }).catch(() => {});

    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /click/:slug — track subscriber click-through from email, notify admin, then redirect
router.get("/click/:slug", async (req: Request, res: Response) => {
  const { slug } = req.params;
  const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
  const albumUrl = `${BASE_URL}/media/${slug}`;

  if (!slug || !email) {
    res.redirect(albumUrl);
    return;
  }

  try {
    const ip = getClientIp(req);
    const ipInfo = await fetchIpInfo(ip);
    const clickedAt = new Date().toLocaleString("ro-RO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Europe/Bucharest",
    });

    const location = ipInfo
      ? [ipInfo.city, ipInfo.region, ipInfo.country].filter(Boolean).join(", ")
      : "unknown";

    await sendEmail({
      to: adminUser.email,
      subject: `👀 Subscriber opened album ${slug}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#111;margin:0 0 16px;">Subscriber clicked "Vezi albumul"</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#666;width:120px;">Album</td><td style="color:#111;font-weight:600;">${slug}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Email</td><td style="color:#111;font-weight:600;">${email}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Clicked at</td><td style="color:#111;">${clickedAt}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">IP</td><td style="color:#111;">${ip || "unknown"}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Location</td><td style="color:#111;">${location}</td></tr>
          </table>
          <p style="margin:20px 0 0;">
            <a href="${albumUrl}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Open album</a>
          </p>
        </div>
      `,
    });
  } catch {
    // Ignore tracking failures and still redirect the subscriber to the album.
  }

  res.redirect(albumUrl);
});

// POST /notify/:slug — send notification email to all subscribers (admin only)
router.post("/notify/:slug", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const db = firestore();
    const snapshot = await db
      .collection(COLLECTION)
      .where("albumSlug", "==", slug)
      .get();

    if (snapshot.empty) {
      res.json({ ok: true, sent: 0 });
      return;
    }

    const emails = snapshot.docs.map((doc) => (doc.data() as { email: string }).email);

    await Promise.all(
      emails.map((email) =>
        sendEmail({
          to: email,
          subject: "Poze noi au fost adăugate în albumul tău 📸",
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#fff;">
              <h1 style="font-size:22px;font-weight:500;margin:0 0 12px;">Fotograful a adăugat poze noi! 🎉</h1>
              <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Albumul <strong style="color:#fff">${slug}</strong> a fost actualizat cu fotografii și/sau videoclipuri noi.
              </p>
              <a href="${BASE_URL}/api/album-subscriptions/click/${encodeURIComponent(slug)}?email=${encodeURIComponent(email)}" style="display:inline-block;padding:12px 24px;background:#fff;color:#000;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
                Vezi albumul →
              </a>
              <hr style="border:none;border-top:1px solid #222;margin:32px 0;" />
              <p style="color:#555;font-size:12px;">
                Ai primit acest email deoarece te-ai abonat la notificările pentru albumul <em>${slug}</em>.
              </p>
            </div>
          `,
        })
      )
    );

    res.json({ ok: true, sent: emails.length });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /count/:slug — returns subscriber count for an album (admin only)
router.get("/count/:slug", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const db = firestore();
    const snapshot = await db
      .collection(COLLECTION)
      .where("albumSlug", "==", slug)
      .get();
    res.json({ count: snapshot.size });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /list/:slug — returns subscriber emails for an album (admin only)
router.get("/list/:slug", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const db = firestore();
    const snapshot = await db
      .collection(COLLECTION)
      .where("albumSlug", "==", slug)
      .get();
    const subscribers = snapshot.docs.map(doc => ({
      email: doc.data().email as string,
      subscribedAt: doc.data().subscribedAt ?? null,
    }));
    res.json({ subscribers });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /unsubscribe — removes a subscriber by albumSlug + email (admin only)
router.delete("/unsubscribe", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { albumSlug, email } = req.body as { albumSlug?: string; email?: string };
  if (!albumSlug || !email) {
    res.status(400).json({ error: "albumSlug și email sunt obligatorii." });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const db = firestore();
    const snapshot = await db
      .collection(COLLECTION)
      .where("albumSlug", "==", albumSlug)
      .where("email", "==", normalizedEmail)
      .get();
    if (snapshot.empty) {
      res.status(404).json({ error: "Abonatul nu a fost găsit." });
      return;
    }
    await Promise.all(snapshot.docs.map(doc => doc.ref.delete()));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
