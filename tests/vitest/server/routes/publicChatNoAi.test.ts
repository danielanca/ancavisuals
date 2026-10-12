import { afterEach, expect, test, vi } from "vitest";
import type { Router } from "express";

const ai = vi.hoisted(() => vi.fn(() => { throw new Error("Public chat must never create an AI client"); }));
vi.mock("src/server/lib/anthropicClient", () => ({ createAnthropicClient: ai }));
vi.mock("src/server/firestore", () => ({ firestore: vi.fn() }));
vi.mock("src/server/notifications/mailer", () => ({ sendEmail: vi.fn() }));
vi.mock("src/server/constants/credentials", () => ({ adminUser: { email: "test@example.com" } }));
import chatbot from "src/server/routes/chatbot.routes";
import assistant from "src/server/routes/assistantChat.routes";
import { CHAT_NODES, FALLBACK_NODE } from "src/server/data/assistantChatData";

async function call(router: Router, path: string, body: Record<string, unknown> = {}) {
  const layer = router.stack.find(entry => entry.route?.path === path);
  let status = 200;
  let result: unknown;
  const res = {
    status: (value: number) => { status = value; return res; },
    set: () => res,
    json: (value: unknown) => { result = value; return res; },
  };
  await layer.route.stack[0].handle({ body }, res);
  return { status, result };
}
afterEach(() => { vi.unstubAllEnvs(); expect(ai).not.toHaveBeenCalled(); });

test("legacy public chatbot rejects direct requests even with an API key configured", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  for (const body of [{ messages: [{ role: "user", content: "Salut" }] }, {}]) {
    expect((await call(chatbot, "/", body)).status).toBe(410);
  }
});
test("unknown public messages use the predefined fallback even with an API key", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  for (let i = 0; i < 3; i++) {
    expect(await call(assistant, "/message", { text: "Explică teoria relativității" })).toEqual({ status: 200, result: FALLBACK_NODE });
  }
});
test("public assistant keeps predefined answers and navigation", async () => {
  expect((await call(assistant, "/init")).result).toEqual(CHAT_NODES.get("welcome"));
  expect((await call(assistant, "/message", { intentId: "booking" })).result).toEqual(CHAT_NODES.get("booking"));
  expect((await call(assistant, "/message", { text: "Care sunt tarifele?" })).result).toEqual(CHAT_NODES.get("pricing"));
});
