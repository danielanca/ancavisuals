import { beforeEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ rewrite: vi.fn() }));
vi.mock("src/server/services/contractClauseAi.service", () => ({ rewriteContractClause: state.rewrite }));
vi.mock("src/server/firestore", () => ({ firestore: vi.fn() }));
vi.mock("src/server/middleware/requireFirebaseAuth", () => ({ requireFirebaseAuth: (_req: unknown, _res: unknown, next: () => void) => next(), requireSupremeAdmin: (_req: unknown, _res: unknown, next: () => void) => next() }));
import router from "src/server/routes/contractClauseTemplates.routes";
const layer = (router as unknown as { stack: { route?: { path: string; stack: { handle: (req: unknown, res: unknown) => Promise<void> }[] } }[] }).stack.find(item => item.route?.path === "/rewrite")!;
const handler = layer.route!.stack.at(-1)!.handle;
function response() { const res = { status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res); return res; }
beforeEach(() => { state.rewrite.mockReset(); });
test("requires auth/owner middleware and returns a proposal without persisting", async () => {
  expect(layer.route!.stack).toHaveLength(3);
  const clause = { title: "Titlu", body: "<p>Text</p>", text: "Text" };
  state.rewrite.mockResolvedValue(clause);
  const res = response();
  await handler({ body: { title: "Titlu", body: "<p>Text</p>", mode: "formal" } }, res);
  expect(res.json).toHaveBeenCalledWith({ clause });
});
test.each([{ title: "", body: "Text", mode: "formal" }, { title: "Titlu", body: "<p>&nbsp;</p>", mode: "correct" }, { title: "Titlu", body: "Text", mode: "other" }, { title: "Titlu", body: "a".repeat(10001), mode: "formal" }])("validates before using paid AI: %j", async body => {
  const res = response(); await handler({ body }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(state.rewrite).not.toHaveBeenCalled();
});
test("returns a safe error for AI failures", async () => {
  state.rewrite.mockRejectedValue(new Error("private API billing details"));
  const res = response(); await handler({ body: { title: "Titlu", body: "Text", mode: "correct" } }, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining("neschimbat") });
  expect(JSON.stringify(res.json.mock.calls)).not.toContain("billing");
});
