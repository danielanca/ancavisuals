import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import PhotoConsensusAdminPage from "src/client/features/admin/components/PhotoConsensusAdminPage";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test-token", role: "admin" } }) }));
beforeEach(() => vi.restoreAllMocks());

const consensus = (proposals: unknown[], albumSlug = "album") => ({ albums: ["album", "alt-album"], albumSlug, proposals, reviewers: [], coverage: { total: 10, seen: {} } });

function renderPage(path = "/admin/instagram-proposals/selectie-comuna") {
  return render(<MemoryRouter initialEntries={[path]}><PhotoConsensusAdminPage /></MemoryRouter>);
}

test("separate admin page loads common choices and links back to proposals", async () => {
  const proposals = ["daniel", "estera", "salomeea"].map(reviewerId => ({ id: reviewerId, reviewerId, proposedBy: reviewerId,
    albumSlug: "album", fileName: "chosen.jpg", photoUrl: "https://cdn.test/chosen.jpg", destinations: ["instagram", "media_assets"] }));
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => consensus(proposals) } as Response);
  renderPage();
  expect(await screen.findByAltText("chosen.jpg")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "← Propuneri Media" })).toHaveAttribute("href", "/admin/instagram-proposals");
  expect(fetch).toHaveBeenCalledWith("/api/instagram-proposals/admin/consensus", expect.objectContaining({ headers: { Authorization: "Bearer test-token" } }));
});

test("failed loading reports the error on the dedicated page", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, json: async () => ({ error: "Acces interzis" }) } as Response);
  renderPage();
  expect(await screen.findByRole("alert")).toHaveTextContent("Acces interzis");
});


test("moderation stays disabled until selection is enabled and accepts all votes for one photo", async () => {
  const proposals = ["daniel", "estera", "salomeea"].map(reviewerId => ({ id: reviewerId, reviewerId, proposedBy: reviewerId,
    albumSlug: "album", fileName: "chosen.jpg", photoUrl: "https://cdn.test/chosen.jpg", status: "pending", destinations: ["instagram", "media_assets"] }));
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => ({
    ok: true, json: async () => options?.method === "PATCH" ? { ok: true } : consensus(proposals),
  } as Response));
  renderPage();
  await screen.findByAltText("chosen.jpg");
  expect(screen.queryByRole("button", { name: "Acceptă chosen.jpg" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Activează acceptarea" }));
  fireEvent.click(screen.getByRole("button", { name: "Acceptă chosen.jpg" }));
  await screen.findByText("Acceptată");
  const patches = fetchMock.mock.calls.filter(([, options]) => options?.method === "PATCH");
  expect(patches).toHaveLength(3);
  expect(patches.map(([url]) => url)).toEqual(["/api/instagram-proposals/daniel", "/api/instagram-proposals/estera", "/api/instagram-proposals/salomeea"]);
  for (const [, options] of patches) expect(JSON.parse(String(options?.body))).toEqual({ status: "accepted" });
});

test("failed moderation reports an error and leaves the photo unaccepted", async () => {
  const proposals = ["daniel", "estera", "salomeea"].map(reviewerId => ({ id: reviewerId, reviewerId, proposedBy: reviewerId,
    albumSlug: "album", fileName: "chosen.jpg", photoUrl: "https://cdn.test/chosen.jpg", status: "pending" }));
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => ({
    ok: options?.method !== "PATCH", json: async () => options?.method === "PATCH" ? { error: "Import eșuat" } : consensus(proposals),
  } as Response));
  renderPage();
  await screen.findByAltText("chosen.jpg");
  fireEvent.click(screen.getByRole("switch", { name: "Activează acceptarea" }));
  fireEvent.click(screen.getByRole("button", { name: "Acceptă chosen.jpg" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Import eșuat");
  expect(screen.queryByText("Acceptată")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Acceptă chosen.jpg" })).not.toBeDisabled());
});

test("one album at a time: choosing another album loads its votes", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async url => ({
    ok: true, json: async () => consensus([], String(url).includes("alt-album") ? "alt-album" : "album"),
  } as Response));
  renderPage();
  const select = await screen.findByRole("combobox", { name: "Albumul" });
  expect(select).toHaveValue("album");
  fireEvent.change(select, { target: { value: "alt-album" } });
  await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/instagram-proposals/admin/consensus?albumSlug=alt-album", expect.anything()));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Albumul" })).toHaveValue("alt-album"));
  expect(screen.getByRole("link", { name: "Deschide albumul ↗" })).toHaveAttribute("href", "/media/alt-album");
});
