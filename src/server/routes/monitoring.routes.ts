import { Router, type Request, type Response } from "express";
import { captureClientError, ERRORS_COLLECTION } from "../monitoring/serverMonitor";
import { firestore } from "../firestore";
import { Timestamp } from "firebase-admin/firestore";
import { getClientIp, fetchIpInfo } from "../utils/ipinfo";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";

const router = Router();

const EXTENSION_PATTERNS = [
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "safari-web-extension://",
  "Extension context invalidated",
];

function isExtensionError(message: string, stack: string): boolean {
  const combined = `${message} ${stack}`;
  return EXTENSION_PATTERNS.some((pattern) => combined.includes(pattern));
}

// Public — trimis din browser
router.post("/client-error", async (req: Request, res: Response) => {
  try {
    const { message, stack = "", page = "" } = req.body as {
      message: string;
      stack: string;
      page: string;
    };

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }

    if (isExtensionError(message, stack)) {
      res.json({ ok: true, ignored: true });
      return;
    }

    const ip = getClientIp(req);
    const geoData = await fetchIpInfo(ip).catch(() => null);
    const geo = geoData
      ? { city: geoData.city, region: geoData.region, country: geoData.country }
      : undefined;

    captureClientError(message, stack, page, ip || undefined, geo);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "failed" });
  }
});

// Admin — listează erori
router.get("/errors", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore()
      .collection(ERRORS_COLLECTION)
      .orderBy("capturedAt", "desc")
      .limit(200)
      .get();

    const errors = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        message: data.message,
        stack: data.stack,
        source: data.source,
        severity: data.severity,
        page: data.page,
        seen: data.seen,
        ip: data.ip ?? null,
        geo: data.geo ?? null,
        capturedAt: (data.capturedAt as Timestamp)?.toDate().toISOString() ?? null,
      };
    });

    res.json({ errors });
  } catch (error) {
    res.status(500).json({ error: "failed_to_fetch" });
  }
});

// Admin — număr erori nevăzute (pentru badge)
router.get("/errors/unseen-count", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore()
      .collection(ERRORS_COLLECTION)
      .where("seen", "==", false)
      .count()
      .get();

    res.json({ count: snapshot.data().count });
  } catch {
    res.status(500).json({ error: "failed" });
  }
});

// Admin — marchează toate ca văzute
router.patch("/errors/mark-seen", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore()
      .collection(ERRORS_COLLECTION)
      .where("seen", "==", false)
      .get();

    if (snapshot.empty) {
      res.json({ updated: 0 });
      return;
    }

    const batch = firestore().batch();
    snapshot.docs.forEach((doc) => batch.update(doc.ref, { seen: true }));
    await batch.commit();

    res.json({ updated: snapshot.size });
  } catch {
    res.status(500).json({ error: "failed" });
  }
});

export default router;
