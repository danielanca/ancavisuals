/*
 * Purpose: admins can delete a saved lead; the route is protected by the admin
 * middleware and answers 404 for an unknown id.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

function createRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

async function loadRouter(deleteResult: boolean, archive = false) {
  const deleteLeadMock = vi.fn().mockResolvedValue(deleteResult);
  const archiveLeadMock = vi.fn().mockResolvedValue(deleteResult);
  const requireSupremeAdmin = vi.fn((_req: unknown, _res: unknown, next: () => void) => next());
  vi.doMock("src/server/middleware/requireFirebaseAuth.js", () => ({
    requireFirebaseAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireSupremeAdmin,
  }));
  vi.doMock("src/server/services/leads.service.js", () => ({ getLeads: vi.fn(), deleteLead: deleteLeadMock, archiveLead: archiveLeadMock }));
  vi.doMock("src/server/services/emailLog.service.js", () => ({ getEmailLog: vi.fn(), getEmailLogEntry: vi.fn() }));
  const router = (await import("src/server/routes/leads.routes")).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layer = (router as any).stack.find((l: any) => archive
    ? l.route?.path === "/leads/:id/archive" && l.route.methods.patch
    : l.route?.path === "/leads/:id" && l.route.methods.delete);
  const stack = layer.route.stack;
  return { handler: stack[stack.length - 1].handle, middlewares: stack.slice(0, -1).map((s: { handle: unknown }) => s.handle), deleteLeadMock, archiveLeadMock, requireSupremeAdmin };
}

afterEach(() => { vi.resetModules(); });

describe("PATCH /api/admin/leads/:id/archive", () => {
  test.each([true, false])("persists archived=%s and is admin-protected", async archived => {
    const { handler, middlewares, archiveLeadMock, requireSupremeAdmin } = await loadRouter(true, true);
    expect(middlewares).toContain(requireSupremeAdmin);
    const res = createRes();
    await handler({ params: { id: "lead-1" }, body: { archived } }, res);
    expect(archiveLeadMock).toHaveBeenCalledWith("lead-1", archived);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
  test("rejects an invalid archive flag", async () => {
    const { handler, archiveLeadMock } = await loadRouter(true, true);
    const res = createRes();
    await handler({ params: { id: "lead-1" }, body: { archived: "true" } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(archiveLeadMock).not.toHaveBeenCalled();
  });
  test("returns 404 for a missing lead", async () => {
    const { handler } = await loadRouter(false, true);
    const res = createRes();
    await handler({ params: { id: "missing" }, body: { archived: true } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("DELETE /api/admin/leads/:id", () => {
  test("deletes the lead and is admin-protected", async () => {
    const { handler, middlewares, deleteLeadMock, requireSupremeAdmin } = await loadRouter(true);
    expect(middlewares).toContain(requireSupremeAdmin);
    const res = createRes();
    await handler({ params: { id: "lead-1" } }, res);
    expect(deleteLeadMock).toHaveBeenCalledWith("lead-1");
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test("answers 404 for an unknown lead", async () => {
    const { handler } = await loadRouter(false);
    const res = createRes();
    await handler({ params: { id: "missing" } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
