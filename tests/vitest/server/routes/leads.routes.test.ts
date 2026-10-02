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

async function loadRouter(deleteResult: boolean) {
  const deleteLeadMock = vi.fn().mockResolvedValue(deleteResult);
  const requireSupremeAdmin = vi.fn((_req: unknown, _res: unknown, next: () => void) => next());
  vi.doMock("src/server/middleware/requireFirebaseAuth.js", () => ({
    requireFirebaseAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireSupremeAdmin,
  }));
  vi.doMock("src/server/services/leads.service.js", () => ({ getLeads: vi.fn(), deleteLead: deleteLeadMock }));
  vi.doMock("src/server/services/emailLog.service.js", () => ({ getEmailLog: vi.fn(), getEmailLogEntry: vi.fn() }));
  const router = (await import("src/server/routes/leads.routes")).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layer = (router as any).stack.find((l: any) => l.route?.path === "/leads/:id" && l.route.methods.delete);
  const stack = layer.route.stack;
  return { handler: stack[stack.length - 1].handle, middlewares: stack.slice(0, -1).map((s: { handle: unknown }) => s.handle), deleteLeadMock, requireSupremeAdmin };
}

afterEach(() => { vi.resetModules(); });

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
