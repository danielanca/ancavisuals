import { Router } from "express";
import type { Request, Response } from "express";
import { firestore } from "../firestore";
import { Timestamp } from "firebase-admin/firestore";
import { checkAndSendMementos } from "../cron/mementos.cron";
import { sendEmail } from "../notifications/mailer";

const router = Router();
const COLLECTION = "mementos";

router.get("/mementos", async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db.collection(COLLECTION).orderBy("dueDate", "asc").get();
    const mementos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate instanceof Timestamp
        ? doc.data().dueDate.toDate().toISOString()
        : doc.data().dueDate,
      createdAt: doc.data().createdAt instanceof Timestamp
        ? doc.data().createdAt.toDate().toISOString()
        : doc.data().createdAt,
    }));
    res.json({ mementos });
  } catch (error) {
    console.error("[mementos] GET failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca mementourile." });
  }
});

router.post("/mementos", async (req: Request, res: Response) => {
  try {
    const { title, description, dueDate, category, reminderMinutesBefore, recurring } = req.body;
    if (!title || !dueDate || !category) {
      return res.status(400).json({ error: "title, dueDate și category sunt obligatorii." });
    }
    const db = firestore();
    const docRef = await db.collection(COLLECTION).add({
      title,
      description: description ?? "",
      dueDate: Timestamp.fromDate(new Date(dueDate)),
      category,
      reminderMinutesBefore: reminderMinutesBefore ?? 0,
      recurring: recurring ?? "none",
      completed: false,
      emailSent: false,
      createdAt: Timestamp.now(),
    });
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error("[mementos] POST failed:", error);
    res.status(500).json({ error: "Nu s-a putut salva mementoul." });
  }
});

router.patch("/mementos/:id", async (req: Request, res: Response) => {
  try {
    const { completed, title, description, dueDate, reminderMinutesBefore, recurring } = req.body;
    const db = firestore();
    const updates: Record<string, unknown> = {};

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (dueDate !== undefined) updates.dueDate = Timestamp.fromDate(new Date(dueDate));
    if (reminderMinutesBefore !== undefined) updates.reminderMinutesBefore = reminderMinutesBefore;
    if (recurring !== undefined) updates.recurring = recurring;

    if (completed !== undefined) {
      updates.completed = completed;
      if (completed === true) {
        const doc = await db.collection(COLLECTION).doc(req.params.id).get();
        const data = doc.data();
        if (data?.recurring && data.recurring !== "none") {
          const nextDate = getNextOccurrence(data.dueDate.toDate(), data.recurring);
          updates.dueDate = Timestamp.fromDate(nextDate);
          updates.completed = false;
          updates.emailSent = false;
        }
      }
    }

    await db.collection(COLLECTION).doc(req.params.id).update(updates);
    res.json({ ok: true });
  } catch (error) {
    console.error("[mementos] PATCH failed:", error);
    res.status(500).json({ error: "Nu s-a putut actualiza mementoul." });
  }
});

router.get("/mementos/server-time", (_req: Request, res: Response) => {
  res.json({ serverTime: new Date().toISOString() });
});

router.post("/mementos/send-test-email", async (_req: Request, res: Response) => {
  try {
    await sendEmail({
      to: "ancadaniel1994@gmail.com",
      subject: "✅ Test email — Mementouri",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#7c3aed;">✅ Email funcționează!</h2>
        <p style="color:#374151;">Acesta este un email de test trimis din secțiunea Mementouri.</p>
      </div>`,
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});


router.delete("/mementos/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[mementos] DELETE failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge mementoul." });
  }
});

export function getNextOccurrence(date: Date, recurring: string): Date {
  const next = new Date(date);
  switch (recurring) {
    case "weekly":  next.setDate(next.getDate() + 7); break;
    case "monthly": next.setMonth(next.getMonth() + 1); break;
    case "yearly":  next.setFullYear(next.getFullYear() + 1); break;
  }
  return next;
}

export default router;
