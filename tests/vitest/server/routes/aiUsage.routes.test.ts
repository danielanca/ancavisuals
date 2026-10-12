import { beforeEach, expect, test, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

const state = vi.hoisted(() => ({ store: new Map<string, Record<string, unknown>>(), fail: false }));
type Doc = { id: string; exists: boolean; data: () => Record<string, unknown> };
vi.mock("src/server/firestore", () => ({ firestore: () => ({ collection: (name: string) => {
  expect(name).toBe("aiUsageHistory");
  return {
    doc: (id: string) => ({ get: async (): Promise<Doc> => ({ id, exists: state.store.has(id), data: () => state.store.get(id)! }) }),
    orderBy: () => {
      let start = "", end = "", cursor: Doc | null = null, limit = 51;
      const query = {
        where: (_field: string, operator: string, value: string) => { if (operator === ">=") start = value; else end = value; return query; },
        startAfter: (value: Doc) => { cursor = value; return query; },
        limit: (value: number) => { limit = value; return query; },
        get: async () => {
          if (state.fail) throw new Error("private database details");
          let docs = [...state.store].map(([id, data]) => ({ id, exists: true, data: () => data })).sort((a, b) => String(b.data().createdAt).localeCompare(String(a.data().createdAt)));
          if (cursor) docs = docs.slice(docs.findIndex(doc => doc.id === cursor!.id) + 1);
          docs = docs.filter(doc => (!start || String(doc.data().createdAt) >= start) && (!end || String(doc.data().createdAt) < end));
          return { docs: docs.slice(0, limit) };
        },
      }; return query;
    },
  };
} }) }));
vi.mock("src/server/middleware/requireFirebaseAuth", () => ({
  requireFirebaseAuth: (req: Request, res: Response, next: NextFunction) => req.headers.authorization ? next() : res.status(401).json({ error: "Token lipsă" }),
  requireSupremeAdmin: (req: Request, res: Response, next: NextFunction) => req.headers["x-test-admin"] ? next() : res.status(403).json({ error: "Acces interzis" }),
}));
import router from "src/server/routes/aiUsage.routes";
async function call(query: Record<string, unknown> = {}, auth: "admin" | "member" | "none" = "admin") {
  const layer = router.stack.find(entry => entry.route?.path === "/");
  const req = { query, headers: auth === "none" ? {} : { authorization: "Bearer test", ...(auth === "admin" ? { "x-test-admin": "yes" } : {}) } } as unknown as Request;
  let code = 200; let body: Record<string, unknown> = {}; const headers: Record<string, string> = {};
  const res = {
    status: (value: number) => { code = value; return res; },
    json: (value: Record<string, unknown>) => { body = value; return res; },
    set: (name: string, value: string) => { headers[name] = value; return res; },
  };
  for (const entry of layer.route.stack) {
    let next = false;
    await entry.handle(req, res, () => { next = true; });
    if (!next) break;
  }
  return { code, body, headers };
}
beforeEach(() => { state.store.clear(); state.fail = false; });
test("history is owner-only", async () => {
  expect((await call({}, "none")).code).toBe(401);
  expect((await call({}, "member")).code).toBe(403);
});
test("paginates without losing identical timestamp records and whitelists fields", async () => {
  for (let i = 0; i < 51; i++) state.store.set(`record-${i}`, { createdAt: "2026-10-12T10:00:00.000Z", feature: "Extras", inputTokens: 10, prompt: "PRIVATE", apiKey: "SECRET" });
  const first = await call();
  expect(first.code).toBe(200); expect(first.headers["Cache-Control"]).toBe("no-store");
  expect(first.body.items).toHaveLength(50); expect(first.body.nextCursor).toBeTruthy();
  const last = await call({ cursor: first.body.nextCursor });
  expect(last.body.items).toHaveLength(1); expect(last.body.nextCursor).toBeNull();
  const ids = [...first.body.items as { id: string }[], ...last.body.items as { id: string }[]].map(item => item.id);
  expect(new Set(ids).size).toBe(51); expect(JSON.stringify(first.body)).not.toMatch(/PRIVATE|SECRET|prompt|apiKey/);
});
test("date range includes the entire end day", async () => {
  state.store.set("one", { createdAt: "2026-10-12T20:59:59.999Z" });
  state.store.set("two", { createdAt: "2026-10-12T21:00:00.000Z" });
  expect((await call({ start: "2026-10-12", end: "2026-10-12" })).body.items).toHaveLength(1);
});
test("rejects invalid date ranges and cursors", async () => {
  for (const query of [{ start: "2026-02-30" }, { end: "bad" }, { start: "2026-10-13", end: "2026-10-12" }, { cursor: "../secret" }, { cursor: "missing" }, { start: ["2026-10-12"] }]) expect((await call(query)).code).toBe(400);
});
test("database errors return generic 503, never an empty successful history", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try { state.fail = true; const result = await call(); expect(result.code).toBe(503); expect(JSON.stringify(result.body)).not.toContain("private"); }
  finally { log.mockRestore(); }
});

test("Romania date filters respect 23-hour and 25-hour DST days", async () => {
  for (const [day, first, last, next] of [
    ["2026-03-29", "2026-03-28T22:00:00.000Z", "2026-03-29T20:59:59.999Z", "2026-03-29T21:00:00.000Z"],
    ["2026-10-25", "2026-10-24T21:00:00.000Z", "2026-10-25T21:59:59.999Z", "2026-10-25T22:00:00.000Z"],
  ]) {
    state.store.clear(); state.store.set("first", { createdAt: first }); state.store.set("last", { createdAt: last }); state.store.set("next", { createdAt: next });
    expect((await call({ start: day, end: day })).body.items).toHaveLength(2);
  }
});
