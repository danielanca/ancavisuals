/*
 * Purpose: verifies the public contract-signing page fetch flow, validation,
 * and submission payload handling without calling the live API.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ContractSignPage from "src/client/pages/Contract/ContractSignPage";

const contractFixture = {
  id: "contract-1",
  status: "sent",
  eventType: "Nunta",
  eventDate: "2026-09-12",
  eventLocation: "Cluj-Napoca",
  eventStartTime: "14:00",
  eventEndTime: "02:00",
  eventDetails: "Ședință foto înainte de ceremonie",
  services: [
    { label: "Fotografie", price: 1000 },
    { label: "Videografie", price: 500 },
  ],
  currency: "EUR",
  priceTotal: 1500,
  priceAdvance: 500,
  advancePaidAt: "2026-08-01",
  priceRest: 1000,
  restPaidAt: "2026-09-10",
  paymentMethod: "Transfer bancar",
};

function renderPage(path = "/contract/token-1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/contract/:token" element={<ContractSignPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ContractSignPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
      fillStyle: "#fff",
      strokeStyle: "#111",
      lineWidth: 1,
      lineCap: "round",
      lineJoin: "round",
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    }) as unknown as CanvasRenderingContext2D);

    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,signature");
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 180,
      right: 600,
      width: 600,
      height: 180,
      toJSON: () => ({}),
    } as DOMRect);
  });

  describe("happy path", () => {
    test("renders contract details after the public payload loads", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => contractFixture,
      }));

      renderPage();

      expect(screen.getByText("Se încarcă contractul...")).toBeInTheDocument();
      expect(await screen.findByText("Contract de Prestări Servicii Foto-Video")).toBeInTheDocument();
      expect(screen.getByText("Nunta")).toBeInTheDocument();
      expect(screen.getByText("Cluj-Napoca")).toBeInTheDocument();
      expect(screen.getByText("Rezumat plăți")).toBeInTheDocument();
      expect(screen.getByText("1500 EUR")).toBeInTheDocument();
      expect(screen.getByText("Metodă de plată: Transfer bancar")).toBeInTheDocument();
    });

    test("submits trimmed beneficiary data and shows success state", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => contractFixture,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        });
      vi.stubGlobal("fetch", fetchMock);

      renderPage();

      await screen.findByText("Contract de Prestări Servicii Foto-Video");

      fireEvent.change(screen.getByPlaceholderText("Ex: Popescu Ion"), { target: { value: "  Ion Popescu  " } });
      fireEvent.change(screen.getByPlaceholderText("Ex: maria@email.com"), { target: { value: "ion@example.com" } });
      fireEvent.change(screen.getByPlaceholderText("Str. Exemplu nr. 1, Oraș, Județ"), { target: { value: "  Cluj  " } });
      fireEvent.change(screen.getByPlaceholderText("07xxxxxxxx"), { target: { value: " 0712345678 " } });
      fireEvent.change(screen.getByPlaceholderText("Ex: AB123456"), { target: { value: "ab123456" } });
      fireEvent.click(screen.getByLabelText(/Sunt de acord cu prelucrarea datelor mele personale/));
      fireEvent.click(screen.getByLabelText("Am citit contractul în întregime și sunt de acord cu toate clauzele și condițiile prezentate."));

      const canvas = screen.getByText("Semnați mai jos folosind mouse-ul sau degetul.").parentElement?.querySelector("canvas");
      if (!canvas) {
        throw new Error("Signature canvas not found");
      }
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 80, clientY: 40 });
      fireEvent.mouseUp(canvas);

      fireEvent.click(screen.getByRole("button", { name: "SEMNEZ CONTRACTUL" }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });

      const [, submitRequest] = fetchMock.mock.calls[1];
      expect(fetchMock.mock.calls[1][0]).toBe("/api/contracts/sign/token-1");
      expect(submitRequest).toMatchObject({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      expect(JSON.parse(submitRequest.body)).toEqual({
        clientName: "Ion Popescu",
        clientEmail: "ion@example.com",
        clientAddress: "Cluj",
        clientPhone: "0712345678",
        clientIdSeries: "AB123456",
        clientSignatureBase64: "data:image/png;base64,signature",
      });

      expect(await screen.findByText("Contract semnat cu succes!")).toBeInTheDocument();
      expect(screen.getByText("Mulțumim! Contractul a fost semnat și veți primi în scurt timp o copie PDF pe email.")).toBeInTheDocument();
    });
  });

  describe("error states", () => {
    test("shows the already-signed state when the API returns 410 signed", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 410,
        json: async () => ({ status: "signed" }),
      }));

      renderPage();

      expect(await screen.findByText("Contract semnat")).toBeInTheDocument();
      expect(screen.getByText("Contractul a fost deja semnat. Veți primi o copie PDF pe email.")).toBeInTheDocument();
    });

    test("shows the expired state when the API returns 410 expired", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 410,
        json: async () => ({ status: "expired" }),
      }));

      renderPage();

      expect(await screen.findByText("Link expirat")).toBeInTheDocument();
      expect(screen.getByText("Link-ul de semnare a expirat. Contactați Anca Visuals pentru un link nou.")).toBeInTheDocument();
    });

    test("shows invalid link state when the contract is not found", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "Contract negăsit." }),
      }));

      renderPage();

      expect(await screen.findByText("Link invalid")).toBeInTheDocument();
    });

    test("blocks submit and shows client-side validation errors when required data is missing", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => contractFixture,
      });
      vi.stubGlobal("fetch", fetchMock);

      renderPage();

      await screen.findByText("Contract de Prestări Servicii Foto-Video");
      fireEvent.click(screen.getByRole("button", { name: "SEMNEZ CONTRACTUL" }));

      expect(await screen.findByText("Numele complet este obligatoriu.")).toBeInTheDocument();
      expect(screen.getByText("Seria și numărul buletinului sunt obligatorii.")).toBeInTheDocument();
      expect(screen.getByText("Semnătura este obligatorie.")).toBeInTheDocument();
      expect(screen.getByText("Trebuie să fiți de acord cu contractul.")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("shows server validation message when submit fails", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => contractFixture,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: "Semnătura este obligatorie." }),
        });
      vi.stubGlobal("fetch", fetchMock);

      renderPage();

      await screen.findByText("Contract de Prestări Servicii Foto-Video");

      fireEvent.change(screen.getByPlaceholderText("Ex: Popescu Ion"), { target: { value: "Ion Popescu" } });
      fireEvent.change(screen.getByPlaceholderText("Ex: maria@email.com"), { target: { value: "ion@example.com" } });
      fireEvent.change(screen.getByPlaceholderText("Ex: AB123456"), { target: { value: "AB123456" } });
      fireEvent.click(screen.getByLabelText(/Sunt de acord cu prelucrarea datelor mele personale/));
      fireEvent.click(screen.getByLabelText("Am citit contractul în întregime și sunt de acord cu toate clauzele și condițiile prezentate."));

      const canvas = screen.getByText("Semnați mai jos folosind mouse-ul sau degetul.").parentElement?.querySelector("canvas");
      if (!canvas) throw new Error("Signature canvas not found");
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 80, clientY: 40 });
      fireEvent.mouseUp(canvas);

      fireEvent.click(screen.getByRole("button", { name: "SEMNEZ CONTRACTUL" }));

      expect(await screen.findByText("Semnătura este obligatorie.")).toBeInTheDocument();
    });
  });
});
