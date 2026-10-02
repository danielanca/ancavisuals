/*
 * Purpose: a lead can be deleted from /admin/leads after confirming.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
vi.mock("src/client/features/admin/components/Breadcrumb", () => ({ default: () => null }));

import LeadsPage from "src/client/features/admin/components/LeadsPage";

afterEach(() => { vi.unstubAllGlobals(); });

describe("LeadsPage delete", () => {
  test("deletes a lead after confirmation", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      if (url.includes("/leads")) return Promise.resolve({ ok: true, json: async () => ({ leads: [
        { id: "l1", source: "configurator", name: "Ion Pop", phone: "0711111111", emailStatus: "sent", createdAt: new Date().toISOString() },
      ] }) });
      return Promise.resolve({ ok: true, json: async () => ({ emails: [] }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><LeadsPage /></MemoryRouter>);

    fireEvent.click(await screen.findByLabelText("Șterge lead-ul Ion Pop"));
    expect(screen.getByText("Ștergi lead-ul?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Șterge" }));

    await waitFor(() => expect(screen.queryByText("Ion Pop")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/leads/l1", expect.objectContaining({ method: "DELETE" }));
  });
});
