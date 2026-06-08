import type { Request, Response } from "express";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { firestore } from "../firestore";
import { FIREBASE_STORAGE_BUCKET } from "../constants/firebase";
import { generateContractPDF, buildContractHTML } from "../services/pdf.generator";
import { generateInvoicePDF, generateInvoiceXML } from "../services/invoice.generator";
import type { InvoiceData } from "../services/invoice.generator";
import { sendContractLinkEmail, sendSignedContractEmail, sendContractDeletedEmail, sendContractReminderEmail } from "../notifications/templates/contractEmail";
import { getClientIp, fetchIpInfo } from "../utils/ipinfo";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { expandEventDates } from "../utils/expandEventDates";
import { APP_BASE_URL } from "../constants/domain";

const router = Router();
const BOOKED_EVENT_STATUSES = new Set(["confirmat", "finalizat"]);

function tsToISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

type AdminEventType = "Nuntă" | "Botez" | "Logodnă" | "Aniversare" | "Altele";

const DIRECT_ADMIN_EVENT_TYPES = new Set<AdminEventType>(["Nuntă", "Botez", "Logodnă", "Aniversare"]);

function mapContractEventType(rawType: unknown): { type: AdminEventType; typeLabel?: string } {
  const normalized = String(rawType ?? "").trim();
  if (DIRECT_ADMIN_EVENT_TYPES.has(normalized as AdminEventType)) {
    return { type: normalized as AdminEventType };
  }
  return {
    type: "Altele",
    ...(normalized ? { typeLabel: normalized } : {}),
  };
}

async function getAdminBankDetails() {
  const settingsDoc = await firestore().collection("settings").doc("admin").get();
  const bankDetails = settingsDoc.data()?.bankDetails as Record<string, unknown> | undefined;
  return {
    bankBeneficiaryName: String(bankDetails?.beneficiaryName ?? "").trim(),
    bankIban: String(bankDetails?.iban ?? "").trim(),
  };
}

// POST /api/contracts — create new contract (admin)
router.post("/", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const body = req.body;

    if (!body.eventType || !body.eventDate || !body.clientEmail) {
      return res.status(400).json({ error: "Câmpuri obligatorii: eventType, eventDate, clientEmail" });
    }

    const priceTotal = Number(body.priceTotal) || 0;
    const priceAdvance = Number(body.priceAdvance) || 0;

    const contract = {
      token: uuidv4(),
      status: "draft" as const,
      createdAt: Timestamp.now(),

      eventType: body.eventType,
      eventDate: body.eventDate,
      eventLocation: body.eventLocation ?? "",
      eventStartTime: body.eventStartTime ?? "",
      eventEndTime: body.eventEndTime ?? "",
      eventDetails: body.eventDetails ?? "",

      packageName: body.packageName ?? "",
      packageServices: body.packageServices ?? "",
      services: Array.isArray(body.services) ? body.services : [],
      currency: body.currency ?? "RON",
      priceTotal,
      priceAdvance,
      advancePaidAt: body.advancePaidAt ?? "",
      priceRest: body.priceRest !== undefined ? Number(body.priceRest) : priceTotal - priceAdvance,
      restPaidAt: body.restPaidAt ?? "",
      paymentMethod: body.paymentMethod ?? "Transfer bancar",

      clauses: Array.isArray(body.clauses) ? body.clauses : [],
      privateClient: body.privateClient === true,
      transportKm: body.transportKm ?? "",
      transportFuelPrice: body.transportFuelPrice ?? "10",

      clientEmail: body.clientEmail,
      clientName: body.clientName?.trim() ?? "",
      clientPhone: body.clientPhone?.trim() ?? "",
      clientAddress: body.clientAddress?.trim() ?? "",
      clientIdSeries: body.clientIdSeries?.trim() ?? "",
    };

    const docRef = await db.collection("contracts").add({
      ...contract,
      eventId: body.eventId ?? null,
    });

    // Link event to contract if eventId is provided
    if (body.eventId) {
      await db.collection("adminEvents").doc(body.eventId).update({ contractId: docRef.id })
        .catch(() => {}); // don't block if the event doesn't exist
    }

    res.status(201).json({ id: docRef.id, token: contract.token });
  } catch (error) {
    console.error("[contracts] POST / failed:", error);
    res.status(500).json({ error: "Nu s-a putut crea contractul." });
  }
});

// GET /api/contracts — contract list (admin)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db.collection("contracts").orderBy("createdAt", "desc").get();

    const contracts = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: tsToISO(data.createdAt),
        signedAt: tsToISO(data.signedAt),
        sentAt: tsToISO(data.sentAt),
      };
    });

    res.json({ contracts });
  } catch (error) {
    console.error("[contracts] GET / failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca contractele." });
  }
});

// NOTE: /sign/:token routes must come BEFORE /:id to avoid route collision

// GET /api/contracts/sign/:token/pdf — PDF contract for public preview
// Optional query params: clientName, clientAddress, clientPhone, clientIdSeries
router.get("/sign/:token/pdf", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { token } = req.params;
    const snapshot = await db.collection("contracts").where("token", "==", token).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: "Contract negăsit." });
    const data = snapshot.docs[0].data();
    const bankDetails = await getAdminBankDetails();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientSignatureBase64, prestatorSignatureBase64, clientIp, clientEmail, pdfUrl, ...publicData } = data;
    const pdfBuffer = await generateContractPDF({
      ...publicData,
      ...bankDetails,
      createdAt: tsToISO(data.createdAt),
      ...(req.query.clientName !== undefined ? { clientName: String(req.query.clientName) } : {}),
      ...(req.query.clientAddress !== undefined ? { clientAddress: String(req.query.clientAddress) } : {}),
      ...(req.query.clientPhone !== undefined ? { clientPhone: String(req.query.clientPhone) } : {}),
      ...(req.query.clientIdSeries !== undefined ? { clientIdSeries: String(req.query.clientIdSeries) } : {}),
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="contract-preview.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[contracts] GET /sign/:token/pdf failed:", error);
    res.status(500).json({ error: "Eroare la generarea PDF-ului." });
  }
});

// GET /api/contracts/sign/:token/html — full HTML contract for preview
// Optional query params: clientName, clientAddress, clientPhone, clientIdSeries
router.get("/sign/:token/html", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { token } = req.params;
    const snapshot = await db.collection("contracts").where("token", "==", token).limit(1).get();
    if (snapshot.empty) return res.status(404).send("<p>Contract negăsit.</p>");
    const data = snapshot.docs[0].data();
    const bankDetails = await getAdminBankDetails();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientSignatureBase64, clientIp, clientEmail, pdfUrl, ...publicData } = data;
    const html = buildContractHTML({
      ...publicData,
      ...bankDetails,
      createdAt: tsToISO(data.createdAt),
      ...(req.query.clientName !== undefined ? { clientName: String(req.query.clientName) } : {}),
      ...(req.query.clientAddress !== undefined ? { clientAddress: String(req.query.clientAddress) } : {}),
      ...(req.query.clientPhone !== undefined ? { clientPhone: String(req.query.clientPhone) } : {}),
      ...(req.query.clientIdSeries !== undefined ? { clientIdSeries: String(req.query.clientIdSeries) } : {}),
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("[contracts] GET /sign/:token/html failed:", error);
    res.status(500).send("<p>Eroare server.</p>");
  }
});

// GET /api/contracts/sign/:token — public contract data (no auth)
router.get("/sign/:token", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { token } = req.params;

    const snapshot = await db.collection("contracts").where("token", "==", token).limit(1).get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "Contract negăsit." });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

    if (data.status === "signed") {
      return res.status(410).json({ error: "Contractul a fost deja semnat.", status: "signed", pdfUrl: data.pdfUrl ?? null });
    }
    if (data.status === "expired") {
      return res.status(410).json({ error: "Contractul a expirat.", status: "expired" });
    }

    const bankDetails = await getAdminBankDetails();

    // Don't expose sensitive fields to the client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientSignatureBase64, clientIp, pdfUrl, ...publicData } = data;

    res.json({
      id: doc.id,
      ...publicData,
      ...bankDetails,
      createdAt: tsToISO(data.createdAt),
    });
  } catch (error) {
    console.error("[contracts] GET /sign/:token failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/contracts/sign/:token — submit client signature
router.post("/sign/:token", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { token } = req.params;
    const { clientName, clientEmail, clientAddress, clientPhone, clientIdSeries, clientSignatureBase64 } = req.body;

    if (!clientName?.trim()) {
      return res.status(400).json({ error: "Numele complet este obligatoriu." });
    }
    if (!clientEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      return res.status(400).json({ error: "Emailul este obligatoriu și trebuie să fie valid." });
    }
    if (!clientIdSeries?.trim() || !/^[A-Z]{2}[0-9]{6,7}$/.test(clientIdSeries.trim())) {
      return res.status(400).json({ error: "Seria și numărul buletinului trebuie să fie în formatul AB123456." });
    }
    if (!clientSignatureBase64 || !clientSignatureBase64.startsWith("data:image/")) {
      return res.status(400).json({ error: "Semnătura este obligatorie." });
    }

    const snapshot = await db.collection("contracts").where("token", "==", token).limit(1).get();
    if (snapshot.empty) {
      return res.status(404).json({ error: "Contract negăsit." });
    }

    const doc = snapshot.docs[0];
    const contract = doc.data();

    if (contract.status === "signed") {
      return res.status(410).json({ error: "Contractul a fost deja semnat.", status: "signed" });
    }
    if (contract.status === "expired") {
      return res.status(410).json({ error: "Contractul a expirat.", status: "expired" });
    }

    const clientIp = getClientIp(req) ?? "unknown";
    const clientUserAgent = req.headers["user-agent"] ?? "";
    const ipInfo = await fetchIpInfo(clientIp).catch(() => null);
    const signedAt = Timestamp.now();

    await db.collection("contracts").doc(doc.id).update({
      status: "signed",
      signedAt,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      clientIdSeries: clientIdSeries.trim(),
      clientAddress: clientAddress?.trim() ?? "",
      clientPhone: clientPhone?.trim() ?? "",
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

    // Generate PDF and send email in background — don't block the response
    const fullContract = {
      ...contract,
      id: doc.id,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      clientIdSeries: clientIdSeries.trim(),
      clientAddress: clientAddress?.trim() ?? "",
      clientPhone: clientPhone?.trim() ?? "",
      clientSignatureBase64,
      clientIp,
      clientUserAgent,
      clientGeo: {
        city: ipInfo?.city ?? "",
        region: ipInfo?.region ?? "",
        country: ipInfo?.country ?? "",
        org: ipInfo?.org ?? "",
      },
      signedAt: signedAt.toDate().toISOString(),
    };

    generateAndSendPDF(fullContract).catch((err) => {
      console.error("[contracts] PDF generation/email failed:", err);
    });

    res.json({ ok: true, message: "Contractul a fost semnat cu succes!" });
  } catch (error) {
    console.error("[contracts] POST /sign/:token failed:", error);
    res.status(500).json({ error: "Eroare server la semnare." });
  }
});

// POST /api/contracts/:id/resend — resend signed contract PDF to both admin and client
router.post("/:id/resend", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Contract negăsit." });

    const contract = { id: doc.id, ...doc.data() } as Record<string, unknown>;

    if (contract.status !== "signed") {
      return res.status(400).json({ error: "Contractul nu este semnat." });
    }
    if (!contract.clientEmail) {
      return res.status(400).json({ error: "Lipsește emailul clientului." });
    }

    generateAndSendPDF(contract).catch((err) => {
      console.error("[contracts] resend PDF/email failed:", err);
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[contracts] POST /:id/resend failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// PATCH /api/contracts/:id — edit contract (admin)
// Signed contracts allow only metadata updates (bank details, fiscal status, payment dates)
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Contract negăsit." });

    const data = doc.data()!;
    const body = req.body;
    const priceTotal = Number(body.priceTotal) || 0;
    const priceAdvance = Number(body.priceAdvance) || 0;

    const updates: Record<string, unknown> = {
      eventType: body.eventType,
      eventDate: body.eventDate,
      eventLocation: body.eventLocation ?? "",
      eventStartTime: body.eventStartTime ?? "",
      eventEndTime: body.eventEndTime ?? "",
      eventDetails: body.eventDetails ?? "",
      services: Array.isArray(body.services) ? body.services : [],
      currency: body.currency ?? "RON",
      priceTotal,
      priceAdvance,
      priceRest: body.priceRest !== undefined ? Number(body.priceRest) : priceTotal - priceAdvance,
      advancePaidAt: body.advancePaidAt ?? "",
      restPaidAt: body.restPaidAt ?? "",
      paymentMethod: body.paymentMethod ?? "Transfer bancar",
      clientEmail: body.clientEmail,
      clientName: body.clientName?.trim() ?? "",
      clientPhone: body.clientPhone?.trim() ?? "",
      clientAddress: body.clientAddress?.trim() ?? "",
      clientIdSeries: body.clientIdSeries?.trim() ?? "",
      privateClient: body.privateClient === true,
      fiscalized: body.fiscalized === true,
      transportKm: body.transportKm ?? "",
      transportFuelPrice: body.transportFuelPrice ?? "10",
      bankBeneficiaryName: body.bankBeneficiaryName?.trim() ?? "",
      bankIban: body.bankIban?.trim().toUpperCase() ?? "",
    };

    // Remove undefined values — Firestore throws on undefined fields
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    await db.collection("contracts").doc(req.params.id).update(cleanUpdates);
    res.json({ ok: true });
  } catch (error) {
    console.error("[contracts] PATCH /:id failed:", error);
    res.status(500).json({ error: "Eroare la actualizarea contractului." });
  }
});

// GET /api/contracts/:id — contract details (admin)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Contract negăsit." });
    }

    const data = doc.data()!;
    res.json({
      id: doc.id,
      ...data,
      createdAt: tsToISO(data.createdAt),
      signedAt: tsToISO(data.signedAt),
    });
  } catch (error) {
    console.error("[contracts] GET /:id failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/contracts/:id/create-event — generate adminEvent from contract
router.post("/:id/create-event", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const contractRef = db.collection("contracts").doc(req.params.id);
    const doc = await contractRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Contract negăsit." });
    }

    const contract = doc.data()!;
    if (contract.eventId) {
      return res.status(409).json({ error: "Contractul este deja legat de un eveniment.", eventId: contract.eventId });
    }

    if (!contract.eventDate) {
      return res.status(400).json({ error: "Contractul nu are dată de eveniment." });
    }

    const contractDate = new Date(String(contract.eventDate));
    if (isNaN(contractDate.getTime())) {
      return res.status(400).json({ error: "Data contractului este invalidă." });
    }

    const contractDateIso = contractDate.toISOString().slice(0, 10);
    const eventsSnapshot = await db.collection("adminEvents").get();
    const occupied = eventsSnapshot.docs.some((eventDoc) => {
      const eventData = eventDoc.data();
      if (!BOOKED_EVENT_STATUSES.has(String(eventData.status ?? ""))) return false;
      return expandEventDates(eventData).includes(contractDateIso);
    });

    if (occupied) {
      return res.status(409).json({ error: "Data contractului este deja ocupată de un eveniment confirmat." });
    }

    const { type, typeLabel } = mapContractEventType(contract.eventType);
    const total = Number(contract.priceTotal) || 0;
    const advanceAmount = Number(contract.priceAdvance) || 0;
    const eventRef = await db.collection("adminEvents").add({
      type,
      ...(typeLabel ? { typeLabel } : {}),
      status: "confirmat",
      fiscalized: false,
      createdAt: Timestamp.now(),
      eventDate: Timestamp.fromDate(contractDate),
      client: {
        fullName: contract.clientName?.trim() || contract.clientEmail || "Client contract",
        phone: contract.clientPhone?.trim() ?? "",
        email: contract.clientEmail ?? "",
      },
      services: Array.isArray(contract.services) ? contract.services : [],
      pricing: {
        total,
        advanceAmount,
        advancePaid: advanceAmount > 0,
        remainingAmount: contract.priceRest !== undefined
          ? Number(contract.priceRest) || Math.max(0, total - advanceAmount)
          : Math.max(0, total - advanceAmount),
      },
      contractId: doc.id,
      notes: contract.eventDetails ?? "",
    });

    await contractRef.update({ eventId: eventRef.id });

    res.status(201).json({ ok: true, eventId: eventRef.id });
  } catch (error) {
    console.error("[contracts] POST /:id/create-event failed:", error);
    res.status(500).json({ error: "Nu s-a putut genera evenimentul din contract." });
  }
});

// POST /api/contracts/:id/reset-signature — clear client signature (testing only)
router.post("/:id/reset-signature", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Contract negăsit." });

    await db.collection("contracts").doc(req.params.id).update({
      status: "sent",
      clientSignatureBase64: null,
      clientIp: null,
      clientUserAgent: null,
      clientGeo: null,
      signedAt: null,
      pdfUrl: null,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[contracts] POST /:id/reset-signature failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// DELETE /api/contracts/:id — delete contract (admin)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Contract negăsit." });

    const contractData = { ...doc.data(), id: doc.id };

    await db.collection("contracts").doc(req.params.id).delete();

    // Send confirmation email with the deleted contract details
    sendContractDeletedEmail({ contract: contractData }).catch((err) => {
      console.error("[contracts] DELETE email failed:", err);
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[contracts] DELETE /:id failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// GET /api/contracts/:id/preview — PDF preview (admin)
router.get("/:id/preview", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Contract negăsit." });
    const data = doc.data()!;
    const bankDetails = await getAdminBankDetails();
    const contract = {
      ...bankDetails,   // setările globale ca fallback
      ...data,          // valorile din contract le suprascriu pe cele globale
      id: doc.id,
      createdAt: tsToISO(data.createdAt),
    };
    const pdfBuffer = await generateContractPDF(contract as Record<string, unknown>);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="preview-contract.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[contracts] GET /:id/preview failed:", error);
    res.status(500).json({ error: "Eroare la generarea previzualizării." });
  }
});

// POST /api/contracts/:id/cancel — cancel contract (admin)
router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Contract negăsit." });
    if (doc.data()!.status === "signed") {
      return res.status(400).json({ error: "Contractul semnat nu poate fi anulat." });
    }
    await db.collection("contracts").doc(req.params.id).update({ status: "anulat" });
    res.json({ ok: true });
  } catch (error) {
    console.error("[contracts] POST /:id/cancel failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/contracts/:id/prestator-sign — provider signature (admin)
router.post("/:id/prestator-sign", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { prestatorSignatureBase64 } = req.body;

    if (!prestatorSignatureBase64 || !prestatorSignatureBase64.startsWith("data:image/")) {
      return res.status(400).json({ error: "Semnătura este obligatorie." });
    }

    const doc = await db.collection("contracts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Contract negăsit." });

    await db.collection("contracts").doc(req.params.id).update({ prestatorSignatureBase64 });
    res.json({ ok: true });
  } catch (error) {
    console.error("[contracts] POST /:id/prestator-sign failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/contracts/:id/reminder — send unsigned-contract reminder to client (admin)
router.post("/:id/reminder", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Contract negăsit." });

    const contract = doc.data()!;
    if (contract.status !== "sent") {
      return res.status(400).json({ error: "Reminder-ul se poate trimite doar pentru contracte nesemnate (status: trimis)." });
    }

    await sendContractReminderEmail({
      to: contract.clientEmail,
      token: contract.token,
      eventType: contract.eventType,
      eventDate: contract.eventDate,
      baseUrl: APP_BASE_URL,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[contracts] POST /:id/reminder failed:", error);
    res.status(500).json({ error: "Nu s-a putut trimite reminder-ul." });
  }
});

// POST /api/contracts/:id/send — send link to client (admin)
router.post("/:id/send", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Contract negăsit." });
    }

    const contract = doc.data()!;

    if (contract.status === "signed") {
      return res.status(400).json({ error: "Contractul a fost deja semnat." });
    }

    await db.collection("contracts").doc(req.params.id).update({ status: "sent", sentAt: Timestamp.now() });

    const baseUrl = APP_BASE_URL;
    await sendContractLinkEmail({
      to: contract.clientEmail,
      token: contract.token,
      eventType: contract.eventType,
      eventDate: contract.eventDate,
      baseUrl,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[contracts] POST /:id/send failed:", error);
    res.status(500).json({ error: "Nu s-a putut trimite emailul." });
  }
});

function buildPdfFilename(contract: Record<string, unknown>): string {
  const date = new Date(contract.eventDate as string);
  const formatted = isNaN(date.getTime())
    ? "data_necunoscuta"
    : date.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" }).replace(/\s/g, "_");
  const type = String(contract.eventType ?? "contract").replace(/\s+/g, "_");
  const id = String(contract.id ?? uuidv4()).slice(0, 8);
  return `contracts/${type}_${formatted}_${id}.pdf`;
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

async function generateAndSendPDF(contract: Record<string, unknown>): Promise<void> {
  const db = firestore();
  let pdfUrl: string | null = null;

  try {
    const bankDetails = await getAdminBankDetails();
    const pdfBuffer = await generateContractPDF({ ...contract, ...bankDetails });
    const filename = buildPdfFilename(contract);
    pdfUrl = await uploadPdfToStorage(pdfBuffer, filename);
    if (contract.id) {
      await db.collection("contracts").doc(contract.id as string).update({ pdfUrl });
    }
  } catch (pdfError) {
    console.error("[contracts] PDF generation/upload failed, sending email without PDF link:", pdfError);
  }

  const fallbackUrl = `${APP_BASE_URL}/contract/${String(contract.token ?? "")}`;

  await sendSignedContractEmail({
    to: contract.clientEmail as string,
    eventType: contract.eventType as string,
    eventDate: contract.eventDate as string,
    clientName: contract.clientName as string,
    pdfUrl: pdfUrl ?? fallbackUrl,
    hasPdf: pdfUrl !== null,
  });
}

// GET /api/contracts/invoice-next-number — preview next auto-generated invoice number
router.get("/invoice-next-number", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const counterDoc = await db.collection("settings").doc("invoiceCounter").get();
    const currentYear = new Date().getFullYear();
    const data = counterDoc.data() ?? {};
    const next = data.year === currentYear ? (data.next ?? 1) : 1;
    const prefix = String(data.prefix ?? "FA");
    res.json({ invoiceNumber: `${prefix}-${currentYear}-${String(next).padStart(3, "0")}` });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/contracts/:id/invoice — generate, save and return PDF + XML
router.post("/:id/invoice", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Contract negăsit." });
    const contract = doc.data() as Record<string, unknown>;

    const { invoiceDate, dueDate, description, amountType, buyerCIF, invoiceNumberOverride } = req.body as {
      invoiceDate: string;
      dueDate: string;
      description: string;
      amountType: "total" | "advance" | "rest";
      buyerCIF?: string;
      invoiceNumberOverride?: string;
    };

    if (!invoiceDate || !dueDate || !description) {
      return res.status(400).json({ error: "Câmpuri obligatorii: invoiceDate, dueDate, description." });
    }

    // Load PFA settings
    const settingsDoc = await db.collection("settings").doc("admin").get();
    const settings = settingsDoc.data() ?? {};
    const bankDetails = (settings.bankDetails ?? {}) as Record<string, string>;
    const issuer = (settings.invoiceIssuer ?? {}) as Record<string, string>;

    // Auto-increment invoice number (or use override)
    let invoiceNumber = invoiceNumberOverride?.trim() ?? "";
    if (!invoiceNumber) {
      invoiceNumber = await db.runTransaction(async (tx) => {
        const counterRef = db.collection("settings").doc("invoiceCounter");
        const counterDoc = await tx.get(counterRef);
        const currentYear = new Date().getFullYear();
        const data = counterDoc.data() ?? {};
        const prefix = String(data.prefix ?? "FA");
        const year = data.year === currentYear ? currentYear : currentYear;
        const next = data.year === currentYear ? (Number(data.next ?? 1)) : 1;
        tx.set(counterRef, { year: currentYear, next: next + 1, prefix }, { merge: false });
        return `${prefix}-${year}-${String(next).padStart(3, "0")}`;
      });
    }

    const priceTotal   = Number(contract.priceTotal   ?? 0);
    const priceAdvance = Number(contract.priceAdvance ?? 0);
    const priceRest    = Number(contract.priceRest    ?? priceTotal - priceAdvance);
    const currency     = String(contract.currency ?? "RON");
    const amount = amountType === "advance" ? priceAdvance : amountType === "rest" ? priceRest : priceTotal;

    const invoiceData: InvoiceData = {
      issuerName:       issuer.name       || bankDetails.beneficiaryName || "",
      issuerCIF:        issuer.cif        || "",
      issuerAddress:    issuer.address    || "",
      issuerCity:       issuer.city       || "",
      issuerCounty:     issuer.county     || "",
      issuerPostalCode: issuer.postalCode || "",
      issuerIBAN:       bankDetails.iban  || "",
      buyerName:        String(contract.clientName ?? ""),
      buyerCIF:         buyerCIF || "",
      invoiceNumber,
      invoiceDate,
      dueDate,
      currency,
      description,
      amount,
      eventType: String(contract.eventType ?? ""),
      eventDate: tsToISO(contract.eventDate)?.slice(0, 10) ?? "",
    };

    const [pdfBuffer, xmlString] = await Promise.all([
      generateInvoicePDF(invoiceData),
      Promise.resolve(generateInvoiceXML(invoiceData)),
    ]);

    // Save invoice record to Firestore
    const invoiceRecord = {
      invoiceNumber,
      contractId: req.params.id,
      clientName: invoiceData.buyerName,
      clientCIF: buyerCIF || "",
      amount,
      currency,
      amountType,
      description,
      invoiceDate,
      dueDate,
      createdAt: Timestamp.now(),
      eventType: invoiceData.eventType,
      eventDate: invoiceData.eventDate,
      issuerData: {
        name: invoiceData.issuerName,
        cif: invoiceData.issuerCIF,
        address: invoiceData.issuerAddress,
        city: invoiceData.issuerCity,
        county: invoiceData.issuerCounty,
        postalCode: invoiceData.issuerPostalCode,
        iban: invoiceData.issuerIBAN,
      },
    };
    const savedRef = await db.collection("invoices").add(invoiceRecord);

    const fileName = `factura_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}`;
    res.json({
      invoiceId: savedRef.id,
      invoiceNumber,
      pdfBase64: pdfBuffer.toString("base64"),
      xmlString,
      fileName,
    });
  } catch (error) {
    console.error("[contracts] POST /:id/invoice failed:", error);
    res.status(500).json({ error: "Nu s-a putut genera factura." });
  }
});

export default router;
