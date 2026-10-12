import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { RequestHandler, Request } from "express";
import { firestore } from "../firestore";
import { AI_PRICING_VERSION, estimateAiCost, type AiUsageEntry, type AiUsageStatus } from "../../shared/ai/usage";

type Context = { request?: Request; requestId?: string; operation?: string };
const context = new AsyncLocalStorage<Context>();
export const aiUsageContext: RequestHandler = (req, _res, next) => {
  context.run({ request: req, requestId: randomUUID() }, next);
};
export function withAiOperation<T>(operation: string, callback: () => T): T {
  return context.run({ ...context.getStore(), operation }, callback);
}
export type UsageWriter = (entry: AiUsageEntry) => Promise<void>;
export const saveAiUsage: UsageWriter = async entry => {
  await firestore().collection("aiUsageHistory").doc(entry.id).set(entry);
};

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}
function safeId(value: unknown): string | null {
  return typeof value === "string" && /^[\w.-]{1,200}$/.test(value) ? value : null;
}

/** Transport-level observation covers SDK retries and both JSON and SSE responses.
 * Only token metadata is retained. Prompts, documents, responses and auth headers
 * are never passed to the writer. Instrumentation cannot fail the AI request.
 */
export function trackedAiFetch(provider: "anthropic" | "openai", feature: string, fetcher: typeof fetch = (...args) => fetch(...args), writer: UsageWriter = saveAiUsage, source: AiUsageEntry["source"] = "server"): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url).pathname;
    const tracked = provider === "anthropic" ? path.endsWith("/messages") : /\/(responses|chat\/completions)$/.test(path);
    if (!tracked) return fetcher(input, init);
    const started = Date.now();
    const current = context.getStore();
    const req = current?.request;
    const template = typeof req?.route?.path === "string" ? `${req.baseUrl}${req.route.path}` : null;
    let model = "unknown";
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      if (typeof body.model === "string" && /^[\w.-]{1,100}$/.test(body.model)) model = body.model;
    } catch { /* A malformed body is still forwarded unchanged. */ }
    const entry: AiUsageEntry = {
      id: randomUUID(), createdAt: new Date(started).toISOString(), completedAt: new Date(started).toISOString(),
      feature, operation: current?.operation ?? null, route: template ? `${req!.method} ${template}` : null,
      appRequestId: current?.requestId ?? null, source, provider, model, providerRequestId: null, messageId: null,
      status: "interrupted", httpStatus: null, durationMs: 0, inputTokens: null, outputTokens: null,
      cacheReadTokens: null, cacheWriteTokens: null, cacheWrite1hTokens: null, totalTokens: null, reasoningTokens: null,
      usageComplete: false, estimatedCostUsd: null, pricingVersion: null,
    };
    let finished = false;
    let reportedTotal: number | null = null;
    function usage(value: unknown) {
      const u = object(value);
      if (provider === "openai") {
        const rawInput = count(u.input_tokens ?? u.prompt_tokens);
        const output = count(u.output_tokens ?? u.completion_tokens);
        const details = object(u.input_tokens_details ?? u.prompt_tokens_details);
        if (rawInput !== null) {
          entry.cacheReadTokens = Math.min(rawInput, count(details.cached_tokens) ?? 0);
          entry.cacheWriteTokens = Math.min(rawInput - entry.cacheReadTokens, count(details.cache_write_tokens) ?? 0);
          entry.inputTokens = rawInput - entry.cacheReadTokens - entry.cacheWriteTokens;
          entry.cacheWrite1hTokens = 0;
        }
        if (output !== null) entry.outputTokens = output;
        entry.reasoningTokens = count(object(u.output_tokens_details ?? u.completion_tokens_details).reasoning_tokens);
        reportedTotal = count(u.total_tokens);
        return;
      }
      for (const [field, key] of [["inputTokens", "input_tokens"], ["outputTokens", "output_tokens"], ["cacheReadTokens", "cache_read_input_tokens"], ["cacheWriteTokens", "cache_creation_input_tokens"]] as const) {
        const n = count(u[key]); if (n !== null) entry[field] = n;
      }
      const hour = count(object(u.cache_creation).ephemeral_1h_input_tokens);
      if (hour !== null) entry.cacheWrite1hTokens = hour;
    }
    async function finish(status: AiUsageStatus, complete = false) {
      if (finished) return;
      finished = true;
      entry.status = status; entry.usageComplete = complete && entry.inputTokens !== null && entry.outputTokens !== null;
      if (entry.usageComplete) {
        entry.cacheReadTokens ??= 0; entry.cacheWriteTokens ??= 0;
        if (entry.cacheWriteTokens === 0) entry.cacheWrite1hTokens ??= 0;
      }
      entry.completedAt = new Date().toISOString(); entry.durationMs = Date.now() - started;
      entry.totalTokens = reportedTotal ?? (entry.inputTokens === null && entry.outputTokens === null ? null : (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0) + (entry.cacheReadTokens ?? 0) + (entry.cacheWriteTokens ?? 0));
      entry.estimatedCostUsd = estimateAiCost(entry);
      entry.pricingVersion = entry.estimatedCostUsd === null ? null : AI_PRICING_VERSION;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Bound telemetry latency. The write may still finish after the deadline.
        await Promise.race([writer(entry), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Telemetry timeout")), 3000); })]);
      } catch {
        console.error("[ai-usage] history write unavailable", JSON.stringify(entry));
      } finally { if (timer) clearTimeout(timer); }
    }
    let response: Response;
    try { response = await fetcher(input, init); }
    catch (error) { await finish("error"); throw error; }
    entry.httpStatus = response.status;
    entry.providerRequestId = safeId(response.headers.get(provider === "openai" ? "x-request-id" : "request-id"));
    if (!response.ok) { await finish("error"); return response; }
    if (!(response.headers.get("content-type") || "").includes("text/event-stream")) {
      try {
        const message = object(await response.clone().json());
        entry.messageId = safeId(message.id); usage(message.usage);
        if (typeof message.model === "string" && /^[\w.-]{1,100}$/.test(message.model)) entry.model = message.model;
        await finish(message.status === "failed" ? "error" : message.status === "incomplete" ? "interrupted" : "success", true);
      } catch { await finish("interrupted"); }
      return response;
    }
    if (!response.body) { await finish("interrupted"); return response; }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalOutputReported = false;
    async function observe(chunk: Uint8Array) {
      buffer += decoder.decode(chunk, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trimEnd(); buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        try {
          const data = line.slice(5).trim();
          if (provider === "openai" && data === "[DONE]") { await finish("success", finalOutputReported); continue; }
          const event = object(JSON.parse(data));
          if (provider === "openai") {
            const message = object(event.response ?? event);
            entry.messageId = safeId(message.id) ?? entry.messageId;
            if (typeof message.model === "string" && /^[\w.-]{1,100}$/.test(message.model)) entry.model = message.model;
            usage(message.usage);
            if (entry.inputTokens !== null && entry.outputTokens !== null) finalOutputReported = true;
            if (event.type === "response.completed") await finish("success", finalOutputReported);
            else if (event.type === "response.incomplete") await finish("interrupted", finalOutputReported);
            else if (event.type === "response.failed" || event.type === "error" || event.error) await finish("error", finalOutputReported);
            continue;
          }
          if (event.type === "message_start") {
            const message = object(event.message); entry.messageId = safeId(message.id); usage(message.usage);
            if (typeof message.model === "string" && /^[\w.-]{1,100}$/.test(message.model)) entry.model = message.model;
          } else if (event.type === "message_delta") {
            usage(event.usage); // cumulative, never sum deltas
            if (count(object(event.usage).output_tokens) !== null) finalOutputReported = true;
          } else if (event.type === "message_stop") await finish("success", finalOutputReported);
          else if (event.type === "error") await finish("error");
        } catch { /* Observing must not change the SDK's parsing/error behavior. */ }
      }
      if (buffer.length > 1_000_000) buffer = "";
    }
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const result = await reader.read();
          if (result.done) { await finish("interrupted"); controller.close(); return; }
          await observe(result.value); controller.enqueue(result.value);
        } catch (error) { await finish("interrupted"); controller.error(error); }
      },
      async cancel(reason) { try { await reader.cancel(reason); } finally { await finish("interrupted"); } },
    });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}
/** Use as the SDK's `fetch` option, or as a direct fetch replacement.
 * Chat Completions streaming callers must set stream_options.include_usage=true;
 * otherwise the history correctly reports unknown consumption.
 */
export function trackedOpenAiFetch(feature: string, fetcher?: typeof fetch, writer?: UsageWriter, source: AiUsageEntry["source"] = "server"): typeof fetch {
  return trackedAiFetch("openai", feature, fetcher, writer, source);
}
