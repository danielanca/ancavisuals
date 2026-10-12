import { Router } from "express";
import type { Query } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import type { AiUsageEntry } from "../../shared/ai/usage";

const router = Router();
const PAGE_SIZE = 50;
function day(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed.toISOString() : null;
}
const midnightHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hour: "2-digit", hourCycle: "h23" });
function bucharestMidnight(utcDay: string): string {
  const date = new Date(utcDay);
  return new Date(date.getTime() - Number(midnightHour.format(date)) * 3600000).toISOString();
}
router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const start = req.query.start === undefined || req.query.start === "" ? null : day(req.query.start);
  const end = req.query.end === undefined || req.query.end === "" ? null : day(req.query.end);
  if ((req.query.start && !start) || (req.query.end && !end) || (start && end && start > end)) {
    res.status(400).json({ error: "Perioadă invalidă." }); return;
  }
  const cursorId = req.query.cursor;
  if (cursorId !== undefined && (typeof cursorId !== "string" || !/^[\w-]{1,80}$/.test(cursorId))) {
    res.status(400).json({ error: "Cursor invalid." }); return;
  }
  try {
    const collection = firestore().collection("aiUsageHistory");
    let query: Query = collection.orderBy("createdAt", "desc");
    if (start) query = query.where("createdAt", ">=", bucharestMidnight(start));
    if (end) query = query.where("createdAt", "<", bucharestMidnight(new Date(new Date(end).getTime() + 86400000).toISOString()));
    if (typeof cursorId === "string") {
      const cursor = await collection.doc(cursorId).get();
      if (!cursor.exists) { res.status(400).json({ error: "Cursor invalid." }); return; }
      query = query.startAfter(cursor);
    }
    const snapshot = await query.limit(PAGE_SIZE + 1).get();
    const docs = snapshot.docs.slice(0, PAGE_SIZE);
    // Explicit whitelist: no future private fields can leak through this endpoint.
    const fields: (keyof AiUsageEntry)[] = ["createdAt", "completedAt", "feature", "operation", "route", "appRequestId", "source", "provider", "model", "providerRequestId", "messageId", "status", "httpStatus", "durationMs", "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "cacheWrite1hTokens", "totalTokens", "reasoningTokens", "usageComplete", "estimatedCostUsd", "pricingVersion"];
    const items = docs.map(doc => {
      const data = doc.data();
      return Object.fromEntries([["id", doc.id], ...fields.map(key => [key, data[key] ?? null])]);
    });
    res.json({ items, nextCursor: snapshot.docs.length > PAGE_SIZE ? docs[PAGE_SIZE - 1].id : null });
  } catch {
    console.error("[ai-usage] history read failed");
    res.status(503).json({ error: "Istoricul AI nu poate fi încărcat momentan." });
  }
});
export default router;
