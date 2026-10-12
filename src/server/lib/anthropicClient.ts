import Anthropic, { type ClientOptions } from "@anthropic-ai/sdk";
import { trackedAiFetch, type UsageWriter } from "./aiUsage";
import type { AiUsageEntry } from "../../shared/ai/usage";
export { aiUsageContext, withAiOperation } from "./aiUsage";

export function trackedAnthropicFetch(feature: string, fetcher?: typeof fetch, writer?: UsageWriter, source: AiUsageEntry["source"] = "server"): typeof fetch {
  return trackedAiFetch("anthropic", feature, fetcher, writer, source);
}
export function createAnthropicClient(feature: string, options: ClientOptions = {}, source: AiUsageEntry["source"] = "server"): Anthropic {
  return new Anthropic({ ...options, fetch: trackedAnthropicFetch(feature, options.fetch as typeof fetch | undefined, undefined, source) });
}
