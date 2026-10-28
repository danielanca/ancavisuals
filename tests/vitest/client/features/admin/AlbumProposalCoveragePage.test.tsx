/*
 * Purpose: /admin/instagram-proposals/albume — albums under the Instagram / Media Assets minimum.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import AlbumProposalCoveragePage from "src/client/features/admin/components/AlbumProposalCoveragePage";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

test("lists albums without enough proposals and follows the chosen minimums", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ albums: [
    { slug: "08august2026", name: "Ana · Nuntă", eventDate: "2026-08-08T00:00:00Z", instagram: 2, mediaAssets: 12, accepted: 1, people: ["estera"], lastProposedAt: "2026-10-01T10:00:00Z" },
    { slug: "06septembrie2026", name: "Bia · Nuntă", eventDate: "2026-09-06T00:00:00Z", instagram: 0, mediaAssets: 0, accepted: 0, people: [], lastProposedAt: null },
    { slug: "full", name: "Cris · Botez", eventDate: "2026-07-01T00:00:00Z", instagram: 15, mediaAssets: 15, accepted: 0, people: ["daniel"], lastProposedAt: null },
  ] }) })));
  render(<MemoryRouter><AlbumProposalCoveragePage /></MemoryRouter>);

  const list = await screen.findByRole("list", { name: "Albume" });
  expect(within(list).getAllByRole("listitem").map((item) => item.getAttribute("aria-label"))).toEqual(["Bia · Nuntă", "Ana · Nuntă"]);
  expect(within(screen.getByRole("listitem", { name: "Ana · Nuntă" })).getByText("2/10 · lipsesc 8")).toBeInTheDocument();
  expect(screen.getByText("Nimeni n-a propus încă.")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Lipsă Media Assets" }));
  expect(within(list).getAllByRole("listitem").map((item) => item.getAttribute("aria-label"))).toEqual(["Bia · Nuntă"]);

  fireEvent.click(screen.getByRole("button", { name: "Toate" }));
  fireEvent.change(screen.getByLabelText("Minim Instagram"), { target: { value: "1" } });
  expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem("albumProposalCoverage:minimums")!)).toEqual({ instagram: 1, mediaAssets: 10 });
});
