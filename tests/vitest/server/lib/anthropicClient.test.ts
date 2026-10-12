// @vitest-environment node
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, test, vi } from "vitest";
import type { Request, Response as ExpressResponse } from "express";
import { aiUsageContext, trackedAnthropicFetch, withAiOperation } from "src/server/lib/anthropicClient";
import { estimateAiCost, type AiUsageEntry } from "src/shared/ai/usage";

const url = "https://api.anthropic.com/v1/messages";
const body = JSON.stringify({ model: "claude-haiku-4-5-20251001", messages: [{ role: "user", content: "PRIVATE PROMPT / PDF / API KEY" }] });
const message = { id: "msg_test", type: "message", role: "assistant", model: "claude-haiku-4-5-20251001", content: [{ type: "text", text: "PRIVATE RESPONSE" }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 100, output_tokens: 25, cache_read_input_tokens: 200, cache_creation_input_tokens: 40, cache_creation: { ephemeral_5m_input_tokens: 30, ephemeral_1h_input_tokens: 10 } } };
function setup(response: () => Response) {
  const records: AiUsageEntry[] = [];
  const writer = vi.fn(async (entry: AiUsageEntry) => { records.push(structuredClone(entry)); });
  const fetcher = vi.fn(async () => response());
  return { records, writer, fetcher, fetch: trackedAnthropicFetch("Extrase bancare", fetcher, writer) };
}
const json = () => new Response(JSON.stringify(message), { headers: { "content-type": "application/json", "request-id": "req_test" } });
function sse(events: unknown[], finish = true) {
  const text = events.map(event => `event: ${(event as { type: string }).type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`).join("");
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new Response(new ReadableStream({ pull(controller) {
    if (offset === bytes.length) { if (finish) controller.close(); else controller.error(new Error("connection lost")); return; }
    // Split JSON, CRLF, and Unicode across transport chunks.
    controller.enqueue(bytes.slice(offset, offset + 7)); offset = Math.min(bytes.length, offset + 7);
  } }), { headers: { "content-type": "text/event-stream", "request-id": "req_stream" } });
}
const events = [
  { type: "message_start", message: { ...message, content: [], usage: { ...message.usage, output_tokens: 1 } } },
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "răspuns privat" } },
  { type: "content_block_stop", index: 0 },
  { type: "message_delta", delta: { stop_reason: null }, usage: { output_tokens: 12 } },
  { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 25 } },
  { type: "message_stop" },
];

describe("Anthropic transport history", () => {
  test("records exact usage, cache, price and request metadata without payloads or secrets", async () => {
    const s = setup(json);
    const response = await withAiOperation("Citire extras", () => s.fetch(url, { method: "POST", body, headers: { "x-api-key": "secret" } }));
    expect(await response.json()).toEqual(message);
    expect(s.records).toHaveLength(1);
    expect(s.records[0]).toMatchObject({ feature: "Extrase bancare", operation: "Citire extras", model: message.model, inputTokens: 100, outputTokens: 25, cacheReadTokens: 200, cacheWriteTokens: 40, cacheWrite1hTokens: 10, totalTokens: 365, status: "success", usageComplete: true, providerRequestId: "req_test", messageId: "msg_test" });
    expect(s.records[0].estimatedCostUsd).toBeCloseTo(0.0003025, 10);
    expect(JSON.stringify(s.records)).not.toMatch(/PRIVATE|secret|messages|content/);
    expect(new Date(s.records[0].createdAt).getTime()).toBeLessThanOrEqual(new Date(s.records[0].completedAt).getTime());
  });
  test("real SDK JSON calls preserve the API response", async () => {
    const s = setup(json);
    const client = new Anthropic({ apiKey: "test", fetch: s.fetch, maxRetries: 0 });
    const result = await client.messages.create({ model: message.model, max_tokens: 100, messages: [{ role: "user", content: "private" }] });
    expect(result.content).toEqual(message.content); expect(s.records).toHaveLength(1);
  });
  test("real SDK stream parses unchanged and cumulative output is counted once", async () => {
    const s = setup(() => sse(events));
    const client = new Anthropic({ apiKey: "test", fetch: s.fetch, maxRetries: 0 });
    const result = await client.messages.stream({ model: message.model, max_tokens: 100, messages: [{ role: "user", content: "private" }] }).finalMessage();
    expect(result.content).toEqual([{ type: "text", text: "răspuns privat" }]);
    expect(s.records).toHaveLength(1);
    expect(s.records[0]).toMatchObject({ outputTokens: 25, inputTokens: 100, totalTokens: 365, status: "success", usageComplete: true });
  });
  test("EOF without message_stop is incomplete and has no cost estimate", async () => {
    const s = setup(() => sse(events.slice(0, -1)));
    await (await s.fetch(url, { body })).text();
    expect(s.records[0]).toMatchObject({ status: "interrupted", usageComplete: false, outputTokens: 25, estimatedCostUsd: null });
  });
  test("network failure is recorded with unknown consumption, then original error propagates", async () => {
    const records: AiUsageEntry[] = [];
    const failure = new Error("PRIVATE NETWORK ERROR");
    const fetcher = trackedAnthropicFetch("Test", async () => { throw failure; }, async entry => { records.push(entry); });
    await expect(fetcher(url, { body })).rejects.toBe(failure);
    expect(records[0]).toMatchObject({ status: "error", totalTokens: null, httpStatus: null, estimatedCostUsd: null });
    expect(JSON.stringify(records)).not.toContain("PRIVATE NETWORK ERROR");
  });
  test("HTTP errors do not record zero as known consumption or retain provider error text", async () => {
    const s = setup(() => new Response("PRIVATE PROVIDER ERROR", { status: 429 }));
    expect((await s.fetch(url, { body })).status).toBe(429);
    expect(s.records[0]).toMatchObject({ status: "error", httpStatus: 429, totalTokens: null, usageComplete: false });
  });
  test("SDK retries have separate history entries", async () => {
    let attempt = 0;
    const s = setup(() => ++attempt === 1 ? new Response(JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "retry" } }), { status: 429, headers: { "retry-after-ms": "1" } }) : json());
    const client = new Anthropic({ apiKey: "test", fetch: s.fetch, maxRetries: 1 });
    await client.messages.create({ model: message.model, max_tokens: 100, messages: [{ role: "user", content: "private" }] });
    expect(s.records.map(entry => entry.status)).toEqual(["error", "success"]);
    expect(new Set(s.records.map(entry => entry.id)).size).toBe(2);
  });
  test("stream failure and cancellation retain partial usage", async () => {
    const s = setup(() => sse(events.slice(0, -1), false));
    await expect((await s.fetch(url, { body })).text()).rejects.toThrow("connection lost");
    expect(s.records[0]).toMatchObject({ status: "interrupted", inputTokens: 100, usageComplete: false });
    const cancelled = setup(() => sse(events));
    const response = await cancelled.fetch(url, { body });
    await response.body!.cancel();
    expect(cancelled.records).toHaveLength(1); expect(cancelled.records[0].status).toBe("interrupted");
  });
  test("telemetry failures cannot break successful inference and fallback excludes prompt", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const fetcher = trackedAnthropicFetch("Test", async () => json(), async () => { throw new Error("PRIVATE DB ERROR"); });
      expect(await (await fetcher(url, { body })).json()).toEqual(message);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE|secret/);
    } finally { log.mockRestore(); }
  });
  test("concurrent HTTP requests keep distinct contexts and store route templates", async () => {
    const s = setup(json);
    async function call(operation: string) {
      await new Promise<void>((resolve, reject) => {
        const req = { method: "POST", baseUrl: "/api/admin", route: { path: "/events/:id/extract" }, originalUrl: "/api/admin/events/PRIVATE-ID/extract?token=secret" } as Request;
        aiUsageContext(req, {} as ExpressResponse, () => {
          void withAiOperation(operation, () => s.fetch(url, { body })).then(() => resolve(), reject);
        });
      });
    }
    await Promise.all([call("A"), call("B")]);
    expect(s.records.map(entry => entry.operation).sort()).toEqual(["A", "B"]);
    expect(new Set(s.records.map(entry => entry.appRequestId)).size).toBe(2);
    expect(s.records.every(entry => entry.route === "POST /api/admin/events/:id/extract")).toBe(true);
    expect(JSON.stringify(s.records)).not.toMatch(/PRIVATE|secret/);
  });
  test("non-message requests are unchanged and do not invent usage", async () => {
    const s = setup(json); await s.fetch("https://api.anthropic.com/v1/models"); expect(s.records).toEqual([]);
  });
  test("unknown models do not get an incorrect price", async () => {
    const s = setup(() => new Response(JSON.stringify({ ...message, model: "future-model" })));
    await s.fetch(url, { body }); expect(s.records[0].estimatedCostUsd).toBeNull();
    expect(estimateAiCost({ ...s.records[0], model: "claude-haiku-4-5-20251001", usageComplete: false })).toBeNull();
  });
});
