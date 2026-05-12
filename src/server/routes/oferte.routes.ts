import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { firestore } from "../firestore";
import { adminUser } from "../constants/credentials";
import { sendEmail } from "../notifications/mailer";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { APP_BASE_URL } from "../constants/domain";
import {
  OFFER_SERVICES,
  mergeOfferShowcase,
  type OfferMediaAsset,
  type OfferAssetKind,
  normalizeOfferServiceIds,
  normalizeOfferTemplateAssets,
} from "../../shared/offers/offerServices";
import { BUNNY_ACCESS_KEY_HEADER, buildBunnyStorageUrl, getBunnyStorageKey } from "../constants/bunny";
import { downloadBunnyOriginal } from "../utils/downloadBunnyOriginal";

const router = Router();
const mediaAssetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
const OFFER_TEMPLATE_DOC_ID = "global";

function romanianTime(): string {
  return new Date().toLocaleString("ro-RO", {
    timeZone: "Europe/Bucharest",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress ?? "necunoscut";
}

function bunnyPublicUrl(path: string): string {
  const domain = process.env.BUNNY_CDN_DOMAIN ?? "";
  return `${domain}/${path}`;
}


async function uploadToBunny(buffer: Buffer, bunnyPath: string, contentType: string): Promise<void> {
  const key = getBunnyStorageKey();
  const response = await fetch(buildBunnyStorageUrl(bunnyPath), {
    method: "PUT",
    headers: { [BUNNY_ACCESS_KEY_HEADER]: key, "Content-Type": contentType },
    body: buffer,
  });
  if (!response.ok) {
    throw new Error(`Bunny upload failed: ${response.status} ${await response.text()}`);
  }
}

async function deleteFromBunny(bunnyPath: string): Promise<void> {
  const key = getBunnyStorageKey();
  await fetch(buildBunnyStorageUrl(bunnyPath), {
    method: "DELETE",
    headers: { [BUNNY_ACCESS_KEY_HEADER]: key },
  });
}

type StoredTemplateAsset = {
  assetId: string;
  order: number;
};

function detectAssetKind(file: Express.Multer.File): OfferAssetKind {
  return file.mimetype.toLowerCase().startsWith("video/") ? "video" : "image";
}

function normalizeStoredShowcase(raw: unknown): Record<string, StoredTemplateAsset[]> {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const out: Record<string, StoredTemplateAsset[]> = {};

  for (const service of OFFER_SERVICES) {
    const list = Array.isArray(source[service.id]) ? source[service.id] as unknown[] : [];
    out[service.id] = normalizeOfferTemplateAssets(list);
  }

  return out;
}

async function readTemplateShowcase() {
  const doc = await firestore().collection("offer_template_showcase").doc(OFFER_TEMPLATE_DOC_ID).get();
  return normalizeStoredShowcase(doc.data()?.services);
}

async function writeTemplateShowcase(services: Record<string, StoredTemplateAsset[]>) {
  await firestore().collection("offer_template_showcase").doc(OFFER_TEMPLATE_DOC_ID).set(
    {
      services,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function listMediaAssets(serviceId?: string): Promise<OfferMediaAsset[]> {
  const snapshot = await firestore().collection("offer_media_assets").get();
  const assets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OfferMediaAsset[];
  const filtered = serviceId ? assets.filter(asset => asset.serviceId === serviceId) : assets;
  return filtered.sort((a, b) => {
    const left = a.createdAt ?? "";
    const right = b.createdAt ?? "";
    return left < right ? 1 : left > right ? -1 : 0;
  });
}

function resolveTemplateAssets(
  selectedServiceIds: string[],
  showcase: Record<string, StoredTemplateAsset[]>,
  assets: OfferMediaAsset[],
): Record<string, OfferMediaAsset[]> {
  const byId = new Map(assets.map(asset => [asset.id, asset]));
  return Object.fromEntries(
    selectedServiceIds.map(serviceId => [
      serviceId,
      (showcase[serviceId] ?? [])
        .map(item => byId.get(item.assetId))
        .filter((asset): asset is OfferMediaAsset => Boolean(asset)),
    ]),
  );
}

// ─── Public ───────────────────────────────────────────────────────────────────

// GET /api/oferte/:slug
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const db = firestore();
    const snapshot = await db
      .collection("offers")
      .where("slug", "==", slug)
      .where("active", "==", true)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: "Ofertă negăsită." });

    const doc = snapshot.docs[0];
    const data = doc.data();
    const showcase = await readTemplateShowcase();
    const selectedServices = normalizeOfferServiceIds(data.selectedServices);
    const allAssets = await listMediaAssets();
    const resolvedAssets = resolveTemplateAssets(selectedServices, showcase, allAssets);
    const serviceSections = mergeOfferShowcase(
      {},
      resolvedAssets,
    ).filter(service => selectedServices.includes(service.id));

    // never expose internal counts to public
    const { viewCount, downloadCount, ...publicData } = data;
    res.json({ id: doc.id, ...publicData, selectedServices, serviceSections });
  } catch (error) {
    console.error("[oferte] GET /:slug failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/oferte/:slug/view
router.post("/:slug/view", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const db = firestore();
    const snapshot = await db.collection("offers").where("slug", "==", slug).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: "Ofertă negăsită." });

    const doc = snapshot.docs[0];
    const offer = doc.data();
    const newCount = (offer.viewCount ?? 0) + 1;
    await doc.ref.update({ viewCount: newCount });

    const ip = clientIp(req);
    const time = romanianTime();

    await sendEmail({
      to: adminUser.email,
      subject: `👁 Oferta /${slug} a fost vizualizată`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#0a0a0a;padding:32px 16px;color:#f5f5f5;">
          <div style="max-width:480px;margin:0 auto;border:1px solid #262626;border-radius:16px;padding:28px;background:#111;">
            <p style="color:#a78bfa;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 14px;">Ancavisuals · Oferte</p>
            <h1 style="font-size:22px;font-weight:400;margin:0 0 22px;color:#fff;">Ofertă vizualizată</h1>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="color:#666;padding:6px 0;">Slug</td><td style="color:#fff;padding:6px 0;font-weight:600;">/${slug}</td></tr>
              ${offer.clientName ? `<tr><td style="color:#666;padding:6px 0;">Client</td><td style="color:#fff;padding:6px 0;">${offer.clientName}</td></tr>` : ""}
              <tr><td style="color:#666;padding:6px 0;">Ora</td><td style="color:#fff;padding:6px 0;">${time}</td></tr>
              <tr><td style="color:#666;padding:6px 0;">IP</td><td style="color:#aaa;padding:6px 0;font-size:12px;">${ip}</td></tr>
              <tr><td style="color:#666;padding:6px 0;">Total vizualizări</td><td style="color:#a78bfa;padding:6px 0;font-weight:700;">${newCount}</td></tr>
            </table>
            <div style="margin-top:22px;">
              <a href="${APP_BASE_URL}/admin/oferte" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
                Deschide admin
              </a>
            </div>
          </div>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[oferte] POST /:slug/view failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/oferte/:slug/download
router.post("/:slug/download", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const db = firestore();
    const snapshot = await db.collection("offers").where("slug", "==", slug).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: "Ofertă negăsită." });

    const doc = snapshot.docs[0];
    const offer = doc.data();
    const newCount = (offer.downloadCount ?? 0) + 1;
    await doc.ref.update({ downloadCount: newCount });

    const ip = clientIp(req);
    const time = romanianTime();

    await sendEmail({
      to: adminUser.email,
      subject: `⬇️ Oferta /${slug} a fost descărcată`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#0a0a0a;padding:32px 16px;color:#f5f5f5;">
          <div style="max-width:480px;margin:0 auto;border:1px solid #262626;border-radius:16px;padding:28px;background:#111;">
            <p style="color:#34d399;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 14px;">Ancavisuals · Oferte</p>
            <h1 style="font-size:22px;font-weight:400;margin:0 0 22px;color:#fff;">PDF Descărcat!</h1>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="color:#666;padding:6px 0;">Slug</td><td style="color:#fff;padding:6px 0;font-weight:600;">/${slug}</td></tr>
              ${offer.clientName ? `<tr><td style="color:#666;padding:6px 0;">Client</td><td style="color:#fff;padding:6px 0;">${offer.clientName}</td></tr>` : ""}
              <tr><td style="color:#666;padding:6px 0;">Ora</td><td style="color:#fff;padding:6px 0;">${time}</td></tr>
              <tr><td style="color:#666;padding:6px 0;">IP</td><td style="color:#aaa;padding:6px 0;font-size:12px;">${ip}</td></tr>
              <tr><td style="color:#666;padding:6px 0;">Total descărcări</td><td style="color:#34d399;padding:6px 0;font-weight:700;">${newCount}</td></tr>
            </table>
            <div style="margin-top:22px;">
              <a href="${APP_BASE_URL}/admin/oferte" style="display:inline-block;background:#059669;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
                Deschide admin
              </a>
            </div>
          </div>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[oferte] POST /:slug/download failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────────

router.get("/admin/template-showcase", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const showcase = await readTemplateShowcase();
    const allAssets = await listMediaAssets();
    res.json({
      services: OFFER_SERVICES.map(service => ({
        ...service,
        assets: resolveTemplateAssets([service.id], showcase, allAssets)[service.id] ?? [],
      })),
    });
  } catch (error) {
    console.error("[oferte] GET /admin/template-showcase failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

router.get("/admin/media-assets", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const serviceId = typeof req.query.serviceId === "string" ? req.query.serviceId : undefined;
    const assets = await listMediaAssets(serviceId);
    res.json({ assets });
  } catch (error) {
    console.error("[oferte] GET /admin/media-assets failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

router.post(
  "/admin/media-assets/upload/:serviceId",
  requireFirebaseAuth,
  requireSupremeAdmin,
  mediaAssetUpload.array("files", 30),
  async (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const service = OFFER_SERVICES.find(item => item.id === serviceId);
    const files = req.files as Express.Multer.File[] | undefined;

    if (!service) return res.status(404).json({ error: "Serviciul nu a fost gasit." });
    if (!files || files.length === 0) return res.status(400).json({ error: "Lipsesc fisierele." });

    try {
      const uploaded = await Promise.all(files.map(async file => {
        const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const bunnyPath = `offers-assets/${serviceId}/${safeFileName}`;
        await uploadToBunny(file.buffer, bunnyPath, file.mimetype || "application/octet-stream");
        const asset: Omit<OfferMediaAsset, "id"> = {
          serviceId,
          kind: detectAssetKind(file),
          url: bunnyPublicUrl(bunnyPath),
          bunnyPath,
          label: file.originalname.replace(/\.[^.]+$/, ""),
          createdAt: new Date().toISOString(),
        };
        const docRef = await firestore().collection("offer_media_assets").add(asset);
        return { id: docRef.id, ...asset };
      }));
      res.status(201).json({ assets: uploaded });
    } catch (error) {
      console.error("[oferte] POST /admin/media-assets/upload/:serviceId failed:", error);
      res.status(500).json({ error: "Eroare server." });
    }
  },
);

const downloadOriginal = downloadBunnyOriginal;

router.post("/admin/media-assets/import-from-url", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { items, serviceId, sourceAlbumSlug } = req.body as {
    items: Array<{ url: string; fileName: string }>;
    serviceId: string;
    sourceAlbumSlug?: string;
  };

  const service = OFFER_SERVICES.find(item => item.id === serviceId);
  if (!service) { res.status(400).json({ error: "Serviciu invalid." }); return; }
  if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ error: "Lipsesc fisierele de importat." }); return; }

  try {
    const imported = await Promise.all(items.map(async ({ url, fileName }) => {
      const { buffer, contentType } = await downloadOriginal(url);
      const kind: OfferAssetKind = contentType.startsWith("video/") ? "video" : "image";

      const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const bunnyPath = `offers-assets/${serviceId}/${safeFileName}`;
      await uploadToBunny(buffer, bunnyPath, contentType);

      const asset: Record<string, unknown> = {
        serviceId,
        kind,
        url: bunnyPublicUrl(bunnyPath),
        bunnyPath,
        label: fileName.replace(/\.[^.]+$/, ""),
        createdAt: new Date().toISOString(),
      };
      if (sourceAlbumSlug) asset.sourceAlbumSlug = sourceAlbumSlug;
      asset.sourcePhotoUrl = url;
      const docRef = await firestore().collection("offer_media_assets").add(asset);
      return { id: docRef.id, ...asset };
    }));

    res.status(201).json({ assets: imported });
  } catch (error) {
    console.error("[oferte] POST /admin/media-assets/import-from-url failed:", error);
    res.status(500).json({ error: "Eroare la import." });
  }
});

router.post("/admin/media-assets/reprocess-originals", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore().collection("offer_media_assets").get();
    type RawAsset = { id: string; sourcePhotoUrl?: string; bunnyPath?: string };
    const candidates = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as RawAsset))
      .filter(asset => typeof asset.sourcePhotoUrl === "string" && asset.sourcePhotoUrl && typeof asset.bunnyPath === "string" && asset.bunnyPath);

    let fixed = 0;
    let skipped = 0;

    await Promise.all(candidates.map(async asset => {
      try {
        const { buffer, contentType } = await downloadOriginal(asset.sourcePhotoUrl!);
        await uploadToBunny(buffer, asset.bunnyPath!, contentType);
        const kind: OfferAssetKind = contentType.startsWith("video/") ? "video" : "image";
        await firestore().collection("offer_media_assets").doc(asset.id).update({
          kind,
          url: bunnyPublicUrl(asset.bunnyPath!),
          reprocessedAt: new Date().toISOString(),
        });
        fixed++;
      } catch {
        skipped++;
      }
    }));

    res.json({ ok: true, fixed, skipped, total: candidates.length });
  } catch (error) {
    console.error("[oferte] POST /admin/media-assets/reprocess-originals failed:", error);
    res.status(500).json({ error: "Eroare la reprocessare." });
  }
});

router.delete("/admin/media-assets/by-source", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { sourceAlbumSlug, serviceId } = req.body as { sourceAlbumSlug?: string; serviceId?: string };

  if (!sourceAlbumSlug && !serviceId) { res.status(400).json({ error: "Lipsesc parametrii." }); return; }

  try {
    let query: FirebaseFirestore.Query = firestore().collection("offer_media_assets");
    if (sourceAlbumSlug) query = query.where("sourceAlbumSlug", "==", sourceAlbumSlug);
    if (serviceId) query = query.where("serviceId", "==", serviceId);

    const snapshot = await query.get();
    if (snapshot.empty) { res.json({ ok: true, deleted: 0 }); return; }

    await Promise.all(snapshot.docs.map(async doc => {
      const asset = doc.data();
      if (typeof asset.bunnyPath === "string" && asset.bunnyPath) {
        await deleteFromBunny(asset.bunnyPath).catch(() => {});
      }
      await doc.ref.delete();
    }));

    const showcase = await readTemplateShowcase();
    const deletedIds = new Set(snapshot.docs.map(d => d.id));
    let showcaseChanged = false;
    for (const service of OFFER_SERVICES) {
      const before = showcase[service.id] ?? [];
      const after = before.filter(item => !deletedIds.has(item.assetId)).map((item, i) => ({ ...item, order: i }));
      if (after.length !== before.length) { showcase[service.id] = after; showcaseChanged = true; }
    }
    if (showcaseChanged) await writeTemplateShowcase(showcase);

    res.json({ ok: true, deleted: snapshot.docs.length });
  } catch (error) {
    console.error("[oferte] DELETE /admin/media-assets/by-source failed:", error);
    res.status(500).json({ error: "Eroare la stergere." });
  }
});

router.delete("/admin/media-assets/:assetId", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const assetRef = firestore().collection("offer_media_assets").doc(assetId);
    const assetDoc = await assetRef.get();
    if (!assetDoc.exists) return res.status(404).json({ error: "Assetul nu a fost gasit." });

    const asset = { id: assetDoc.id, ...assetDoc.data() } as OfferMediaAsset;
    if (asset.bunnyPath) await deleteFromBunny(asset.bunnyPath);
    await assetRef.delete();

    const showcase = await readTemplateShowcase();
    for (const service of OFFER_SERVICES) {
      showcase[service.id] = (showcase[service.id] ?? [])
        .filter(item => item.assetId !== assetId)
        .map((item, index) => ({ ...item, order: index }));
    }
    await writeTemplateShowcase(showcase);
    res.json({ ok: true });
  } catch (error) {
    console.error("[oferte] DELETE /admin/media-assets/:assetId failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

router.put("/admin/template-showcase/:serviceId/order", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { serviceId } = req.params;
  const assetIds: string[] = Array.isArray(req.body.assetIds)
    ? req.body.assetIds.map((value: unknown) => String(value))
    : Array.isArray(req.body.imageIds)
      ? req.body.imageIds.map((value: unknown) => String(value))
      : [];

  if (!OFFER_SERVICES.some(service => service.id === serviceId)) {
    return res.status(404).json({ error: "Serviciul nu a fost gasit." });
  }

  try {
    const showcase = await readTemplateShowcase();
    const allAssets = await listMediaAssets(serviceId);
    const allowedAssetIds = new Set(allAssets.map(asset => asset.id));
    const filteredAssetIds = assetIds.filter(assetId => allowedAssetIds.has(assetId));
    showcase[serviceId] = filteredAssetIds.map((assetId, index) => ({ assetId, order: index }));
    await writeTemplateShowcase(showcase);
    res.json({ assets: resolveTemplateAssets([serviceId], showcase, allAssets)[serviceId] ?? [] });
  } catch (error) {
    console.error("[oferte] PUT /admin/template-showcase/:serviceId/order failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

router.delete("/admin/template-showcase/:serviceId/assets/:assetId", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { serviceId, assetId } = req.params;

  if (!OFFER_SERVICES.some(service => service.id === serviceId)) {
    return res.status(404).json({ error: "Serviciul nu a fost gasit." });
  }

  try {
    const showcase = await readTemplateShowcase();
    showcase[serviceId] = (showcase[serviceId] ?? [])
      .filter(item => item.assetId !== assetId)
      .map((item, index) => ({ ...item, order: index }));
    await writeTemplateShowcase(showcase);
    res.json({ ok: true });
  } catch (error) {
    console.error("[oferte] DELETE /admin/template-showcase/:serviceId/assets/:assetId failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// GET /api/oferte/admin/list
router.get("/admin/list", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db.collection("offers").orderBy("createdAt", "desc").get();
    const offers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ offers });
  } catch (error) {
    console.error("[oferte] GET /admin/list failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/oferte/admin
router.post("/admin", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { slug, clientName, title, description, pdfUrl, price, packageName, validUntil, selectedServices } = req.body;

    if (!slug?.trim()) return res.status(400).json({ error: "Slug-ul este obligatoriu." });

    const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");
    const db = firestore();

    // Check uniqueness
    const existing = await db.collection("offers").where("slug", "==", cleanSlug).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: `Slug-ul „${cleanSlug}" există deja.` });

    const now = new Date().toISOString();
    const newOffer = {
      slug: cleanSlug,
      clientName: clientName?.trim() ?? "",
      title: title?.trim() ?? "",
      description: description?.trim() ?? "",
      pdfUrl: pdfUrl?.trim() ?? "",
      price: price?.trim() ?? "",
      packageName: packageName?.trim() ?? "",
      validUntil: validUntil ?? "",
      selectedServices: normalizeOfferServiceIds(selectedServices),
      active: true,
      viewCount: 0,
      downloadCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection("offers").add(newOffer);
    res.json({ id: docRef.id, ...newOffer });
  } catch (error) {
    console.error("[oferte] POST /admin failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// PATCH /api/oferte/admin/:id
router.patch("/admin/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = firestore();
    const docRef = db.collection("offers").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Oferta nu a fost găsită." });

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if ("slug" in req.body) {
      const cleanSlug = String(req.body.slug).trim().toLowerCase().replace(/\s+/g, "-");
      const existing = await db.collection("offers").where("slug", "==", cleanSlug).limit(1).get();
      if (!existing.empty && existing.docs[0].id !== id) {
        return res.status(409).json({ error: `Slug-ul „${cleanSlug}" există deja.` });
      }
      updates.slug = cleanSlug;
    }

    const allowed = ["clientName", "title", "description", "pdfUrl", "price", "packageName", "validUntil", "active", "viewCount", "downloadCount"];
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    if ("selectedServices" in req.body) {
      updates.selectedServices = normalizeOfferServiceIds(req.body.selectedServices);
    }

    await docRef.update(updates);
    res.json({ id, ...doc.data(), ...updates });
  } catch (error) {
    console.error("[oferte] PATCH /admin/:id failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// DELETE /api/oferte/admin/:id
router.delete("/admin/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = firestore();
    await db.collection("offers").doc(id).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[oferte] DELETE /admin/:id failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

export default router;
