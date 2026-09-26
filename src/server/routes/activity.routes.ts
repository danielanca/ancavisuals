import express, { type Request, type Response } from "express";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth.js";
import {
  getActivities,
  deleteVisitorActivities,
  markAllRead,
  markRead,
  deleteActivity,
  getNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from "../services/activity.service.js";

import { adminUser } from "../constants/credentials";
import { sendEmail, verifyEmailTransport, getTestEmailMode } from "../notifications/mailer";
import { describeEmailError, getEmailDeliveries, getEmailAlert, acknowledgeEmailAlert } from "../services/emailDelivery.service";

const router = express.Router();

router.delete("/activity/visitors", requireFirebaseAuth, requireSupremeAdmin, async (_req, res) => {
  try {
    await deleteVisitorActivities();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Nu s-au putut șterge notificările de vizitator." });
  }
});

router.get("/email-alert", requireFirebaseAuth, requireSupremeAdmin, async (_req, res) => {
  try { res.json({ alert: await getEmailAlert() }); }
  catch { res.status(503).json({ error: "Nu se poate verifica starea emailurilor." }); }
});
router.post("/email-alert/acknowledge", requireFirebaseAuth, requireSupremeAdmin, async (req, res) => {
  if (typeof req.body?.id !== "string" || !req.body.id) { res.status(400).json({ error: "Lipsește identificatorul alertei." }); return; }
  try { await acknowledgeEmailAlert(req.body.id); res.json({ ok: true }); }
  catch { res.status(503).json({ error: "Alerta nu a putut fi confirmată." }); }
});

router.get("/email-deliveries", requireFirebaseAuth, requireSupremeAdmin, async (_req, res) => {
  try {
    res.json({ deliveries: await getEmailDeliveries(), recipient: adminUser.email, testMode: getTestEmailMode() });
  } catch {
    res.status(503).json({ error: "Istoricul emailurilor nu este disponibil." });
  }
});

// No arbitrary recipients or message content: this only sends a test to the configured admin.
let diagnosticBusy = false;
let nextDiagnosticAt = 0;
router.post("/email-diagnostic", requireFirebaseAuth, requireSupremeAdmin, async (req, res) => {
  if (req.body?.action !== "verify" && req.body?.action !== "send") {
    res.status(400).json({ error: "Alege verificarea SMTP sau emailul de test." }); return;
  }
  if (diagnosticBusy || Date.now() < nextDiagnosticAt) {
    res.status(429).json({ error: "Așteaptă 30 de secunde înainte de un nou test." }); return;
  }
  diagnosticBusy = true;
  nextDiagnosticAt = Date.now() + 30000;
  try {
    if (req.body.action === "verify") {
      await verifyEmailTransport();
      res.json({ message: "Conexiunea și autentificarea SMTP funcționează. Nu s-a trimis niciun email." });
    } else {
      if (!adminUser.email) {
        res.status(400).json({ error: "Adresa adminului nu este configurată pe server." }); return;
      }
      await sendEmail({ to: adminUser.email, subject: `AncaVisuals — test email ${new Date().toISOString()}`,
        html: "<p>Acesta este emailul de test AncaVisuals. Dacă îl citești, primirea la această adresă este confirmată.</p>" });
      res.json({ message: `Email acceptat de SMTP pentru ${adminUser.email}. Verifică Inbox și Spam pentru a confirma primirea.` });
    }
  } catch (error) {
    res.status(502).json({ error: describeEmailError(error) });
  } finally {
    diagnosticBusy = false;
  }
});

// GET /api/admin/activity
router.get("/activity", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const activities = await getActivities(60);
    res.json({ activities });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /api/admin/activity/read-all
router.patch("/activity/read-all", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    await markAllRead();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /api/admin/activity/:id/read
router.patch("/activity/:id/read", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await markRead(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /api/admin/activity/:id
router.delete("/activity/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await deleteActivity(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/admin/notification-settings
router.get("/notification-settings", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const settings = await getNotificationSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PUT /api/admin/notification-settings
router.put("/notification-settings", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await saveNotificationSettings(req.body as NotificationSettings);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
