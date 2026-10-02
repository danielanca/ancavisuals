/*
 * Purpose: verifies the client task organizer API — validation and the
 * completedAt bookkeeping that the progress stats rely on — without Firestore.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

type Handler = (req: any, res: any) => Promise<void> | void;

function createMockResponse() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

const NOW = new Date("2026-10-02T09:00:00.000Z");

async function loadTasksRouter(existing: Record<string, unknown> | null = { title: "Preview", status: "todo" }) {
  const addMock = vi.fn().mockResolvedValue({ id: "task-1" });
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const batchUpdateMock = vi.fn();
  const batchCommitMock = vi.fn().mockResolvedValue(undefined);
  const docMock = vi.fn((id: string) => ({
    id,
    get: vi.fn().mockResolvedValue({ id, exists: existing !== null, data: () => existing ?? undefined }),
    update: updateMock,
    delete: vi.fn().mockResolvedValue(undefined),
  }));

  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (_req: any, _res: any, next: () => void) => next(),
    requireSupremeAdmin: (_req: any, _res: any, next: () => void) => next(),
  }));
  vi.doMock("src/server/firestore", () => ({
    firestore: () => ({
      collection: () => ({ add: addMock, doc: docMock, get: vi.fn() }),
      batch: () => ({ update: batchUpdateMock, commit: batchCommitMock }),
    }),
  }));
  vi.doMock("firebase-admin/firestore", () => ({
    Timestamp: { now: () => ({ toDate: () => NOW }) },
  }));

  const module = await import("src/server/routes/tasks.routes");
  const router = module.default as any;
  const getHandler = (method: string, path: string): Handler => {
    const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route.methods?.[method]);
    const stack = layer.route.stack;
    return stack[stack.length - 1].handle;
  };
  return {
    module,
    addMock,
    updateMock,
    batchUpdateMock,
    batchCommitMock,
    post: getHandler("post", "/"),
    patch: getHandler("patch", "/:id"),
    reorder: getHandler("post", "/reorder"),
  };
}

describe("tasks routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("POST rejects a missing title", async () => {
    const { post, addMock } = await loadTasksRouter();
    const res = createMockResponse();
    await post({ body: { clientName: "Ana" } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(addMock).not.toHaveBeenCalled();
  });

  test("POST rejects malformed dates and unknown statuses", async () => {
    const { module } = await loadTasksRouter();
    expect(module.buildTaskPatch({ title: "x", dueDate: "02.10.2026" }, { requireTitle: true })).toHaveProperty("error");
    expect(module.buildTaskPatch({ title: "x", status: "blocked" }, { requireTitle: true })).toHaveProperty("error");
  });

  test("POST creates an open task with defaults", async () => {
    const { post, addMock } = await loadTasksRouter();
    const res = createMockResponse();
    await post({ body: { title: "  Trimite preview  ", plannedFor: "2026-10-02" } }, res);
    expect(addMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Trimite preview",
      status: "todo",
      priority: "normal",
      plannedFor: "2026-10-02",
      completedAt: null,
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("PATCH to done stamps completedAt; reopening clears it", async () => {
    const done = await loadTasksRouter({ title: "Preview", status: "doing" });
    await done.patch({ params: { id: "t" }, body: { status: "done" } }, createMockResponse());
    expect(done.updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "done", completedAt: expect.anything() }));

    vi.resetModules();
    const reopened = await loadTasksRouter({ title: "Preview", status: "done" });
    const res = createMockResponse();
    await reopened.patch({ params: { id: "t" }, body: { status: "todo" } }, res);
    expect(reopened.updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "todo", completedAt: null }));
    expect(res.json).toHaveBeenCalledWith({ task: expect.objectContaining({ completedAt: null }) });
  });

  test("PATCH on a missing task returns 404", async () => {
    const { patch } = await loadTasksRouter(null);
    const res = createMockResponse();
    await patch({ params: { id: "nope" }, body: { title: "x" } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("validates timeline time and duration", async () => {
    const { module } = await loadTasksRouter();
    expect(module.buildTaskPatch({ scheduledStart: "9:30" }, { requireTitle: false })).toHaveProperty("error");
    expect(module.buildTaskPatch({ scheduledStart: "24:00" }, { requireTitle: false })).toHaveProperty("error");
    expect(module.buildTaskPatch({ durationMin: 2 }, { requireTitle: false })).toHaveProperty("error");
    expect(module.buildTaskPatch({ durationMin: 2 * 24 * 60 }, { requireTitle: false })).toEqual({ patch: { durationMin: 2880 } });
    expect(module.buildTaskPatch({ durationMin: 8 * 24 * 60 }, { requireTitle: false })).toHaveProperty("error");
    expect(module.buildTaskPatch({ scheduledStart: "09:30", durationMin: 90 }, { requireTitle: false }))
      .toEqual({ patch: { scheduledStart: "09:30", durationMin: 90 } });
    expect(module.buildTaskPatch({ scheduledStart: null }, { requireTitle: false })).toEqual({ patch: { scheduledStart: null } });
  });

  test("reorder writes dayOrder by position in one batch", async () => {
    const { reorder, batchUpdateMock, batchCommitMock } = await loadTasksRouter();
    const res = createMockResponse();
    await reorder({ body: { ids: ["b", "a"] } }, res);
    expect(batchUpdateMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: "b" }), { dayOrder: 0 });
    expect(batchUpdateMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "a" }), { dayOrder: 1 });
    expect(batchCommitMock).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test("reorder rejects a malformed id list", async () => {
    const { reorder, batchCommitMock } = await loadTasksRouter();
    const res = createMockResponse();
    await reorder({ body: { ids: ["a", 3] } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(batchCommitMock).not.toHaveBeenCalled();
  });
});
