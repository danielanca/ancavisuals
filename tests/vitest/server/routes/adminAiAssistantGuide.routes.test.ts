/*
 * Purpose: verifies the Dashboard guide endpoint (POST /api/admin/ai-assistant/guide) — it sends
 * Claude the admin page list in a cached system prompt, returns the reply text, answers a refusal
 * with a plain message, and rejects empty questions — without calling Claude.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

type Handler = (req: any, res: any) => Promise<void> | void;

function createMockResponse() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function loadGuide(response?: Record<string, unknown>) {
  vi.resetModules();
  process.env.ANTHROPIC_API_KEY = "test-key";
  const createMock = vi.fn();
  if (response) createMock.mockResolvedValueOnce(response);
  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (_req: any, _res: any, next: () => void) => next(),
    requireSupremeAdmin: (_req: any, _res: any, next: () => void) => next(),
  }));
  vi.doMock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: createMock }; } }));
  const { default: router } = await import("src/server/routes/adminAiAssistant.routes");
  const layer = (router as any).stack.find((l: any) => l.route?.path === "/guide" && l.route.methods.post);
  const handlers: Handler[] = layer.route.stack.map((s: any) => s.handle);
  return { handler: handlers[handlers.length - 1], createMock };
}

const pages = [
  { label: "Prețuri de pornire", path: "/admin/preturi", category: "Contracte & Oferte", keywords: "preturi date ocupate" },
  { label: "Bad", path: "javascript:alert(1)", category: "x" },
];

afterEach(() => vi.resetModules());

describe("admin guide", () => {
  test("sends the page list to Claude and returns its answer", async () => {
    const { handler, createMock } = await loadGuide({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "În meniu, la Oferte → [Prețuri de pornire](/admin/preturi)." }],
    });
    const res = createMockResponse();
    await handler({ body: { pages, messages: [{ role: "user", content: "unde schimb prețurile?" }] } }, res);

    expect(res.json).toHaveBeenCalledWith({ reply: "În meniu, la Oferte → [Prețuri de pornire](/admin/preturi)." });
    const params = createMock.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.output_config).toEqual({ effort: "low" });
    expect(params.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(params.system[0].text).toContain("Contracte & Oferte → Prețuri de pornire: /admin/preturi");
    // Only paths starting with "/" reach the prompt.
    expect(params.system[0].text).not.toContain("javascript:");
  });

  test("answers a refusal with a plain message", async () => {
    const { handler } = await loadGuide({ stop_reason: "refusal", content: [] });
    const res = createMockResponse();
    await handler({ body: { pages, messages: [{ role: "user", content: "?" }] } }, res);
    expect(res.json.mock.calls[0][0].reply).toContain("Nu pot răspunde");
  });

  test("rejects a request without a question", async () => {
    const { handler, createMock } = await loadGuide();
    const res = createMockResponse();
    await handler({ body: { pages, messages: [] } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(createMock).not.toHaveBeenCalled();
  });
});
