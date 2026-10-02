import express, { type Request, type Response } from "express";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth.js";
import { deleteLead, getLeads } from "../services/leads.service.js";
import { getEmailLog, getEmailLogEntry } from "../services/emailLog.service.js";

const router = express.Router();

// GET /api/admin/leads
router.get("/leads", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    res.json({ leads: await getLeads(200) });
  } catch (error) {
    console.error("[leads] GET /leads failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca lead-urile." });
  }
});

// DELETE /api/admin/leads/:id
router.delete("/leads/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const deleted = await deleteLead(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Lead-ul nu a fost găsit." });
    res.json({ ok: true });
  } catch (error) {
    console.error("[leads] DELETE /leads/:id failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge lead-ul." });
  }
});

// GET /api/admin/email-log
router.get("/email-log", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    res.json({ emails: await getEmailLog(150) });
  } catch (error) {
    console.error("[email-log] GET /email-log failed:", error);
    res.status(500).json({ error: "Nu s-a putut încărca jurnalul de emailuri." });
  }
});

// GET /api/admin/email-log/:id — includes the full HTML body
router.get("/email-log/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const entry = await getEmailLogEntry(req.params.id);
    if (!entry) return res.status(404).json({ error: "Emailul nu a fost găsit." });
    res.json({ email: entry });
  } catch (error) {
    console.error("[email-log] GET /email-log/:id failed:", error);
    res.status(500).json({ error: "Nu s-a putut încărca emailul." });
  }
});

export default router;
