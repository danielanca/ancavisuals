/*
 * Purpose: verifies the admin activity-inbox routes — list, mark read, and
 * delete — with Firestore mocked out. Delete is what backs the "șterge
 * entry-urile" button in ActivityInbox.tsx.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

type Handler = (req: any, res: any) => Promise<void> | void;

function createMockResponse() {
  const res: any = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function loadRouter() {
  const getActivities = vi.fn().mockResolvedValue([
    { id: "a1", type: "lead", title: "Lead 1", description: "", metadata: {}, read: false, emailSent: true },
  ]);
  const markAllRead = vi.fn().mockResolvedValue(undefined);
  const markRead = vi.fn().mockResolvedValue(undefined);
  const deleteActivity = vi.fn().mockResolvedValue(undefined);
  const getNotificationSettings = vi.fn().mockResolvedValue({ email: {} });
  const saveNotificationSettings = vi.fn().mockResolvedValue(undefined);

  vi.doMock("src/server/services/activity.service.js", () => ({
    getActivities, markAllRead, markRead, deleteActivity, getNotificationSettings, saveNotificationSettings,
  }));
  vi.doMock("src/server/middleware/requireFirebaseAuth.js", () => ({
    requireFirebaseAuth: (_req: any, _res: any, next: any) => next(),
    requireSupremeAdmin: (_req: any, _res: any, next: any) => next(),
  }));

  const mod = await import("src/server/routes/activity.routes");
  const router = mod.default as any;

  const getHandler = (method: string, path: string): Handler => {
    const layer = router.stack.find((e: any) => e.route?.path === path && e.route.methods?.[method]);
    if (!layer) throw new Error(`Missing ${method.toUpperCase()} ${path}`);
    return layer.route.stack[layer.route.stack.length - 1].handle;
  };

  return {
    getActivities, markAllRead, markRead, deleteActivity,
    getList: getHandler("get", "/activity"),
    patchReadAll: getHandler("patch", "/activity/read-all"),
    patchRead: getHandler("patch", "/activity/:id/read"),
    deleteEntry: getHandler("delete", "/activity/:id"),
  };
}

describe("activity.routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  test("GET /activity returns the activity list", async () => {
    const { getList } = await loadRouter();
    const res = createMockResponse();

    await getList({}, res);

    expect(res.json).toHaveBeenCalledWith({ activities: expect.arrayContaining([expect.objectContaining({ id: "a1" })]) });
  });

  test("PATCH /activity/read-all marks everything read", async () => {
    const { patchReadAll, markAllRead } = await loadRouter();
    const res = createMockResponse();

    await patchReadAll({}, res);

    expect(markAllRead).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test("PATCH /activity/:id/read marks one entry read", async () => {
    const { patchRead, markRead } = await loadRouter();
    const res = createMockResponse();

    await patchRead({ params: { id: "a1" } }, res);

    expect(markRead).toHaveBeenCalledWith("a1");
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  describe("DELETE /activity/:id", () => {
    test("deletes the entry and returns ok:true", async () => {
      const { deleteEntry, deleteActivity } = await loadRouter();
      const res = createMockResponse();

      await deleteEntry({ params: { id: "a1" } }, res);

      expect(deleteActivity).toHaveBeenCalledWith("a1");
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("returns 500 when the delete fails", async () => {
      const { deleteEntry, deleteActivity } = await loadRouter();
      deleteActivity.mockRejectedValueOnce(new Error("firestore down"));
      const res = createMockResponse();

      await deleteEntry({ params: { id: "a1" } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
