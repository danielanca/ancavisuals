import type { Request, Response } from "express";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { firestore } from "../firestore";
import { FIREBASE_STORAGE_BUCKET } from "../constants/firebase";
import { generateHandoverPDF, buildHandoverHTML } from "../services/pdf.generator";
import { sendHandoverLinkEmail, sendSignedHandoverEmail, sendHandoverReminderEmail } from "../notifications/templates/handoverEmail";
import { getClientIp, fetchIpInfo } from "../utils/ipinfo";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { APP_BASE_URL } from "../constants/domain";

const router = Router();

const DEFAULT_COURIER_DELIVERY_DAYS = 7;
const DEFAULT_MATERIALS_REPORT_WINDOW_DAYS = 7;
const DEFAULT_DIGITAL_LINK_EXPIRY_DAYS = 30;

function tsToISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

// POST /api/handover — create new handover protocol (admin)
router.post("/", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const body = req.body;

    if (!body.eventType || !body.eventDate || !body.clientEmail) {
      return res.status(400).json({ error: "Câmpuri obligatorii: eventType, eventDate, clientEmail" });
    }

    const handover = {
      token: uuidv4(),
      status: "draft" as const,
      createdAt: Timestamp.now(),

      eventId: body.eventId ?? null,
      eventType: body.eventType,
      eventDate: body.eventDate,

      clientEmail: body.clientEmail,
      clientName: body.clientName?.trim() ?? "",

      digitalLinkUrl: body.digitalLinkUrl?.trim() ?? "",
      courierDeliveryDays: Number(body.courierDeliveryDays) || DEFAULT_COURIER_DELIVERY_DAYS,
      materialsReportWindowDays: Number(body.materialsReportWindowDays) || DEFAULT_MATERIALS_REPORT_WINDOW_DAYS,
      digitalLinkExpiryDays: Number(body.digitalLinkExpiryDays) || DEFAULT_DIGITAL_LINK_EXPIRY_DAYS,
    };

    const docRef = await db.collection("materialsHandover").add(handover);

    if (body.eventId) {
      await db.collection("adminEvents").doc(body.eventId).update({ handoverId: docRef.id })
        .catch(() => {}); // don't block if the event doesn't exist
    }

    res.status(201).json({ id: docRef.id, token: handover.token });
  } catch (error) {
    console.error("[handover] POST / failed:", error);
    res.status(500).json({ error: "Nu s-a putut crea procesul verbal." });
  }
});

// GET /api/handover — list (admin)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db.collection("materialsHandover").orderBy("createdAt", "desc").get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: tsToISO(data.createdAt),
        signedAt: tsToISO(data.signedAt),
        sentAt: tsToISO(data.sentAt),
      };
    });

    res.json({ items });
  } catch (error) {
    console.error("[handover] GET / failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca procesele verbale." });
  }
});

// NOTE: /sign/:token routes must come BEFORE /:id to avoid route collision

// GET /api/handover/sign/:token/pdf — PDF preview
router.get("/sign/:token/pdf", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { token } = req.params;
    const snapshot = await db.collection("materialsHandover").where("token", "==", token).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: "Proces verbal negăsit." });
    const data = snapshot.docs[0].data();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientSignatureBase64, clientIp, pdfUrl, ...publicData } = data;
    const pdfBuffer = await generateHandoverPDF({ ...publicData, createdAt: tsToISO(data.createdAt) });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="proces-verbal-preview.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[handover] GET /sign/:token/pdf failed:", error);
    res.status(500).json({ error: "Eroare la generarea PDF-ului." });
  }
});

// GET /api/handover/sign/:token/html — HTML preview
router.get("/sign/:token/html", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { token } = req.params;
    const snapshot = await db.collection("materialsHandover").where("token", "==", token).limit(1).get();
    if (snapshot.empty) return res.status(404).send("<p>Proces verbal negăsit.</p>");
    const data = snapshot.docs[0].data();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientSignatureBase64, clientIp, pdfUrl, ...publicData } = data;
    const html = buildHandoverHTML({ ...publicData, createdAt: tsToISO(data.createdAt) });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("[handover] GET /sign/:token/html failed:", error);
    res.status(500).send("<p>Eroare server.</p>");
  }
});

// GET /api/handover/sign/:token — public data (no auth)
router.get("/sign/:token", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { token } = req.params;

    const snapshot = await db.collection("materialsHandover").where("token", "==", token).limit(1).get();
    if (snapshot.empty) {
      return res.status(404).json({ error: "Proces verbal negăsit." });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

    if (data.status === "signed") {
      return res.status(410).json({ error: "Procesul verbal a fost deja semnat.", status: "signed", pdfUrl: data.pdfUrl ?? null });
    }
    if (data.status === "expired") {
      return res.status(410).json({ error: "Link-ul a expirat.", status: "expired" });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientSignatureBase64, clientIp, pdfUrl, ...publicData } = data;

    res.json({
      id: doc.id,
      ...publicData,
      createdAt: tsToISO(data.createdAt),
    });
  } catch (error) {
    console.error("[handover] GET /sign/:token failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/handover/sign/:token — submit client signature
router.post("/sign/:token", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { token } = req.params;
    const { clientName, digitalLinkReceived, termsAcknowledged, clientSignatureBase64 } = req.body;

    if (!clientName?.trim()) {
      return res.status(400).json({ error: "Numele complet este obligatoriu." });
    }
    if (digitalLinkReceived !== true) {
      return res.status(400).json({ error: "Trebuie să confirmați că ați primit link-ul digital." });
    }
    if (termsAcknowledged !== true) {
      return res.status(400).json({ error: "Trebuie să confirmați că ați înțeles termenele de livrare." });
    }
    if (!clientSignatureBase64 || !clientSignatureBase64.startsWith("data:image/")) {
      return res.status(400).json({ error: "Semnătura este obligatorie." });
    }

    const snapshot = await db.collection("materialsHandover").where("token", "==", token).limit(1).get();
    if (snapshot.empty) {
      return res.status(404).json({ error: "Proces verbal negăsit." });
    }

    const doc = snapshot.docs[0];
    const handover = doc.data();

    if (handover.status === "signed") {
      return res.status(410).json({ error: "Procesul verbal a fost deja semnat.", status: "signed" });
    }
    if (handover.status === "expired") {
      return res.status(410).json({ error: "Link-ul a expirat.", status: "expired" });
    }

    const clientIp = getClientIp(req) ?? "unknown";
    const clientUserAgent = req.headers["user-agent"] ?? "";
    const ipInfo = await fetchIpInfo(clientIp).catch(() => null);
    const signedAt = Timestamp.now();

    await db.collection("materialsHandover").doc(doc.id).update({
      status: "signed",
      signedAt,
      clientName: clientName.trim(),
      digitalLinkReceived: true,
      termsAcknowledged: true,
      clientSignatureBase64,
      clientIp,
      clientUserAgent,
      clientGeo: {
        city: ipInfo?.city ?? "",
        region: ipInfo?.region ?? "",
        country: ipInfo?.country ?? "",
        org: ipInfo?.org ?? "",
      },
    });

    const fullHandover = {
      ...handover,
      id: doc.id,
      clientName: clientName.trim(),
      clientSignatureBase64,
      clientIp,
      clientUserAgent,
      signedAt: signedAt.toDate().toISOString(),
    };

    generateAndSendPDF(fullHandover).catch((err) => {
      console.error("[handover] PDF generation/email failed:", err);
    });

    res.json({ ok: true, message: "Procesul verbal a fost semnat cu succes!" });
  } catch (error) {
    console.error("[handover] POST /sign/:token failed:", error);
    res.status(500).json({ error: "Eroare server la semnare." });
  }
});

// POST /api/handover/:id/send — send signing link to client (admin)
router.post("/:id/send", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("materialsHandover").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Proces verbal negăsit." });

    const handover = doc.data()!;
    if (handover.status === "signed") {
      return res.status(400).json({ error: "Procesul verbal a fost deja semnat." });
    }

    await db.collection("materialsHandover").doc(req.params.id).update({ status: "sent", sentAt: Timestamp.now() });

    await sendHandoverLinkEmail({
      to: handover.clientEmail,
      token: handover.token,
      eventType: handover.eventType,
      eventDate: handover.eventDate,
      baseUrl: APP_BASE_URL,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[handover] POST /:id/send failed:", error);
    res.status(500).json({ error: "Nu s-a putut trimite emailul." });
  }
});

// POST /api/handover/:id/resend — resend signed PDF to both admin and client
router.post("/:id/resend", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("materialsHandover").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Proces verbal negăsit." });

    const handover = { id: doc.id, ...doc.data() } as Record<string, unknown>;

    if (handover.status !== "signed") {
      return res.status(400).json({ error: "Procesul verbal nu este semnat." });
    }

    generateAndSendPDF(handover).catch((err) => {
      console.error("[handover] resend PDF/email failed:", err);
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[handover] POST /:id/resend failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/handover/:id/reminder — remind client to sign (admin)
router.post("/:id/reminder", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("materialsHandover").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Proces verbal negăsit." });

    const handover = doc.data()!;
    if (handover.status !== "sent") {
      return res.status(400).json({ error: "Reminder-ul se poate trimite doar pentru procese verbale netrimise spre semnare (status: trimis)." });
    }

    await sendHandoverReminderEmail({
      to: handover.clientEmail,
      token: handover.token,
      eventType: handover.eventType,
      eventDate: handover.eventDate,
      baseUrl: APP_BASE_URL,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[handover] POST /:id/reminder failed:", error);
    res.status(500).json({ error: "Nu s-a putut trimite reminder-ul." });
  }
});

// GET /api/handover/:id — details (admin)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("materialsHandover").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Proces verbal negăsit." });

    const data = doc.data()!;
    res.json({
      id: doc.id,
      ...data,
      createdAt: tsToISO(data.createdAt),
      signedAt: tsToISO(data.signedAt),
      sentAt: tsToISO(data.sentAt),
    });
  } catch (error) {
    console.error("[handover] GET /:id failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// GET /api/handover/:id/preview — PDF preview (admin)
router.get("/:id/preview", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("materialsHandover").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Proces verbal negăsit." });
    const data = doc.data()!;
    const pdfBuffer = await generateHandoverPDF({ ...data, id: doc.id, createdAt: tsToISO(data.createdAt) });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="preview-proces-verbal.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[handover] GET /:id/preview failed:", error);
    res.status(500).json({ error: "Eroare la generarea previzualizării." });
  }
});

// DELETE /api/handover/:id — delete (admin)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("materialsHandover").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Proces verbal negăsit." });

    await db.collection("materialsHandover").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[handover] DELETE /:id failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

function buildPdfFilename(handover: Record<string, unknown>): string {
  const date = new Date(handover.eventDate as string);
  const formatted = isNaN(date.getTime())
    ? "data_necunoscuta"
    : date.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" }).replace(/\s/g, "_");
  const type = String(handover.eventType ?? "proces_verbal").replace(/\s+/g, "_");
  const id = String(handover.id ?? uuidv4()).slice(0, 8);
  return `handover/${type}_${formatted}_${id}.pdf`;
}

async function uploadPdfToStorage(pdfBuffer: Buffer, filename: string): Promise<string> {
  const bucket = getStorage().bucket(FIREBASE_STORAGE_BUCKET);
  const file = bucket.file(filename);
  await file.save(pdfBuffer, { contentType: "application/pdf", resumable: false });
  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: "01-01-2099",
  });
  return signedUrl;
}

async function generateAndSendPDF(handover: Record<string, unknown>): Promise<void> {
  const db = firestore();
  let pdfUrl: string | null = null;

  try {
    const pdfBuffer = await generateHandoverPDF(handover);
    const filename = buildPdfFilename(handover);
    pdfUrl = await uploadPdfToStorage(pdfBuffer, filename);
    if (handover.id) {
      await db.collection("materialsHandover").doc(handover.id as string).update({ pdfUrl });
    }
  } catch (pdfError) {
    console.error("[handover] PDF generation/upload failed, sending email without PDF link:", pdfError);
  }

  const fallbackUrl = `${APP_BASE_URL}/proces-verbal/${String(handover.token ?? "")}`;

  await sendSignedHandoverEmail({
    to: handover.clientEmail as string,
    eventType: handover.eventType as string,
    eventDate: handover.eventDate as string,
    clientName: handover.clientName as string,
    pdfUrl: pdfUrl ?? fallbackUrl,
    hasPdf: pdfUrl !== null,
  });
}

export default router;
