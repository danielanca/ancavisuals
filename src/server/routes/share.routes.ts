import { Router } from "express";
import {
  adminCoupleKey,
  createShare,
  downloadShareZip,
  forwardShare,
  getShare,
  getSharePreviewImage,
  listCoupleShares,
  requireCoupleKey,
  updateCoupleShare,
  verifyCouple,
} from "../controllers/share.controller";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";

const router = Router();

// Couple's manager — unlocked by the album's secret key (header), never by the plain album link.
router.get("/couple/:slug", requireCoupleKey, verifyCouple);
router.get("/couple/:slug/links", requireCoupleKey, listCoupleShares);
router.patch("/couple/:slug/links/:id", requireCoupleKey, updateCoupleShare);

// Admin: get (or rotate) the couple's secret link for an album.
router.post("/admin/couple-key/:slug", requireFirebaseAuth, requireSupremeAdmin, adminCoupleKey);

router.post("/", createShare);
router.get("/:id/preview.jpg", getSharePreviewImage);
router.get("/:id", getShare);
router.get("/:id/download", downloadShareZip);
router.post("/:id/forward", forwardShare);

export default router;
