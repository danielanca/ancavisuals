import { beforeEach, describe, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({ store: new Map<string, any>(), ai: vi.fn(), album: vi.fn() }));
function doc(collection: string, id: string) {
  const key = `${collection}/${id}`;
  return { key, id, get: async () => ({ id, exists: state.store.has(key), data: () => state.store.get(key) }) };
}
vi.mock("src/server/firestore", () => ({ firestore: () => ({
  collection: (collection: string) => ({
    doc: (id: string) => doc(collection, id),
    orderBy: () => {
      let cursor = ""; let limit = 50;
      const query = {
        limit: (value: number) => { limit = value; return query; },
        startAfter: (value: any) => { cursor = value.id; return query; },
        get: async () => {
          const docs = [...state.store.entries()].filter(([key]) => key.startsWith(`${collection}/`)).map(([key, data]) => ({ id: key.split("/")[1], data: () => data })).sort((a, b) => b.data().createdAt.localeCompare(a.data().createdAt));
          const start = cursor ? docs.findIndex(item => item.id === cursor) + 1 : 0;
          return { docs: docs.slice(start, start + limit) };
        },
      }; return query;
    },
  }),
  runTransaction: async (fn: any) => {
    const writes: (() => void)[] = [];
    const result = await fn({ get: (ref: any) => ref.get(), set: (ref: any, data: any) => writes.push(() => state.store.set(ref.key, data)), update: (ref: any, data: any) => writes.push(() => state.store.set(ref.key, { ...state.store.get(ref.key), ...data })) });
    writes.forEach(write => write()); return result;
  },
}) }));
vi.mock("src/server/services/album.service", () => ({ loadAlbum: state.album, resolveAlbumSlug: async (slug: string) => slug === "8august2026" ? "08august2026" : slug }));
vi.mock("src/server/services/feedbackAi.service", async importOriginal => ({ ...await importOriginal<any>(), generateFeedbackVariants: state.ai }));
vi.mock("src/server/middleware/requireFirebaseAuth", () => ({
  requireFirebaseAuth: (req: any, res: any, next: any) => req.headers?.authorization ? next() : res.status(401).json({ error: "Token lipsă" }),
  requireSupremeAdmin: (req: any, res: any, next: any) => req.admin ? next() : res.status(403).json({ error: "Acces interzis" }),
}));
import router from "src/server/routes/feedback.routes";
import { FeedbackAiUnavailableError } from "src/server/services/feedbackAi.service";
async function call(method: string, path: string, request: any = {}) {
  const layer = (router as any).stack.find((entry: any) => entry.route?.path === path && entry.route.methods[method]);
  const req = { params: { slug: "2026" }, body: {}, query: {}, ip: "127.0.0.1", ...request };
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.body = data; return res; };
  async function run(index: number): Promise<void> {
    const handler = layer.route.stack[index]?.handle;
    if (!handler) return;
    let next = false; await handler(req, res, () => { next = true; });
    if (next) await run(index + 1);
  }
  await run(0); return res;
}
const payload = { name: " Ana ", message: " Ne-au plăcut pozele. ", requestId: "test-request-id-00001" };
const admin = { admin: true, headers: { authorization: "Bearer admin" } };
beforeEach(() => {
  state.store.clear(); state.album.mockReset().mockResolvedValue({ photos: [] });
  state.ai.mockReset().mockResolvedValue(Array.from({ length: 7 }, (_, index) => `Varianta ${index + 1}`));
  vi.stubEnv("ANTHROPIC_API_KEY", "fake-test-key");
});
describe("album feedback", () => {
  test("stores only named feedback for the canonical album; public response does not expose data", async () => {
    const result = await call("post", "/:slug", { params: { slug: "8august2026" }, body: { ...payload, read: true, albumSlug: "other", createdAt: "forged" } });
    expect(result.statusCode).toBe(201); expect(result.body).toEqual({ ok: true });
    expect(state.store.get(`clientFeedback/${payload.requestId}`)).toMatchObject({ albumSlug: "08august2026", name: "Ana", message: "Ne-au plăcut pozele.", read: false });
    expect(state.ai).not.toHaveBeenCalled();
  });
  test("rejects missing/oversized fields, invalid IDs and bot submissions", async () => {
    for (const overrides of [{ name: "" }, { message: " " }, { name: "a".repeat(101) }, { message: "a".repeat(3001) }, { requestId: "../invalid" }, { website: "spam" }]) {
      expect((await call("post", "/:slug", { body: { ...payload, ...overrides } })).statusCode).toBe(400);
    }
    expect(state.store.size).toBe(0);
  });
  test("rejects invalid or missing albums without calling AI or saving", async () => {
    expect((await call("post", "/:slug", { params: { slug: "../bad" }, body: payload })).statusCode).toBe(400);
    state.album.mockResolvedValue(null);
    expect((await call("post", "/:slug", { body: payload })).statusCode).toBe(404);
    expect((await call("post", "/:slug/variants", { body: { message: "Idei proprii" } })).statusCode).toBe(404);
    expect(state.ai).not.toHaveBeenCalled(); expect(state.store.size).toBe(0);
  });
  test("retry is idempotent and cannot overwrite another album's feedback", async () => {
    await call("post", "/:slug", { body: payload });
    expect((await call("post", "/:slug", { body: payload })).statusCode).toBe(201);
    expect([...state.store.keys()].filter(key => key.startsWith("clientFeedback/"))).toHaveLength(1);
    expect([...state.store.values()].find(item => "count" in item).count).toBe(1);
    expect((await call("post", "/:slug", { params: { slug: "other" }, body: payload })).statusCode).toBe(409);
    expect((await call("post", "/:slug", { body: { ...payload, message: "Alt text" } })).statusCode).toBe(409);
  });
  test("limits submissions and AI separately and resets after an hour", async () => {
    vi.useFakeTimers();
    try {
      for (let index = 0; index < 5; index++) expect((await call("post", "/:slug", { body: { ...payload, requestId: `test-request-id-${index.toString().padStart(5, "0")}` } })).statusCode).toBe(201);
      expect((await call("post", "/:slug", { body: { ...payload, requestId: "sixth-request-id-0000" } })).statusCode).toBe(429);
      expect((await call("post", "/:slug/variants", { body: { message: "Poze frumoase" } })).statusCode).toBe(200);
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);
      expect((await call("post", "/:slug", { body: { ...payload, requestId: "sixth-request-id-0000" } })).statusCode).toBe(201);
    } finally { vi.useRealTimers(); }
  });
  test("AI returns 7 variants without saving feedback and uses only client's words", async () => {
    const result = await call("post", "/:slug/variants", { body: { name: "Private name", message: " Fotografii bune, livrarea cam lentă. " } });
    expect(result.body.variants).toHaveLength(7);
    expect(state.ai).toHaveBeenCalledWith("Fotografii bune, livrarea cam lentă.");
    expect([...state.store.keys()].some(key => key.startsWith("clientFeedback/"))).toBe(false);
    for (let index = 0; index < 4; index++) await call("post", "/:slug/variants", { body: { message: "Ideile mele" } });
    expect((await call("post", "/:slug/variants", { body: { message: "Ideile mele" } })).statusCode).toBe(429);
    expect(state.ai).toHaveBeenCalledTimes(5);
  });
  test("AI failure/missing key never prevents manual feedback submission", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await call("post", "/:slug/variants", { body: { message: "Text client" } })).statusCode).toBe(503);
    vi.stubEnv("ANTHROPIC_API_KEY", "fake-test-key"); state.ai.mockRejectedValue(new Error("upstream failure"));
    expect((await call("post", "/:slug/variants", { body: { message: "Text client" } })).statusCode).toBe(500);
    expect((await call("post", "/:slug", { body: payload })).statusCode).toBe(201);
  });
  test("credit exhaustion returns useful 503 and leaves manual submission available", async () => {
    state.ai.mockRejectedValue(new FeedbackAiUnavailableError("insufficient_credits"));
    const result = await call("post", "/:slug/variants", { body: { message: "Text client" } });
    expect(result.statusCode).toBe(503);
    expect(result.body.error).toContain("Poți scrie și trimite feedback-ul direct");
    expect(JSON.stringify(result.body)).not.toMatch(/insufficient_credits|request_id|api_key/);
    expect((await call("post", "/:slug", { body: payload })).statusCode).toBe(201);
  });
  test("only owner can read/mark feedback; no public read route exists", async () => {
    await call("post", "/:slug", { body: payload });
    expect((await call("get", "/admin/all")).statusCode).toBe(401);
    expect((await call("get", "/admin/all", { headers: admin.headers })).statusCode).toBe(403);
    expect((await call("get", "/admin/all", admin)).body.feedback[0]).toMatchObject({ name: "Ana", read: false });
    expect((await call("patch", "/admin/:id/read", { params: { id: payload.requestId } })).statusCode).toBe(401);
    expect((await call("patch", "/admin/:id/read", { ...admin, params: { id: payload.requestId } })).statusCode).toBe(200);
    expect(state.store.get(`clientFeedback/${payload.requestId}`).read).toBe(true);
    expect((router as any).stack.some((entry: any) => entry.route?.path === "/:slug" && entry.route.methods.get)).toBe(false);
  });
  test("paginates admin history without exposing rate-limit documents", async () => {
    for (let index = 0; index < 51; index++) state.store.set(`clientFeedback/history-request-${index.toString().padStart(4, "0")}`, { name: `Client ${index}`, albumSlug: "2026", message: "Feedback", read: false, createdAt: new Date(2026, 0, index + 1).toISOString() });
    const first = await call("get", "/admin/all", admin);
    expect(first.body.feedback).toHaveLength(50);
    const next = await call("get", "/admin/all", { ...admin, query: { cursor: first.body.nextCursor } });
    expect(next.body.feedback).toHaveLength(1); expect(next.body.nextCursor).toBeNull();
  });
});
