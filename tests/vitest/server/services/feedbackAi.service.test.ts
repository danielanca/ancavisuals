import { beforeEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ create: vi.fn(), config: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class {
  constructor(config: unknown) { state.config(config); }
  messages = { create: state.create };
} }));
import { FeedbackAiUnavailableError, generateFeedbackVariants } from "src/server/services/feedbackAi.service";
const variants = Array.from({ length: 7 }, (_, index) => `Formulare distinctă ${index}`);
beforeEach(() => { state.create.mockReset(); state.config.mockReset(); vi.stubEnv("ANTHROPIC_API_KEY", "fake-test-key"); });
function answer(value: unknown, stop_reason = "end_turn") {
  state.create.mockResolvedValue({ stop_reason, content: [{ type: "text", text: JSON.stringify(value) }] });
}
test("uses existing Claude integration and strictly limits rewriting to client's words, including criticism", async () => {
  answer({ variants });
  expect(await generateFeedbackVariants("Poze bune, livrare lentă")).toEqual(variants);
  const request = state.create.mock.calls[0][0];
  expect(request.model).toBe("claude-sonnet-4-6");
  expect(JSON.parse(request.messages[0].content)).toEqual({ ideileClientului: "Poze bune, livrare lentă" });
  expect(request.system).toContain("exact 7");
  expect(request.system).toContain("Păstrează criticile");
  expect(request.system).toContain("Nu inventa");
  expect(request.output_config.format.type).toBe("json_schema");
  expect(state.config.mock.calls[0][0]).toMatchObject({ apiKey: "fake-test-key", maxRetries: 0 });
});
test("rejects truncated or refused output instead of offering incomplete choices", async () => {
  for (const stop of ["max_tokens", "refusal"]) {
    answer({ variants }, stop);
    await expect(generateFeedbackVariants("Text client")).rejects.toThrow("Incomplete");
  }
});
test("requires 7 distinct nonempty bounded variants", async () => {
  for (const invalid of [[], variants.slice(0, 6), Array(7).fill("Same"), [...variants.slice(0, 6), " "], [...variants.slice(0, 6), 42], [...variants.slice(0, 6), "a".repeat(1001)]]) {
    answer({ variants: invalid });
    await expect(generateFeedbackVariants("Text client")).rejects.toThrow();
  }
});
test("recognises Anthropic credit exhaustion as unavailable AI, without leaking provider details", async () => {
  state.create.mockRejectedValue(new Error('400 {"error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}'));
  const error = await generateFeedbackVariants("Text client").catch(error => error);
  expect(error).toBeInstanceOf(FeedbackAiUnavailableError);
  expect(error.reason).toBe("insufficient_credits");
  expect(error.message).toContain("Poți scrie și trimite feedback-ul direct");
  expect(error.message).not.toContain("Anthropic");
});
