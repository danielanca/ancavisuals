import type { Request, Response } from "express";
import { Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import type { AuthenticatedRequest } from "../middleware/requireFirebaseAuth";
import {
  sendInspirationProposalSubmittedEmail,
  sendInspirationProposalReviewEmail,
} from "../notifications/templates/inspirationProposalTemplate";

const router = Router();

const PROPOSALS_COLLECTION = "inspirationProposals";
const INSPIRATION_COLLECTION = "inspirationPhotos";

// POST /propose — collaborator submits 1-6 photos
router.post("/propose", requireFirebaseAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { photos } = req.body as {
    photos: Array<{ url: string; tags: string[]; notes: string }>;
  };

  if (!Array.isArray(photos) || photos.length === 0 || photos.length > 6) {
    res.status(400).json({ error: "Trimite între 1 și 6 poze." });
    return;
  }

  try {
    const db = firestore();
    const batch = db.batch();
    for (const photo of photos) {
      const docRef = db.collection(PROPOSALS_COLLECTION).doc();
      batch.set(docRef, {
        proposedByEmail: authReq.firebaseEmail,
        proposedByUid: authReq.firebaseUid,
        url: photo.url,
        tags: Array.isArray(photo.tags) ? photo.tags : [],
        notes: photo.notes ?? "",
        status: "pending",
        rejectionReason: "",
        proposedAt: Timestamp.now(),
        reviewedAt: null,
      });
    }
    await batch.commit();

    sendInspirationProposalSubmittedEmail({
      proposerEmail: authReq.firebaseEmail,
      photoCount: photos.length,
    }).catch((err) => console.error("[inspiration-proposals] Submitted email failed:", err));

    res.json({ ok: true, submitted: photos.length });
  } catch (error) {
    console.error("[inspiration-proposals] POST /propose failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /my — collaborator sees own proposals (pending + approved + rejected)
router.get("/my", requireFirebaseAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const db = firestore();
    const snapshot = await db
      .collection(PROPOSALS_COLLECTION)
      .where("proposedByUid", "==", authReq.firebaseUid)
      .orderBy("proposedAt", "desc")
      .get();

    const proposals = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        url: data.url as string,
        tags: data.tags as string[],
        notes: data.notes as string,
        status: data.status as string,
        rejectionReason: data.rejectionReason as string,
        proposedAt: (data.proposedAt as Timestamp).toDate().toISOString(),
        reviewedAt: data.reviewedAt ? (data.reviewedAt as Timestamp).toDate().toISOString() : null,
      };
    });

    res.json({ proposals });
  } catch (error) {
    console.error("[inspiration-proposals] GET /my failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /admin/pending-count — for dashboard badge
router.get("/admin/pending-count", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db
      .collection(PROPOSALS_COLLECTION)
      .where("status", "==", "pending")
      .get();
    res.json({ pendingCount: snapshot.size });
  } catch (error) {
    console.error("[inspiration-proposals] GET /admin/pending-count failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /admin/pending — admin sees all pending proposals
router.get("/admin/pending", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db
      .collection(PROPOSALS_COLLECTION)
      .where("status", "==", "pending")
      .orderBy("proposedAt", "asc")
      .get();

    const proposals = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        url: data.url as string,
        tags: data.tags as string[],
        notes: data.notes as string,
        proposedByEmail: data.proposedByEmail as string,
        proposedAt: (data.proposedAt as Timestamp).toDate().toISOString(),
      };
    });

    res.json({ proposals });
  } catch (error) {
    console.error("[inspiration-proposals] GET /admin/pending failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /admin/review/:id — admin approves or rejects a proposal
router.post("/admin/review/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, rejectionReason } = req.body as {
    action: "approve" | "reject";
    rejectionReason?: string;
  };

  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "action must be approve or reject" });
    return;
  }

  try {
    const db = firestore();
    const proposalDoc = await db.collection(PROPOSALS_COLLECTION).doc(id).get();
    if (!proposalDoc.exists) {
      res.status(404).json({ error: "Propunerea nu a fost găsită." });
      return;
    }
    const proposal = proposalDoc.data()!;

    await proposalDoc.ref.update({
      status: action === "approve" ? "approved" : "rejected",
      rejectionReason: rejectionReason ?? "",
      reviewedAt: Timestamp.now(),
    });

    if (action === "approve") {
      await db.collection(INSPIRATION_COLLECTION).add({
        url: proposal.url as string,
        tags: proposal.tags ?? [],
        notes: proposal.notes ?? "",
        uploadedAt: Timestamp.now(),
      });
    }

    sendInspirationProposalReviewEmail({
      to: proposal.proposedByEmail as string,
      action,
      photoUrl: proposal.url as string,
      rejectionReason: rejectionReason ?? "",
    }).catch((err) => console.error("[inspiration-proposals] Review email failed:", err));

    res.json({ ok: true });
  } catch (error) {
    console.error("[inspiration-proposals] POST /admin/review failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
