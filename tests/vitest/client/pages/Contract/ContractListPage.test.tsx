/*
 * Purpose: verifies the admin contract list page fetch/render behavior,
 * send-link flow, and direct link copy interactions.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ContractListPage from "src/client/features/admin/components/Contracts/ContractListPage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const contractsFixture = [
  {
    id: "contract-1",
    token: "token-1",
    status: "draft",
    eventType: "Nunta",
    eventDate: "2026-09-12T00:00:00.000Z",
    clientEmail: "client@example.com",
    priceTotal: 1200,
    createdAt: "2026-04-14T10:00:00.000Z",
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/contracts"]}>
      <Routes>
        <Route path="/admin/contracts" element={<ContractListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ContractListPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("alert", vi.fn());
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "https://ancavisuals.ro" },
    });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe("happy path", () => {
    test("loads and renders the contract list", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ contracts: contractsFixture }),
      }));

      renderPage();

      expect(screen.getByText("Se încarcă...")).toBeInTheDocument();
      expect(await screen.findByText("Nunta")).toBeInTheDocument();
      expect(screen.getByText("1 contracte totale")).toBeInTheDocument();
      expect(screen.getByText("Client: client@example.com")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Acțiuni" })).toBeInTheDocument();
    });

    test("sends the contract link and updates the visible status", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ contracts: contractsFixture }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ dates: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true }),
        });
      vi.stubGlobal("fetch", fetchMock);

      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: "Acțiuni" }));
      fireEvent.click(await screen.findByRole("button", { name: /Trimite link/ }));

      // ConfirmModal apare — confirmăm acțiunea
      fireEvent.click(await screen.findByRole("button", { name: "Trimite" }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(3);
      });

      // calls[0] = /api/contracts, calls[1] = /api/admin/booked-dates, calls[2] = send
      expect(fetchMock.mock.calls[2][0]).toBe("/api/contracts/contract-1/send");
      expect(fetchMock.mock.calls[2][1]).toEqual({ method: "POST" });
      expect(await screen.findByText("Trimis")).toBeInTheDocument();
    });

    test("copies the public signing link to clipboard", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ contracts: contractsFixture }),
      }));

      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: "Acțiuni" }));
      fireEvent.click(await screen.findByRole("button", { name: /Copiază link/ }));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://ancavisuals.ro/contract/token-1");
      expect(await screen.findByText("Link copiat în clipboard!")).toBeInTheDocument();
    });
  });

  describe("error and guard paths", () => {
    test("does not send the link when confirmation is cancelled", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ contracts: contractsFixture }),
      }));
      vi.stubGlobal("confirm", vi.fn(() => false));

      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: "Acțiuni" }));
      fireEvent.click(await screen.findByRole("button", { name: /Trimite link/ }));

      // 2 fetches on mount (contracts + booked-dates), none for send since modal was not confirmed
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test("shows fetch errors from the initial contract list request", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: "Nu s-au putut încărca contractele." }),
      }));

      renderPage();

      expect(await screen.findByText("Eroare: Nu s-au putut încărca contractele.")).toBeInTheDocument();
    });
  });
});
