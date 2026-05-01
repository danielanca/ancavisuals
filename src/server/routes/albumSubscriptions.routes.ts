import express, { type Request, type Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { sendEmail } from "../notifications/mailer";

const router = express.Router();
const COLLECTION = "albumSubscriptions";
const BASE_URL = process.env.BASE_URL || "https://ancavisuals.ro";

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
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
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
    const albumUrl = `${BASE_URL}/media/${slug}`;

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
              <a href="${albumUrl}" style="display:inline-block;padding:12px 24px;background:#fff;color:#000;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
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

export default router;
