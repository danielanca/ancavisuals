import { Router } from "express";
import type { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireCoupleAuth } from "../middleware/requireFirebaseAuth";
import type { CoupleAuthenticatedRequest } from "../middleware/requireFirebaseAuth";

const router = Router();

const VALID_TRIGGER_TYPES = new Set(["daysBeforeWedding", "specificDate", "onCondition"]);
const VALID_STATUSES = new Set(["pending", "sent", "dismissed"]);

function serializeReminder(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    type: data.type,
    title: data.title,
    message: data.message,
    triggerType: data.triggerType,
    triggerValue: {
      daysBeforeWedding: data.triggerValue?.daysBeforeWedding ?? null,
      specificDate: data.triggerValue?.specificDate?.toDate?.()?.toISOString() ?? data.triggerValue?.specificDate ?? null,
      condition: data.triggerValue?.condition ?? null,
    },
    channels: {
      email: data.channels?.email ?? false,
      inApp: data.channels?.inApp ?? true,
    },
    status: data.status,
    sentAt: data.sentAt?.toDate?.()?.toISOString() ?? null,
    isDefault: data.isDefault ?? false,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? data.updatedAt,
  };
}

// GET / — all reminders + preferences for this wedding
router.get("/", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const database = firestore();
    const snap = await database
      .collection("wh_weddings")
      .doc(weddingId)
      .collection("reminders")
      .get();

    const preferences = snap.docs.find((doc) => doc.id === "preferences")?.data() ?? {
      emailNotificationsEnabled: false,
      inAppNotificationsEnabled: true,
      emailAddress: "",
    };

    const reminders = snap.docs
      .filter((doc) => doc.id !== "preferences")
      .map((doc) => serializeReminder(doc.id, doc.data()));

    res.json({ reminders, preferences });
  } catch (error) {
    console.error("[reminders] GET / failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca reminderele." });
  }
});

// PATCH /preferences — update notification preferences
router.patch("/preferences", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const { emailNotificationsEnabled, inAppNotificationsEnabled, emailAddress } = req.body;

    const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (typeof emailNotificationsEnabled === "boolean") updates.emailNotificationsEnabled = emailNotificationsEnabled;
    if (typeof inAppNotificationsEnabled === "boolean") updates.inAppNotificationsEnabled = inAppNotificationsEnabled;
    if (emailAddress !== undefined) updates.emailAddress = String(emailAddress).trim();

    await firestore()
      .collection("wh_weddings")
      .doc(weddingId)
      .collection("reminders")
      .doc("preferences")
      .set(updates, { merge: true });

    res.json({ ok: true, ...updates });
  } catch (error) {
    console.error("[reminders] PATCH /preferences failed:", error);
    res.status(500).json({ error: "Nu s-au putut salva preferințele." });
  }
});

// POST / — add a custom reminder
router.post("/", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const { title, message, triggerType, triggerValue, channels } = req.body;

    if (!String(title ?? "").trim()) return res.status(400).json({ error: "Titlul este obligatoriu." });
    if (!String(message ?? "").trim()) return res.status(400).json({ error: "Mesajul este obligatoriu." });
    if (!VALID_TRIGGER_TYPES.has(String(triggerType ?? ""))) {
      return res.status(400).json({ error: "Tipul de declanșare este invalid." });
    }

    const now = Timestamp.now();
    const reminderData = {
      type: "custom",
      title: String(title).trim(),
      message: String(message).trim(),
      triggerType: String(triggerType),
      triggerValue: {
        daysBeforeWedding: triggerValue?.daysBeforeWedding ?? null,
        specificDate: triggerValue?.specificDate
          ? Timestamp.fromDate(new Date(triggerValue.specificDate))
          : null,
        condition: null,
      },
      channels: {
        email: Boolean(channels?.email),
        inApp: Boolean(channels?.inApp ?? true),
      },
      status: "pending",
      sentAt: null,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await firestore()
      .collection("wh_weddings")
      .doc(weddingId)
      .collection("reminders")
      .add(reminderData);

    res.status(201).json(serializeReminder(docRef.id, reminderData));
  } catch (error) {
    console.error("[reminders] POST / failed:", error);
    res.status(500).json({ error: "Nu s-a putut crea reminderul." });
  }
});

// PATCH /:reminderId — dismiss or edit a reminder
router.patch("/:reminderId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const { reminderId } = req.params;
    const { status, title, message, channels } = req.body;

    const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (status && VALID_STATUSES.has(status)) updates.status = status;
    if (title !== undefined) updates.title = String(title).trim();
    if (message !== undefined) updates.message = String(message).trim();
    if (channels) {
      updates["channels.email"] = Boolean(channels.email);
      updates["channels.inApp"] = Boolean(channels.inApp ?? true);
    }

    const docRef = firestore()
      .collection("wh_weddings")
      .doc(weddingId)
      .collection("reminders")
      .doc(reminderId);

    await docRef.update(updates);
    const snap = await docRef.get();

    res.json(serializeReminder(reminderId, snap.data()!));
  } catch (error) {
    console.error("[reminders] PATCH /:reminderId failed:", error);
    res.status(500).json({ error: "Nu s-a putut actualiza reminderul." });
  }
});

// DELETE /:reminderId — delete a custom reminder only
router.delete("/:reminderId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { weddingId } = req as CoupleAuthenticatedRequest;
    const { reminderId } = req.params;
    const database = firestore();

    const docRef = database
      .collection("wh_weddings")
      .doc(weddingId)
      .collection("reminders")
      .doc(reminderId);

    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Reminderul nu a fost găsit." });
    if (snap.data()?.isDefault) {
      return res.status(403).json({ error: "Reminderele implicite nu pot fi șterse." });
    }

    await docRef.delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[reminders] DELETE /:reminderId failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge reminderul." });
  }
});

export default router;
