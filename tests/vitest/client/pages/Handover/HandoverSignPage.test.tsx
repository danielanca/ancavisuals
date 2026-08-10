/*
 * Purpose: verifies the public handover (Proces Verbal) signing page fetch flow,
 * validation, and submission payload handling without calling the live API.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import HandoverSignPage from "src/client/pages/Handover/HandoverSignPage";

const handoverFixture = {
  id: "handover-1",
  status: "sent",
  eventType: "Nuntă",
  eventDate: "2026-09-12",
  clientEmail: "client@example.com",
  courierDeliveryDays: 7,
  materialsReportWindowDays: 7,
  digitalLinkExpiryDays: 30,
};

function renderPage(path = "/proces-verbal/token-1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/proces-verbal/:token" element={<HandoverSignPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HandoverSignPage", () => {
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
    test("renders handover declaration with the configured day windows", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => handoverFixture,
      }));

      renderPage();

      expect(screen.getByText("Se încarcă procesul verbal...")).toBeInTheDocument();
      expect(await screen.findByText("Proces Verbal de Predare-Primire a Materialelor")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Ex: maria@email.com")).toHaveValue("client@example.com");
      expect(screen.getByText("30 zile")).toBeInTheDocument();
      expect(screen.getAllByText("7 zile").length).toBe(2);
    });

    test("submits the signature payload and shows success state", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => handoverFixture })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
      vi.stubGlobal("fetch", fetchMock);

      renderPage();

      await screen.findByText("Proces Verbal de Predare-Primire a Materialelor");

      fireEvent.change(screen.getByPlaceholderText("Ex: Popescu Ion"), { target: { value: "Ion Popescu" } });
      fireEvent.change(screen.getByPlaceholderText("Ex: 07xx xxx xxx"), { target: { value: "0712345678" } });
      fireEvent.click(screen.getByLabelText(/Am înțeles că voi primi link-ul digital/));
      fireEvent.click(screen.getByLabelText(/Am luat la cunoștință să-mi salvez materialele/));
      fireEvent.click(screen.getByLabelText(/Am înțeles și sunt de acord cu termenele/));

      const canvas = screen.getByText("Semnați mai jos folosind mouse-ul sau degetul.").parentElement?.querySelector("canvas");
      if (!canvas) throw new Error("Signature canvas not found");
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 80, clientY: 40 });
      fireEvent.mouseUp(canvas);

      fireEvent.click(screen.getByRole("button", { name: "SEMNEZ PROCESUL VERBAL" }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });

      expect(fetchMock.mock.calls[1][0]).toBe("/api/handover/sign/token-1");
      const submitRequest = fetchMock.mock.calls[1][1];
      expect(JSON.parse(submitRequest.body)).toEqual({
        clientName: "Ion Popescu",
        clientPhone: "0712345678",
        clientEmail: "client@example.com",
        digitalLinkAcknowledged: true,
        backupAcknowledged: true,
        termsAcknowledged: true,
        clientSignatureBase64: "data:image/png;base64,signature",
      });

      expect(await screen.findByText("Proces verbal semnat cu succes!")).toBeInTheDocument();
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

      expect(await screen.findByText("Proces verbal semnat")).toBeInTheDocument();
    });

    test("shows the expired state when the API returns 410 expired", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 410,
        json: async () => ({ status: "expired" }),
      }));

      renderPage();

      expect(await screen.findByText("Link expirat")).toBeInTheDocument();
    });

    test("blocks submit and shows client-side validation errors when required data is missing", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => handoverFixture,
      });
      vi.stubGlobal("fetch", fetchMock);

      renderPage();

      await screen.findByText("Proces Verbal de Predare-Primire a Materialelor");
      fireEvent.click(screen.getByRole("button", { name: "SEMNEZ PROCESUL VERBAL" }));

      expect(await screen.findByText("Numele complet este obligatoriu.")).toBeInTheDocument();
      expect(screen.getByText("Numărul de telefon este obligatoriu.")).toBeInTheDocument();
      expect(screen.getByText("Trebuie să confirmați că ați înțeles că veți primi link-ul digital pe email după semnare.")).toBeInTheDocument();
      expect(screen.getByText("Trebuie să confirmați că veți salva materialele pe un mediu de stocare separat.")).toBeInTheDocument();
      expect(screen.getByText("Trebuie să confirmați că ați înțeles termenele de mai jos.")).toBeInTheDocument();
      expect(screen.getByText("Semnătura este obligatorie.")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
