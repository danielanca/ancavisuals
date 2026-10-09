import type Anthropic from "@anthropic-ai/sdk";
import { expect, test, vi } from "vitest";
import { requestStructured } from "src/server/lib/claudeStructured";

const args = {
  messages: [{ role: "user" as const, content: "Date fictive: total 10 RON." }],
  schema: { type: "object", properties: { total: { type: "number" } }, required: ["total"], additionalProperties: false },
  maxTokens: 1024,
  timeoutMs: 30000,
};

test("finance extraction uses pinned Haiku without adaptive thinking or effort, preserving schema and streaming", async () => {
  const message = { stop_reason: "end_turn", content: [{ type: "text", text: '{"total":10}' }] };
  const stream = vi.fn(() => ({ finalMessage: async () => message }));
  const result = await requestStructured({ messages: { stream } } as unknown as Anthropic, args);
  expect(stream).toHaveBeenCalledWith({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema: args.schema } },
    messages: args.messages,
  }, { timeout: 30000 });
  expect(result.data).toEqual({ total: 10 });
});

test.each(["max_tokens", "refusal"])("does not accept incomplete or refused financial data (%s)", async (stopReason) => {
  const stream = vi.fn(() => ({ finalMessage: async () => ({ stop_reason: stopReason, content: [{ type: "text", text: '{"total":10}' }] }) }));
  const result = await requestStructured({ messages: { stream } } as unknown as Anthropic, args);
  expect(result.data).toBeNull();
  expect(result.stopReason).toBe(stopReason);
});
