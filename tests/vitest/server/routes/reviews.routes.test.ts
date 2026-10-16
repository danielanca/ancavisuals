import { beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({ store: new Map<string, any>() }));
function doc(collection: string, id: string) {
  const key = `${collection}/${id}`;
  return {
    id, key,
    get: async () => ({ id, exists: state.store.has(key), data: () => state.store.get(key) }),
    update: async (data: any) => { state.store.set(key, { ...state.store.get(key), ...data }); },
  };
}
vi.mock("src/server/firestore", () => ({ firestore: () => ({
  collection: (collection: string) => ({
    doc: (id: string) => doc(collection, id),
    where: (field: string, operator: string, values: string[]) => ({ get: async () => ({ docs: [...state.store.entries()]
      .filter(([key, data]) => key.startsWith(`${collection}/`) && values.includes(data[field]))
      .map(([key, data]) => ({ id: key.split("/")[1], data: () => data })) }) }),
    add: async (data: any) => { const ref = doc(collection, "manual-review"); state.store.set(ref.key, data); return ref; },
  }),
  runTransaction: async (fn: any) => {
    const writes: (() => void)[] = [];
    const result = await fn({
      get: (ref: any) => ref.get(),
      set: (ref: any, data: any) => writes.push(() => state.store.set(ref.key, data)),
      update: (ref: any, data: any) => writes.push(() => state.store.set(ref.key, { ...state.store.get(ref.key), ...data })),
      delete: (ref: any) => writes.push(() => state.store.delete(ref.key)),
    });
    writes.forEach(write => write()); return result;
  },
}) }));
vi.mock("src/server/middleware/requireFirebaseAuth", () => ({
  requireFirebaseAuth: (req: any, res: any, next: any) => req.headers.authorization ? next() : res.status(401).json({ error: "Unauthorized" }),
  requireSupremeAdmin: (req: any, res: any, next: any) => req.admin ? next() : res.status(403).json({ error: "Forbidden" }),
}));
import router from "src/server/routes/reviews.routes";
async function call(method: string, path: string, request: any = {}) {
  const layer = (router as any).stack.find((entry: any) => entry.route?.path === path && entry.route.methods[method]);
  const req = { params: {}, body: {}, query: {}, headers: {}, ...request };
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
const sourceId = "feedback-request-0001";
const admin = { admin: true, headers: { authorization: "Bearer test" } };
const body = { author: "Client", text: "Mesaj public", rating: "0", category: "both", offerSlug: "olx", sourceFeedbackId: sourceId };
beforeEach(() => {
  state.store.clear();
  state.store.set(`clientFeedback/${sourceId}`, { name: "Client", message: "Original privat", albumSlug: "privat", read: false });
});

test("manual reviews remain supported; feedback publication is owner-only", async () => {
  expect((await call("post", "/admin", { body })).statusCode).toBe(401);
  expect((await call("post", "/admin", { headers: admin.headers, body })).statusCode).toBe(403);
  expect(state.store.size).toBe(1);
  expect((await call("post", "/admin", { ...admin, body: { author: "Manual", text: "Text", rating: "5", category: "wedding" } })).statusCode).toBe(201);
  expect(state.store.get("siteReviews/manual-review")).toMatchObject({ author: "Manual", rating: 5, category: "wedding" });
});

test("accepts feedback atomically once, preserves original, and exposes it in selected zones only", async () => {
  const result = await call("post", "/admin", { ...admin, body });
  expect(result.statusCode).toBe(201);
  expect(result.body.review).toMatchObject({ rating: null, category: "both", offerSlug: "olx", text: "Mesaj public" });
  expect(state.store.get(`clientFeedback/${sourceId}`)).toMatchObject({ message: "Original privat", read: true, publishedReviewId: `feedback-${sourceId}` });
  expect((await call("post", "/admin", { ...admin, body })).statusCode).toBe(409);
  const home = await call("get", "/", { query: { category: "wedding" } });
  const olx = await call("get", "/", { query: { category: "oferta", offerSlug: "olx" } });
  expect(home.body.reviews).toHaveLength(1); expect(olx.body.reviews).toHaveLength(1);
  expect(JSON.stringify(home.body)).not.toMatch(/Original privat|albumSlug|sourceFeedbackId/);
  expect((await call("get", "/", { query: { category: "oferta", offerSlug: "other" } })).body.reviews).toHaveLength(0);
});

test("missing or invalid feedback cannot be published; pending feedback stays private", async () => {
  expect((await call("get", "/", { query: { category: "wedding" } })).body.reviews).toEqual([]);
  expect((await call("post", "/admin", { ...admin, body: { ...body, sourceFeedbackId: "missing-feedback-0001" } })).statusCode).toBe(404);
  expect((await call("post", "/admin", { ...admin, body: { ...body, sourceFeedbackId: "../bad" } })).statusCode).toBe(400);
  expect(state.store.size).toBe(1);
});

test("removing an accepted review unpublishes it while keeping private feedback available", async () => {
  await call("post", "/admin", { ...admin, body });
  const id = `feedback-${sourceId}`;
  expect((await call("delete", "/admin/:id", { params: { id } })).statusCode).toBe(401);
  expect((await call("delete", "/admin/:id", { ...admin, params: { id } })).statusCode).toBe(200);
  expect(state.store.has(`siteReviews/${id}`)).toBe(false);
  expect(state.store.get(`clientFeedback/${sourceId}`)).toMatchObject({ message: "Original privat", publishedReviewId: null });
  expect((await call("post", "/admin", { ...admin, body })).statusCode).toBe(201);
});

test("drafts stay in admin only until published; reviews without status remain public", async () => {
  expect((await call("post", "/admin", { ...admin, body: { author: "Draft", text: "Text draft", rating: "5", category: "wedding", status: "draft" } })).body.review).toMatchObject({ status: "draft" });
  state.store.set("siteReviews/legacy", { author: "Veche", text: "Fără status", category: "wedding", date: "2025-01-01", order: 1 });
  const publicAuthors = async () => (await call("get", "/", { query: { category: "wedding" } })).body.reviews.map((review: any) => review.author);
  expect(await publicAuthors()).toEqual(["Veche"]);

  expect((await call("put", "/admin/:id", { headers: admin.headers, params: { id: "manual-review" }, body: { status: "published" } })).statusCode).toBe(403);
  const published = await call("put", "/admin/:id", { ...admin, params: { id: "manual-review" }, body: { status: "published" } });
  expect(published.body.review).toMatchObject({ author: "Draft", text: "Text draft", status: "published" });
  expect(await publicAuthors()).toEqual(["Draft", "Veche"]);

  await call("put", "/admin/:id", { ...admin, params: { id: "manual-review" }, body: { status: "draft" } });
  expect(await publicAuthors()).toEqual(["Veche"]);
});

test("feedback can be accepted as a draft without appearing publicly", async () => {
  const result = await call("post", "/admin", { ...admin, body: { ...body, status: "draft" } });
  expect(result.body.review).toMatchObject({ status: "draft" });
  expect(state.store.get(`clientFeedback/${sourceId}`)).toMatchObject({ publishedReviewId: `feedback-${sourceId}` });
  expect((await call("get", "/", { query: { category: "oferta", offerSlug: "olx" } })).body.reviews).toHaveLength(0);
});
