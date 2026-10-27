/*
 * Purpose: public, account-less proposal links. An admin generates a unique link
 * per album; anyone holding it enters their name, picks photos and proposes them
 * for Instagram / Media Assets. Proposals land in the same `instagramProposals`
 * collection as the logged-in flow, so the existing swipe/admin review applies.
 */
import express, { type Request, type Response } from "express";
import { randomBytes } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin, type AuthenticatedRequest } from "../middleware/requireFirebaseAuth";
import { loadAlbum, resolveAlbumSlug } from "../services/album.service";
import { normalizeOfferServiceIds } from "../../shared/offers/offerServices";
import { sendViaFunnel } from "../notifications/emailFunnel";
import { adminUser } from "../constants/credentials";

import { isPhotoReviewerId, type PhotoReviewerId } from "../../shared/media/proposalConsensus";

const router = express.Router();
const LINKS_COLLECTION = "proposalLinks";
const PROPOSALS_COLLECTION = "instagramProposals";
const TASKS_COLLECTION = "clientTasks";
const DESTINATIONS = ["instagram", "media_assets"] as const;
const MAX_FILES_PER_SUBMIT = 200;
const MAX_NAME_LENGTH = 60;

type Destination = typeof DESTINATIONS[number];

type VisitorProgress = {
  name?: string;
  viewedCount?: number;
  proposedCount?: number;
  startedAt?: Timestamp;
  lastSeenAt?: Timestamp;
  completedAt?: Timestamp | null;
};

type ProposalLink = {
  token: string;
  albumSlug: string;
  label: string;
  reviewerId?: PhotoReviewerId;
  active: boolean;
  mediaAssetServiceIds: string[];
  createdByEmail: string;
  createdAt: Timestamp;
  taskId?: string | null;
  totalPhotos?: number;
  visitors?: Record<string, VisitorProgress>;
  completedAt?: Timestamp | null;
};

/** Relative path; the admin UI prefixes the current origin when copying. */
export function buildProposalLinkUrl(token: string): string {
  return `/propune/${token}`;
}

function fileNameFromUrl(src: string): string {
  try {
    return decodeURIComponent(new URL(src).pathname.split("/").pop() ?? "");
  } catch {
    return decodeURIComponent(src.split("?")[0].split("/").pop() ?? "");
  }
}

function mediaKey(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

const isSafeToken = (token: string) => /^[A-Za-z0-9_-]{16,64}$/.test(token);
const isSafeVisitorId = (id: string) => /^[A-Za-z0-9_-]{8,64}$/.test(id);

function normalizeDestinations(input: unknown): Destination[] {
  if (!Array.isArray(input)) return [];
  return DESTINATIONS.filter(destination => input.includes(destination));
}

async function readActiveLink(token: string): Promise<ProposalLink | null> {
  if (!isSafeToken(token)) return null;
  const snap = await firestore().collection(LINKS_COLLECTION).doc(token).get();
  if (!snap.exists) return null;
  const link = snap.data() as ProposalLink;
  return link.active ? link : null;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Email to the owner when a visitor presses „Am terminat” on a proposal link. */
export function buildCompletionEmail(link: Pick<ProposalLink, "albumSlug" | "label" | "totalPhotos">, visitor: VisitorProgress & { name: string }) {
  const where = link.label || link.albumSlug;
  const proposed = visitor.proposedCount ?? 0;
  const viewed = visitor.viewedCount ?? 0;
  const seen = link.totalPhotos ? `${viewed} / ${link.totalPhotos}` : String(viewed);
  return {
    subject: `✅ ${visitor.name} a terminat de ales poze — ${where}`,
    html: `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#111;">
        <p><strong>${escapeHtml(visitor.name)}</strong> a apăsat „Am terminat” pe linkul de propuneri pentru <strong>${escapeHtml(where)}</strong>.</p>
        <p>Poze propuse: <strong>${proposed}</strong><br>Poze răsfoite: ${seen}</p>
        <p style="margin:18px 0 0;"><a href="https://ancavisuals.ro/media/${encodeURIComponent(link.albumSlug)}#proposal-invites" style="color:#c9a96e;">Vezi propunerile în album →</a></p>
      </div>`,
  };
}

const toIso = (value?: Timestamp | null) => value?.toDate?.().toISOString() ?? null;

export function linkProgressStatus(link: Pick<ProposalLink, "visitors" | "completedAt">): "not_started" | "in_progress" | "completed" {
  if (link.completedAt) return "completed";
  return Object.keys(link.visitors ?? {}).length > 0 ? "in_progress" : "not_started";
}

function serializeLink(link: ProposalLink, photos: { fileName: string; previewUrl: string; proposedBy: string }[] = []) {
  return {
    token: link.token,
    albumSlug: link.albumSlug,
    label: link.label,
    reviewerId: link.reviewerId ?? null,
    active: link.active,
    url: buildProposalLinkUrl(link.token),
    createdAt: toIso(link.createdAt),
    taskId: link.taskId ?? null,
    status: linkProgressStatus(link),
    completedAt: toIso(link.completedAt),
    totalPhotos: link.totalPhotos ?? 0,
    visitors: mergeVisitorsByName(link.visitors ?? {}).map(({ id, ...visitor }) => ({
      id,
      name: visitor.name ?? "",
      viewedCount: visitor.viewedCount ?? 0,
      proposedCount: visitor.proposedCount ?? 0,
      lastSeenAt: toIso(visitor.lastSeenAt),
      completedAt: toIso(visitor.completedAt),
    })),
    photos,
  };
}

const TASK_STATUS_RANK = { todo: 0, doing: 1, done: 2 } as const;

/** Moves the linked task forward (todo → doing → done); never reopens a task. */
async function advanceLinkTask(taskId: string | null | undefined, status: "doing" | "done"): Promise<void> {
  if (!taskId) return;
  try {
    const ref = firestore().collection(TASKS_COLLECTION).doc(taskId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const current = String(snap.data()?.status ?? "todo") as keyof typeof TASK_STATUS_RANK;
    if ((TASK_STATUS_RANK[current] ?? 0) >= TASK_STATUS_RANK[status]) return;
    const now = Timestamp.now();
    await ref.update({ status, updatedAt: now, ...(status === "done" ? { completedAt: now } : {}) });
  } catch (error) {
    console.error("[proposal-links] task sync failed:", error);
  }
}

function cleanVisitorName(name: unknown): string {
  return String(name ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
}

/** The name is the visitor's username on a link (owner, 2026-10-27): „salomeea” = „Salomeea”. */
const nameKey = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Ids already registered under this name on the link, the furthest along first. */
function visitorIdsForName(link: Pick<ProposalLink, "visitors">, name: string): string[] {
  const key = nameKey(name);
  return Object.entries(link.visitors ?? {})
    .filter(([, visitor]) => visitor.name && nameKey(visitor.name) === key)
    .sort(([, a], [, b]) => (b.viewedCount ?? 0) - (a.viewedCount ?? 0))
    .map(([id]) => id);
}

/** Same name on another phone / browser → continue that visitor instead of starting a new one. */
export function resolveVisitorId(link: Pick<ProposalLink, "visitors">, name: string, visitorId: string): string {
  return visitorIdsForName(link, name)[0] ?? visitorId;
}

/** Older duplicates (same name, different ids, before names were usernames) shown as one person. */
function mergeVisitorsByName(visitors: Record<string, VisitorProgress>) {
  const latest = (a?: Timestamp | null, b?: Timestamp | null) =>
    !a ? b : !b ? a : (a.toDate().getTime() >= b.toDate().getTime() ? a : b);
  const byName = new Map<string, { id: string } & VisitorProgress>();
  for (const [id, visitor] of Object.entries(visitors)) {
    const key = nameKey(visitor.name ?? id);
    const current = byName.get(key);
    if (!current) {
      byName.set(key, { id, ...visitor });
      continue;
    }
    const lead = (visitor.viewedCount ?? 0) > (current.viewedCount ?? 0) ? { id, name: visitor.name } : { id: current.id, name: current.name };
    byName.set(key, {
      ...lead,
      viewedCount: Math.max(current.viewedCount ?? 0, visitor.viewedCount ?? 0),
      proposedCount: (current.proposedCount ?? 0) + (visitor.proposedCount ?? 0),
      lastSeenAt: latest(current.lastSeenAt, visitor.lastSeenAt) ?? undefined,
      completedAt: latest(current.completedAt, visitor.completedAt) ?? null,
    });
  }
  return Array.from(byName.values());
}

// ── Admin ────────────────────────────────────────────────────────────────────

// GET /admin?albumSlug= — links generated for an album
router.get("/admin", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const albumSlug = String(req.query.albumSlug ?? "").trim();
  if (!albumSlug) {
    res.status(400).json({ error: "albumSlug este obligatoriu." });
    return;
  }
  try {
    const canonical = await resolveAlbumSlug(albumSlug);
    const db = firestore();
    const [snapshot, proposalsSnap, album] = await Promise.all([
      db.collection(LINKS_COLLECTION).where("albumSlug", "==", canonical).get(),
      db.collection(PROPOSALS_COLLECTION).where("albumSlug", "==", canonical).get(),
      loadAlbum(canonical),
    ]);
    const previewByKey = new Map((album?.photos ?? []).map(url => [mediaKey(fileNameFromUrl(url)), url]));
    const photosByToken = new Map<string, { fileName: string; previewUrl: string; proposedBy: string }[]>();
    for (const doc of proposalsSnap.docs) {
      const data = doc.data();
      const token = typeof data.proposalLinkToken === "string" ? data.proposalLinkToken : "";
      if (!token) continue;
      const fileName = String(data.fileName ?? "");
      const list = photosByToken.get(token) ?? [];
      list.push({ fileName, previewUrl: previewByKey.get(mediaKey(fileName)) ?? String(data.photoUrl ?? ""), proposedBy: String(data.proposedBy ?? "") });
      photosByToken.set(token, list);
    }
    const links = snapshot.docs
      .map(doc => {
        const link = doc.data() as ProposalLink;
        return serializeLink(link, photosByToken.get(link.token) ?? []);
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ links });
  } catch (error) {
    console.error("[proposal-links] GET /admin failed:", error);
    res.status(500).json({ error: "Nu am putut încărca linkurile." });
  }
});

// POST /admin — generate a new unique link for an album
router.post("/admin", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { albumSlug, label, mediaAssetServiceIds, reviewerId } = req.body as {
    albumSlug?: string;
    label?: string;
    mediaAssetServiceIds?: string[];
    reviewerId?: PhotoReviewerId;
  };
  if (reviewerId !== undefined && !isPhotoReviewerId(reviewerId)) {
    res.status(400).json({ error: "Persoană de selecție invalidă." });
    return;
  }
  const requestedSlug = albumSlug?.trim() ?? "";
  if (!requestedSlug) {
    res.status(400).json({ error: "albumSlug este obligatoriu." });
    return;
  }
  try {
    const canonical = await resolveAlbumSlug(requestedSlug);
    const serviceIds = normalizeOfferServiceIds(mediaAssetServiceIds);
    const cleanLabel = cleanVisitorName(label);
    const token = randomBytes(16).toString("base64url");
    const now = Timestamp.now();
    const db = firestore();

    const taskRef = await db.collection(TASKS_COLLECTION).add({
      title: `Alege poze Instagram / Media Assets — ${canonical}${cleanLabel ? ` (${cleanLabel})` : ""}`,
      notes: `Link selecție: https://ancavisuals.ro${buildProposalLinkUrl(token)}\nTask-ul trece automat în lucru când persoana începe și la gata când apasă „Am terminat”. Progresul și pozele alese: /media/${canonical} → Link unic de selecție poze.`,
      clientName: cleanLabel,
      eventId: null,
      status: "todo",
      priority: "normal",
      dueDate: null,
      plannedFor: null,
      source: "proposal_link",
      proposalLinkToken: token,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });

    const link: ProposalLink = {
      token,
      albumSlug: canonical,
      label: cleanLabel,
      ...(reviewerId ? { reviewerId } : {}),
      active: true,
      mediaAssetServiceIds: serviceIds.length > 0 ? serviceIds : ["photo"],
      createdByEmail: authReq.firebaseEmail,
      createdAt: now,
      taskId: taskRef.id,
      visitors: {},
      completedAt: null,
    };
    await db.collection(LINKS_COLLECTION).doc(token).set(link);
    res.status(201).json({ link: serializeLink(link) });
  } catch (error) {
    console.error("[proposal-links] POST /admin failed:", error);
    res.status(500).json({ error: "Nu am putut genera linkul." });
  }
});

// PATCH /admin/:token — activate / deactivate a link
router.patch("/admin/:token", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { token } = req.params;
  const active = req.body?.active === true;
  if (!isSafeToken(token)) {
    res.status(400).json({ error: "Token invalid." });
    return;
  }
  try {
    const ref = firestore().collection(LINKS_COLLECTION).doc(token);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: "Linkul nu există." });
      return;
    }
    await ref.update({ active, updatedAt: Timestamp.now() });
    res.json({ ok: true, active });
  } catch (error) {
    console.error("[proposal-links] PATCH /admin failed:", error);
    res.status(500).json({ error: "Nu am putut actualiza linkul." });
  }
});

// ── Public ───────────────────────────────────────────────────────────────────

// GET /:token — album photos for the link holder
router.get("/:token", async (req: Request, res: Response) => {
  try {
    const link = await readActiveLink(req.params.token);
    if (!link) {
      res.status(404).json({ error: "link_not_found" });
      return;
    }
    const album = await loadAlbum(link.albumSlug);
    if (!album) {
      res.status(404).json({ error: "album_not_found" });
      return;
    }
    const photos = album.photos.map(previewUrl => ({ fileName: fileNameFromUrl(previewUrl), previewUrl }));
    if (link.totalPhotos !== photos.length) {
      firestore().collection(LINKS_COLLECTION).doc(link.token).update({ totalPhotos: photos.length }).catch(() => {});
    }
    res.json({ albumSlug: link.albumSlug, title: album.title, label: link.label, photos });
  } catch (error) {
    console.error("[proposal-links] GET /:token failed:", error);
    res.status(500).json({ error: "Nu am putut încărca albumul." });
  }
});

// GET /:token/proposals?visitorId= — what this visitor already proposed
router.get("/:token/proposals", async (req: Request, res: Response) => {
  const visitorId = String(req.query.visitorId ?? "");
  if (!isSafeVisitorId(visitorId)) {
    res.status(400).json({ error: "visitorId invalid." });
    return;
  }
  try {
    const link = await readActiveLink(req.params.token);
    if (!link) {
      res.status(404).json({ error: "link_not_found" });
      return;
    }
    const name = link.visitors?.[visitorId]?.name;
    const ids = Array.from(new Set([visitorId, ...(name ? visitorIdsForName(link, name) : [])]));
    const snapshots = await Promise.all(ids.map(id => firestore().collection(PROPOSALS_COLLECTION)
      .where("albumSlug", "==", link.albumSlug)
      .where("proposedByUid", "==", `link:${link.token}:${id}`)
      .get()));
    const fileNames = new Set(snapshots.flatMap(snapshot => snapshot.docs.map(doc => mediaKey(String(doc.data().fileName ?? "")))));
    res.json({ fileNames: Array.from(fileNames) });
  } catch (error) {
    console.error("[proposal-links] GET /:token/proposals failed:", error);
    res.status(500).json({ error: "Nu am putut încărca propunerile." });
  }
});

// POST /:token/proposals — propose photos under the visitor's name
router.post("/:token/proposals", async (req: Request, res: Response) => {
  const { name, visitorId, fileNames, destinations } = req.body as {
    name?: string;
    visitorId?: string;
    fileNames?: unknown;
    destinations?: unknown;
  };
  const cleanName = cleanVisitorName(name);
  let cleanVisitorId = String(visitorId ?? "");
  const normalizedDestinations = normalizeDestinations(destinations);
  const requestedKeys = Array.isArray(fileNames)
    ? Array.from(new Set(fileNames.map(value => mediaKey(String(value))))).slice(0, MAX_FILES_PER_SUBMIT)
    : [];

  if (!cleanName) {
    res.status(400).json({ error: "Scrie-ți numele." });
    return;
  }
  if (!isSafeVisitorId(cleanVisitorId)) {
    res.status(400).json({ error: "visitorId invalid." });
    return;
  }
  if (normalizedDestinations.length === 0) {
    res.status(400).json({ error: "Alege Instagram sau Media Assets." });
    return;
  }
  if (requestedKeys.length === 0) {
    res.status(400).json({ error: "Alege cel puțin o poză." });
    return;
  }

  try {
    const link = await readActiveLink(req.params.token);
    if (!link) {
      res.status(404).json({ error: "link_not_found" });
      return;
    }
    const album = await loadAlbum(link.albumSlug);
    if (!album) {
      res.status(404).json({ error: "album_not_found" });
      return;
    }
    cleanVisitorId = resolveVisitorId(link, cleanName, cleanVisitorId);

    // Same photoUrl shape as the logged-in flow: the original when it exists, else the preview.
    const urlByKey = new Map<string, string>();
    for (const url of album.photos) urlByKey.set(mediaKey(fileNameFromUrl(url)), url);
    for (const url of album.originalPhoto) urlByKey.set(mediaKey(fileNameFromUrl(url)), url);

    const proposedByUid = `link:${link.token}:${cleanVisitorId}`;
    const mediaAssetServiceIds = normalizedDestinations.includes("media_assets") ? link.mediaAssetServiceIds : [];
    const db = firestore();
    const existing = await db.collection(PROPOSALS_COLLECTION)
      .where("albumSlug", "==", link.albumSlug)
      .where("proposedByUid", "==", proposedByUid)
      .get();
    const existingByKey = new Map(existing.docs.map(doc => [mediaKey(String(doc.data().fileName ?? "")), doc]));

    const batch = db.batch();
    let added = 0;
    let updated = 0;
    for (const key of requestedKeys) {
      const photoUrl = urlByKey.get(key);
      if (!photoUrl) continue;
      const current = existingByKey.get(key);
      if (current) {
        const data = current.data();
        batch.update(current.ref, {
          proposedBy: cleanName,
          ...(link.reviewerId ? { reviewerId: link.reviewerId } : {}),
          selectionDestinations: Array.from(new Set([...(data.selectionDestinations ?? data.destinations ?? []), ...normalizedDestinations])),
          destinations: Array.from(new Set([...(data.destinations ?? []), ...normalizedDestinations])),
          mediaAssetServiceIds: normalizeOfferServiceIds([...(data.mediaAssetServiceIds ?? []), ...mediaAssetServiceIds]),
          updatedAt: Timestamp.now(),
        });
        updated++;
        continue;
      }
      batch.set(db.collection(PROPOSALS_COLLECTION).doc(), {
        albumSlug: link.albumSlug,
        photoUrl,
        fileName: fileNameFromUrl(photoUrl),
        proposedBy: cleanName,
        proposedByUid,
        proposedVia: "link",
        proposalLinkToken: link.token,
        proposalLinkLabel: link.label,
        ...(link.reviewerId ? { reviewerId: link.reviewerId } : {}),
        proposedAt: Timestamp.now(),
        status: "pending",
        destinations: normalizedDestinations,
        selectionDestinations: normalizedDestinations,
        mediaAssetServiceIds,
      });
      added++;
    }

    if (added + updated === 0) {
      res.status(400).json({ error: "Pozele alese nu mai există în album." });
      return;
    }
    batch.set(db.collection(LINKS_COLLECTION).doc(link.token), {
      visitors: { [cleanVisitorId]: { name: cleanName, proposedCount: FieldValue.increment(added), lastSeenAt: Timestamp.now() } },
    }, { merge: true });
    await batch.commit();
    await advanceLinkTask(link.taskId, "doing");
    res.json({ ok: true, added, updated, visitorId: cleanVisitorId });
  } catch (error) {
    console.error("[proposal-links] POST /:token/proposals failed:", error);
    res.status(500).json({ error: "Nu am putut trimite propunerile." });
  }
});

// POST /:token/visitor — „log in” with a name: an existing visitor with that name continues
// where they left off (their id + how far they got); otherwise the browser's own id is kept.
router.post("/:token/visitor", async (req: Request, res: Response) => {
  const { name, visitorId } = req.body as { name?: string; visitorId?: string };
  const cleanName = cleanVisitorName(name);
  const cleanVisitorId = String(visitorId ?? "");
  if (!cleanName || !isSafeVisitorId(cleanVisitorId)) {
    res.status(400).json({ error: "Date invalide." });
    return;
  }
  try {
    const link = await readActiveLink(req.params.token);
    if (!link) {
      res.status(404).json({ error: "link_not_found" });
      return;
    }
    const [match] = visitorIdsForName(link, cleanName);
    // A new name from a browser whose id already belongs to someone else („Schimbă numele”): new person.
    const resolvedId = match ?? (link.visitors?.[cleanVisitorId]?.name ? randomBytes(12).toString("base64url") : cleanVisitorId);
    const existing = link.visitors?.[resolvedId];
    res.json({ visitorId: resolvedId, name: existing?.name ?? cleanName, viewedCount: existing?.viewedCount ?? 0 });
  } catch (error) {
    console.error("[proposal-links] POST /:token/visitor failed:", error);
    res.status(500).json({ error: "Nu am putut verifica numele." });
  }
});

// POST /:token/progress — the visitor started / scrolled further through the album
router.post("/:token/progress", async (req: Request, res: Response) => {
  const { name, visitorId, viewedCount } = req.body as { name?: string; visitorId?: string; viewedCount?: number };
  const cleanName = cleanVisitorName(name);
  let cleanVisitorId = String(visitorId ?? "");
  if (!cleanName || !isSafeVisitorId(cleanVisitorId)) {
    res.status(400).json({ error: "Date invalide." });
    return;
  }
  try {
    const link = await readActiveLink(req.params.token);
    if (!link) {
      res.status(404).json({ error: "link_not_found" });
      return;
    }
    cleanVisitorId = resolveVisitorId(link, cleanName, cleanVisitorId);
    const previous = link.visitors?.[cleanVisitorId];
    const viewed = Math.max(previous?.viewedCount ?? 0, Math.max(0, Math.floor(Number(viewedCount) || 0)));
    const now = Timestamp.now();
    await firestore().collection(LINKS_COLLECTION).doc(link.token).set({
      visitors: { [cleanVisitorId]: { name: cleanName, viewedCount: viewed, lastSeenAt: now, ...(previous?.startedAt ? {} : { startedAt: now }) } },
    }, { merge: true });
    await advanceLinkTask(link.taskId, "doing");
    res.json({ ok: true, visitorId: cleanVisitorId });
  } catch (error) {
    console.error("[proposal-links] POST /:token/progress failed:", error);
    res.status(500).json({ error: "Nu am putut salva progresul." });
  }
});

// POST /:token/complete — the visitor says they are done choosing
router.post("/:token/complete", async (req: Request, res: Response) => {
  const { name, visitorId } = req.body as { name?: string; visitorId?: string };
  const cleanName = cleanVisitorName(name);
  let cleanVisitorId = String(visitorId ?? "");
  if (!cleanName || !isSafeVisitorId(cleanVisitorId)) {
    res.status(400).json({ error: "Date invalide." });
    return;
  }
  try {
    const link = await readActiveLink(req.params.token);
    if (!link) {
      res.status(404).json({ error: "link_not_found" });
      return;
    }
    cleanVisitorId = resolveVisitorId(link, cleanName, cleanVisitorId);
    const now = Timestamp.now();
    await firestore().collection(LINKS_COLLECTION).doc(link.token).set({
      completedAt: link.completedAt ?? now,
      visitors: { [cleanVisitorId]: { name: cleanName, completedAt: now, lastSeenAt: now } },
    }, { merge: true });
    await advanceLinkTask(link.taskId, "done");
    res.json({ ok: true });
    const visitor = { ...link.visitors?.[cleanVisitorId], name: cleanName };
    const email = buildCompletionEmail(link, visitor);
    sendViaFunnel({ kind: "notification", to: adminUser.email, ...email, source: "proposal-link:complete" })
      .catch(error => console.error("[proposal-links] completion email failed:", error));
  } catch (error) {
    console.error("[proposal-links] POST /:token/complete failed:", error);
    res.status(500).json({ error: "Nu am putut marca selecția ca finalizată." });
  }
});

export default router;
