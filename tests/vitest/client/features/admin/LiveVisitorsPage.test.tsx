import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import LiveVisitorsPage from "src/client/features/admin/components/LiveVisitorsPage";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
vi.mock("src/client/features/admin/components/Breadcrumb", () => ({ default: () => null }));

const sample = (sessionId: string, page: string, attribution: Record<string, string>) => ({
  sessionId, visitorId: sessionId, visitorNumber: 1, isNew: true,
  firstSeenAt: Date.parse("2026-09-23T10:00:00Z"), lastSeenAt: Date.parse("2026-09-23T10:01:00Z"),
  lastEventAt: Date.parse("2026-09-23T10:00:00Z"), endedAt: Date.parse("2026-09-23T10:01:00Z"),
  durationSeconds: 60, currentPage: page, pageCount: 1, path: [{ page, at: Date.parse("2026-09-23T10:00:00Z") }],
  events: [], attribution, isGoogleAds: Boolean(attribution.gclid), source: "direct",
  city: "Cluj", country: "RO", deviceType: "desktop", idle: false,
});
const records = [sample("ads123", "/oferta", { gclid: "x" }), sample("client456", "/media/album", { gclid: "y" }), sample("chat789", "/blog/article", { utmSource: "chatgpt" })];
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-23T12:00:00Z"));
  fetchMock = vi.fn(async (url: string) => url.includes("/history")
    ? { ok: true, json: async () => ({ sessions: records, visitorNumbers: { "visitor:ads123": 1, "visitor:client456": 2, "visitor:chat789": 3 }, nextCursor: null }) }
    : { ok: false, status: 503 });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Live Visits daily interface", () => {
  test("separates paid prospects, album customers and ChatGPT traffic", async () => {
    render(<LiveVisitorsPage />);
    await screen.findByText("3 sesiuni începute în ziua aleasă");
    const channels = screen.getByRole("navigation", { name: "Surse de trafic" });
    fireEvent.click(within(channels).getByRole("button", { name: "Google Ads 1" }));
    const list = screen.getByRole("region", { name: "Lista sesiunilor" });
    expect(within(list).getByText("Vizitator #1")).toBeTruthy();
    expect(within(list).queryByText("Vizitator #2")).toBeNull();
    fireEvent.click(within(channels).getByRole("button", { name: "AI / LLM 1" }));
    expect(within(list).getByText("Vizitator #3")).toBeTruthy();
    expect(screen.getByText("chatgpt")).toBeTruthy();
  });

  test("date selection requests the chosen day from the server", async () => {
    render(<LiveVisitorsPage />);
    await screen.findByText("3 sesiuni începute în ziua aleasă");
    fireEvent.change(screen.getByLabelText("Data vizitelor"), { target: { value: "2026-09-22" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes("date=2026-09-22"))).toBe(true));
  });

  test("failed archive leaves the session visible and reports failure", async () => {
    render(<LiveVisitorsPage />);
    await screen.findByText("3 sesiuni începute în ziua aleasă");
    fireEvent.click(screen.getByRole("button", { name: "Arhivează", exact: true }));
    await screen.findByRole("alert");
    expect(within(screen.getByRole("region", { name: "Lista sesiunilor" })).getByText("Vizitator #1")).toBeTruthy();
  });

  test("history errors are not presented as zero visits", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    render(<LiveVisitorsPage />);
    await screen.findByRole("alert");
    expect(screen.getByText("Date indisponibile")).toBeTruthy();
    expect(screen.queryByText("Nicio sesiune pentru selecția ta")).toBeNull();
  });
});
