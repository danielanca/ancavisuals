import type { Request, Response } from "express";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { firestore } from "../firestore";
import { FIREBASE_STORAGE_BUCKET } from "../constants/firebase";
import { generateContractPDF, buildContractHTML } from "../services/pdf.generator";
import { sendContractLinkEmail, sendSignedContractEmail, sendContractDeletedEmail } from "../notifications/templates/contractEmail";
import { getClientIp, fetchIpInfo } from "../utils/ipinfo";

const router = Router();

// POST /api/contracts — creare contract nou (admin)
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

    // Leagă evenimentul de contract dacă e furnizat eventId
    if (body.eventId) {
      await db.collection("adminEvents").doc(body.eventId).update({ contractId: docRef.id })
        .catch(() => {}); // nu blocăm dacă evenimentul nu există
    }

    res.status(201).json({ id: docRef.id, token: contract.token });
  } catch (error) {
    console.error("[contracts] POST / failed:", error);
    res.status(500).json({ error: "Nu s-a putut crea contractul." });
  }
});

// GET /api/contracts — lista contracte (admin)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db.collection("contracts").orderBy("createdAt", "desc").get();

    const contracts = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        signedAt: data.signedAt instanceof Timestamp ? data.signedAt.toDate().toISOString() : (data.signedAt ?? null),
        sentAt: data.sentAt instanceof Timestamp ? data.sentAt.toDate().toISOString() : (data.sentAt ?? null),
      };
    });

    res.json({ contracts });
  } catch (error) {
    console.error("[contracts] GET / failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca contractele." });
  }
});

// NOTE: /sign/:token routes must come BEFORE /:id to avoid route collision

// GET /api/contracts/sign/:token/pdf — PDF contract pentru previzualizare publică
// Query params opționali: clientName, clientAddress, clientPhone, clientIdSeries
router.get("/sign/:token/pdf", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { token } = req.params;
    const snapshot = await db.collection("contracts").where("token", "==", token).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: "Contract negăsit." });
    const data = snapshot.docs[0].data();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientSignatureBase64, prestatorSignatureBase64, clientIp, clientEmail, pdfUrl, ...publicData } = data;
    const pdfBuffer = await generateContractPDF({
      ...publicData,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
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

// GET /api/contracts/sign/:token/html — HTML complet contract pentru previzualizare
// Query params opționali: clientName, clientAddress, clientPhone, clientIdSeries
router.get("/sign/:token/html", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { token } = req.params;
    const snapshot = await db.collection("contracts").where("token", "==", token).limit(1).get();
    if (snapshot.empty) return res.status(404).send("<p>Contract negăsit.</p>");
    const data = snapshot.docs[0].data();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientSignatureBase64, clientIp, clientEmail, pdfUrl, ...publicData } = data;
    const html = buildContractHTML({
      ...publicData,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
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

// GET /api/contracts/sign/:token — date contract public (fără auth)
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

    // Nu expunem câmpuri sensibile clientului
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientSignatureBase64, clientIp, pdfUrl, ...publicData } = data;

    res.json({
      id: doc.id,
      ...publicData,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
    });
  } catch (error) {
    console.error("[contracts] GET /sign/:token failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/contracts/sign/:token — submit semnătură client
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

    // Generare PDF și trimitere email în background — nu blocăm răspunsul
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

// PATCH /api/contracts/:id — editare contract (admin, doar nesemnat)
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Contract negăsit." });

    const data = doc.data()!;
    if (data.status === "signed") {
      return res.status(400).json({ error: "Contractul semnat nu poate fi modificat." });
    }

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
      transportKm: body.transportKm ?? "",
      transportFuelPrice: body.transportFuelPrice ?? "10",
    };

    await db.collection("contracts").doc(req.params.id).update(updates);
    res.json({ ok: true });
  } catch (error) {
    console.error("[contracts] PATCH /:id failed:", error);
    res.status(500).json({ error: "Eroare la actualizarea contractului." });
  }
});

// GET /api/contracts/:id — detalii contract (admin)
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
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
      signedAt: data.signedAt instanceof Timestamp ? data.signedAt.toDate().toISOString() : (data.signedAt ?? null),
    });
  } catch (error) {
    console.error("[contracts] GET /:id failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/contracts/:id/reset-signature — șterge semnătura clientului (doar pentru teste)
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

// DELETE /api/contracts/:id — șterge contract (admin)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Contract negăsit." });

    const contractData = { ...doc.data(), id: doc.id };

    await db.collection("contracts").doc(req.params.id).delete();

    // Trimite email de confirmare cu detaliile contractului șters
    sendContractDeletedEmail({ contract: contractData }).catch((err) => {
      console.error("[contracts] DELETE email failed:", err);
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[contracts] DELETE /:id failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// GET /api/contracts/:id/preview — previzualizare PDF (admin)
router.get("/:id/preview", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const doc = await db.collection("contracts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Contract negăsit." });
    const data = doc.data()!;
    const contract = {
      ...data,
      id: doc.id,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
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

// POST /api/contracts/:id/cancel — anulare contract (admin)
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

// POST /api/contracts/:id/prestator-sign — semnătură prestator (admin)
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

// POST /api/contracts/:id/send — trimite link la client (admin)
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

    const baseUrl = process.env.APP_BASE_URL ?? "https://ancavisuals.ro";
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
  const pdfBuffer = await generateContractPDF(contract);

  const filename = buildPdfFilename(contract);
  const pdfUrl = await uploadPdfToStorage(pdfBuffer, filename);

  if (contract.id) {
    await db.collection("contracts").doc(contract.id as string).update({ pdfUrl });
  }

  await sendSignedContractEmail({
    to: contract.clientEmail as string,
    eventType: contract.eventType as string,
    eventDate: contract.eventDate as string,
    clientName: contract.clientName as string,
    pdfUrl,
  });
}

export default router;
