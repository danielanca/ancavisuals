import express, { type Request, type Response } from "express";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth.js";
import { archiveLead, deleteLead, getLeads } from "../services/leads.service.js";
import { EMAIL_LOG_MAX_LIST, getEmailLog, getEmailLogEntry } from "../services/emailLog.service.js";
import { getInboxSyncState, syncEmailInbox } from "../services/emailInbox.service.js";

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

router.patch("/leads/:id/archive", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  if (typeof req.body?.archived !== "boolean") return res.status(400).json({ error: "Starea arhivării este invalidă." });
  try {
    if (!await archiveLead(req.params.id, req.body.archived)) return res.status(404).json({ error: "Lead-ul nu a fost găsit." });
    res.json({ ok: true });
  } catch (error) {
    console.error("[leads] archive failed:", error);
    res.status(500).json({ error: "Nu s-a putut actualiza arhivarea lead-ului." });
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
// ?all=1 → the whole log (without bodies) for /admin/email-log; the leads page keeps the last 150.
router.get("/email-log", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    res.json({ emails: await getEmailLog(req.query.all === "1" ? EMAIL_LOG_MAX_LIST : 150) });
  } catch (error) {
    console.error("[email-log] GET /email-log failed:", error);
    res.status(500).json({ error: "Nu s-a putut încărca jurnalul de emailuri." });
  }
});

// GET /api/admin/email-inbox-sync — when the mailbox was last read for replies, and the last error.
router.get("/email-inbox-sync", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    res.json({ state: await getInboxSyncState() });
  } catch (error) {
    console.error("[email-log] GET /email-inbox-sync failed:", error);
    res.status(500).json({ error: "Nu s-a putut citi starea sincronizării." });
  }
});

// POST /api/admin/email-inbox-sync — read the mailbox now ("Verifică răspunsurile").
router.post("/email-inbox-sync", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    res.json({ result: await syncEmailInbox() });
  } catch (error) {
    console.error("[email-log] inbox sync failed:", error);
    res.status(502).json({ error: `Căsuța de email nu a putut fi citită: ${error instanceof Error ? error.message : "eroare necunoscută"}` });
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
