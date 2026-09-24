/*
 * Purpose: verifies the in-memory live-visitor store — session creation,
 * visitor numbering, page navigation, event cap, idle/timeout via the sweeper,
 * and end-of-session — without touching Firestore.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { restoreGet } = vi.hoisted(() => ({ restoreGet: vi.fn() }));

vi.mock("src/server/firestore", () => ({
  firestore: () => ({
    collection: () => ({ doc: () => ({ set: vi.fn().mockResolvedValue(undefined), get: restoreGet }) }),
  }),
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "ts" },
}));

import {
  restoreSession,
  startLiveVisitorsSweeper,
  recordEvent,
  ping,
  endSession,
  getActiveSnapshot,
  liveVisitorsEmitter,
  __resetLiveVisitors,
} from "src/server/services/liveVisitors.service";

const ctx = { ip: "8.8.8.8", ua: "Mozilla/5.0 (Macintosh)", geo: { city: "Cluj", country: "RO" } };

describe("liveVisitors.service", () => {
  beforeEach(() => {
    __resetLiveVisitors();
  });

  afterEach(() => { __resetLiveVisitors(); vi.useRealTimers(); });

  test("restores the stored journey after a restart before appending an event", async () => {
    const old = recordEvent({ sessionId: "persisted", event: "page_view", page: "/blog/example", landingMeta: { utmSource: "chatgpt" } }, ctx);
    const stored = { ...getActiveSnapshot()[0], archived: true };
    __resetLiveVisitors();
    restoreGet.mockResolvedValue({ exists: true, data: () => stored });
    await Promise.all([restoreSession("persisted"), restoreSession("persisted")]);
    recordEvent({ sessionId: "persisted", event: "page_view", page: "/contact" }, ctx);
    const [session] = getActiveSnapshot();
    expect(restoreGet).toHaveBeenCalledTimes(1);
    expect(session.firstSeenAt).toBe(old.session.firstSeenAt);
    expect(session.path.map((p) => p.page)).toEqual(["/blog/example", "/contact"]);
    expect(session.source).toBe("ai");
    expect(session.archived).toBe(true);
  });

  test("contact intent survives the event retention cap", () => {
    recordEvent({ sessionId: "s", event: "whatsapp_clicked" }, ctx);
    for (let i = 0; i < 220; i++) recordEvent({ sessionId: "s", event: "scroll_depth" }, ctx);
    expect(getActiveSnapshot()[0].hasContactIntent).toBe(true);
  });

  test("heartbeat preserves inactivity and publishes the revived session", () => {
    vi.useFakeTimers();
    recordEvent({ sessionId: "idle", event: "page_view" }, ctx);
    vi.advanceTimersByTime(61000);
    const spy = vi.fn();
    liveVisitorsEmitter.on("update", spy);
    ping("idle", "hidden");
    expect(getActiveSnapshot()[0]).toMatchObject({ idle: true, visibility: "hidden" });
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ type: "ping", session: expect.objectContaining({ idle: true }) }));
  });

  test("timeout stops at the last heartbeat, not the timeout detection time", () => {
    vi.useFakeTimers();
    recordEvent({ sessionId: "s", event: "page_view" }, ctx);
    vi.advanceTimersByTime(10000);
    ping("s");
    startLiveVisitorsSweeper();
    vi.advanceTimersByTime(80000);
    expect(getActiveSnapshot()[0]).toMatchObject({ endReason: "timeout", durationSeconds: 10 });
    ping("s");
    expect(getActiveSnapshot()[0]).toMatchObject({ endedAt: null, durationSeconds: 90 });
  });

  test("late arrival of attribution repairs a session started by another event", () => {
    recordEvent({ sessionId: "s", event: "element_clicked" }, ctx);
    recordEvent({ sessionId: "s", event: "session_started", landingMeta: { utmSource: "chatgpt" } }, ctx);
    expect(getActiveSnapshot()[0].source).toBe("ai");
  });

  test("first event creates a session with an incrementing visitor number", () => {
    const a = recordEvent({ sessionId: "s1", event: "session_started", page: "/" }, ctx);
    const b = recordEvent({ sessionId: "s2", event: "session_started", page: "/oferta" }, ctx);
    expect(a.session.visitorNumber).toBe(1);
    expect(b.session.visitorNumber).toBe(2);
    expect(a.session.city).toBe("Cluj");
    expect(getActiveSnapshot()).toHaveLength(2);
  });

  test("page_view advances the path and page count", () => {
    recordEvent({ sessionId: "s1", event: "session_started", page: "/" }, ctx);
    recordEvent({ sessionId: "s1", event: "page_view", page: "/oferta", pageTitle: "Ofertă" }, ctx);
    recordEvent({ sessionId: "s1", event: "page_view", page: "/portfolio" }, ctx);
    const [session] = getActiveSnapshot();
    expect(session.pageCount).toBe(3);
    expect(session.path.map((p) => p.page)).toEqual(["/", "/oferta", "/portfolio"]);
    expect(session.currentPage).toBe("/portfolio");
  });

  test("google ads attribution is detected from gclid", () => {
    const { session } = recordEvent(
      { sessionId: "g1", event: "session_started", page: "/oferta", landingMeta: { gclid: "abc123" } },
      ctx,
    );
    expect(session.isGoogleAds).toBe(true);
    expect(session.source).toBe("google_ads");
  });

  test("events are capped and a snapshot is emitted", () => {
    const spy = vi.fn();
    liveVisitorsEmitter.on("update", spy);
    for (let i = 0; i < 260; i++) {
      recordEvent({ sessionId: "s1", event: "scroll_depth", page: "/", scrollDepth: i }, ctx);
    }
    const [session] = getActiveSnapshot();
    expect(session.events.length).toBeLessThanOrEqual(200);
    expect(spy).toHaveBeenCalled();
  });

  test("endSession emits session_ended with a duration and reason", () => {
    const events: string[] = [];
    liveVisitorsEmitter.on("update", (p: { type: string }) => events.push(p.type));
    recordEvent({ sessionId: "s1", event: "session_started", page: "/" }, ctx);
    endSession("s1", "left", 134);
    const [session] = getActiveSnapshot();
    expect(session.endedAt).not.toBeNull();
    expect(session.endReason).toBe("left");
    expect(session.durationSeconds).toBe(134);
    expect(events).toContain("session_ended");
  });

  test("ping after a timeout revives the session", () => {
    recordEvent({ sessionId: "s1", event: "session_started", page: "/" }, ctx);
    endSession("s1", "timeout");
    ping("s1");
    const [session] = getActiveSnapshot();
    expect(session.endedAt).toBeNull();
  });
});
