/*
 * Purpose: verifies the admin contract creation page validations, computed totals,
 * and submission payload without calling the live API.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import CreateContractPage from "src/client/features/admin/components/Contracts/CreateContractPage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/contracts/create"]}>
      <Routes>
        <Route path="/admin/contracts/create" element={<CreateContractPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Builds a fetch mock that routes the EUR rate request separately from the
// contract submission so tests can assert on the contract call independently.
function makeFetchMock(contractResponse: { ok: boolean; status?: number; json: () => Promise<unknown> }) {
  return vi.fn().mockImplementation((url: string) => {
    if (String(url).includes("frankfurter")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ rates: { RON: 5 }, date: "2026-05-14" }),
      });
    }
    return Promise.resolve(contractResponse);
  });
}

function getEventTypeSelect() {
  const select = screen.getAllByRole("combobox")[0];
  if (!select) throw new Error("Event type select not found");
  return select;
}

function getEventDateInput() {
  const input = document.querySelectorAll('input[type="date"]')[0];
  if (!input) throw new Error("Event date input not found");
  return input;
}

function getAdvanceInput(manualTotal = false) {
  const inputs = document.querySelectorAll('input[inputMode="decimal"]');
  const input = inputs[manualTotal ? 1 : 0];
  if (!input) throw new Error("Advance input not found");
  return input;
}

function getPriceTotalInput() {
  const input = document.querySelectorAll('input[inputMode="decimal"]')[0];
  if (!input) throw new Error("Price total input not found");
  return input;
}

describe("CreateContractPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
  });

  describe("happy path", () => {
    test("submits computed totals and custom services payload", async () => {
      const fetchMock = makeFetchMock({
        ok: true,
        status: 201,
        json: async () => ({ id: "contract-1", token: "token-1" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      renderPage();

      // "Altul" has no template — all services start unchecked, no transport complications
      fireEvent.change(getEventTypeSelect(), { target: { value: "Altul" } });

      const futureDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      fireEvent.change(getEventDateInput(), { target: { value: futureDate } });

      // Click first service checkbox (foto_video) to include it, then set price
      fireEvent.click(screen.getAllByRole("checkbox")[0]);
      fireEvent.change(screen.getByPlaceholderText("Preț / GRATUIT"), {
        target: { value: "GRATUIT" },
      });

      fireEvent.click(screen.getByRole("button", { name: "+ Adaugă serviciu custom" }));
      fireEvent.change(screen.getByPlaceholderText("Denumire serviciu"), {
        target: { value: "Dronă" },
      });
      fireEvent.change(screen.getAllByPlaceholderText("Preț / GRATUIT")[1], {
        target: { value: "250" },
      });

      fireEvent.change(screen.getByPlaceholderText("client@email.com"), {
        target: { value: "client@example.com" },
      });
      fireEvent.change(getAdvanceInput(), { target: { value: "100" } });

      fireEvent.click(screen.getByRole("button", { name: "Salvează contractul" }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/admin/contracts");
      });

      const contractCall = fetchMock.mock.calls.find(([url]) => url === "/api/contracts");
      expect(contractCall).toBeDefined();
      const [, request] = contractCall!;
      expect(request.method).toBe("POST");

      expect(JSON.parse(request.body as string)).toEqual({
        eventType: "Altul",
        eventDate: futureDate,
        eventLocation: "",
        eventStartTime: "",
        eventEndTime: "",
        eventDetails: "",
        services: [
          { label: "Foto + Video (1 fotograf + 1 videograf)", price: 0, gratuit: true },
          { label: "Dronă", price: 250, gratuit: false },
        ],
        currency: "RON",
        eurRate: 5,
        priceTotal: 250,
        priceAdvance: 100,
        priceRest: 150,
        advancePaidAt: "",
        restPaidAt: "",
        paymentMethod: "Transfer bancar",
        bankBeneficiaryName: "",
        bankIban: "",
        clientEmail: "client@example.com",
        clientName: "",
        clientPhone: "",
        clientAddress: "",
        clientIdSeries: "",
        privateClient: false,
        transportKm: "",
        transportFuelPrice: "10",
      });
    });

    test("allows manual total override and shows the adjusted rest amount", async () => {
      renderPage();

      fireEvent.click(screen.getByLabelText("manual"));
      fireEvent.change(getPriceTotalInput(), {
        target: { value: "900" },
      });

      fireEvent.change(getAdvanceInput(true), { target: { value: "250" } });

      expect(screen.getAllByText("650 RON")).toHaveLength(2);
    });
  });

  describe("validation and error states", () => {
    test("rejects missing event type", async () => {
      renderPage();

      const futureDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      fireEvent.change(getEventDateInput(), { target: { value: futureDate } });
      fireEvent.change(screen.getByPlaceholderText("client@email.com"), {
        target: { value: "client@example.com" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Salvează contractul" }));

      expect(await screen.findByText("Selectează tipul evenimentului.")).toBeInTheDocument();
    });

    test("marks selected services with missing prices", async () => {
      renderPage();

      // "Altul" → no template → click first service to include it, clear its price
      fireEvent.change(getEventTypeSelect(), { target: { value: "Altul" } });

      const futureDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      fireEvent.change(getEventDateInput(), { target: { value: futureDate } });

      fireEvent.change(screen.getByPlaceholderText("client@email.com"), {
        target: { value: "client@example.com" },
      });

      fireEvent.click(screen.getAllByRole("checkbox")[0]);
      fireEvent.change(screen.getByPlaceholderText("Preț / GRATUIT"), {
        target: { value: "" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Salvează contractul" }));

      expect(await screen.findByText("Completează prețul (sau scrie GRATUIT) pentru serviciile bifate marcate în roșu.")).toBeInTheDocument();
    });

    test("shows API errors returned during contract creation", async () => {
      const fetchMock = makeFetchMock({
        ok: false,
        status: 500,
        json: async () => ({ error: "Nu s-a putut crea contractul." }),
      });
      vi.stubGlobal("fetch", fetchMock);

      renderPage();

      // "Altul" → no template → no transport complication
      fireEvent.change(getEventTypeSelect(), { target: { value: "Altul" } });
      const futureDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      fireEvent.change(getEventDateInput(), { target: { value: futureDate } });
      fireEvent.change(screen.getByPlaceholderText("client@email.com"), {
        target: { value: "client@example.com" },
      });

      fireEvent.click(screen.getAllByRole("checkbox")[0]);
      fireEvent.change(screen.getByPlaceholderText("Preț / GRATUIT"), {
        target: { value: "500" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Salvează contractul" }));

      expect(await screen.findByText("Nu s-a putut crea contractul.")).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
