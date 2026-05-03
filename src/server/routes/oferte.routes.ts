import { Router } from "express";
import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { firestore } from "../firestore";
import { adminUser } from "../constants/credentials";
import { sendEmail } from "../notifications/mailer";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";

const router = Router();

function romanianTime(): string {
  return new Date().toLocaleString("ro-RO", {
    timeZone: "Europe/Bucharest",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress ?? "necunoscut";
}

// ─── Public ───────────────────────────────────────────────────────────────────

// GET /api/oferte/:slug
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const db = firestore();
    const snapshot = await db
      .collection("offers")
      .where("slug", "==", slug)
      .where("active", "==", true)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: "Ofertă negăsită." });

    const doc = snapshot.docs[0];
    const data = doc.data();
    // never expose internal counts to public
    const { viewCount, downloadCount, ...publicData } = data;
    res.json({ id: doc.id, ...publicData });
  } catch (error) {
    console.error("[oferte] GET /:slug failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/oferte/:slug/view
router.post("/:slug/view", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const db = firestore();
    const snapshot = await db.collection("offers").where("slug", "==", slug).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: "Ofertă negăsită." });

    const doc = snapshot.docs[0];
    const offer = doc.data();
    const newCount = (offer.viewCount ?? 0) + 1;
    await doc.ref.update({ viewCount: newCount });

    const ip = clientIp(req);
    const time = romanianTime();

    await sendEmail({
      to: adminUser.email,
      subject: `👁 Oferta /${slug} a fost vizualizată`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#0a0a0a;padding:32px 16px;color:#f5f5f5;">
          <div style="max-width:480px;margin:0 auto;border:1px solid #262626;border-radius:16px;padding:28px;background:#111;">
            <p style="color:#a78bfa;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 14px;">Ancavisuals · Oferte</p>
            <h1 style="font-size:22px;font-weight:400;margin:0 0 22px;color:#fff;">Ofertă vizualizată</h1>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="color:#666;padding:6px 0;">Slug</td><td style="color:#fff;padding:6px 0;font-weight:600;">/${slug}</td></tr>
              ${offer.clientName ? `<tr><td style="color:#666;padding:6px 0;">Client</td><td style="color:#fff;padding:6px 0;">${offer.clientName}</td></tr>` : ""}
              <tr><td style="color:#666;padding:6px 0;">Ora</td><td style="color:#fff;padding:6px 0;">${time}</td></tr>
              <tr><td style="color:#666;padding:6px 0;">IP</td><td style="color:#aaa;padding:6px 0;font-size:12px;">${ip}</td></tr>
              <tr><td style="color:#666;padding:6px 0;">Total vizualizări</td><td style="color:#a78bfa;padding:6px 0;font-weight:700;">${newCount}</td></tr>
            </table>
            <div style="margin-top:22px;">
              <a href="https://ancavisuals.ro/admin/oferte" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
                Deschide admin
              </a>
            </div>
          </div>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[oferte] POST /:slug/view failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/oferte/:slug/download
router.post("/:slug/download", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const db = firestore();
    const snapshot = await db.collection("offers").where("slug", "==", slug).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: "Ofertă negăsită." });

    const doc = snapshot.docs[0];
    const offer = doc.data();
    const newCount = (offer.downloadCount ?? 0) + 1;
    await doc.ref.update({ downloadCount: newCount });

    const ip = clientIp(req);
    const time = romanianTime();

    await sendEmail({
      to: adminUser.email,
      subject: `⬇️ Oferta /${slug} a fost descărcată`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#0a0a0a;padding:32px 16px;color:#f5f5f5;">
          <div style="max-width:480px;margin:0 auto;border:1px solid #262626;border-radius:16px;padding:28px;background:#111;">
            <p style="color:#34d399;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 14px;">Ancavisuals · Oferte</p>
            <h1 style="font-size:22px;font-weight:400;margin:0 0 22px;color:#fff;">PDF Descărcat!</h1>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="color:#666;padding:6px 0;">Slug</td><td style="color:#fff;padding:6px 0;font-weight:600;">/${slug}</td></tr>
              ${offer.clientName ? `<tr><td style="color:#666;padding:6px 0;">Client</td><td style="color:#fff;padding:6px 0;">${offer.clientName}</td></tr>` : ""}
              <tr><td style="color:#666;padding:6px 0;">Ora</td><td style="color:#fff;padding:6px 0;">${time}</td></tr>
              <tr><td style="color:#666;padding:6px 0;">IP</td><td style="color:#aaa;padding:6px 0;font-size:12px;">${ip}</td></tr>
              <tr><td style="color:#666;padding:6px 0;">Total descărcări</td><td style="color:#34d399;padding:6px 0;font-weight:700;">${newCount}</td></tr>
            </table>
            <div style="margin-top:22px;">
              <a href="https://ancavisuals.ro/admin/oferte" style="display:inline-block;background:#059669;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
                Deschide admin
              </a>
            </div>
          </div>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[oferte] POST /:slug/download failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────────

// GET /api/oferte/admin/list
router.get("/admin/list", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db.collection("offers").orderBy("createdAt", "desc").get();
    const offers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ offers });
  } catch (error) {
    console.error("[oferte] GET /admin/list failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/oferte/admin
router.post("/admin", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { slug, clientName, title, description, pdfUrl, price, packageName, validUntil } = req.body;

    if (!slug?.trim()) return res.status(400).json({ error: "Slug-ul este obligatoriu." });

    const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");
    const db = firestore();

    // Check uniqueness
    const existing = await db.collection("offers").where("slug", "==", cleanSlug).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: `Slug-ul „${cleanSlug}" există deja.` });

    const now = new Date().toISOString();
    const newOffer = {
      slug: cleanSlug,
      clientName: clientName?.trim() ?? "",
      title: title?.trim() ?? "",
      description: description?.trim() ?? "",
      pdfUrl: pdfUrl?.trim() ?? "",
      price: price?.trim() ?? "",
      packageName: packageName?.trim() ?? "",
      validUntil: validUntil ?? "",
      active: true,
      viewCount: 0,
      downloadCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection("offers").add(newOffer);
    res.json({ id: docRef.id, ...newOffer });
  } catch (error) {
    console.error("[oferte] POST /admin failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// PATCH /api/oferte/admin/:id
router.patch("/admin/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = firestore();
    const docRef = db.collection("offers").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Oferta nu a fost găsită." });

    const allowed = ["clientName", "title", "description", "pdfUrl", "price", "packageName", "validUntil", "active"];
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    await docRef.update(updates);
    res.json({ id, ...doc.data(), ...updates });
  } catch (error) {
    console.error("[oferte] PATCH /admin/:id failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// DELETE /api/oferte/admin/:id
router.delete("/admin/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = firestore();
    await db.collection("offers").doc(id).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[oferte] DELETE /admin/:id failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

export default router;
