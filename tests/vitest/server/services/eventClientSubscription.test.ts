/*
 * Purpose: the event client is auto-subscribed to its album on WhatsApp once, never twice,
 * never for an album shared by two events — with an in-memory Firestore.
 */
import { beforeEach, expect, test, vi } from "vitest";

type Doc = Record<string, any>;
let store: Record<string, Map<string, Doc>>;

function collection(name: string) {
  store[name] ??= new Map();
  const docs = store[name];
  const ref = (id: string) => ({
    id,
    get: async () => ({ exists: docs.has(id), id, data: () => docs.get(id) }),
    update: async (patch: Doc) => { docs.set(id, { ...docs.get(id), ...patch }); },
  });
  const query = (filters: [string, unknown][]) => ({
    where: (field: string, _op: string, value: unknown) => query([...filters, [field, value]]),
    get: async () => {
      const matches = [...docs.entries()].filter(([, d]) => filters.every(([f, v]) => d[f] === v));
      return { empty: matches.length === 0, docs: matches.map(([id, d]) => ({ id, data: () => d, ref: ref(id) })) };
    },
  });
  return {
    doc: ref,
    where: (field: string, op: string, value: unknown) => query([]).where(field, op, value),
    add: async (d: Doc) => { const id = `sub-${docs.size + 1}`; docs.set(id, d); return { id }; },
  };
}

beforeEach(() => {
  vi.resetModules();
  store = {};
  vi.doMock("src/server/firestore", () => ({ firestore: () => ({ collection }) }));
});

const event = (id: string, data: Doc) => { collection("adminEvents"); store.adminEvents.set(id, data); };
const subs = () => [...(store.albumSubscriptions ?? new Map()).values()];

test("subscribes the client phone on WhatsApp once, tagged as coming from the event", async () => {
  const { subscribeEventClient } = await import("src/server/services/eventClientSubscription");
  event("e1", { albumSlug: "16august2026", client: { fullName: "Petcu Diana", phone: "0746 000 000" } });

  expect(await subscribeEventClient("e1")).toEqual({ status: "subscribed", albumSlug: "16august2026", phone: "+40746000000" });
  expect(subs()).toEqual([expect.objectContaining({ phone: "+40746000000", name: "Petcu Diana", channels: ["whatsapp"], source: "event-client", eventId: "e1" })]);

  // Client unsubscribed (doc deleted) — a second run must not bring them back.
  store.albumSubscriptions.clear();
  expect(await subscribeEventClient("e1")).toEqual({ status: "already-done" });
  expect(subs()).toHaveLength(0);
});

test("adds WhatsApp to a client who already subscribed from the form, without a duplicate", async () => {
  const { subscribeEventClient } = await import("src/server/services/eventClientSubscription");
  event("e1", { albumSlug: "a", client: { phone: "0746000000" } });
  collection("albumSubscriptions").add({ albumSlug: "a", phone: "+40746000000", email: "x@y.ro", channels: ["email"] });

  expect((await subscribeEventClient("e1")).status).toBe("merged");
  expect(subs()).toEqual([expect.objectContaining({ channels: ["email", "whatsapp"], email: "x@y.ro" })]);
});

test("skips albums shared by two events and events without album or phone", async () => {
  const { subscribeEventClient } = await import("src/server/services/eventClientSubscription");
  event("e1", { albumSlug: "25iulie2026", client: { phone: "0746000000" } });
  event("e2", { albumSlug: "25iulie2026", client: { phone: "0755000000" } });
  event("e3", { client: { phone: "0746000000" } });
  event("e4", { albumSlug: "b", client: { phone: "" } });

  expect(await subscribeEventClient("e1")).toEqual({ status: "shared-album" });
  expect(await subscribeEventClient("e3")).toEqual({ status: "no-album" });
  expect(await subscribeEventClient("e4")).toEqual({ status: "no-phone" });
  expect(subs()).toHaveLength(0);
});
