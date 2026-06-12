import express, { type Request, type Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin, requireEsteraOrAdmin, type AuthenticatedRequest } from "../middleware/requireFirebaseAuth";
import { OFFER_SERVICES, normalizeOfferServiceIds } from "../../shared/offers/offerServices";
import { BUNNY_ACCESS_KEY_HEADER, buildBunnyStorageUrl, getBunnyStorageKey } from "../constants/bunny";
import { downloadBunnyOriginal } from "../utils/downloadBunnyOriginal";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { markCollaboratorInviteCompleted } from "../services/collaboratorInvite.service";

const router = express.Router();
const COLLECTION = "instagramProposals";
const MEDIA_DESTINATION = "media_assets";
const INSTAGRAM_DESTINATION = "instagram";

type ProposalDestination = typeof MEDIA_DESTINATION | typeof INSTAGRAM_DESTINATION;

function normalizeDestinations(input: unknown): ProposalDestination[] {
  if (!Array.isArray(input)) return [INSTAGRAM_DESTINATION];
  const allowed = new Set<ProposalDestination>([INSTAGRAM_DESTINATION, MEDIA_DESTINATION]);
  const values = Array.from(new Set(input.map(value => String(value).trim()).filter((value): value is ProposalDestination => allowed.has(value as ProposalDestination))));
  return values.length > 0 ? values : [INSTAGRAM_DESTINATION];
}

function bunnyPublicUrl(path: string): string {
  const domain = process.env.BUNNY_CDN_DOMAIN ?? "";
  return `${domain}/${path}`;
}

function originalPhotoUrl(previewUrl: string): string {
  try {
    const url = new URL(previewUrl);
    const original = url.pathname
      .replace("/photos_preview/", "/photos/")
      .replace(/\.webp$/i, ".jpg");
    return signBunnyUrl(original);
  } catch {
    return previewUrl;
  }
}

function previewPhotoUrl(originalUrl: string): string {
  try {
    const url = new URL(originalUrl);
    const preview = url.pathname
      .replace("/photos/", "/photos_preview/")
      .replace(/\.jpg$/i, ".webp");
    return signBunnyUrl(preview);
  } catch {
    return originalUrl;
  }
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

async function importProposalToMediaAssets(id: string, proposal: Record<string, unknown>) {
  const serviceIds = normalizeOfferServiceIds(proposal.mediaAssetServiceIds);
  if (serviceIds.length === 0) return [];

  const existing = await firestore().collection("offer_media_assets")
    .where("sourceProposalId", "==", id)
    .get();
  if (!existing.empty) {
    return existing.docs.map(doc => doc.id);
  }

  const photoUrl = String(proposal.photoUrl ?? "");
  const fileName = String(proposal.fileName ?? "");
  if (!photoUrl || !fileName) return [];

  const { buffer, contentType } = await downloadBunnyOriginal(photoUrl);
  const createdAt = new Date().toISOString();

  const createdIds = await Promise.all(serviceIds.map(async serviceId => {
    const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const bunnyPath = `offers-assets/${serviceId}/${safeFileName}`;
    await uploadToBunny(buffer, bunnyPath, contentType);
    const docRef = await firestore().collection("offer_media_assets").add({
      serviceId,
      kind: "image",
      url: bunnyPublicUrl(bunnyPath),
      bunnyPath,
      label: fileName.replace(/\.[^.]+$/, ""),
      createdAt,
      sourceProposalId: id,
      sourceAlbumSlug: proposal.albumSlug ?? "",
      sourcePhotoUrl: photoUrl,
    });
    return docRef.id;
  }));

  return createdIds;
}

// POST / — propose a photo (any logged-in user)
router.post("/", requireFirebaseAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { albumSlug, photoUrl, fileName, destinations, mediaAssetServiceIds } = req.body as {
    albumSlug: string;
    photoUrl: string;
    fileName: string;
    destinations?: ProposalDestination[];
    mediaAssetServiceIds?: string[];
  };

  if (!albumSlug || !photoUrl || !fileName) {
    res.status(400).json({ error: "albumSlug, photoUrl și fileName sunt obligatorii." });
    return;
  }

  const normalizedDestinations = normalizeDestinations(destinations);
  const normalizedServiceIds = normalizedDestinations.includes(MEDIA_DESTINATION)
    ? normalizeOfferServiceIds(mediaAssetServiceIds)
    : [];

  if (normalizedDestinations.includes(MEDIA_DESTINATION) && normalizedServiceIds.length === 0) {
    res.status(400).json({ error: "Selectează cel puțin un serviciu pentru Media Assets." });
    return;
  }

  try {
    const db = firestore();

    const existing = await db.collection(COLLECTION)
      .where("albumSlug", "==", albumSlug)
      .where("fileName", "==", fileName)
      .where("proposedByUid", "==", authReq.firebaseUid)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0];
      const current = doc.data();
      const mergedDestinations = Array.from(new Set([
        ...(Array.isArray(current.destinations) ? current.destinations.map(value => String(value)) : [INSTAGRAM_DESTINATION]),
        ...normalizedDestinations,
      ]));
      const mergedServiceIds = Array.from(new Set([
        ...normalizeOfferServiceIds(current.mediaAssetServiceIds),
        ...normalizedServiceIds,
      ]));
      await doc.ref.update({
        destinations: mergedDestinations,
        mediaAssetServiceIds: mergedServiceIds,
        updatedAt: Timestamp.now(),
      });
      res.json({ ok: true, id: doc.id, alreadyProposed: true, destinations: mergedDestinations, mediaAssetServiceIds: mergedServiceIds });
      return;
    }

    const docRef = await db.collection(COLLECTION).add({
      albumSlug,
      photoUrl,
      fileName,
      proposedBy: authReq.firebaseEmail,
      proposedByUid: authReq.firebaseUid,
      proposedAt: Timestamp.now(),
      status: "pending",
      destinations: normalizedDestinations,
      mediaAssetServiceIds: normalizedServiceIds,
    });

    await markCollaboratorInviteCompleted({
      email: authReq.firebaseEmail,
      albumSlug,
      actionType: "instagram",
    });

    res.status(201).json({ ok: true, id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /showcase — public endpoint: returns photo URLs from accepted proposals for promo display
router.get("/showcase", async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db
      .collection(COLLECTION)
      .where("status", "==", "accepted")
      .orderBy("proposedAt", "desc")
      .limit(30)
      .get();

    const all = snapshot.docs.map((doc) => doc.data().photoUrl as string).filter(Boolean);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }

    res.json({ photos: all.slice(0, 12) });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /admin/all — all proposals across all albums (admin only) — must be before /album/:slug
router.get("/admin/all", requireFirebaseAuth, requireEsteraOrAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db
      .collection(COLLECTION)
      .orderBy("proposedAt", "desc")
      .get();

    const proposals = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        proposedAt: (data.proposedAt as Timestamp).toDate().toISOString(),
        originalPhotoUrl: originalPhotoUrl(data.photoUrl as string),
        previewPhotoUrl: previewPhotoUrl(data.photoUrl as string),
      };
    });

    res.json({ proposals });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /album/:slug — get proposals for an album (any logged-in user)
router.get("/album/:slug", requireFirebaseAuth, async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const db = firestore();
    const snapshot = await db.collection(COLLECTION)
      .where("albumSlug", "==", slug)
      .orderBy("proposedAt", "desc")
      .get();

    const proposals = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      proposedAt: (doc.data().proposedAt as Timestamp).toDate().toISOString(),
    }));

    res.json({ proposals });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /:id — update status (supreme admin only)
router.patch("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, destinations: destinationsOverride } = req.body as {
    status: "pending" | "accepted" | "archived" | "rejected";
    destinations?: string[];
  };

  if (!["pending", "accepted", "archived", "rejected"].includes(status)) {
    res.status(400).json({ error: "Status invalid." });
    return;
  }

  try {
    const db = firestore();
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: "Propunerea nu a fost găsită." });
      return;
    }

    const proposal = doc.data() as Record<string, unknown>;
    const updates: Record<string, unknown> = { status, updatedAt: Timestamp.now() };

    if (status === "accepted") {
      const destinations = normalizeDestinations(destinationsOverride ?? proposal.destinations);
      if (destinations.length > 0) updates.destinations = destinations;
      if (destinations.includes(MEDIA_DESTINATION)) {
        const proposalWithOverride = { ...proposal, destinations };
        const createdAssetIds = await importProposalToMediaAssets(id, proposalWithOverride);
        if (createdAssetIds.length > 0) {
          updates.mediaAssetIds = createdAssetIds;
          updates.mediaAssetsImportedAt = Timestamp.now();
        }
      }
    }

    await docRef.update(updates);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /admin/bulk — delete all proposals by status (must be before /:id)
router.delete("/admin/bulk", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { status } = req.query as { status?: string };
  if (!status) { res.status(400).json({ error: "status param required" }); return; }
  try {
    const db = firestore();
    const snapshot = await db.collection(COLLECTION).where("status", "==", status).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    res.json({ ok: true, deleted: snapshot.size });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /:id — delete proposal (supreme admin only)
router.delete("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
