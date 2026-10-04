import express, { type Request, type Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { isKnownMissing, remoteFileSizes } from "../utils/remoteFileSize";
import { MAX_PHOTO_BYTES } from "../../shared/media/photoWeight";

const router = express.Router();
const COLLECTION = "showcase_zones";

// Stored URLs may carry a Bunny token that's since expired (tokens last 1h) —
// re-sign the path fresh on every read instead of trusting the stored token.
function refreshBunnyUrl(url: string): string {
  const cdnBase = process.env.BUNNY_CDN_DOMAIN ?? "";
  if (!url || !cdnBase || !url.startsWith(cdnBase)) return url;
  try {
    const { pathname } = new URL(url);
    return signBunnyUrl(pathname);
  } catch {
    return url;
  }
}

// A photo picked from an album may be the full-resolution original (/<album>/photos/X.jpg,
// often 2–4 MB). Every album also has its optimized copy at /<album>/photos_preview/X.webp.
const ALBUM_ORIGINAL = /^\/([^/]+)\/photos\/([^/]+)\.(?:jpe?g|png|webp)$/i;
// Zones can hold videos too (homepage_videos) — those are always large and stay.
const VIDEO_FILE = /\.(?:mp4|mov|webm|m4v)$/i;

/**
 * Swaps album originals for their optimized copy and drops photos still over
 * MAX_PHOTO_BYTES — for the admin they stay, listed in `heavy` (URL → bytes) to flag them.
 */
async function lightPhotoUrls(storedUrls: string[], keepHeavy: boolean): Promise<{ urls: string[]; heavy: Record<string, number> }> {
  const cdnBase = process.env.BUNNY_CDN_DOMAIN ?? "";
  // Sizes are looked up on the token-less URL: tokens change on every read, the file doesn't.
  const plain = (url: string) => {
    try { return cdnBase && url.startsWith(cdnBase) ? cdnBase + new URL(url).pathname : url; } catch { return url; }
  };
  const previewOf = (url: string) => {
    try {
      const match = cdnBase && url.startsWith(cdnBase) ? ALBUM_ORIGINAL.exec(new URL(url).pathname) : null;
      return match ? `${cdnBase}/${match[1]}/photos_preview/${match[2]}.webp` : null;
    } catch { return null; }
  };
  const previews = storedUrls.map(previewOf);
  const sizes = await remoteFileSizes(
    [...storedUrls.map(plain).filter((url) => !VIDEO_FILE.test(url)), ...previews.filter((url): url is string => Boolean(url))],
    800,
  );
  const heavy: Record<string, number> = {};
  const urls = storedUrls.flatMap((url, i) => {
    const preview = previews[i];
    // The album preview wins unless it is known to be missing: a size still loading (cold
    // cache) must not fall back to the multi-MB original — its size is unknown too, so the
    // weight filter would let it through.
    const source = preview && !isKnownMissing(preview) ? preview : url;
    const size = sizes.get(plain(source));
    const signed = refreshBunnyUrl(source);
    if (!VIDEO_FILE.test(plain(source)) && size !== undefined && size > MAX_PHOTO_BYTES) {
      if (!keepHeavy) return [];
      heavy[signed] = size;
    }
    return [signed];
  });
  return { urls, heavy };
}

router.get("/:id/sources", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    // Proposals are photo-only, so a zone curating videos (e.g. homepage_videos)
    // has no use for them — skip that query entirely in that case.
    const kindFilter = req.query.kind === "video" ? "video" : req.query.kind === "image" ? "image" : null;

    const [proposalsSnap, assetsSnap] = await Promise.all([
      kindFilter === "video"
        ? Promise.resolve(null)
        : db.collection("instagramProposals").where("status", "==", "accepted").get(),
      db.collection("offer_media_assets").get(),
    ]);

    // Accepted proposals point at the album original (2–4 MB): offer its optimized copy to
    // pick instead, so new picks are light from the start.
    const proposalDocs = proposalsSnap?.docs ?? [];
    const { urls: proposalUrls } = await lightPhotoUrls(proposalDocs.map((doc) => String(doc.data().photoUrl ?? "")), true);
    const proposals = proposalDocs.map((doc, i) => {
      const data = doc.data();
      return {
        id: doc.id,
        photoUrl: proposalUrls[i] ?? refreshBunnyUrl(String(data.photoUrl ?? "")),
        albumSlug: String(data.albumSlug ?? ""),
        fileName: String(data.fileName ?? ""),
      };
    });

    const assets = assetsSnap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          url: refreshBunnyUrl(String(data.url ?? "")),
          label: String(data.label ?? ""),
          serviceId: String(data.serviceId ?? ""),
          kind: data.kind === "video" ? "video" as const : "image" as const,
        };
      })
      .filter((asset) => !kindFilter || asset.kind === kindFilter);

    res.json({ proposals, assets });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const db = firestore();
    const doc = await db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) {
      res.json({ photos: [], desktop: [], mobile: [] });
      return;
    }
    const data = doc.data();
    const isAdmin = String(req.headers.cookie ?? "").includes("av_admin=1");
    const toUrls = (list: unknown) =>
      lightPhotoUrls(
        Array.isArray(list) ? (list as Array<{ url?: unknown }>).map((p) => String(p.url ?? "")).filter(Boolean) : [],
        isAdmin,
      );
    const [photos, desktop, mobile] = await Promise.all([toUrls(data?.photos), toUrls(data?.desktop), toUrls(data?.mobile)]);
    res.json({
      photos: photos.urls,
      desktop: desktop.urls,
      mobile: mobile.urls,
      // Admin only: photos over the limit, to flag on the page.
      ...(isAdmin ? { heavy: { ...photos.heavy, ...desktop.heavy, ...mobile.heavy } } : {}),
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  console.log(`[showcase] PUT /${id} — body keys:`, Object.keys(req.body ?? {}));
  const { label, photos, desktop, mobile } = req.body as {
    label?: string;
    photos?: Array<{ url: string; sourceType: "proposal" | "media_asset" | "manual"; sourceId?: string }>;
    desktop?: Array<{ url: string; sourceType: "proposal" | "media_asset" | "manual"; sourceId?: string }>;
    mobile?: Array<{ url: string; sourceType: "proposal" | "media_asset" | "manual"; sourceId?: string }>;
  };

  const hasSingleList = Array.isArray(photos);
  const hasDeviceLists = Array.isArray(desktop) && Array.isArray(mobile);
  if (!hasSingleList && !hasDeviceLists) {
    res.status(400).json({ error: "photos sau (desktop + mobile) sunt obligatorii." });
    return;
  }

  try {
    const db = firestore();
    const docRef = db.collection(COLLECTION).doc(id);
    const update: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (hasSingleList) update.photos = photos;
    if (hasDeviceLists) {
      update.desktop = desktop;
      update.mobile = mobile;
    }
    if (label !== undefined) update.label = label;
    await docRef.set(update, { merge: true });
    console.log(`[showcase] salvat zona "${id}" —`, hasSingleList ? `${photos!.length} poze` : `desktop:${desktop!.length} mobil:${mobile!.length}`);
    res.json({ ok: true });
  } catch (error) {
    console.error("[showcase] eroare Firestore:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
