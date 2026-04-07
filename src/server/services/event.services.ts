import { Request, Response } from "express";
import crypto from "crypto";
import { generateEventSlug } from "../../utils/eventUrl"; // assuming you have this
import { firestore } from "../firestoreInit";
import admin from "firebase-admin";
//import { Request } from "node-fetch";

interface Host {
  name: string;
  email?: string;
  phone?: string;
}

interface Guest {
  name: string;
  phone: string;        // primary identifier
  email?: string;
  relation?: string;    // optional: family, friend, colleague...
}

interface CreateEventBody {
  // Basic event info
  weddingTitle: string;                    // e.g. "Estera & Daniel Wedding"
  coupleNames: string;              // e.g. "Estera ♥ Daniel"
  eventDate: string;                // ISO date "2028-05-23"
  eventTime?: string;               // e.g. "18:00"
  timezone?: string;                // recommended: "Europe/Bucharest"
  city: string;                 // main city or venue name
  fullAddress?: string;
  description?: string;             // short welcome message

  // More detailed venues (very useful for wedding)
  venues?: {
    civil?: { name: string; address: string; time: string };
    religious?: { name: string; address: string; time: string };
    reception?: { name: string; address: string; time: string };
  };

  // Customization / texts
  invitationTexts?: {
    tagline?: string;
    countdownTitle?: string;
    rsvpTitle?: string;
    thanksYes?: string;
    thanksNo?: string;
    // ... you can add many more fields
  };

  // Who is invited
  hosts: Host[];                    // usually 2 people
  initialGuests: Guest[];                  // list of invited people

  // Settings
  requireMenuChoice?: boolean;
  allowPlusOne?: boolean;
  maxAdultsPerInvite?: number;
  maxChildrenPerInvite?: number;
}

interface BookedDate {
  date: string,
  type: string,
  label: string,
  price: string,
  phone: string,
  status: string
  dbStore : string
}

const EVENTS_COLLECTION = "events";
const RSVPS_SUBCOLLECTION = "rsvps";
const BOOK_COLLECTION = "bookedDates";

export async function createEvent(req: Request, res: Response) {
  try {
    const data = req.body as CreateEventBody;

    // ── Basic validation ─────────────────────────────────────────────
    if (!data.weddingTitle || !data.coupleNames || !data.eventDate || !data.city) {
      return res.status(400).json(
        { 
          error: "Missing required fields (title, coupleNames, eventDate, location)",
          title : data.weddingTitle,
          couple: data.coupleNames,
          eventData: data.eventDate,
          city : data.city
        },
        
      );
    }

    if (!Array.isArray(data.hosts) || data.hosts.length === 0) {
      return res.status(400).json({ error: "At least one host is required" });
    }

    if (!Array.isArray(data.initialGuests) || data.initialGuests.length === 0) {
      return res.status(400).json({ 
        error: "At least one guest must be invited",
         guest: data.initialGuests });
    }

   // NEW: Generate slug WITHOUT phone number / personal data
   const slug = await generateUniqueSlug(
    generateEventSlug(data.weddingTitle, data.city)
  );
    const eventRef = firestore().collection(EVENTS_COLLECTION).doc(slug);

    // Check for collision (rare but possible)
    const existing = await eventRef.get();
    if (existing.exists) {
      return res.status(409).json({ error: "Generated slug already exists, try again" });
    }

    const eventUrl = `/${slug}`;

    const eventData = {
      ...data,
      slug,
      eventUrl,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Optional: add creator info later via auth
      // createdBy: req.user?.uid,
    };

    await eventRef.set(eventData);

    return res.status(201).json({
      success: true,
      message: "Wedding event created successfully",
      slug,
      eventUrl: eventUrl,
      shareLink: `https://yourdomain.com${eventUrl}`,
    });
  } catch (err) {
    console.error("Create event error:", err);
    return res.status(500).json({ error: "Failed to create event" });
  }
}



// Helper for uniqueness (improved loop)
async function generateUniqueSlug(base: string): Promise<string> {
  let attempt = base;
  let counter = 0;

  while (true) {
    const snap = await firestore().collection(EVENTS_COLLECTION).doc(attempt).get();
    if (!snap.exists) return attempt;

    counter++;
    attempt = `${base}-${counter}`;
    if (counter > 50) throw new Error("Too many slug collisions");
  }
}
// ──────────────────────────────────────────────────────────────
//                Get Event + Authorization by Phone
// ──────────────────────────────────────────────────────────────

export async function getEvent(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    //const { phone } = req.query; // ?phone=...  (can also use header later)

    if (!slug) {
      return res.status(400).json({ error: "Event slug is required" });
    }

    const eventRef = firestore().collection(EVENTS_COLLECTION).doc(slug);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventSnap.data()!;
/*
    // If phone is provided → check access
    if (phone) {
      const normalizedPhone = String(phone).trim().replace(/\s+/g, "");
      const isInvited = event.guests?.some((g: any) =>
        String(g.phone).trim().replace(/\s+/g, "") === normalizedPhone
      );

      if (!isInvited) {
        return res.status(403).json({ error: "You are not invited to this event" });
      }
    }
    // → If no phone provided, you can still return public fields (depending on your policy)
*/
    // Remove sensitive fields before sending
    const safeEvent = {
      ...event,
      // Remove sensitive internal data if needed
      // hosts: undefined,
      // guests: undefined, // or just names...
    };
    

    return res.status(200).json({
      success: true,
      data: safeEvent,
    });
  } catch (err) {
    console.error("Get event error:", err);
    return res.status(500).json({ error: "Failed to fetch event" });
  }
}
export async function getAllEvents(req: Request, res: Response) {
  try {
    // Optional: you can keep phone if you want private filtering later
    const { phone } = req.query;

    const eventsRef = firestore().collection(EVENTS_COLLECTION);
    const snapshot = await eventsRef.get();

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No events found",
      });
    }

    const events = snapshot.docs.map(doc => ({
      id: doc.id,           // ← very important: include the document ID
      ...doc.data(),
    }));



    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (err) {
    console.error("Get all events error:", err);
    return res.status(500).json({ error: "Failed to fetch events" });
  }
}

// Add this function to your existing backend file
export async function verifyGuest(req: Request, res: Response) {
  try {
    const { slug } = req.params;  // matches your :id route
    const { name, phone } = req.body;

    if (!slug || !phone) {
      return res.status(400).json({ error: "Slug and phone required" });
    }

    const eventRef = firestore().collection(EVENTS_COLLECTION).doc(slug);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventSnap.data()!;
    
    // Normalize phone for comparison
    const normalizedPhone = phone.toString().trim().replace(/\s+/g, '').replace(/^\+?/, '');
    
    // Check if guest exists
    const guest = event.initialGuests?.find((g: Guest) => 
      String(g.phone).trim().replace(/\s+/g, '').replace(/^\+?/, '') === normalizedPhone
    );

    if (!guest) {
      return res.status(403).json({
        error: "Phone number not found in guest list",
        hint: "Please check your number or contact the couple"
      });
    }

    // Optional: also check name similarity (fuzzy match)
    const nameMatch = guest.name.toLowerCase().includes(name.toLowerCase().trim()) ||
                     name.toLowerCase().trim().includes(guest.name.toLowerCase());

    if (!nameMatch) {
      return res.status(403).json({ 
        error: "Name doesn't match our records for this phone number",
        expectedName: guest.name
      });
    }

    // Generate short-lived verification token (good security)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
/*
    // Store token (optional - for extra security)
    await eventRef.collection('guestTokens').doc(token).set({
      guestName: guest.name,
      guestPhone: guest.phone,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    */

    return res.json({
      success: true,
      token,
      guestName: guest.name,
      message: "Welcome! You're verified as a guest."
    });

  } catch (err) {
    console.error("Guest verification error:", err);
    return res.status(500).json({ error: "Verification failed" });
  }
}






export async function checkAvailability(req: Request, res: Response) {
  try {
    const { date, dbStore } = req.body as { date: string; dbStore: string };

    // Basic input validation
    if (!date || !dbStore) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: date and dbStore',
      });
    }

    const year = date.split('-')[0];
    const documentId = dbStore.trim();

    const docRef = firestore()
      .collection(BOOK_COLLECTION)
      .doc(year)
      .collection('days')
      .doc(documentId);

    const docSnap = await docRef.get();

    if (docSnap.exists) {
      return res.status(201).json({
        success: true,
        available: false,
        message: 'This date is already booked',
        date,
        bookedBy: docSnap.data()?.title || 'Unknown' // optional: show title if you want
      });
    }

    return res.status(200).json({
      success: true,
      available: true,
      message: 'Date is available',
      date
    });

  } catch (err: any) {
    console.error('Availability check failed:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to check availability'
    });
  }
}

// ───────────────────────────────────────────────
// 2. BOOK DATE (only succeeds if available)
// ───────────────────────────────────────────────
export async function bookDate(req: Request, res: Response) {
  try {
    const data = req.body as {
      date: string;
      title: string;
      desc?: string;
      dbStore: string;
      phone?: string;
      price?:string;
    };

    // Required fields validation
    if (!data.date || !data.title || !data.dbStore || !data.price || !data.phone){
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: date, title, phone, price'
      });
    }

    const year = data.date.split('-')[0];
    const documentId = data.dbStore.trim();

    const docRef = firestore()
      .collection(BOOK_COLLECTION)
      .doc(year)
      .collection('days')
      .doc(documentId);

    // Check availability first (atomic-friendly with transaction possible later)
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      return res.status(409).json({  // 409 Conflict
        success: false,
        error: 'This date is already booked',
        date: data.date
      });
    }

    // Prepare data to save
    const bookingData = {
      ...data,
      //createdAt: FieldValue.serverTimestamp(),
     // updatedAt: FieldValue.serverTimestamp(),
    };

    await docRef.set(bookingData);

    return res.status(200).json({
      success: true,
      message: 'Date booked successfully',
      date: data.date,
      title: data.title
    });

  } catch (err: any) {
    console.error('Booking failed:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to create booking'
    });
  }
}