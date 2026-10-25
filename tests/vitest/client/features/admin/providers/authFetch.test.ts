/*
 * Purpose: an expired token passed by the page (`auth.accessToken`) must not break admin actions —
 * on 401 the request is retried once with a freshly refreshed Firebase token.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

let originalFetch: typeof window.fetch;
beforeEach(() => { vi.resetModules(); originalFetch = window.fetch; });
afterEach(() => { window.fetch = originalFetch; });

async function setup(responses: number[]) {
  const calls: string[] = [];
  window.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(new Headers(init?.headers).get("Authorization") ?? "");
    return new Response("{}", { status: responses.shift() ?? 200 });
  }) as typeof window.fetch;
  const module = await import("src/client/features/admin/providers/authFetch");
  const getIdToken = vi.fn(async (force?: boolean) => (force ? "fresh" : "current"));
  module.setAuthFetchUser({ getIdToken } as never);
  module.installAuthFetch();
  return { calls, getIdToken };
}

test("a page's stale token gets one retry with a refreshed token", async () => {
  const { calls, getIdToken } = await setup([401, 201]);
  const res = await fetch("/api/admin/tasks", { method: "POST", headers: { Authorization: "Bearer stale" }, body: "{}" });
  expect(res.status).toBe(201);
  expect(calls).toEqual(["Bearer stale", "Bearer fresh"]);
  expect(getIdToken).toHaveBeenCalledWith(true);
});

test("no retry when the request succeeds, and only one retry when the fresh token is also refused", async () => {
  const ok = await setup([200]);
  await fetch("/api/admin/tasks", { headers: { Authorization: "Bearer stale" } });
  expect(ok.calls).toHaveLength(1);

  vi.resetModules();
  const refused = await setup([401, 401]);
  const res = await fetch("/api/admin/tasks", { headers: { Authorization: "Bearer stale" } });
  expect(res.status).toBe(401);
  expect(refused.calls).toEqual(["Bearer stale", "Bearer fresh"]);
});

test("requests without Authorization still get the current token added", async () => {
  const { calls } = await setup([200]);
  await fetch("/api/admin/tasks");
  expect(calls).toEqual(["Bearer current"]);
});
