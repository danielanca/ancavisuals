import { EventEmitter } from "events";
import { firestore } from "../firestore.js";
import { LIVE_TIMEOUT_MS, LIVE_IDLE_MS, visitSource, type VisitSource } from "../../shared/liveVisits";
import { FieldValue } from "firebase-admin/firestore";

// ── Types ────────────────────────────────────────────────────────────────────

export type EventPriority = "low" | "normal" | "high" | "critical";

export interface LiveEvent {
  id: string;
  name: string;
  at: number;
  page: string;
  label?: string;
  priority: EventPriority;
  meta?: Record<string, unknown>;
}

export interface LiveAttribution {
  gclid?: string;
  gadSource?: string;
  wbraid?: string;
  gbraid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPath?: string;
}

export interface LiveSession {
  sessionId: string;
  visitorId: string;
  isNew: boolean;
  visitorNumber: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastEventAt: number;
  endedAt: number | null;
  endReason: string | null;
  endDurationSeconds: number | null;
  currentPage: string;
  currentPageTitle: string;
  pageCount: number;
  path: { page: string; at: number }[];
  events: LiveEvent[];
  scrollByPage: Record<string, number>;
  attribution: LiveAttribution;
  isGoogleAds: boolean;
  source: VisitSource;
  ip: string;
  city: string;
  region: string;
  country: string;
  org: string;
  ua: string;
  deviceType: "mobile" | "tablet" | "desktop";
  idle: boolean;
  geoResolved: boolean;
  visibility: "visible" | "hidden";
  archived?: boolean;
  audience?: "client" | "prospect";
  hasContactIntent?: boolean;
  hasConfirmedLead?: boolean;
}

export interface RecordEventInput {
  sessionId: string;
  visitorId?: string;
  isNew?: boolean;
  event: string;
  page?: string;
  pageTitle?: string;
  label?: string;
  priority?: EventPriority;
  meta?: Record<string, unknown>;
  landingMeta?: LiveAttribution & { isGoogleAds?: boolean };
  scrollDepth?: number;
}

export interface SessionContext {
  ip: string;
  ua: string;
  geo?: { city?: string; region?: string; country?: string; org?: string } | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const EVENTS_CAP = 200;
const PATH_CAP = 60;
const HEARTBEAT_TIMEOUT_MS = LIVE_TIMEOUT_MS; // tolerate background-tab timer throttling
const IDLE_AFTER_MS = LIVE_IDLE_MS;
const KEEP_ENDED_MS = 10 * 60_000;
const PERSIST_DEBOUNCE_MS = 5_000;
const SWEEP_INTERVAL_MS = 5_000;
const LIVE_SESSIONS_COLLECTION = "live_sessions";

// ── Store ────────────────────────────────────────────────────────────────────

const sessions = new Map<string, LiveSession>();
export const liveVisitorsEmitter = new EventEmitter();
liveVisitorsEmitter.setMaxListeners(50);

let visitorCounter = 0;
const persistTimers = new Map<string, NodeJS.Timeout>();

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function deviceFromUa(ua: string): LiveSession["deviceType"] {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return "tablet";
  if (/mobi|iphone|android.*mobile|phone/.test(s)) return "mobile";
  return "desktop";
}

function classifySource(attr: LiveAttribution, isGoogleAds: boolean): VisitSource {
  return visitSource(attr, isGoogleAds);
}

function computeIsGoogleAds(attr: LiveAttribution, hint?: boolean): boolean {
  if (hint) return true;
  if (attr.gclid || attr.wbraid || attr.gbraid) return true;
  const src = (attr.utmSource ?? "").toLowerCase();
  const med = (attr.utmMedium ?? "").toLowerCase();
  return (src === "google" || src === "adwords") && ["cpc", "ppc", "paid", "paidsearch", "sem"].includes(med);
}

function createSession(input: RecordEventInput, ctx: SessionContext): LiveSession {
  visitorCounter += 1;
  const attr: LiveAttribution = { ...(input.landingMeta ?? {}) };
  const isGoogleAds = computeIsGoogleAds(attr, input.landingMeta?.isGoogleAds);
  const now = Date.now();
  const page = input.page ?? "/";
  const session: LiveSession = {
    sessionId: input.sessionId,
    visitorId: input.visitorId ?? "",
    isNew: input.isNew ?? true,
    visitorNumber: visitorCounter,
    firstSeenAt: now,
    lastSeenAt: now,
    lastEventAt: now,
    endedAt: null,
    endReason: null,
    endDurationSeconds: null,
    currentPage: page,
    currentPageTitle: input.pageTitle ?? "",
    pageCount: 1,
    path: [{ page, at: now }],
    events: [],
    scrollByPage: {},
    attribution: attr,
    isGoogleAds,
    source: classifySource(attr, isGoogleAds),
    ip: ctx.ip,
    city: ctx.geo?.city ?? "",
    region: ctx.geo?.region ?? "",
    country: ctx.geo?.country ?? "",
    org: ctx.geo?.org ?? "",
    ua: ctx.ua,
    deviceType: deviceFromUa(ctx.ua),
    idle: false,
    geoResolved: Boolean(ctx.geo),
    visibility: "visible",
  };
  sessions.set(session.sessionId, session);
  return session;
}

// Restore before ingestion so a process restart cannot overwrite the recorded journey.
const restoring = new Map<string, Promise<void>>();
export async function restoreSession(sessionId: string): Promise<void> {
  if (sessions.has(sessionId)) return;
  const pending = restoring.get(sessionId);
  if (pending) return pending;
  const task = (async () => {
    const doc = await firestore().collection(LIVE_SESSIONS_COLLECTION).doc(sessionId).get();
    if (!doc.exists || sessions.has(sessionId)) return;
    const d = doc.data();
    if (!d || !Number.isFinite(d.firstSeenAt ?? d.startedAtMs)) return;
    const restored: LiveSession = {
      ...d, sessionId,
      visitorId: d.visitorId ?? "", isNew: Boolean(d.isNew), visitorNumber: d.visitorNumber ?? 0,
      firstSeenAt: d.firstSeenAt ?? d.startedAtMs, lastSeenAt: d.lastSeenAt ?? d.startedAtMs,
      lastEventAt: d.lastEventAt ?? d.lastSeenAt ?? d.startedAtMs,
      endedAt: d.endedAt ?? null, endReason: d.endReason ?? null,
      endDurationSeconds: d.endedAt ? d.durationSeconds ?? null : null,
      currentPage: d.currentPage ?? "/", currentPageTitle: d.currentPageTitle ?? "",
      pageCount: d.pageCount ?? 1, path: d.path ?? [], events: d.events ?? [],
      scrollByPage: d.scrollByPage ?? {}, attribution: d.attribution ?? {},
      isGoogleAds: Boolean(d.isGoogleAds), source: visitSource(d.attribution ?? {}, Boolean(d.isGoogleAds)),
      ip: d.ip ?? "", ua: d.ua ?? "", city: d.city ?? "", region: d.region ?? "",
      country: d.country ?? "", org: d.org ?? "", deviceType: d.deviceType ?? "desktop",
      idle: Boolean(d.idle), geoResolved: Boolean(d.country), visibility: d.visibility ?? "visible",
    };
    sessions.set(sessionId, restored);
  })();
  restoring.set(sessionId, task);
  try { await task; } finally { restoring.delete(sessionId); }
}

/** Whether geo still needs resolving for this session (avoids repeat ipinfo calls). */
export function sessionNeedsGeo(sessionId: string): boolean {
  const s = sessions.get(sessionId);
  return !s || !s.geoResolved;
}

export function recordEvent(input: RecordEventInput, ctx: SessionContext): { session: LiveSession; event: LiveEvent } {
  let session = sessions.get(input.sessionId);
  const now = Date.now();

  if (!session) {
    session = createSession(input, ctx);
    liveVisitorsEmitter.emit("update", { type: "session_started", sessionId: session.sessionId, session: serializeSession(session) });
  } else {
    if (ctx.geo && !session.geoResolved) {
      session.city = ctx.geo.city ?? session.city;
      session.region = ctx.geo.region ?? session.region;
      session.country = ctx.geo.country ?? session.country;
      session.org = ctx.geo.org ?? session.org;
      session.geoResolved = true;
    }
    if (session.endedAt) {
      // A ping/event arrived after we timed the session out — revive it.
      session.endedAt = null;
      session.endReason = null;
      session.endDurationSeconds = null;
    }
  }

  if (input.landingMeta) {
    session.attribution = { ...input.landingMeta, ...session.attribution };
    session.isGoogleAds = computeIsGoogleAds(session.attribution, input.landingMeta.isGoogleAds);
    session.source = classifySource(session.attribution, session.isGoogleAds);
  }
  session.lastSeenAt = now;
  session.lastEventAt = now;
  session.idle = false;

  const page = input.page ?? session.currentPage;
  if (/^\/media(?:\/|\?|$)/.test(page)) session.audience = "client";
  if (["whatsapp_clicked", "phone_revealed", "contact_clicked", "availability_checked"].includes(input.event)) session.hasContactIntent = true;
  if (input.event === "form_submitted" && input.meta?.kind === "contact" && input.meta?.confirmed === true) session.hasConfirmedLead = true;
  if (input.event === "page_view" && page !== session.currentPage) {
    session.currentPage = page;
    session.currentPageTitle = input.pageTitle ?? "";
    session.pageCount += 1;
    session.path.push({ page, at: now });
    if (session.path.length > PATH_CAP) session.path.splice(0, session.path.length - PATH_CAP);
  } else if (input.pageTitle) {
    session.currentPageTitle = input.pageTitle;
  }

  let meta = input.meta;
  if (typeof input.scrollDepth === "number" && Number.isFinite(input.scrollDepth)) {
    const depth = Math.min(100, Math.max(0, Math.round(input.scrollDepth)));
    session.scrollByPage[page] = Math.max(session.scrollByPage[page] ?? 0, depth);
    if (input.event === "scroll_depth") meta = { depth, ...(meta ?? {}) };
  }

  const event: LiveEvent = {
    id: newId(),
    name: input.event,
    at: now,
    page,
    priority: input.priority ?? "normal",
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(meta !== undefined ? { meta } : {}),
  };
  session.events.push(event);
  if (session.events.length > EVENTS_CAP) session.events.splice(0, session.events.length - EVENTS_CAP);

  liveVisitorsEmitter.emit("update", {
    type: "event",
    sessionId: session.sessionId,
    session: serializeSession(session),
    event,
  });

  schedulePersist(session);
  return { session, event };
}

export function ping(sessionId: string, visibility?: "visible" | "hidden"): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.lastSeenAt = Date.now();
  if (visibility) session.visibility = visibility;
  if (session.endedAt) {
    session.endedAt = null;
    session.endReason = null;
    session.endDurationSeconds = null;
  }
  // Connectivity is not interaction. A heartbeat must never clear inactivity.
  session.idle = session.lastSeenAt - session.lastEventAt > IDLE_AFTER_MS;
  liveVisitorsEmitter.emit("update", { type: "ping", sessionId, session: serializeSession(session) });
  schedulePersist(session);
}

export function endSession(sessionId: string, reason: string, durationSeconds?: number): void {
  const session = sessions.get(sessionId);
  if (!session || session.endedAt) return;
  const now = Date.now();
  session.endedAt = reason === "timeout" ? session.lastSeenAt : now;
  session.endReason = reason;
  const duration = typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds >= 0
    ? Math.round(durationSeconds)
    : Math.max(0, Math.round((session.endedAt - session.firstSeenAt) / 1000));
  session.endDurationSeconds = duration;

  const event: LiveEvent = {
    id: newId(),
    name: "session_ended",
    at: now,
    page: session.currentPage,
    priority: "normal",
    meta: { reason, durationSeconds: duration, pageCount: session.pageCount },
  };
  session.events.push(event);

  liveVisitorsEmitter.emit("update", {
    type: "session_ended",
    sessionId,
    reason,
    durationSeconds: duration,
    session: serializeSession(session),
    event,
  });

  flushPersist(session);
}

export function setSessionArchived(sessionId: string, archived: boolean): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.archived = archived;
  liveVisitorsEmitter.emit("update", { type: "archived", session: serializeSession(session) });
}

// ── Serialization ────────────────────────────────────────────────────────────

export function serializeSession(s: LiveSession) {
  return {
    sessionId: s.sessionId,
    visitorId: s.visitorId,
    isNew: s.isNew,
    visitorNumber: s.visitorNumber,
    firstSeenAt: s.firstSeenAt,
    lastSeenAt: s.lastSeenAt,
    lastEventAt: s.lastEventAt,
    endedAt: s.endedAt,
    endReason: s.endReason,
    durationSeconds: s.endDurationSeconds ?? Math.round(((s.endedAt ?? s.lastSeenAt) - s.firstSeenAt) / 1000),
    currentPage: s.currentPage,
    currentPageTitle: s.currentPageTitle,
    pageCount: s.pageCount,
    path: s.path,
    events: s.events,
    scrollByPage: s.scrollByPage,
    attribution: s.attribution,
    isGoogleAds: s.isGoogleAds,
    source: s.source,
    city: s.city,
    region: s.region,
    country: s.country,
    org: s.org,
    deviceType: s.deviceType,
    idle: s.idle,
    visibility: s.visibility,
    archived: s.archived ?? false,
    audience: s.audience ?? "prospect",
    hasContactIntent: s.hasContactIntent ?? false,
    hasConfirmedLead: s.hasConfirmedLead ?? false,
  };
}

export function getActiveSnapshot() {
  return Array.from(sessions.values())
    .sort((a, b) => b.firstSeenAt - a.firstSeenAt)
    .map(serializeSession);
}

// ── Firestore persistence ────────────────────────────────────────────────────

async function writeSession(session: LiveSession): Promise<void> {
  try {
    await firestore()
      .collection(LIVE_SESSIONS_COLLECTION)
      .doc(session.sessionId)
      .set(
        {
          ...serializeSession(session),
          ip: session.ip,
          ua: session.ua,
          updatedAt: FieldValue.serverTimestamp(),
          startedAtMs: session.firstSeenAt,
        },
        { merge: true },
      );
  } catch (error) {
    console.warn(`[live-visitors] persist failed for ${session.sessionId}:`, error);
  }
}

function schedulePersist(session: LiveSession): void {
  if (persistTimers.has(session.sessionId)) return;
  const timer = setTimeout(() => {
    persistTimers.delete(session.sessionId);
    void writeSession(session);
  }, PERSIST_DEBOUNCE_MS);
  persistTimers.set(session.sessionId, timer);
}

function flushPersist(session: LiveSession): void {
  const timer = persistTimers.get(session.sessionId);
  if (timer) { clearTimeout(timer); persistTimers.delete(session.sessionId); }
  void writeSession(session);
}

// ── Sweeper ──────────────────────────────────────────────────────────────────

let sweeper: NodeJS.Timeout | null = null;

export function startLiveVisitorsSweeper(): void {
  if (sweeper) return;
  sweeper = setInterval(() => {
    const now = Date.now();
    for (const session of sessions.values()) {
      if (!session.endedAt && now - session.lastSeenAt > HEARTBEAT_TIMEOUT_MS) {
        endSession(session.sessionId, "timeout");
        continue;
      }
      if (
        !session.endedAt &&
        !session.idle &&
        now - session.lastEventAt > IDLE_AFTER_MS
      ) {
        session.idle = true;
        const event: LiveEvent = {
          id: newId(),
          name: "visitor_idle",
          at: now,
          page: session.currentPage,
          priority: "low",
        };
        session.events.push(event);
        if (session.events.length > EVENTS_CAP) session.events.shift();
        schedulePersist(session);
        liveVisitorsEmitter.emit("update", {
          type: "event",
          sessionId: session.sessionId,
          session: serializeSession(session),
          event,
        });
      }
      if (session.endedAt && now - session.endedAt > KEEP_ENDED_MS) {
        sessions.delete(session.sessionId);
        const timer = persistTimers.get(session.sessionId);
        if (timer) { clearTimeout(timer); persistTimers.delete(session.sessionId); }
        liveVisitorsEmitter.emit("update", { type: "session_removed", sessionId: session.sessionId });
      }
    }
  }, SWEEP_INTERVAL_MS);
  if (typeof sweeper.unref === "function") sweeper.unref();
}

// Test helper — reset in-memory state between tests.
export function __resetLiveVisitors(): void {
  if (sweeper) clearInterval(sweeper);
  sweeper = null;
  sessions.clear();
  persistTimers.forEach((t) => clearTimeout(t));
  persistTimers.clear();
  visitorCounter = 0;
  liveVisitorsEmitter.removeAllListeners();
}
