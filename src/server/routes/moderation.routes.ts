import type { Request, Response } from "express";
import { Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import {
  BUNNY_ACCESS_KEY_HEADER,
  BUNNY_IMAGE_FILE_PATTERN,
  buildBunnyDirectoryUrl,
  getBunnyStorageKey,
} from "../constants/bunny";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import type { AuthenticatedRequest } from "../middleware/requireFirebaseAuth";
import { sendModerationSubmittedEmail, sendModerationResultEmail } from "../notifications/templates/moderationTemplate";
import { adminUser } from "../constants/credentials";
import { deletePhotoCopies, listAlbumPhotoFolders, photoDisplayPath } from "../services/albumPhotoCopies.service";
import { invalidateAlbumCache } from "../services/album.service";

const router = Router();
const storageKey = getBunnyStorageKey();

const isSafeFilename = (name: string) => {
  if (!name) return false;
  if (name.includes("..") || name.includes("/") || name.includes("\\")) return false;
  if (name.length > 180) return false;
  return BUNNY_IMAGE_FILE_PATTERN.test(name);
};

// The gallery displays the lightweight WebP, but moderation refers to the original photo.
// Store the canonical original name for new submissions; old WebP submissions are still
// resolved by albumPhotoCopies.service through their basename.
const canonicalModerationFilename = (name: string) => name.replace(/\.webp$/i, ".jpg");

const isSafeSlug = (slug: string) => /^[a-z0-9][a-z0-9-_]{0,120}$/i.test(slug);

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
  const safePhotos = Array.from(new Set(photos.filter(isSafeFilename).map(canonicalModerationFilename)));
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
      (data.photos as string[]).forEach((photo) => entry.photos.add(canonicalModerationFilename(photo)));
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
        // Each photo from whichever file of it still exists (the WebP preview, else the original
        // .jpg): a proposal for Picture-0001.webp must still show when only photos/Picture-0001.jpg is left.
        const listing = await listAlbumPhotoFolders(slug);
        const photosWithUrls = Array.from(entry.photos).map((filename) => {
          const path = photoDisplayPath(listing, filename);
          return {
            filename,
            signedUrl: path ? signBunnyUrl(`/${slug}/${path.split("/").map(encodeURIComponent).join("/")}`) : "",
            missing: !path,
          };
        });
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

  const safeToDelete = Array.from(new Set((photosToDelete ?? []).filter(isSafeFilename).map(canonicalModerationFilename)));

  try {
    // Every file of each photo: photos_preview (WebP) AND photos (the original) — owner, 2026-10-29.
    const { deleted: successfullyDeleted, failed } = await deletePhotoCopies(albumSlug, safeToDelete);
    if (failed.length > 0) {
      // Nothing is marked reviewed while a photo is still there: the admin can press again.
      res.status(502).json({ error: `Bunny nu a putut șterge: ${failed.join(", ")}. Încearcă din nou.`, deleted: successfullyDeleted.length });
      return;
    }
    if (successfullyDeleted.length > 0) await invalidateAlbumCache(albumSlug);

    const db = firestore();
    const allProposedPhotos = new Set<string>();
    const moderatorEmails = new Set<string>();

    for (const submissionId of submissionIds) {
      const doc = await db.collection("moderationSubmissions").doc(submissionId).get();
      if (doc.exists) {
        const data = doc.data()!;
        (data.photos as string[]).forEach((photo) => allProposedPhotos.add(canonicalModerationFilename(photo)));
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
