import type { Request, Response } from "express";
import { Router } from "express";
import { firestore } from "../firestore";
import { Timestamp } from "firebase-admin/firestore";
import { buildBunnyStorageUrl, buildBunnyDirectoryUrl, getBunnyStorageKey, BUNNY_ACCESS_KEY_HEADER, BUNNY_PHOTOS_FOLDER, BUNNY_QR_MOMENT_FOLDER } from "../constants/bunny";
import sharp from "sharp";

const router = Router();

// GET /api/admin/events — toate evenimentele, sortate după eventDate
router.get("/events", async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db.collection("adminEvents").orderBy("eventDate", "asc").get();

    const events = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        eventDate: data.eventDate instanceof Timestamp ? data.eventDate.toDate().toISOString() : (data.eventDate ?? null),
        eventEndDate: data.eventEndDate instanceof Timestamp ? data.eventEndDate.toDate().toISOString() : (data.eventEndDate ?? null),
      };
    });

    res.json({ events });
  } catch (error) {
    console.error("[adminEvents] GET /events failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca evenimentele." });
  }
});

// POST /api/admin/events — creează eveniment nou
router.post("/events", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const body = req.body;

    if (!body.type || !body.client?.fullName) {
      return res.status(400).json({ error: "Câmpuri obligatorii lipsă: type, client.fullName" });
    }

    const services: { name: string; price: number }[] = body.services ?? [];
    const servicesTotal = services.reduce((sum, s) => sum + (s.price ?? 0), 0);
    const total = Number(body.pricing?.total) || servicesTotal;
    const advanceAmount = Number(body.pricing?.advanceAmount) || 0;
    const advancePaid = body.pricing?.advancePaid === true;

    const newEvent = {
      type: body.type,
      status: body.status ?? "lead",
      fiscalized: body.fiscalized === true,
      createdAt: Timestamp.now(),
      eventDate: body.eventDate ? Timestamp.fromDate(new Date(body.eventDate)) : null,
      eventEndDate: body.eventEndDate ? Timestamp.fromDate(new Date(body.eventEndDate)) : null,
      ...(body.typeLabel ? { typeLabel: body.typeLabel } : {}),
      client: {
        fullName: body.client.fullName,
        phone: body.client.phone ?? "",
        email: body.client.email ?? "",
      },
      services,
      pricing: {
        total,
        advanceAmount,
        advancePaid,
        remainingAmount: Math.max(0, total - advanceAmount),
      },
      ...(body.contractId ? { contractId: body.contractId } : {}),
      ...(body.notes ? { notes: body.notes } : {}),
    };

    const docRef = await db.collection("adminEvents").add(newEvent);
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error("[adminEvents] POST /events failed:", error);
    res.status(500).json({ error: "Nu s-a putut crea evenimentul." });
  }
});

// PATCH /api/admin/events/:id — actualizează câmpuri
router.patch("/events/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { id } = req.params;
    const updates = req.body;

    if (updates.eventDate) {
      updates.eventDate = Timestamp.fromDate(new Date(updates.eventDate));
    } else if (updates.eventDate === null) {
      updates.eventDate = null;
    }
    if (updates.eventEndDate) {
      updates.eventEndDate = Timestamp.fromDate(new Date(updates.eventEndDate));
    } else if (updates.eventEndDate === null) {
      updates.eventEndDate = null;
    }

    await db.collection("adminEvents").doc(id).update(updates);
    res.json({ ok: true });
  } catch (error) {
    console.error("[adminEvents] PATCH /events/:id failed:", error);
    res.status(500).json({ error: "Nu s-a putut actualiza evenimentul." });
  }
});

// DELETE /api/admin/events/:id — șterge eveniment definitiv
router.delete("/events/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { id } = req.params;
    await db.collection("adminEvents").doc(id).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[adminEvents] DELETE /events/:id failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge evenimentul." });
  }
});

// GET /api/admin/settings — goals + currency
router.get("/settings", async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("settings").doc("admin").get();

    if (!doc.exists) {
      // returnăm defaults sensibile dacă nu există încă documentul
      const defaults = {
        goals: {
          sixMonths: { targetRevenue: 15000, startDate: "2026-04-01", endDate: "2026-09-30" },
          oneYear: { targetRevenue: 30000, startDate: "2026-01-01", endDate: "2026-12-31" },
        },
        currency: "EUR",
        exchangeRate: 5.0,
        bankDetails: {
          beneficiaryName: "",
          iban: "",
        },
      };
      return res.json(defaults);
    }

    res.json(doc.data());
  } catch (error) {
    console.error("[adminEvents] GET /settings failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca setările." });
  }
});

// PUT /api/admin/settings — salvează goals
router.put("/settings", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection("settings").doc("admin").set(req.body, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    console.error("[adminEvents] PUT /settings failed:", error);
    res.status(500).json({ error: "Nu s-au putut salva setările." });
  }
});

router.get("/ui-state", async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("settings").doc("adminUIState").get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put("/ui-state", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection("settings").doc("adminUIState").set(req.body, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/events/:id/create-album", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { slug, pin } = req.body as { slug: string; pin?: string };

    if (!slug || !/^[a-z0-9][a-z0-9-]{1,80}$/.test(slug)) {
      return res.status(400).json({ error: "Slug invalid. Folosește doar litere mici, cifre și cratimă." });
    }

    // Verifică dacă folderul există deja în Bunny
    const checkUrl = buildBunnyStorageUrl(slug, BUNNY_PHOTOS_FOLDER) + "/";
    const checkRes = await fetch(checkUrl, { headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() } });
    if (checkRes.ok) {
      return res.status(409).json({ error: "Un album cu acest slug există deja în Bunny." });
    }

    // Create folder structure via placeholder files
    const folders = [
      BUNNY_PHOTOS_FOLDER,
      "photos_preview",
      "shortvideo",
      "longvideo",
      `${BUNNY_QR_MOMENT_FOLDER}/photo`,
      `${BUNNY_QR_MOMENT_FOLDER}/video`,
      `${BUNNY_QR_MOMENT_FOLDER}/audio`,
    ];
    for (const folder of folders) {
      const placeholderUrl = buildBunnyStorageUrl(slug, folder, ".keep");
      const uploadRes = await fetch(placeholderUrl, {
        method: "PUT",
        headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey(), "Content-Type": "application/octet-stream" },
        body: "",
      });
      if (!uploadRes.ok) {
        return res.status(500).json({ error: `Bunny upload failed for ${folder}: ${uploadRes.status}` });
      }
    }

    // Salvează albumSlug și albumPin pe eveniment
    const db = firestore();
    const updates: Record<string, unknown> = { albumSlug: slug };
    if (pin) updates.albumPin = pin;
    await db.collection("adminEvents").doc(id).update(updates);

    res.json({ ok: true, slug, mediaUrl: `/media/${slug}` });
  } catch (error) {
    console.error("[adminEvents] create-album failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Checks if a Bunny folder already exists for the given slug and auto-links it to the event
router.post("/events/:id/detect-album", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { slug } = req.body as { slug: string };

    if (!slug || !/^[a-z0-9][a-z0-9-]{1,80}$/.test(slug)) {
      return res.status(400).json({ found: false });
    }

    const checkUrl = buildBunnyStorageUrl(slug, BUNNY_PHOTOS_FOLDER) + "/";
    const checkRes = await fetch(checkUrl, { headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() } });

    if (!checkRes.ok) return res.json({ found: false });

    const db = firestore();
    await db.collection("adminEvents").doc(id).update({ albumSlug: slug });
    res.json({ found: true, slug });
  } catch (error) {
    res.status(500).json({ found: false, error: String(error) });
  }
});

router.patch("/events/:id/album", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { albumSlug, albumPin } = req.body as { albumSlug?: string; albumPin?: string };
    const db = firestore();
    const updates: Record<string, unknown> = {};
    if (albumSlug !== undefined) updates.albumSlug = albumSlug;
    if (albumPin !== undefined) updates.albumPin = albumPin;
    await db.collection("adminEvents").doc(id).update(updates);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/admin/events/:id/process-album
// SSE stream: generates WebP previews in photos_preview/ and a photos.zip in Bunny
router.post("/events/:id/process-album", async (req: Request, res: Response) => {
  const { id } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const db = firestore();
    const doc = await db.collection("adminEvents").doc(id).get();
    const slug = doc.data()?.albumSlug as string | undefined;

    if (!slug) {
      send({ error: "Evenimentul nu are albumSlug setat." });
      return res.end();
    }

    const storageKey = getBunnyStorageKey();

    // List all files in photos/
    const listUrl = buildBunnyDirectoryUrl(slug, BUNNY_PHOTOS_FOLDER);
    const listRes = await fetch(listUrl, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });
    if (!listRes.ok) {
      send({ error: "Nu pot lista folderul photos din Bunny." });
      return res.end();
    }

    const entries = await listRes.json() as { ObjectName: string; IsDirectory: boolean }[];
    const photos = entries
      .filter((e) => !e.IsDirectory && /\.(jpg|jpeg|png)$/i.test(e.ObjectName) && e.ObjectName !== ".keep")
      .map((e) => e.ObjectName);

    send({ stage: "start", total: photos.length });

    // List existing previews to skip already processed files
    const previewListUrl = buildBunnyDirectoryUrl(slug, "photos_preview");
    const previewListRes = await fetch(previewListUrl, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });
    const existingPreviews = new Set<string>();
    if (previewListRes.ok) {
      const previewEntries = await previewListRes.json() as { ObjectName: string }[];
      previewEntries.forEach((e) => {
        const base = e.ObjectName.replace(/\.[^.]+$/, "");
        existingPreviews.add(base);
      });
    }

    // Step 1: Generate WebP previews incrementally
    send({ stage: "previews", message: "Generez previzualizări WebP..." });
    let previewsDone = 0;
    let previewsSkipped = 0;

    for (const filename of photos) {
      const baseName = filename.replace(/\.[^.]+$/, "");
      if (existingPreviews.has(baseName)) {
        previewsSkipped++;
        continue;
      }

      const originalUrl = buildBunnyStorageUrl(slug, BUNNY_PHOTOS_FOLDER, filename);
      const dlRes = await fetch(originalUrl, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });
      if (!dlRes.ok || !dlRes.body) {
        send({ stage: "previews", warning: `Skip ${filename}: download failed` });
        continue;
      }

      const buffer = Buffer.from(await dlRes.arrayBuffer());
      const webpBuffer = await sharp(buffer)
        .resize({ width: 1400, withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();

      const previewName = `${baseName}.webp`;
      const uploadUrl = buildBunnyStorageUrl(slug, "photos_preview", previewName);
      const upRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey, "Content-Type": "image/webp" },
        body: webpBuffer,
      });

      if (upRes.ok) {
        previewsDone++;
        send({ stage: "previews", done: previewsDone, total: photos.length, current: previewName });
      } else {
        send({ stage: "previews", warning: `Upload failed for ${previewName}` });
      }
    }

    send({ stage: "previews_complete", done: previewsDone, skipped: previewsSkipped });
    send({ stage: "done" });
  } catch (err) {
    send({ error: String(err) });
  }

  res.end();
});

// GET /api/admin/media-activity — ultimele vizite pe paginile /media
router.get("/media-activity", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const snapshot = await db
      .collection("mediaVisits")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const visits = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        slug: d.slug,
        timestamp: d.timestamp instanceof Timestamp ? d.timestamp.toDate().toISOString() : d.timestamp,
        ip: d.ip,
        userAgent: d.userAgent,
        city: d.city,
        region: d.region,
        country: d.country,
        org: d.org,
      };
    });

    res.json({ visits });
  } catch (error) {
    console.error("[adminEvents] GET /media-activity failed:", error);
    res.status(500).json({ error: "Nu s-a putut încărca activitatea." });
  }
});

// DELETE /api/admin/media-activity/:id — șterge o vizită
router.delete("/media-activity/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection("mediaVisits").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[adminEvents] DELETE /media-activity/:id failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge vizita." });
  }
});

export default router;
