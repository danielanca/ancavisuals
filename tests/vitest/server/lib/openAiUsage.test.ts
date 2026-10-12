// @vitest-environment node
import { expect, test } from "vitest";
import { trackedOpenAiFetch } from "src/server/lib/aiUsage";
import type { AiUsageEntry } from "src/shared/ai/usage";

const response = {
  id: "resp_test", model: "gpt-future", status: "completed", output: [{ text: "PRIVATE OUTPUT" }],
  usage: { input_tokens: 100, output_tokens: 30, total_tokens: 130, input_tokens_details: { cached_tokens: 40, cache_write_tokens: 10 }, output_tokens_details: { reasoning_tokens: 20 } },
};
function setup(result: () => Response) {
  const records: AiUsageEntry[] = [];
  return { records, fetch: trackedOpenAiFetch("Extragere PDF", async () => result(), async entry => { records.push(structuredClone(entry)); }) };
}
const request = { method: "POST", body: JSON.stringify({ model: "gpt-future", input: "PRIVATE DOCUMENT" }) };
function stream(events: unknown[], done = false) {
  const text = events.map(event => `data: ${JSON.stringify(event)}\n\n`).join("") + (done ? "data: [DONE]\n\n" : "");
  const bytes = new TextEncoder().encode(text); let index = 0;
  return new Response(new ReadableStream({ pull(controller) {
    if (index >= bytes.length) { controller.close(); return; }
    controller.enqueue(bytes.slice(index, index + 11)); index += 11;
  } }), { headers: { "content-type": "text/event-stream", "x-request-id": "req_openai" } });
}
test("Responses JSON uses the common schema and never double-counts cache or reasoning", async () => {
  const s = setup(() => new Response(JSON.stringify(response), { headers: { "x-request-id": "req_openai" } }));
  expect(await (await s.fetch("https://api.openai.com/v1/responses", request)).json()).toEqual(response);
  expect(s.records[0]).toMatchObject({ provider: "openai", model: "gpt-future", feature: "Extragere PDF", inputTokens: 50, outputTokens: 30, cacheReadTokens: 40, cacheWriteTokens: 10, reasoningTokens: 20, totalTokens: 130, usageComplete: true, providerRequestId: "req_openai", estimatedCostUsd: null });
  expect(JSON.stringify(s.records)).not.toMatch(/PRIVATE|DOCUMENT|OUTPUT/);
});
test("Chat Completions JSON normalizes its different usage names", async () => {
  const chat = { id: "chatcmpl_test", model: "gpt-future", choices: [], usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130, prompt_tokens_details: { cached_tokens: 40 }, completion_tokens_details: { reasoning_tokens: 20 } } };
  const s = setup(() => new Response(JSON.stringify(chat)));
  await s.fetch("https://api.openai.com/v1/chat/completions", request);
  expect(s.records[0]).toMatchObject({ provider: "openai", inputTokens: 60, cacheReadTokens: 40, cacheWriteTokens: 0, outputTokens: 30, reasoningTokens: 20, totalTokens: 130 });
});
test("Responses streaming records completed usage and forwards bytes unchanged", async () => {
  const events = [{ type: "response.created", response: { ...response, status: "in_progress", usage: null } }, { type: "response.output_text.delta", delta: "PRIVATE STREAM" }, { type: "response.completed", response }];
  const s = setup(() => stream(events));
  const text = await (await s.fetch("https://api.openai.com/v1/responses", request)).text();
  expect(text).toContain("PRIVATE STREAM");
  expect(s.records).toHaveLength(1); expect(s.records[0]).toMatchObject({ status: "success", usageComplete: true, totalTokens: 130, reasoningTokens: 20 });
  expect(JSON.stringify(s.records)).not.toContain("PRIVATE");
});
test("Chat streaming consumes the final usage chunk before DONE", async () => {
  const s = setup(() => stream([{ id: "chatcmpl_test", model: "gpt-future", choices: [{ delta: { content: "PRIVATE" } }], usage: null }, { id: "chatcmpl_test", choices: [], usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 } }], true));
  await (await s.fetch("https://api.openai.com/v1/chat/completions", request)).text();
  expect(s.records).toHaveLength(1); expect(s.records[0]).toMatchObject({ provider: "openai", status: "success", totalTokens: 130, usageComplete: true });
});
test("streams without usage do not invent zero-token consumption", async () => {
  const s = setup(() => stream([{ id: "chatcmpl_test", model: "gpt-future", usage: null }], true));
  await (await s.fetch("https://api.openai.com/v1/chat/completions", request)).text();
  expect(s.records[0]).toMatchObject({ status: "success", totalTokens: null, usageComplete: false, estimatedCostUsd: null });
});
test("OpenAI failure and incomplete events retain any reported consumption", async () => {
  for (const [type, status] of [["response.failed", "error"], ["response.incomplete", "interrupted"]]) {
    const s = setup(() => stream([{ type, response }]));
    await (await s.fetch("https://api.openai.com/v1/responses", request)).text();
    expect(s.records[0]).toMatchObject({ status, totalTokens: 130, usageComplete: true });
  }
});
