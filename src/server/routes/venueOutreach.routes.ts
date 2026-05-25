import { Router } from "express";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { firestore } from "../firestore";
import { Timestamp } from "firebase-admin/firestore";

const router = Router();
router.use(requireFirebaseAuth, requireSupremeAdmin);

const PLACES_KEY =
  process.env.GOOGLE_PLACES_API ??
  process.env.GOOGLE_PLACES_API_KEY ??
  process.env.VITE_GOOGLE_MAPS_BROWSER_KEY ??
  "";

const LOG_COLLECTION = "venueOutreachLog";

const SEARCH_QUERIES: Record<string, string[]> = {
  venue: [
    "sală de nunți",
    "restaurant evenimente",
    "salon petreceri",
    "locație nuntă",
    "restaurant nuntă",
  ],
  "rochii-mirese": [
    "magazin rochii mireasă",
    "atelier rochii de mireasă",
    "rochii nuntă",
    "salon rochii mireasă",
    "boutique rochii mireasă",
  ],
};

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface PlacesTextResult {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  types: string[];
}

interface PlacesDetailsResult {
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
}

async function textSearch(query: string, city: string): Promise<PlacesTextResult[]> {
  const encoded = encodeURIComponent(`${query} ${city}`);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encoded}&language=ro&region=ro&key=${PLACES_KEY}`;
  const response = await fetch(url);
  const data = (await response.json()) as { results: PlacesTextResult[]; status: string };
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.warn(`Places text search status: ${data.status} for "${query} ${city}"`);
  }
  return data.results ?? [];
}

async function fetchDetails(placeId: string): Promise<PlacesDetailsResult> {
  const fields = "formatted_phone_number,international_phone_number,website";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=ro&key=${PLACES_KEY}`;
  const response = await fetch(url);
  const data = (await response.json()) as { result?: PlacesDetailsResult; status: string };
  return data.result ?? {};
}

router.get("/venue-outreach/search", async (req, res) => {
  const city = (req.query.city as string | undefined)?.trim();
  const keyword = (req.query.keyword as string | undefined)?.trim();
  const category = ((req.query.category as string | undefined)?.trim()) || "venue";

  if (!city && !keyword) {
    res.status(400).json({ error: "city or keyword param required" });
    return;
  }

  if (!PLACES_KEY) {
    res.status(500).json({ error: "Google Places API key not configured" });
    return;
  }

  try {
    const seen = new Set<string>();
    const venues: PlacesTextResult[] = [];

    if (keyword) {
      const queryString = city ? `${keyword} ${city}` : keyword;
      const encoded = encodeURIComponent(queryString);
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encoded}&language=ro&region=ro&key=${PLACES_KEY}`;
      const response = await fetch(url);
      const data = (await response.json()) as { results: PlacesTextResult[]; status: string };
      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.warn(`Places text search status: ${data.status} for "${queryString}"`);
      }
      for (const place of (data.results ?? [])) {
        if (!seen.has(place.place_id)) {
          seen.add(place.place_id);
          venues.push(place);
        }
      }
    } else {
      const queries = SEARCH_QUERIES[category] ?? SEARCH_QUERIES["venue"];
      for (const query of queries) {
        const results = await textSearch(query, city!);
        for (const place of results) {
          if (!seen.has(place.place_id)) {
            seen.add(place.place_id);
            venues.push(place);
          }
        }
      }
    }

    const withDetails = await Promise.all(
      venues.map(async (venue) => {
        const details = await fetchDetails(venue.place_id);
        return {
          placeId: venue.place_id,
          slug: toSlug(venue.name),
          name: venue.name,
          address: venue.formatted_address,
          rating: venue.rating,
          reviewCount: venue.user_ratings_total,
          types: venue.types,
          phone: details.formatted_phone_number ?? details.international_phone_number ?? null,
          website: details.website ?? null,
        };
      })
    );

    res.json({ venues: withDetails, city: city ?? keyword });
  } catch (error) {
    console.error("venue-outreach error:", error);
    res.status(500).json({ error: "Places API request failed" });
  }
});

router.get("/venue-outreach/extract-email", async (req, res) => {
  const website = (req.query.website as string | undefined)?.trim();
  if (!website) {
    res.status(400).json({ error: "website param required" });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(website, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AncaVisuals-bot/1.0)" },
    });
    clearTimeout(timeout);

    const html = await response.text();
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const found = html.match(emailRegex) ?? [];

    const blacklist = ["sentry", "wixpress", "example", "schema", "pixel", "cloudflare", "jquery", "bootstrap", "fontawesome", "google", "facebook", "w3.org", "wordpress", "github"];
    const emails = [...new Set(found)].filter(
      (email) => !blacklist.some((b) => email.toLowerCase().includes(b))
    );

    res.json({ email: emails[0] ?? null, all: emails.slice(0, 5) });
  } catch {
    res.json({ email: null, all: [] });
  }
});

router.post("/venue-outreach/send", async (req, res) => {
  const { phone, message, channel } = req.body as {
    phone: string;
    message: string;
    channel: "sms" | "whatsapp";
  };

  if (!phone || !message || !channel) {
    res.status(400).json({ error: "phone, message, channel required" });
    return;
  }

  const apiKey = process.env.SMSALERT_API_KEY;
  const username = process.env.SMSALERT_USERNAME;
  if (!apiKey || !username) {
    res.status(500).json({ error: "SMSALERT_API_KEY or SMSALERT_USERNAME not configured" });
    return;
  }

  const normalizedPhone = phone.startsWith("+") ? phone : `+40${phone.replace(/^0/, "")}`;
  const basicAuth = Buffer.from(`${username}:${apiKey}`).toString("base64");

  try {
    const body: Record<string, string> = {
      phoneNumber: normalizedPhone,
      message,
    };

    if (channel === "whatsapp") {
      const waSender = process.env.SMSALERT_WA_SENDER;
      if (waSender) body.from = waSender;
      body.channel = "whatsapp";
    }

    const response = await fetch("https://smsalert.mobi/api/v2/message/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      console.error(`SMSAlert error [${channel}]:`, result);
      res.status(response.status).json({ error: result.message ?? "SMSAlert API error", detail: result });
      return;
    }

    res.json({ ok: true, result });
  } catch (error) {
    console.error("SMSAlert send error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.get("/venue-outreach/log", async (_req, res) => {
  try {
    const db = firestore();
    const snapshot = await db.collection(LOG_COLLECTION).orderBy("sentAt", "desc").get();
    const entries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      sentAt: doc.data().sentAt instanceof Timestamp
        ? doc.data().sentAt.toDate().toISOString()
        : doc.data().sentAt,
    }));
    res.json({ entries });
  } catch (error) {
    console.error("venue-outreach log GET error:", error);
    res.status(500).json({ error: "Failed to fetch log" });
  }
});

router.post("/venue-outreach/log", async (req, res) => {
  const { placeId, name, city, address, phone, website, channel } = req.body as {
    placeId: string;
    name: string;
    city: string;
    address?: string;
    phone?: string | null;
    website?: string | null;
    channel: "whatsapp" | "email" | "sms";
  };

  if (!placeId || !name || !channel) {
    res.status(400).json({ error: "placeId, name, channel required" });
    return;
  }

  try {
    const db = firestore();
    await db.collection(LOG_COLLECTION).add({
      placeId,
      name,
      city: city ?? "",
      address: address ?? "",
      phone: phone ?? null,
      website: website ?? null,
      channel,
      sentAt: Timestamp.now(),
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("venue-outreach log POST error:", error);
    res.status(500).json({ error: "Failed to save log entry" });
  }
});

export default router;
