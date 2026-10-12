export type AiUsageStatus = "success" | "error" | "interrupted";
export interface AiUsageEntry {
  id: string;
  createdAt: string;
  completedAt: string;
  feature: string;
  operation: string | null;
  route: string | null;
  appRequestId: string | null;
  source: "server" | "script";
  provider: string;
  model: string;
  providerRequestId: string | null;
  messageId: string | null;
  status: AiUsageStatus;
  httpStatus: number | null;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  cacheWrite1hTokens: number | null;
  totalTokens: number | null;
  reasoningTokens: number | null;
  usageComplete: boolean;
  estimatedCostUsd: number | null;
  pricingVersion: string | null;
}

// USD / million tokens. Snapshot of official Anthropic pricing, 2026-10-12.
// Unknown models and incomplete streams deliberately have no cost estimate.
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-4-5-20251001": [1, 5],
  "claude-haiku-4-5": [1, 5],
  "claude-sonnet-4-6": [3, 15],
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-fable-5-1": [10, 50],
};
export const AI_PRICING_VERSION = "anthropic-2026-10-12";
export function estimateAiCost(entry: Pick<AiUsageEntry, "provider" | "model" | "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens" | "cacheWrite1hTokens" | "usageComplete">): number | null {
  const price = entry.provider === "anthropic" ? PRICES[entry.model] : undefined;
  if (!price || !entry.usageComplete || entry.inputTokens == null || entry.outputTokens == null) return null;
  const [input, output] = price;
  const readMultiplier = entry.model === "claude-fable-5-1" ? 0.025 : entry.model === "claude-opus-5-5" ? 0.05 : 0.1;
  const writes = entry.cacheWriteTokens ?? 0;
  const hour = Math.min(writes, entry.cacheWrite1hTokens ?? 0);
  return (entry.inputTokens * input + entry.outputTokens * output + (entry.cacheReadTokens ?? 0) * input * readMultiplier + (writes - hour) * input * 1.25 + hour * input * 2) / 1_000_000;
}
