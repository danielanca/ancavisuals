import { Router } from "express";
import type { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { detectServiceFlags, computeContractTitle, type ContractService } from "../services/pdf.generator";
import { interpolateClauseTokens } from "../services/contractClauseInterpolation";
import { SEED_DEFAULT_CLAUSES } from "../services/contractClauseSeedData";

const router = Router();
const COLLECTION = "contractClauseTemplates";

interface ClauseTemplateDoc {
  key: string;
  title: string;
  bodyTemplate: string;
  appliesTo: string; // "all" or an event type matching CreateContractPage's EVENT_TYPES
  order: number;
  groupKey: string | null;
  conditionTag: string | null;
  mutexGroup: string | null;
  isActive: boolean;
}

router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const { appliesTo, includeInactive } = req.query as { appliesTo?: string; includeInactive?: string };
    const snapshot = await db.collection(COLLECTION).get();
    let templates = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ClauseTemplateDoc & { id: string }));
    if (includeInactive !== "true") templates = templates.filter((t) => t.isActive !== false);
    if (appliesTo) templates = templates.filter((t) => t.appliesTo === appliesTo || t.appliesTo === "all");
    templates.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    res.json({ templates });
  } catch (error) {
    console.error("[contract-clause-templates] GET / failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

router.post("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { key, title, bodyTemplate, appliesTo, order, groupKey, conditionTag, mutexGroup } = req.body as Partial<ClauseTemplateDoc>;
    if (!key?.trim() || !title?.trim() || !bodyTemplate?.trim()) {
      res.status(400).json({ error: "Cheie, titlu și text sunt obligatorii." });
      return;
    }
    const db = firestore();
    const now = Timestamp.now();
    const docRef = await db.collection(COLLECTION).add({
      key: key.trim(),
      title: title.trim(),
      bodyTemplate,
      appliesTo: appliesTo?.trim() || "all",
      order: Number(order) || 0,
      groupKey: groupKey || null,
      conditionTag: conditionTag || null,
      mutexGroup: mutexGroup || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error("[contract-clause-templates] POST / failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /reorder — must come before PATCH /:id to avoid route collision
router.patch("/reorder", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { updates } = req.body as { updates?: { id: string; order: number }[] };
    if (!Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ error: "Lista de actualizări lipsește." });
      return;
    }
    const db = firestore();
    const batch = db.batch();
    const now = Timestamp.now();
    updates.forEach((u) => {
      batch.update(db.collection(COLLECTION).doc(u.id), { order: Number(u.order), updatedAt: now });
    });
    await batch.commit();
    res.json({ ok: true });
  } catch (error) {
    console.error("[contract-clause-templates] PATCH /reorder failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /seed-defaults — idempotent unless ?force=true; populates the shared ("all") baseline
router.post("/seed-defaults", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const force = req.query.force === "true";
    const existing = await db.collection(COLLECTION).limit(1).get();
    if (!existing.empty && !force) {
      res.json({ ok: true, skipped: true, message: "Biblioteca are deja clauze — folosește ?force=true ca să adaugi oricum seed-ul." });
      return;
    }
    const batch = db.batch();
    const now = Timestamp.now();
    for (const clause of SEED_DEFAULT_CLAUSES) {
      const ref = db.collection(COLLECTION).doc();
      batch.set(ref, { ...clause, isActive: true, createdAt: now, updatedAt: now });
    }
    await batch.commit();
    res.json({ ok: true, inserted: SEED_DEFAULT_CLAUSES.length });
  } catch (error) {
    console.error("[contract-clause-templates] POST /seed-defaults failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

interface RenderClauseRequest {
  eventType?: string;
  services?: ContractService[];
  privateClient?: boolean;
  eventDate?: unknown;
  eventStartTime?: string;
  eventEndTime?: string;
  eventLocation?: string;
  clientName?: string;
  priceTotal?: number;
  currency?: string;
  priceAdvance?: number;
  priceRest?: number;
  paymentMethod?: string;
  bankBeneficiaryName?: string;
  bankIban?: string;
  transportKm?: number;
  transportFuelPrice?: number;
}

function isClauseApplicable(conditionTag: string | null, flags: ReturnType<typeof detectServiceFlags>, privateClient: boolean): boolean {
  switch (conditionTag) {
    case "hasFoto": return flags.hasFoto;
    case "hasVideo": return flags.hasVideo;
    case "hasPhotobooth": return flags.hasPhotobooth;
    case "hasVideobooth": return flags.hasVideobooth;
    case "hasPhotoVideo": return flags.hasPhotoVideo;
    case "privateClient": return privateClient;
    case "notPrivateClient": return !privateClient;
    case "hasPhotoVideoAndPrivate": return flags.hasPhotoVideo && privateClient;
    case "hasPhotoVideoAndNotPrivate": return flags.hasPhotoVideo && !privateClient;
    case null:
    case undefined:
    case "":
      return true;
    default:
      return true;
  }
}

// POST /render — pure computation, nothing persisted. Powers the "Generează clauzele" button
// in CreateContractPage/EditContractPage.
router.post("/render", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body as RenderClauseRequest;
    const eventType = body.eventType ?? "";
    const services = body.services ?? [];
    const privateClient = Boolean(body.privateClient);

    const db = firestore();
    const snapshot = await db.collection(COLLECTION).get();
    let templates = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as ClauseTemplateDoc & { id: string }))
      .filter((t) => t.isActive !== false);
    templates = templates.filter((t) => t.appliesTo === "all" || t.appliesTo === eventType);
    templates.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const flags = detectServiceFlags(services, eventType);
    const contractTitle = computeContractTitle(flags);

    const ctx = {
      eventDate: body.eventDate,
      eventStartTime: body.eventStartTime,
      eventEndTime: body.eventEndTime,
      eventLocation: body.eventLocation,
      eventType,
      clientName: body.clientName,
      contractTitle,
      priceTotal: body.priceTotal,
      currency: body.currency,
      priceAdvance: body.priceAdvance,
      priceRest: body.priceRest,
      transportKm: body.transportKm,
      transportFuelPrice: body.transportFuelPrice,
      bankBeneficiaryName: body.bankBeneficiaryName,
      bankIban: body.bankIban,
    };

    const clauses = templates.map((t) => ({
      templateId: t.id,
      key: t.key,
      title: t.title,
      body: interpolateClauseTokens(t.bodyTemplate, ctx),
      order: t.order,
      groupKey: t.groupKey,
      mutexGroup: t.mutexGroup,
      defaultChecked: isClauseApplicable(t.conditionTag, flags, privateClient),
    }));

    res.json({ clauses });
  } catch (error) {
    console.error("[contract-clause-templates] POST /render failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

router.patch("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { title, bodyTemplate, appliesTo, order, groupKey, conditionTag, mutexGroup, isActive } = req.body as Partial<ClauseTemplateDoc>;
    const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (title !== undefined) updates.title = title;
    if (bodyTemplate !== undefined) updates.bodyTemplate = bodyTemplate;
    if (appliesTo !== undefined) updates.appliesTo = appliesTo || "all";
    if (order !== undefined) updates.order = Number(order);
    if (groupKey !== undefined) updates.groupKey = groupKey || null;
    if (conditionTag !== undefined) updates.conditionTag = conditionTag || null;
    if (mutexGroup !== undefined) updates.mutexGroup = mutexGroup || null;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    const db = firestore();
    await db.collection(COLLECTION).doc(req.params.id).update(updates);
    res.json({ ok: true });
  } catch (error) {
    console.error("[contract-clause-templates] PATCH /:id failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

router.delete("/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    await firestore().collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[contract-clause-templates] DELETE /:id failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
