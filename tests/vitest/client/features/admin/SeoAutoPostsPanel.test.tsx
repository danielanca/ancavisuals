/*
 * Purpose: SEO Radar → "Articole automate" lists the absent keywords and published AI articles,
 * and starts a run from the button.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import SeoAutoPostsPanel from "src/client/features/admin/components/SeoAutoPostsPanel";

afterEach(() => vi.unstubAllGlobals());

test("shows what comes next and what was published, and starts a run", async () => {
  const overview = {
    lastRunAt: "2026-10-28T08:00:00Z", running: false,
    absent: [{ keyword: "fotocabina Dej", city: "Dej", lastScanAt: "" }, { keyword: "foto botez Dej", city: "Dej", lastScanAt: "" }, { keyword: "video Bistrita", city: "Bistrita", lastScanAt: "" }],
    posts: [{ keyword: "fotograf nunta Turda", status: "published", slug: "fotograf-nunta-turda-2", title: "Fotograf nuntă Turda", at: "2026-10-28T08:01:00Z", trigger: "după deploy" }],
  };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
    init?.method === "POST" ? { ok: true, status: 202, json: async () => ({ started: true }) } : { ok: true, status: 200, json: async () => overview });
  vi.stubGlobal("fetch", fetchMock);

  render(<SeoAutoPostsPanel />);
  expect(await screen.findByText("fotocabina Dej")).toBeInTheDocument();
  expect(screen.getAllByText("următorul")).toHaveLength(2);
  expect(screen.getByRole("link", { name: "Fotograf nuntă Turda ↗" })).toHaveAttribute("href", "/blog/fotograf-nunta-turda-2");

  fireEvent.click(screen.getByRole("button", { name: "Scrie și publică 2 acum" }));
  expect(await screen.findByText(/Claude scrie și publică articolele/)).toBeInTheDocument();
  expect(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![0]).toBe("/api/admin/seo-auto-posts/run");
});
