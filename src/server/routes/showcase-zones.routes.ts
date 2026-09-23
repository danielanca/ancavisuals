import express, { type Request, type Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { signBunnyUrl } from "../utils/signBunnyUrl";

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

    const proposals = proposalsSnap
      ? proposalsSnap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            photoUrl: refreshBunnyUrl(String(data.photoUrl ?? "")),
            albumSlug: String(data.albumSlug ?? ""),
            fileName: String(data.fileName ?? ""),
          };
        })
      : [];

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
    const toUrls = (list: unknown) =>
      Array.isArray(list)
        ? (list as Array<{ url?: unknown }>).map((p) => refreshBunnyUrl(String(p.url ?? ""))).filter(Boolean)
        : [];
    res.json({
      photos: toUrls(data?.photos),
      desktop: toUrls(data?.desktop),
      mobile: toUrls(data?.mobile),
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
