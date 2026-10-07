import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { emptyBriefAnswers } from "src/shared/clientBrief/clientBrief";

const state = vi.hoisted(() => ({ store: new Map<string, any>() }));
function ref(collection: string, id: string) {
  const key = `${collection}/${id}`;
  return { key, get: async () => ({ exists: state.store.has(key), data: () => state.store.get(key) }) };
}
vi.mock("src/server/firestore", () => ({ firestore: () => ({
  collection: (name: string) => ({
    doc: (id: string) => ref(name, id),
    get: async () => ({ docs: [...state.store.entries()].filter(([key]) => key.startsWith(`${name}/`)).map(([key, data]) => ({ id: key.slice(name.length + 1), data: () => data })) }),
  }),
  runTransaction: async (fn: any) => {
    const writes: (() => void)[] = [];
    const result = await fn({
      get: (r: any) => r.get(),
      set: (r: any, value: any) => writes.push(() => state.store.set(r.key, value)),
      update: (r: any, value: any) => writes.push(() => state.store.set(r.key, { ...state.store.get(r.key), ...value })),
    });
    writes.forEach(write => write());
    return result;
  },
}) }));
vi.mock("src/server/middleware/requireFirebaseAuth", () => ({
  requireFirebaseAuth: (req: any, res: any, next: any) => req.headers?.authorization === "Bearer admin" ? next() : res.status(401).json({ error: "Token lipsă" }),
  requireSupremeAdmin: (req: any, res: any, next: any) => req.admin ? next() : res.status(403).json({ error: "Acces interzis" }),
}));
import router from "src/server/routes/clientBrief.routes";
async function call(method: string, path: string, request: any = {}) {
  const layer = (router as any).stack.find((entry: any) => entry.route?.path === path && entry.route.methods[method]);
  const res: any = { statusCode: 200, body: null, headers: {} };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.body = data; return res; };
  res.set = (key: string, value: string) => { res.headers[key] = value; return res; };
  const req = { params: {}, body: {}, ...request };
  async function run(index: number): Promise<void> {
    const handler = layer.route.stack[index]?.handle;
    if (!handler) return;
    let nextCalled = false;
    await handler(req, res, () => { nextCalled = true; });
    if (nextCalled) await run(index + 1);
  }
  await run(0);
  return res;
}
const admin = { headers: { authorization: "Bearer admin" }, admin: true };
async function create(eventId = "wedding") {
  return call("post", "/admin/events/:eventId", { ...admin, params: { eventId } });
}
beforeEach(() => {
  state.store.clear();
  state.store.set("adminEvents/wedding", {
    client: { fullName: "Ana și Andrei", phone: "secret-phone", email: "secret-email" },
    type: "Nuntă", eventDate: { toDate: () => new Date("2027-06-20T00:00:00Z") }, pricing: { total: 1200 }, notes: "private admin notes",
  });
});
afterEach(() => vi.useRealTimers());
describe("event client briefs", () => {
  test("requires authenticated owner for creation and admin answers", async () => {
    expect((await call("post", "/admin/events/:eventId", { params: { eventId: "wedding" } })).statusCode).toBe(401);
    expect((await call("post", "/admin/events/:eventId", { headers: admin.headers, params: { eventId: "wedding" } })).statusCode).toBe(403);
    expect((await call("get", "/admin/events/:eventId", { params: { eventId: "wedding" } })).statusCode).toBe(401);
    expect(state.store.has("eventClientBriefs/wedding")).toBe(false);
  });
  test("creates a unique per-event link and reuses it without clearing answers", async () => {
    const first = await create();
    expect(first.statusCode).toBe(200);
    expect(first.body.brief).toMatchObject({ clientName: "Ana și Andrei", eventDate: "2027-06-20T00:00:00.000Z", status: "draft" });
    expect(first.body.brief.url).toMatch(/^\/brief-client\/[a-f0-9]{64}$/);
    const saved = state.store.get("eventClientBriefs/wedding");
    saved.answers.priorities = "Bunicii";
    expect((await create()).body.brief).toMatchObject({ url: first.body.brief.url, answers: { priorities: "Bunicii" } });
    state.store.set("adminEvents/other", { type: "Botez", client: { fullName: "Alt client" } });
    const other = await create("other");
    expect(other.body.brief.url).not.toBe(first.body.brief.url);
    expect(other.body.brief.moments.some((m: any) => m.id === "brideHome")).toBe(false);
  });
  test("missing event cannot create orphan brief", async () => {
    expect((await create("missing")).statusCode).toBe(404);
    expect(state.store.has("eventClientBriefs/missing")).toBe(false);
  });
  test("public access returns only the brief and no private event fields", async () => {
    const created = await create();
    const token = created.body.brief.url.split("/").pop();
    const result = await call("get", "/:token", { params: { token } });
    expect(result.statusCode).toBe(200);
    expect(result.headers["Cache-Control"]).toBe("no-store");
    expect(JSON.stringify(result.body)).not.toMatch(/secret|private admin|pricing|token|url/);
    expect((await call("get", "/:token", { params: { token: "wedding" } })).statusCode).toBe(404);
    expect((await call("get", "/:token", { params: { token: "a".repeat(64) } })).statusCode).toBe(404);
  });
  test("saves, submits, resumes and exposes the same answers in admin", async () => {
    const created = await create();
    const token = created.body.brief.url.split("/").pop();
    const answers = { ...emptyBriefAnswers(), priorities: "Bunicii și slujba", groupPhotos: "Cu fiecare familie", importantPeople: "Maria, bunica", moments: { religious: { presence: "yes", coverage: "full", details: "Toată slujba" } } };
    const draft = await call("put", "/:token", { params: { token }, body: { answers, status: "draft", revision: 0 } });
    expect(draft.body.brief).toMatchObject({ status: "draft", revision: 1, submittedAt: null });
    const completed = await call("put", "/:token", { params: { token }, body: { answers, status: "completed", revision: 1 } });
    expect(completed.body.brief).toMatchObject({ status: "completed", revision: 2, answers });
    expect(completed.body.brief.submittedAt).toBeTruthy();
    const owner = await call("get", "/admin/events/:eventId", { ...admin, params: { eventId: "wedding" } });
    expect(owner.body.brief.answers).toEqual(answers);
    const publicAgain = await call("get", "/:token", { params: { token } });
    expect(publicAgain.body.brief.answers).toEqual(answers);
    expect((await create()).body.brief.status).toBe("completed");
  });
  test("rejects empty submissions, oversized answers and stale changes without overwriting", async () => {
    const created = await create();
    const token = created.body.brief.url.split("/").pop();
    const send = (body: any) => call("put", "/:token", { params: { token }, body });
    expect((await send({ answers: emptyBriefAnswers(), status: "completed", revision: 0 })).statusCode).toBe(400);
    expect((await send({ answers: { ...emptyBriefAnswers(), priorities: "a".repeat(5001) }, status: "draft", revision: 0 })).statusCode).toBe(400);
    expect((await send({ answers: emptyBriefAnswers(), status: "draft", revision: 0 })).statusCode).toBe(200);
    expect((await send({ answers: { ...emptyBriefAnswers(), priorities: "Stale" }, status: "draft", revision: 0 })).statusCode).toBe(409);
    expect(state.store.get("eventClientBriefs/wedding").answers.priorities).toBe("");
  });
  test("link stops working when event is deleted", async () => {
    const created = await create();
    const token = created.body.brief.url.split("/").pop();
    state.store.delete("adminEvents/wedding");
    expect((await call("get", "/:token", { params: { token } })).statusCode).toBe(404);
    expect((await call("put", "/:token", { params: { token }, body: { answers: emptyBriefAnswers(), status: "draft", revision: 0 } })).statusCode).toBe(404);
  });
});

describe("today's event briefs", () => {
  test("requires owner authentication before reading today's client details", async () => {
    expect((await call("get", "/admin/today")).statusCode).toBe(401);
    expect((await call("get", "/admin/today", { headers: admin.headers })).statusCode).toBe(403);
  });
  test("uses Romanian today, exact contract dates and legacy ranges, with saved brief answers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T22:30:00Z")); // Already 6 October in Romania.
    const event = (extra: any = {}) => ({ status: "confirmat", type: "Nuntă", eventDate: "2026-10-06", client: { fullName: "Client", phone: "0700000000" }, ...extra });
    state.store.set("adminEvents/wedding", event({ client: { fullName: "Ana și Andrei", phone: "0700000000" }, services: [{ name: "Foto", price: 1000 }] }));
    const created = await create();
    const token = created.body.brief.url.split("/").pop();
    const answers = { ...emptyBriefAnswers(), priorities: "Bunicii", importantPeople: "Maria", groupPhotos: "Cu fiecare familie" };
    await call("put", "/:token", { params: { token }, body: { answers, status: "completed", revision: 0 } });
    state.store.set("adminEvents/range", event({ eventDate: "2026-10-05", eventEndDate: "2026-10-07" }));
    state.store.set("adminEvents/exact", event({ eventDate: "2026-10-01", eventEndDate: "2026-10-10", eventDates: ["2026-10-01", "2026-10-06", "2026-10-10"] }));
    state.store.set("adminEvents/gap", event({ eventDate: "2026-10-05", eventEndDate: "2026-10-07", eventDates: ["2026-10-05", "2026-10-07"] }));
    state.store.set("adminEvents/canceled", event({ status: "anulat" }));
    state.store.set("adminEvents/lead", event({ status: "lead" }));
    state.store.set("adminEvents/tentative", event({ status: "tentativ" }));
    state.store.set("adminEvents/next", event({ eventDate: "2026-10-07" }));
    const response = await call("get", "/admin/today", admin);
    expect(response.statusCode).toBe(200);
    expect(response.headers["Cache-Control"]).toBe("no-store");
    expect(response.body.day).toBe("2026-10-06");
    expect(response.body.events.map((e: any) => e.id).sort()).toEqual(["exact", "range", "wedding"]);
    expect(response.body.events.find((e: any) => e.id === "wedding")).toMatchObject({ services: ["Foto"], brief: { status: "completed", answers } });
    expect(response.body.events.find((e: any) => e.id === "range").brief).toBeNull();
    expect(JSON.stringify(response.body)).not.toMatch(/price|token|url/);
  });
  test("returns no events on a day without confirmed bookings", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-06T10:00:00Z"));
    expect((await call("get", "/admin/today", admin)).body).toEqual({ day: "2026-10-06", events: [] });
  });
});
