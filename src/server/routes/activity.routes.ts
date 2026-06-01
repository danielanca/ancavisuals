import express, { type Request, type Response } from "express";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth.js";
import {
  getActivities,
  markAllRead,
  markRead,
  getNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from "../services/activity.service.js";

const router = express.Router();

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
