import { Router, type Request, type Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";

const router = Router();

const ADMIN_EVENTS_COLLECTION = "adminEvents";
const PHOTOBOOTH_COLLECTION = "photobooth_guests";
const QR_EVENTS = "qr_events";
const QR_GUESTS = "qr_guests";

// GET /api/admin/contacts — list all events with contact counts
router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();

    const eventsSnapshot = await db
      .collection(ADMIN_EVENTS_COLLECTION)
      .orderBy("eventDate", "desc")
      .get();

    const events = await Promise.all(
      eventsSnapshot.docs.map(async (eventDoc) => {
        const data = eventDoc.data();

        const [photoboothSnapshot, qrEventSnapshot] = await Promise.all([
          db.collection(PHOTOBOOTH_COLLECTION).doc(eventDoc.id).collection("guests").count().get(),
          db.collection(QR_EVENTS).where("adminEventId", "==", eventDoc.id).limit(1).get(),
        ]);

        let qrGuestCount = 0;
        if (!qrEventSnapshot.empty) {
          const qrEventSlug = qrEventSnapshot.docs[0].id;
          const qrCount = await db.collection(QR_GUESTS).where("eventSlug", "==", qrEventSlug).count().get();
          qrGuestCount = qrCount.data().count;
        }

        const photoboothCount = photoboothSnapshot.data().count;
        const totalContacts = photoboothCount + qrGuestCount;

        if (totalContacts === 0) return null;

        return {
          id: eventDoc.id,
          clientName: data.clientName ?? null,
          type: data.type ?? null,
          eventDate: data.eventDate instanceof Timestamp
            ? data.eventDate.toDate().toISOString()
            : (data.eventDate ?? null),
          albumSlug: data.albumSlug ?? null,
          photoboothCount,
          qrGuestCount,
          totalContacts,
        };
      })
    );

    res.json({ events: events.filter(Boolean) });
  } catch (error) {
    console.error("[contacts] list failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// GET /api/admin/contacts/:eventId — contacts for a specific event
router.get("/:eventId", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const db = firestore();

    const [eventDoc, photoboothSnapshot, qrEventSnapshot] = await Promise.all([
      db.collection(ADMIN_EVENTS_COLLECTION).doc(eventId).get(),
      db.collection(PHOTOBOOTH_COLLECTION).doc(eventId).collection("guests").orderBy("timestamp", "desc").get(),
      db.collection(QR_EVENTS).where("adminEventId", "==", eventId).limit(1).get(),
    ]);

    if (!eventDoc.exists) {
      res.status(404).json({ error: "Evenimentul nu există." });
      return;
    }

    const photoboothGuests = photoboothSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name as string,
        email: data.email as string | null,
        phone: data.phone as string | null,
        notified: data.notified as boolean,
        timestamp: data.timestamp instanceof Timestamp
          ? data.timestamp.toDate().toISOString()
          : null,
        source: "fotocabina" as const,
      };
    });

    let qrGuests: object[] = [];
    let qrEventSlug: string | null = null;

    if (!qrEventSnapshot.empty) {
      qrEventSlug = qrEventSnapshot.docs[0].id;
      const qrGuestsSnapshot = await db
        .collection(QR_GUESTS)
        .where("eventSlug", "==", qrEventSlug)
        .orderBy("createdAt", "desc")
        .get();

      qrGuests = qrGuestsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name as string,
          email: data.email as string,
          emailConsent: data.emailConsent as boolean,
          uploadCount: ((data.uploadIds as string[]) ?? []).length,
          timestamp: data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : null,
          source: "qr-moments" as const,
        };
      });
    }

    const eventData = eventDoc.data()!;
    res.json({
      event: {
        id: eventDoc.id,
        clientName: eventData.clientName ?? null,
        type: eventData.type ?? null,
        eventDate: eventData.eventDate instanceof Timestamp
          ? eventData.eventDate.toDate().toISOString()
          : (eventData.eventDate ?? null),
        albumSlug: eventData.albumSlug ?? null,
        qrEventSlug,
      },
      photoboothGuests,
      qrGuests,
    });
  } catch (error) {
    console.error("[contacts] detail failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

export default router;
