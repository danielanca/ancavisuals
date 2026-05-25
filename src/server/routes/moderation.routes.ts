import type { Request, Response } from "express";
import { Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import {
  BUNNY_ACCESS_KEY_HEADER,
  BUNNY_PHOTOS_FOLDER,
  BUNNY_PREVIEW_FOLDER,
  BUNNY_IMAGE_FILE_PATTERN,
  buildBunnyStorageUrl,
  buildBunnyDirectoryUrl,
  getBunnyStorageKey,
} from "../constants/bunny";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import type { AuthenticatedRequest } from "../middleware/requireFirebaseAuth";
import { sendModerationSubmittedEmail, sendModerationResultEmail } from "../notifications/templates/moderationTemplate";
import { adminUser } from "../constants/credentials";
import { markCollaboratorInviteCompleted } from "../services/collaboratorInvite.service";

const router = Router();
const storageKey = getBunnyStorageKey();

const isSafeFilename = (name: string) => {
  if (!name) return false;
  if (name.includes("..") || name.includes("/") || name.includes("\\")) return false;
  if (name.length > 180) return false;
  return BUNNY_IMAGE_FILE_PATTERN.test(name);
};

const isSafeSlug = (slug: string) => /^[a-z0-9][a-z0-9-_]{0,120}$/i.test(slug);

async function hasPreviewFolder(slug: string): Promise<boolean> {
  const previewUrl = buildBunnyDirectoryUrl(slug, BUNNY_PREVIEW_FOLDER);
  const response = await fetch(previewUrl, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });
  if (!response.ok) return false;
  const data = await response.json() as unknown[];
  return Array.isArray(data) && data.length > 0;
}

// GET /api/moderare/albums — list all Bunny folders (albums) for moderator panel
router.get("/albums", requireFirebaseAuth, async (_req: Request, res: Response) => {
  try {
    const rootUrl = buildBunnyDirectoryUrl();
    const response = await fetch(rootUrl, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });
    if (!response.ok) {
      res.status(500).json({ error: "Nu s-au putut lista albumele Bunny" });
      return;
    }
    const data = await response.json() as { IsDirectory: boolean; ObjectName: string }[];
    const folders = (Array.isArray(data) ? data : [])
      .filter((item) => item.IsDirectory && !item.ObjectName.startsWith("."))
      .map((item) => item.ObjectName)
      .sort((a, b) => b.localeCompare(a));
    res.json({ albums: folders });
  } catch (error) {
    console.error("[moderare] GET /albums failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/moderare/submit — moderator proposes filenames for deletion
router.post("/submit", requireFirebaseAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { albumSlug, photos, note } = req.body as {
    albumSlug: string;
    photos: string[];
    note?: string;
  };

  if (!albumSlug || !isSafeSlug(albumSlug)) {
    res.status(400).json({ error: "invalid_slug" });
    return;
  }
  if (!Array.isArray(photos) || photos.length === 0) {
    res.status(400).json({ error: "no_photos" });
    return;
  }
  const safePhotos = photos.filter(isSafeFilename);
  if (safePhotos.length === 0) {
    res.status(400).json({ error: "no_valid_photos" });
    return;
  }

  try {
    const db = firestore();
    await db.collection("moderationSubmissions").add({
      albumSlug,
      moderatorEmail: authReq.firebaseEmail,
      moderatorUid: authReq.firebaseUid,
      photos: safePhotos,
      status: "pending",
      createdAt: Timestamp.now(),
      note: note ?? "",
    });

    await markCollaboratorInviteCompleted({
      email: authReq.firebaseEmail,
      albumSlug,
      actionType: "moderation",
    });

    sendModerationSubmittedEmail({
      moderatorEmail: authReq.firebaseEmail,
      albumSlug,
      photoCount: safePhotos.length,
      note: note ?? "",
    }).catch((err) => console.error("[moderare] Email to admin failed:", err));

    res.json({ ok: true, submitted: safePhotos.length });
  } catch (error) {
    console.error("[moderare] POST /submit failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/moderare/pending — admin gets pending count (for dashboard badge)
router.get("/pending-count", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    // NOTE: Firestore requires a composite index on (status ASC, createdAt ASC)
    // for this query. Create it at: Firebase Console > Firestore > Indexes
    const snapshot = await db
      .collection("moderationSubmissions")
      .where("status", "==", "pending")
      .get();
    const albumSlugs = new Set(snapshot.docs.map((doc) => doc.data().albumSlug as string));
    res.json({ pendingCount: albumSlugs.size });
  } catch (error) {
    console.error("[moderare] GET /pending-count failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/moderare/pending — admin gets all pending submissions merged by album
router.get("/pending", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db
      .collection("moderationSubmissions")
      .where("status", "==", "pending")
      .get();

    const albumMap = new Map<
      string,
      {
        submissionIds: string[];
        photos: Set<string>;
        moderatorEmails: Set<string>;
        latestCreatedAt: string;
      }
    >();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const slug = data.albumSlug as string;
      if (!albumMap.has(slug)) {
        albumMap.set(slug, {
          submissionIds: [],
          photos: new Set(),
          moderatorEmails: new Set(),
          latestCreatedAt: "",
        });
      }
      const entry = albumMap.get(slug)!;
      entry.submissionIds.push(doc.id);
      (data.photos as string[]).forEach((photo) => entry.photos.add(photo));
      entry.moderatorEmails.add(data.moderatorEmail as string);
      const createdAt =
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : String(data.createdAt);
      if (!entry.latestCreatedAt || createdAt > entry.latestCreatedAt) {
        entry.latestCreatedAt = createdAt;
      }
    });

    const albums = await Promise.all(
      Array.from(albumMap.entries()).map(async ([slug, entry]) => {
        const folder = (await hasPreviewFolder(slug)) ? BUNNY_PREVIEW_FOLDER : BUNNY_PHOTOS_FOLDER;
        const photosWithUrls = Array.from(entry.photos).map((filename) => ({
          filename,
          signedUrl: signBunnyUrl(`/${slug}/${folder}/${encodeURIComponent(filename)}`),
        }));
        return {
          albumSlug: slug,
          submissionIds: entry.submissionIds,
          moderatorEmails: Array.from(entry.moderatorEmails),
          latestCreatedAt: entry.latestCreatedAt,
          photos: photosWithUrls,
        };
      }),
    );

    albums.sort((a, b) => a.latestCreatedAt.localeCompare(b.latestCreatedAt));

    res.json({ albums });
  } catch (error) {
    console.error("[moderare] GET /pending failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/moderare/review — admin deletes selected photos and marks submissions reviewed
router.post("/review", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { albumSlug, submissionIds, photosToDelete } = req.body as {
    albumSlug: string;
    submissionIds: string[];
    photosToDelete: string[];
  };

  if (!albumSlug || !isSafeSlug(albumSlug)) {
    res.status(400).json({ error: "invalid_slug" });
    return;
  }
  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    res.status(400).json({ error: "no_submission_ids" });
    return;
  }

  const safeToDelete = (photosToDelete ?? []).filter(isSafeFilename);

  try {
    const folder = (await hasPreviewFolder(albumSlug)) ? BUNNY_PREVIEW_FOLDER : BUNNY_PHOTOS_FOLDER;

    const successfullyDeleted: string[] = [];
    for (const filename of safeToDelete) {
      const deleteUrl = buildBunnyStorageUrl(albumSlug, folder, encodeURIComponent(filename));
      const deleteResponse = await fetch(deleteUrl, {
        method: "DELETE",
        headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey },
      });
      if (deleteResponse.ok) {
        successfullyDeleted.push(filename);
      } else {
        console.error(`[moderare] Bunny delete failed for ${filename}: ${deleteResponse.status}`);
      }
    }

    const db = firestore();
    const allProposedPhotos = new Set<string>();
    const moderatorEmails = new Set<string>();

    for (const submissionId of submissionIds) {
      const doc = await db.collection("moderationSubmissions").doc(submissionId).get();
      if (doc.exists) {
        const data = doc.data()!;
        (data.photos as string[]).forEach((photo) => allProposedPhotos.add(photo));
        moderatorEmails.add(data.moderatorEmail as string);
      }
    }

    const keptPhotos = Array.from(allProposedPhotos).filter(
      (photo) => !successfullyDeleted.includes(photo),
    );

    const batch = db.batch();
    for (const submissionId of submissionIds) {
      batch.update(db.collection("moderationSubmissions").doc(submissionId), {
        status: "reviewed",
        reviewedAt: Timestamp.now(),
        deletedPhotos: successfullyDeleted,
        keptPhotos,
      });
    }
    await batch.commit();

    const allRecipients = new Set([...moderatorEmails, adminUser.email]);
    for (const email of allRecipients) {
      sendModerationResultEmail({
        to: email,
        albumSlug,
        deletedPhotos: successfullyDeleted,
        keptPhotos,
      }).catch((err) => console.error("[moderare] Result email failed:", err));
    }

    res.json({ ok: true, deleted: successfullyDeleted.length, kept: keptPhotos.length });
  } catch (error) {
    console.error("[moderare] POST /review failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
