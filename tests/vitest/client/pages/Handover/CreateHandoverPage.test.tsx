/*
 * Purpose: verifies the admin handover (Proces Verbal) creation page — event
 * prefill from navigation state, the searchable event picker, validation, and
 * the submission payload — without calling the live API.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import CreateHandoverPage from "src/client/features/admin/components/Handover/CreateHandoverPage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderPage(state?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/admin/handover/new", state }]}>
      <Routes>
        <Route path="/admin/handover/new" element={<CreateHandoverPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeFetchMock(events: unknown[], handoverResponse: { ok: boolean; status?: number; json: () => Promise<unknown> }) {
  return vi.fn().mockImplementation((url: string) => {
    if (String(url).includes("/api/admin/events")) {
      return Promise.resolve({ ok: true, json: async () => ({ events }) });
    }
    return Promise.resolve(handoverResponse);
  });
}

describe("CreateHandoverPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
  });

  describe("happy path", () => {
    test("prefills from event navigation state and submits the default day windows", async () => {
      const fetchMock = makeFetchMock([], {
        ok: true,
        status: 201,
        json: async () => ({ id: "handover-1", token: "token-1" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      renderPage({
        eventId: "event-1",
        eventType: "Nuntă",
        eventDate: "2026-09-12",
        clientEmail: "client@example.com",
        clientFullName: "Ion Popescu",
      });

      expect(await screen.findByText("Pre-completat din eveniment ↗")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Salvează procesul verbal" }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/admin/handover");
      });

      const handoverCall = fetchMock.mock.calls.find(([url]) => url === "/api/handover");
      expect(handoverCall).toBeDefined();
      const [, request] = handoverCall!;
      expect(request.method).toBe("POST");
      expect(JSON.parse(request.body as string)).toEqual({
        eventId: "event-1",
        eventType: "Nuntă",
        eventDate: "2026-09-12",
        clientName: "Ion Popescu",
        clientEmail: "client@example.com",
        digitalLinkUrl: "",
        courierDeliveryDays: 7,
        materialsReportWindowDays: 7,
        digitalLinkExpiryDays: 30,
      });
    });

    test("selects an event from the search dropdown and auto-suggests the digital link", async () => {
      const fetchMock = makeFetchMock([
        {
          id: "event-2",
          type: "Botez",
          eventDate: "2026-10-01T00:00:00.000Z",
          albumSlug: "botez-maria",
          client: { fullName: "Maria Ionescu", email: "maria@example.com" },
        },
      ], { ok: true, status: 201, json: async () => ({ id: "handover-2", token: "token-2" }) });
      vi.stubGlobal("fetch", fetchMock);

      renderPage();

      const searchInput = await screen.findByPlaceholderText("Ex: Popescu, Nuntă, 2026-08-...");
      fireEvent.change(searchInput, { target: { value: "Maria" } });

      fireEvent.click(await screen.findByText(/Maria Ionescu/));

      expect(screen.getByDisplayValue("maria@example.com")).toBeInTheDocument();
      const digitalLinkInput = screen.getByPlaceholderText("https://ancavisuals.ro/qr-moments/...") as HTMLInputElement;
      expect(digitalLinkInput.value).toContain("/qr-moments/botez-maria");
    });
  });

  describe("validation and error states", () => {
    test("blocks submit when no event/client data is present", async () => {
      vi.stubGlobal("fetch", makeFetchMock([], { ok: true, status: 201, json: async () => ({}) }));

      renderPage();

      await screen.findByText("Proces Verbal nou");
      fireEvent.click(screen.getByRole("button", { name: "Salvează procesul verbal" }));

      expect(await screen.findByText("Selectează un eveniment și completează emailul clientului.")).toBeInTheDocument();
    });

    test("shows API errors returned during creation", async () => {
      const fetchMock = makeFetchMock([], {
        ok: false,
        status: 500,
        json: async () => ({ error: "Nu s-a putut crea procesul verbal." }),
      });
      vi.stubGlobal("fetch", fetchMock);

      renderPage({
        eventId: "event-1",
        eventType: "Nuntă",
        eventDate: "2026-09-12",
        clientEmail: "client@example.com",
      });

      await screen.findByText("Pre-completat din eveniment ↗");
      fireEvent.click(screen.getByRole("button", { name: "Salvează procesul verbal" }));

      expect(await screen.findByText("Nu s-a putut crea procesul verbal.")).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
