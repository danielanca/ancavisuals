/*
 * Purpose: the "✨ Înfrumusețează" endpoint (POST /api/admin/ai-assistant/polish) sends the text to
 * Claude with the polish rules (HTML rules only for the clause editor), returns the clean text without
 * code fences, and rejects empty or oversized text — without calling Claude.
 */
import { afterEach, expect, test, vi } from "vitest";

function createMockResponse() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function loadPolish(response?: Record<string, unknown>) {
  vi.resetModules();
  process.env.ANTHROPIC_API_KEY = "test-key";
  const createMock = vi.fn();
  if (response) createMock.mockResolvedValueOnce(response);
  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (_req: any, _res: any, next: () => void) => next(),
    requireSupremeAdmin: (_req: any, _res: any, next: () => void) => next(),
  }));
  vi.doMock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: createMock }; } }));
  const mod = await import("src/server/routes/adminAiAssistant.routes");
  const layer = (mod.default as any).stack.find((l: any) => l.route?.path === "/polish" && l.route.methods.post);
  const handlers = layer.route.stack.map((s: any) => s.handle);
  return { handler: handlers[handlers.length - 1], createMock, mod };
}

afterEach(() => vi.resetModules());

test("polishes plain text with the field name as context", async () => {
  const { handler, createMock } = await loadPolish({ stop_reason: "end_turn", content: [{ type: "text", text: "Pozele vor fi gata mâine." }] });
  const res = createMockResponse();
  await handler({ body: { text: "pozele vor fi gata maine aa", format: "plain", field: "Mesajul" } }, res);

  expect(res.json).toHaveBeenCalledWith({ text: "Pozele vor fi gata mâine." });
  const params = createMock.mock.calls[0][0];
  expect(params.model).toBe("claude-opus-5-5");
  expect(params.system[0].text).toContain("speech-to-text");
  expect(params.system[0].text).not.toContain("HTML");
  expect(params.messages[0].content).toContain("Câmpul: Mesajul");
  expect(params.messages[0].content).toContain("pozele vor fi gata maine aa");
});

test("keeps the clause HTML rules and strips a code fence", async () => {
  const { handler, createMock } = await loadPolish({ stop_reason: "end_turn", content: [{ type: "text", text: "```html\n<p>Prestatorul livrează {{eventType}}.</p>\n```" }] });
  const res = createMockResponse();
  await handler({ body: { text: "<p>prestatorul livreaza {{eventType}}</p>", format: "html" } }, res);

  expect(res.json).toHaveBeenCalledWith({ text: "<p>Prestatorul livrează {{eventType}}.</p>" });
  expect(createMock.mock.calls[0][0].system[0].text).toContain("HTML");
});

test("rejects empty and oversized text without calling Claude", async () => {
  const { handler, createMock, mod } = await loadPolish();
  const empty = createMockResponse();
  await handler({ body: { text: "   " } }, empty);
  expect(empty.status).toHaveBeenCalledWith(400);

  const huge = createMockResponse();
  await handler({ body: { text: "a".repeat(mod.POLISH_TEXT_MAX + 1) } }, huge);
  expect(huge.status).toHaveBeenCalledWith(400);
  expect(createMock).not.toHaveBeenCalled();
});
