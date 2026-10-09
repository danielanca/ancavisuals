import { afterEach, beforeEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ create: vi.fn(), config: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class {
  constructor(config: unknown) { state.config(config); }
  messages = { create: state.create };
} }));
import { rewriteContractClause } from "src/server/services/contractClauseAi.service";
beforeEach(() => { state.create.mockReset(); state.config.mockReset(); vi.stubEnv("ANTHROPIC_API_KEY", "fake"); });
afterEach(() => vi.unstubAllEnvs());
function answer(value: unknown, stop_reason = "end_turn") { state.create.mockResolvedValue({ stop_reason, content: [{ type: "text", text: JSON.stringify(value) }] }); }
test("uses economical Haiku with no retries and instructs preserving the clause's facts and conditions", async () => {
  answer({ title: "Titlu", text: "Text formal" });
  expect(await rewriteContractClause("titlu", "<p>text</p>", "formal")).toEqual({ title: "Titlu", text: "Text formal", body: "<p>Text formal</p>" });
  const request = state.create.mock.calls[0][0];
  expect(request.model).toBe("claude-haiku-4-5-20251001");
  expect(request.system).toContain("mai formal");
  expect(request.system).toContain("Nu adăuga obligații");
  expect(request.system).toContain("negațiile");
  expect(request.output_config.format.type).toBe("json_schema");
  expect(state.config).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0, timeout: 40000 }));
});
test("correct mode asks for grammar correction only and safely escapes generated text", async () => {
  answer({ title: "Ora", text: "Nu acceptăm <script>alert(1)</script> & modificări.\nOra 23:00." });
  const result = await rewriteContractClause("Ora", "Text", "correct");
  expect(result.body).not.toContain("<script>");
  expect(result.body).toContain("&lt;script&gt;");
  expect(result.body).toContain("<p>Ora 23:00.</p>");
  expect(state.create.mock.calls[0][0].system).toContain("Corectează doar");
});
test.each(["max_tokens", "refusal"])("rejects incomplete %s responses", async reason => {
  answer({ title: "Titlu", text: "Text" }, reason);
  await expect(rewriteContractClause("Titlu", "Text", "correct")).rejects.toThrow("Incomplete");
});
test.each([{ title: "", text: "Text" }, { title: "Titlu", text: " " }, { title: "a".repeat(301), text: "Text" }, { title: "Titlu", text: "a".repeat(10001) }, { title: "Titlu", text: 42 }])("rejects invalid AI output: %j", async value => {
  answer(value);
  await expect(rewriteContractClause("Titlu", "Text", "correct")).rejects.toThrow();
});
