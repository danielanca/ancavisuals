import { Request, Response } from "express";
import { generateEventSlug } from "../../utils/eventUrl";
import { firestore } from "../firestoreInit";
import admin from "firebase-admin";

interface Receiver {
  name: string;
  email: string;
  phone: string;
}

interface CreateEventBody {
  title: string;
  description?: string;
  date: string;
  time: string;
  location: string;
  receivers: Receiver[];
 // hostId: string;
}

const COL = "events";

export async function createEvent(req: Request, res: Response) {
  try {
    const data = req.body as CreateEventBody;

    // ✅ Validate input
    if (
      !data.title ||
      !data.location ||
      !data.date ||
      !data.time ||
      !Array.isArray(data.receivers) ||
      data.receivers.length === 0
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Generate slug
    const slug = generateEventSlug(
      data.location,
      data.receivers[0].phone
    );

    const docRef =await firestore().collection(COL).doc(slug);

    // ✅ Prevent overwrite
    const existing = await docRef.get();
    if (existing.exists) {
      return res.status(409).json({
        error: "Event already exists",
      });
    }

    const eventUrl = `/events/${slug}`;

    // ✅ Save event
    await docRef.set({
      title: data.title,
      description: data.description ?? "",
      date: data.date,
      time: data.time,
      location: data.location,

      slug,
      eventUrl,

      //hostId: data.hostId, // ⚠️ replace with auth middleware later

      receivers: data.receivers,

      status: "active",

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      message: "Event created successfully",
      slug,
      eventUrl,
    });
  } catch (err) {
    console.error("Create event error:", err);
    return res.status(500).json({
      error: "Failed to create event",
    });
  }
}


export async function seeEvent(
  req: Request,
  res: Response
) {
  try {
    const { slug, phone } = req.params;

    if (!slug || !phone) {
      return res.status(400).json({
        error: "Missing slug or phone number",
      });
    }

    const docRef = firestore().collection(COL).doc(slug);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({
        error: "Event not found",
      });
    }

    const event = docSnap.data();

    // 🔐 Check receiver access
    const isAllowed = event?.receivers?.some(
      (r: any) => r.phone === phone
    );

    if (!isAllowed) {
      return res.status(403).json({
        error: "Access denied for this phone number",
      });
    }

    // ✅ Return only safe fields
    return res.status(200).json({
      data:event
    });
  } catch (err) {
    console.error("See event error:", err);
    return res.status(500).json({
      error: "Failed to retrieve event",
    });
  }
}
