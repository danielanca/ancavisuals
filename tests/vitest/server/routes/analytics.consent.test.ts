/*
 * Purpose: verifies the anonymous cookie-banner counters — only whitelisted
 * actions are counted, nothing identifying is stored, duplicates/admin/bots
 * are dropped — with Firestore mocked out.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

type Handler = (req: any, res: any) => Promise<void> | void;

function createMockResponse() {
  const res: any = { status: vi.fn(), json: vi.fn(), headersSent: false };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function loadRouter(ip = "8.8.8.8") {
  const set = vi.fn().mockResolvedValue(undefined);
  const doc = vi.fn(() => ({ set }));
  vi.doMock("src/server/firestore", () => ({ firestore: () => ({ collection: () => ({ doc }) }) }));
  vi.doMock("src/server/utils/ipinfo", () => ({
    getClientIp: vi.fn().mockReturnValue(ip),
    fetchIpInfo: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("src/server/controllers/triggerEvent.controller", () => ({
    isLocalIp: (value: string) => value === "127.0.0.1",
  }));
  vi.doMock("src/server/services/activity.service", () => ({ logActivity: vi.fn() }));
  vi.doMock("src/server/notifications/emailFunnel", () => ({ blockEmail: vi.fn(), sendViaFunnel: vi.fn() }));
  vi.doMock("src/server/constants/credentials", () => ({ adminUser: { email: "admin@test.ro" } }));

  const mod = await import("src/server/routes/analytics.routes");
  const layer = (mod.analyticsPublicRouter as any).stack.find((e: any) => e.route?.path === "/consent" && e.route.methods?.post);
  const postConsent: Handler = layer.route.stack[layer.route.stack.length - 1].handle;
  return { postConsent, set, doc };
}

const realUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const req = (body: object, headers: Record<string, string> = {}) => ({ body, headers: { "user-agent": realUa, ...headers } });

describe("POST /api/analytics/consent", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("increments the day counter without storing ip or ids", async () => {
    const { postConsent, set, doc } = await loadRouter();
    await postConsent(req({ action: "accept_all", sessionId: "abc" }), createMockResponse());

    expect(doc).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    const [data, opts] = set.mock.calls[0];
    expect(opts).toEqual({ merge: true });
    expect(Object.keys(data).sort()).toEqual(["accept_all", "day"]);
    expect(JSON.stringify(data)).not.toContain("8.8.8.8");
  });

  test("save records whether marketing stayed on", async () => {
    const { postConsent, set } = await loadRouter();
    await postConsent(req({ action: "save", marketing: false }), createMockResponse());
    expect(Object.keys(set.mock.calls[0][0]).sort()).toEqual(["day", "save", "save_marketing_off"]);
  });

  test("rejects unknown actions", async () => {
    const { postConsent, set } = await loadRouter();
    const res = createMockResponse();
    await postConsent(req({ action: "hack" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  test("ignores admin, bots, local ip and rapid duplicates", async () => {
    const { postConsent, set } = await loadRouter();
    await postConsent(req({ action: "shown" }, { cookie: "av_admin=1" }), createMockResponse());
    await postConsent(req({ action: "shown" }, { "user-agent": "Googlebot/2.1" }), createMockResponse());
    await postConsent(req({ action: "shown" }), createMockResponse());
    await postConsent(req({ action: "shown" }), createMockResponse());
    expect(set).toHaveBeenCalledTimes(1);

    const local = await loadRouter("127.0.0.1");
    await local.postConsent(req({ action: "shown" }), createMockResponse());
    expect(local.set).not.toHaveBeenCalled();
  });
});
