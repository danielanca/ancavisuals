import { Router, type Request, type Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";

const router = Router();
const COLLECTION = "clientTasks";

export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export const TASK_PRIORITIES = ["urgent", "high", "medium", "normal", "low"] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];
type TaskPriority = (typeof TASK_PRIORITIES)[number];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  if (typeof value === "object" && "_seconds" in value) {
    return new Date((value as { _seconds: number })._seconds * 1000).toISOString();
  }
  if (typeof value === "string") return value;
  return null;
}

function serializeTask(id: string, data: Record<string, unknown>) {
  return {
    id,
    title: data.title ?? "",
    notes: data.notes ?? "",
    clientName: data.clientName ?? "",
    eventId: data.eventId ?? null,
    status: data.status ?? "todo",
    priority: data.priority ?? "normal",
    dueDate: data.dueDate ?? null,
    plannedFor: data.plannedFor ?? null,
    dayOrder: typeof data.dayOrder === "number" ? data.dayOrder : null,
    scheduledStart: data.scheduledStart ?? null,
    durationMin: typeof data.durationMin === "number" ? data.durationMin : null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    completedAt: toIso(data.completedAt),
  };
}

/** Validates the editable fields of a task body; returns the Firestore patch or an error message. */
export function buildTaskPatch(body: Record<string, unknown>, { requireTitle }: { requireTitle: boolean }):
  { patch: Record<string, unknown> } | { error: string } {
  const patch: Record<string, unknown> = {};

  if (body.title !== undefined || requireTitle) {
    if (typeof body.title !== "string" || !body.title.trim()) return { error: "Titlul este obligatoriu." };
    patch.title = body.title.trim().slice(0, 300);
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== "string") return { error: "Notițe invalide." };
    patch.notes = body.notes.slice(0, 5000);
  }
  if (body.clientName !== undefined) {
    if (typeof body.clientName !== "string") return { error: "Client invalid." };
    patch.clientName = body.clientName.trim().slice(0, 200);
  }
  if (body.eventId !== undefined) {
    if (body.eventId !== null && typeof body.eventId !== "string") return { error: "Eveniment invalid." };
    patch.eventId = body.eventId || null;
  }
  if (body.status !== undefined) {
    if (!TASK_STATUSES.includes(body.status as TaskStatus)) return { error: "Status invalid." };
    patch.status = body.status;
  }
  if (body.priority !== undefined) {
    if (!TASK_PRIORITIES.includes(body.priority as TaskPriority)) return { error: "Prioritate invalidă." };
    patch.priority = body.priority;
  }
  if (body.dayOrder !== undefined) {
    if (body.dayOrder !== null && (typeof body.dayOrder !== "number" || !Number.isInteger(body.dayOrder))) {
      return { error: "Ordine invalidă." };
    }
    patch.dayOrder = body.dayOrder;
  }
  if (body.scheduledStart !== undefined) {
    if (body.scheduledStart !== null && (typeof body.scheduledStart !== "string" || !HH_MM.test(body.scheduledStart))) {
      return { error: "Oră invalidă (format HH:MM)." };
    }
    patch.scheduledStart = body.scheduledStart;
  }
  if (body.durationMin !== undefined) {
    const value = body.durationMin;
    if (value !== null && (typeof value !== "number" || !Number.isInteger(value) || value < 5 || value > 7 * 24 * 60)) {
      return { error: "Durată invalidă." };
    }
    patch.durationMin = value;
  }
  for (const key of ["dueDate", "plannedFor"] as const) {
    if (body[key] === undefined) continue;
    if (body[key] !== null && (typeof body[key] !== "string" || !ISO_DAY.test(body[key] as string))) {
      return { error: "Dată invalidă (format AAAA-LL-ZZ)." };
    }
    patch[key] = body[key] || null;
  }
  return { patch };
}

// GET /api/admin/tasks
router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore().collection(COLLECTION).get();
    const tasks = snapshot.docs.map((doc) => serializeTask(doc.id, doc.data()));
    res.json({ tasks });
  } catch {
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/admin/tasks
router.post("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const result = buildTaskPatch(req.body ?? {}, { requireTitle: true });
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  try {
    const now = Timestamp.now();
    const status = (result.patch.status as TaskStatus | undefined) ?? "todo";
    const data = {
      notes: "",
      clientName: "",
      eventId: null,
      priority: "normal",
      dueDate: null,
      plannedFor: null,
      ...result.patch,
      status,
      createdAt: now,
      updatedAt: now,
      completedAt: status === "done" ? now : null,
    };
    const docRef = await firestore().collection(COLLECTION).add(data);
    res.status(201).json({ task: serializeTask(docRef.id, data) });
  } catch {
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/admin/tasks/reorder — ordinea manuală din „Azi”: { ids } în ordinea dorită
router.post("/reorder", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const ids = (req.body as { ids?: unknown })?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || !ids.every((id) => typeof id === "string" && id)) {
    res.status(400).json({ error: "Listă de taskuri invalidă." });
    return;
  }
  try {
    const db = firestore();
    const batch = db.batch();
    ids.forEach((id, index) => batch.update(db.collection(COLLECTION).doc(id as string), { dayOrder: index }));
    await batch.commit();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Eroare server." });
  }
});

// PATCH /api/admin/tasks/:id
router.patch("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const result = buildTaskPatch(req.body ?? {}, { requireTitle: false });
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  if (Object.keys(result.patch).length === 0) {
    res.status(400).json({ error: "Niciun câmp de actualizat." });
    return;
  }
  try {
    const docRef = firestore().collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: "Task negăsit." });
      return;
    }
    const previous = doc.data() ?? {};
    const now = Timestamp.now();
    const update: Record<string, unknown> = { ...result.patch, updatedAt: now };
    // completedAt drives the progress stats: set it on the transition to done, clear it on reopen.
    if (result.patch.status === "done" && previous.status !== "done") update.completedAt = now;
    if (result.patch.status && result.patch.status !== "done") update.completedAt = null;
    await docRef.update(update);
    res.json({ task: serializeTask(doc.id, { ...previous, ...update }) });
  } catch {
    res.status(500).json({ error: "Eroare server." });
  }
});

// DELETE /api/admin/tasks/:id
router.delete("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Eroare server." });
  }
});

export default router;
