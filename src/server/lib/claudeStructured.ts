import type Anthropic from "@anthropic-ai/sdk";

// Model folosit pentru extragerea datelor financiare (bonuri, facturi, extrase).
export const FINANCE_AI_MODEL = "claude-opus-5-5";

export type StructuredResult<T> = {
  data: T | null;
  stopReason: string | null;
  message: Anthropic.Message;
};

/**
 * Cere lui Claude un răspuns care respectă exact `schema` (structured outputs),
 * cu gândire adaptivă activă. Folosește streaming ca un extras lung să nu
 * lovească timeout-ul HTTP. `data` e null doar dacă răspunsul a fost tăiat
 * (`max_tokens`) sau refuzat.
 */
export async function requestStructured<T>(
  client: Anthropic,
  args: {
    messages: Anthropic.MessageParam[];
    schema: Record<string, unknown>;
    maxTokens: number;
    effort: "low" | "medium" | "high" | "max";
    timeoutMs?: number;
  }
): Promise<StructuredResult<T>> {
  const message = await client.messages
    .stream(
      {
        model: FINANCE_AI_MODEL,
        max_tokens: args.maxTokens,
        thinking: { type: "adaptive" },
        output_config: { effort: args.effort, format: { type: "json_schema", schema: args.schema } },
        messages: args.messages,
      },
      args.timeoutMs ? { timeout: args.timeoutMs } : undefined
    )
    .finalMessage();

  if (message.stop_reason === "max_tokens" || message.stop_reason === "refusal") {
    return { data: null, stopReason: message.stop_reason, message };
  }

  const text = message.content.find((block): block is Anthropic.TextBlock => block.type === "text")?.text ?? "";
  try {
    return { data: JSON.parse(text) as T, stopReason: message.stop_reason, message };
  } catch (error) {
    console.error("[claude-structured] JSON parse failed despite structured output:", error, text.slice(0, 300));
    return { data: null, stopReason: message.stop_reason, message };
  }
}

/** Câmp nullable, în forma acceptată de structured outputs. */
export function nullable(schema: Record<string, unknown>): Record<string, unknown> {
  return { anyOf: [schema, { type: "null" }] };
}
