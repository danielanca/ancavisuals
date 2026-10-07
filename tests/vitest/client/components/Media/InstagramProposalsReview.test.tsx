import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import InstagramProposalsAdminPage from "src/client/features/admin/components/InstagramProposalsAdminPage";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { role: "admin", accessToken: "token" } }) }));
beforeEach(() => vi.restoreAllMocks());

test("pending proposals only expose moderation after the shared selection toggle", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ proposals: [{
    id: "vote-1", albumSlug: "album", fileName: "photo.jpg", photoUrl: "https://cdn.test/photo.jpg",
    proposedBy: "ancadaniel1994@gmail.com", proposedAt: "2026-10-06", status: "pending", destinations: ["instagram"],
  }] }) } as Response);
  render(<MemoryRouter><InstagramProposalsAdminPage /></MemoryRouter>);
  await screen.findByAltText("photo.jpg");
  expect(screen.queryByRole("button", { name: "Acceptă photo.jpg" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Activează selectarea" }));
  expect(screen.getByRole("button", { name: "Acceptă photo.jpg" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Respinge photo.jpg" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Acceptă photo.jpg" }));
  expect(screen.getByRole("button", { name: "Confirmă" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Dezactivează selectarea" }));
  expect(screen.queryByRole("button", { name: "Confirmă" })).not.toBeInTheDocument();
});
