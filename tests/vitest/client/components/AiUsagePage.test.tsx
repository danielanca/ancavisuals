import React from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AiUsagePage from "src/client/features/admin/components/AiUsagePage";
import type { AiUsageEntry } from "src/shared/ai/usage";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test-admin-token" } }) }));
const fetchMock = vi.fn();
const fixture: AiUsageEntry = {
  id: "test-1", createdAt: "2026-10-12T10:30:00.000Z", completedAt: "2026-10-12T10:30:02.000Z",
  feature: "Extrase bancare", operation: "A doua analiză: corectare sold extras", model: "claude-haiku-4-5-20251001",
  route: "POST /api/admin/bank-statements/upload-analyze", appRequestId: "app-1", source: "server",
  providerRequestId: "req-test", messageId: "msg-test", status: "success", httpStatus: 200, durationMs: 2000,
  provider: "anthropic", reasoningTokens: null,
  inputTokens: 100, outputTokens: 25, cacheReadTokens: 50, cacheWriteTokens: 10, cacheWrite1hTokens: 0,
  totalTokens: 185, usageComplete: true, estimatedCostUsd: 0.0002425, pricingVersion: "anthropic-2026-10-12",
};
function reply(items: AiUsageEntry[], nextCursor: string | null = null) {
  return { ok: true, json: async () => ({ items, nextCursor }) };
}
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
test("shows context, exact token breakdown and Romania time with honest partial totals", async () => {
  fetchMock.mockResolvedValue(reply([fixture, { ...fixture, id: "test-2", status: "error", usageComplete: false, totalTokens: null, inputTokens: null, outputTokens: null, estimatedCostUsd: null }]));
  render(<AiUsagePage />);
  await waitFor(() => expect(screen.getByRole("region", { name: "Rezumat înregistrări încărcate" })).toHaveTextContent("2 apeluri"));
  expect(screen.getAllByText("A doua analiză: corectare sold extras")).toHaveLength(2);
  expect(screen.getAllByText(/13:30:00/)).toHaveLength(2);
  expect(screen.getByRole("region", { name: "Rezumat înregistrări încărcate" })).toHaveTextContent("185");
  expect(screen.getByText(/1 apel cu consum incomplet/)).toBeInTheDocument();
  const article = screen.getAllByRole("article")[0];
  for (const value of ["100", "25", "50", "10", "185"]) expect(within(article).getByText(value)).toBeInTheDocument();
  expect(within(article).getByText("req-test")).toBeInTheDocument();
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-admin-token");
});
test("loads older calls without duplicate rows and searches loaded context", async () => {
  fetchMock.mockResolvedValueOnce(reply([fixture], "cursor-1")).mockResolvedValueOnce(reply([fixture, { ...fixture, id: "test-2", feature: "Feedback clienți", operation: null }], null));
  render(<AiUsagePage />);
  fireEvent.click(await screen.findByRole("button", { name: "Încarcă apeluri mai vechi" }));
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
  expect(fetchMock.mock.calls[1][0]).toContain("cursor=cursor-1");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Feedback" } });
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Încarcă apeluri mai vechi" })).not.toBeInTheDocument();
});
test("date filter sends server range and clears the old page", async () => {
  fetchMock.mockResolvedValueOnce(reply([fixture])).mockResolvedValue(reply([]));
  render(<AiUsagePage />); await screen.findByRole("article");
  fireEvent.change(screen.getByLabelText("De la"), { target: { value: "2026-10-12" } });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1][0]).toContain("start=2026-10-12");
  await waitFor(() => expect(screen.queryByRole("article")).not.toBeInTheDocument());
});
test("read errors are visible and retryable", async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Istoric indisponibil" }) }).mockResolvedValue(reply([fixture]));
  render(<AiUsagePage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Istoric indisponibil");
  fireEvent.click(screen.getByRole("button", { name: "Reîncarcă" }));
  await screen.findByRole("article"); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
