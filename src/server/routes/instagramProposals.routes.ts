import express, { type Request, type Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin, requireEsteraOrAdmin, type AuthenticatedRequest } from "../middleware/requireFirebaseAuth";
import { OFFER_SERVICES, normalizeOfferServiceIds } from "../../shared/offers/offerServices";
import { BUNNY_ACCESS_KEY_HEADER, buildBunnyStorageUrl, getBunnyStorageKey } from "../constants/bunny";
import { downloadBunnyOriginal } from "../utils/downloadBunnyOriginal";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { generateRomanianAlt } from "../lib/imageAlt";
import { createMediaAssetPreview } from "../utils/mediaAssetPreview";

import { photoVoteKey, reviewerFromEmail } from "../../shared/media/proposalConsensus";
import { albumCoverage, listPhotoReviewers } from "../services/photoReviewers.service";
import { loadAlbum } from "../services/album.service";

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

// Bunny răspunde uneori 400 „Unable to upload file” când o încărcare se întrerupe (ex. multe
// acceptări rapide, fiecare cu descărcare + încărcare + WebP). Reîncercăm de câteva ori.
const UPLOAD_ATTEMPTS = 3;
const UPLOAD_RETRY_DELAYS_MS = [600, 1800];

async function uploadToBunny(buffer: Buffer, bunnyPath: string, contentType: string): Promise<void> {
  const key = getBunnyStorageKey();
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(buildBunnyStorageUrl(bunnyPath), {
      method: "PUT",
      headers: { [BUNNY_ACCESS_KEY_HEADER]: key, "Content-Type": contentType },
      body: buffer,
    });
    if (response.ok) return;
    const detail = await response.text();
    const retryable = response.status === 400 || response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= UPLOAD_ATTEMPTS) {
      throw new Error(`Bunny upload failed: ${response.status} ${detail}`);
    }
    console.warn(`[instagram-proposals] Bunny upload ${response.status} pentru ${bunnyPath}, reîncerc (${attempt}/${UPLOAD_ATTEMPTS - 1})`);
    await new Promise(resolve => setTimeout(resolve, UPLOAD_RETRY_DELAYS_MS[attempt - 1] ?? 2000));
  }
}

// Cel mult 2 importuri în Media Assets deodată (fiecare: descărcare original, încărcare, WebP cu
// sharp) — acceptările rapide din admin nu mai pornesc zeci de încărcări grele în paralel.
const MAX_PARALLEL_IMPORTS = 2;
let runningImports = 0;
const importQueue: Array<() => void> = [];

export async function withImportSlot<T>(task: () => Promise<T>): Promise<T> {
  // Locul eliberat trece direct la următorul din coadă (fără să scadă contorul), ca un import
  // nou să nu poată intra între timp peste limită.
  if (runningImports < MAX_PARALLEL_IMPORTS) runningImports++;
  else await new Promise<void>(resolve => importQueue.push(resolve));
  try {
    return await task();
  } finally {
    const next = importQueue.shift();
    if (next) next();
    else runningImports--;
  }
}

async function importProposalToMediaAssets(id: string, proposal: Record<string, unknown>) {
  const serviceIds = normalizeOfferServiceIds(proposal.mediaAssetServiceIds);
  if (serviceIds.length === 0) return [];

  const photoUrl = String(proposal.photoUrl ?? "");
  const fileName = String(proposal.fileName ?? "");
  const albumSlug = String(proposal.albumSlug ?? "");
  if (!photoUrl || !fileName || !albumSlug) return [];

  // One copy per album photo and service, even when several reviewers chose it.
  const existing = await firestore().collection("offer_media_assets")
    .where("sourceAlbumSlug", "==", albumSlug).get();
  const existingByService = new Map<string, string>();
  for (const doc of existing.docs) {
    const asset = doc.data();
    let sourceFileName = "";
    try { sourceFileName = decodeURIComponent(new URL(String(asset.sourcePhotoUrl)).pathname.split("/").pop() ?? ""); } catch { continue; }
    if (photoVoteKey(albumSlug, sourceFileName) === photoVoteKey(albumSlug, fileName)) {
      existingByService.set(String(asset.serviceId), doc.id);
    }
  }
  const missingServiceIds = serviceIds.filter(serviceId => !existingByService.has(serviceId));
  if (!missingServiceIds.length) return serviceIds.map(serviceId => existingByService.get(serviceId)!);

  const { buffer, contentType } = await downloadBunnyOriginal(photoUrl);
  const createdAt = new Date().toISOString();
  const alt = typeof proposal.alt === "string" && proposal.alt.trim() ? proposal.alt.trim() : undefined;

  const createdIds = await Promise.all(missingServiceIds.map(async serviceId => {
    const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const bunnyPath = `offers-assets/${serviceId}/${safeFileName}`;
    await uploadToBunny(buffer, bunnyPath, contentType);
    const preview = await createMediaAssetPreview(buffer, contentType, bunnyPath);
    const docRef = await firestore().collection("offer_media_assets").add({
      serviceId,
      kind: "image",
      url: bunnyPublicUrl(bunnyPath),
      bunnyPath,
      ...preview,
      label: fileName.replace(/\.[^.]+$/, ""),
      createdAt,
      sourceProposalId: id,
      sourceAlbumSlug: proposal.albumSlug ?? "",
      sourcePhotoUrl: photoUrl,
      ...(alt ? { alt } : {}),
    });
    return docRef.id;
  }));

  return [...serviceIds.flatMap(serviceId => existingByService.get(serviceId) ?? []), ...createdIds];
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
        selectionDestinations: Array.from(new Set([...(current.selectionDestinations ?? current.destinations ?? [INSTAGRAM_DESTINATION]), ...normalizedDestinations])),
        destinations: mergedDestinations,
        mediaAssetServiceIds: mergedServiceIds,
        updatedAt: Timestamp.now(),
      });
      res.json({ ok: true, id: doc.id, alreadyProposed: true, destinations: mergedDestinations, mediaAssetServiceIds: mergedServiceIds });
      return;
    }

    const accountReviewer = reviewerFromEmail(authReq.firebaseEmail, await listPhotoReviewers());
    const docRef = await db.collection(COLLECTION).add({
      albumSlug,
      photoUrl,
      fileName,
      proposedBy: authReq.firebaseEmail,
      proposedByUid: authReq.firebaseUid,
      ...(accountReviewer ? { reviewerId: accountReviewer } : {}),
      proposedAt: Timestamp.now(),
      status: "pending",
      destinations: normalizedDestinations,
      selectionDestinations: normalizedDestinations,
      mediaAssetServiceIds: normalizedServiceIds,
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

type ConsensusRow = {
  id: string; albumSlug: string; proposedAt: string; photoUrl: string; fileName?: string;
  proposedBy?: string; proposedVia?: string; reviewerId?: string;
} & Record<string, unknown>;
const fileKey = (fileName: string) => fileName.replace(/\.[^.]+$/, "");
const fileNameOf = (url: string) => {
  try { return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? ""); } catch { return url.split("?")[0].split("/").pop() ?? ""; }
};

// GET /admin/consensus?albumSlug= — one album's votes for the common selection: who voted, how far
// each person got (to score a photo only among those who saw it) and each photo's place in the album.
// Without albumSlug: the album with the latest vote. Must be before /album/:slug.
router.get("/admin/consensus", requireFirebaseAuth, requireEsteraOrAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const [snapshot, reviewers] = await Promise.all([db.collection(COLLECTION).get(), listPhotoReviewers()]);
    const all = snapshot.docs.map(doc => {
      const data = doc.data();
      return { ...data, id: doc.id, proposedAt: (data.proposedAt as Timestamp | undefined)?.toDate?.().toISOString() ?? "" } as ConsensusRow;
    });
    const latestBySlug = new Map<string, string>();
    for (const proposal of all) {
      if (proposal.albumSlug && (latestBySlug.get(proposal.albumSlug) ?? "") <= proposal.proposedAt) latestBySlug.set(proposal.albumSlug, proposal.proposedAt);
    }
    const albums = [...latestBySlug.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([slug]) => slug);
    const albumSlug = String(req.query.albumSlug ?? "") || albums[0] || "";
    if (!albumSlug) {
      res.json({ albums, albumSlug: null, proposals: [], reviewers, coverage: { total: 0, seen: {} } });
      return;
    }

    const [album, linksSnap] = await Promise.all([
      loadAlbum(albumSlug).catch(() => null),
      db.collection("proposalLinks").where("albumSlug", "==", albumSlug).get(),
    ]);
    const photoOrder = new Map((album?.photos ?? []).map((url, index) => [fileKey(fileNameOf(url)), index]));
    const proposals = all.filter(proposal => proposal.albumSlug === albumSlug).map(proposal => {
      const index = photoOrder.get(fileKey(String(proposal.fileName ?? "")));
      return {
        ...proposal,
        originalPhotoUrl: originalPhotoUrl(proposal.photoUrl),
        previewPhotoUrl: previewPhotoUrl(proposal.photoUrl),
        ...(index !== undefined ? { photoIndex: index } : {}),
      };
    });
    const accountReviewers = [...new Set(proposals
      .filter(proposal => proposal.proposedVia !== "link")
      .map(proposal => proposal.reviewerId || reviewerFromEmail(String(proposal.proposedBy ?? ""), reviewers))
      .filter((id): id is string => Boolean(id)))];
    const coverage = albumCoverage(album?.photos.length ?? 0, linksSnap.docs.map(doc => doc.data()), accountReviewers, reviewers);
    res.json({ albums, albumSlug, proposals, reviewers: reviewers.map(({ id, name }) => ({ id, name })), coverage });
  } catch (error) {
    console.error("[instagram-proposals] GET /admin/consensus failed:", error);
    res.status(500).json({ error: "Nu am putut încărca voturile." });
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
      .get();

    // Sort this album locally to avoid requiring a composite Firestore index.
    const proposals = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      originalPhotoUrl: originalPhotoUrl(doc.data().photoUrl as string),
      previewPhotoUrl: previewPhotoUrl(doc.data().photoUrl as string),
      proposedAt: (doc.data().proposedAt as Timestamp).toDate().toISOString(),
    })).sort((a, b) => b.proposedAt.localeCompare(a.proposedAt));

    res.json({ proposals });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /generate-alt — generates a Romanian alt text (Claude Vision) for a photo and saves it
// on every proposal doc that represents it (a photo proposed by several people has one doc per
// person). Runs before acceptance so that if the photo is later imported into Media Assets, the
// alt text is already carried over by importProposalToMediaAssets.
router.post("/generate-alt", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { ids, photoUrl } = req.body as { ids?: string[]; photoUrl?: string };
  const targetIds = Array.isArray(ids) ? ids.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
  if (!targetIds.length || !photoUrl) {
    res.status(400).json({ error: "ids si photoUrl sunt obligatorii." });
    return;
  }

  try {
    const { alt, skip } = await generateRomanianAlt(originalPhotoUrl(photoUrl));
    const finalAlt = skip ? "" : alt;

    const db = firestore();
    const batch = db.batch();
    for (const id of targetIds) batch.update(db.collection(COLLECTION).doc(id), { alt: finalAlt });
    await batch.commit();

    // Best-effort: if any of these proposals were already imported into Media Assets
    // (accepted before this alt text existed), keep the live copy in sync too.
    const docs = await Promise.all(targetIds.map(id => db.collection(COLLECTION).doc(id).get()));
    const mediaAssetIds = docs.flatMap(doc => {
      const data = doc.data();
      return Array.isArray(data?.mediaAssetIds) ? data.mediaAssetIds as string[] : [];
    });
    if (mediaAssetIds.length > 0) {
      const assetBatch = db.batch();
      for (const assetId of new Set(mediaAssetIds)) assetBatch.update(db.collection("offer_media_assets").doc(assetId), { alt: finalAlt });
      await assetBatch.commit();
    }

    res.json({ alt: finalAlt });
  } catch (error) {
    console.error("[instagram-proposals] generate-alt error:", error);
    res.status(502).json({ error: "Nu am putut genera textul alt." });
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
    const updates: Record<string, unknown> = { status, updatedAt: Timestamp.now(),
      selectionDestinations: proposal.selectionDestinations ?? normalizeDestinations(proposal.destinations) };

    if (status === "accepted") {
      const destinations = normalizeDestinations(destinationsOverride ?? proposal.destinations);
      if (destinations.length > 0) updates.destinations = destinations;
      if (destinations.includes(MEDIA_DESTINATION)) {
        const proposalWithOverride = { ...proposal, destinations };
        const createdAssetIds = await withImportSlot(() => importProposalToMediaAssets(id, proposalWithOverride));
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
