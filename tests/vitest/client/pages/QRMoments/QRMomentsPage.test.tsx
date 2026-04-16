/*
 * Purpose: verifies the QR Moments upload fallback message so guests always
 * have a WhatsApp alternative when uploads fail.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import QRMomentsPage from "src/client/pages/QRMoments/QRMomentsPage";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/qr-moments/2026-09-12"]}>
      <Routes>
        <Route path="/qr-moments/:eventDate" element={<QRMomentsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QRMomentsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  describe("upload fallback", () => {
    test("shows the WhatsApp fallback when upload fails", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            urlFound: true,
            data: {
              bride: "Ana",
              groom: "Dan",
              eventDate: "12 septembrie 2026",
              message: "Încarcă cele mai frumoase momente",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
        });
      vi.stubGlobal("fetch", fetchMock);

      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: "Sari peste" }));

      const file = new File(["image"], "poza.jpg", { type: "image/jpeg" });
      const uploadButton = await screen.findByRole("button", { name: "Alege Poze" });
      const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        if (tagName.toLowerCase() === "input") {
          const input = document.createElementNS("http://www.w3.org/1999/xhtml", "input") as HTMLInputElement;
          Object.defineProperty(input, "files", {
            configurable: true,
            value: {
              0: file,
              length: 1,
              item: (index: number) => (index === 0 ? file : null),
            },
          });
          queueMicrotask(() => {
            input.onchange?.({ target: input } as unknown as Event);
          });
          return input;
        }
        return document.createElementNS("http://www.w3.org/1999/xhtml", tagName);
      });
      fireEvent.click(uploadButton);

      fireEvent.click(await screen.findByRole("button", { name: "Trimite toate (1)" }));

      await waitFor(() => {
        expect(screen.getByText(/Eroare la încărcare\./i)).toBeInTheDocument();
      });

      const link = screen.getByRole("link", { name: /WhatsApp la 0745-469-907/i });
      expect(link).toHaveAttribute("href", "https://wa.me/40745469907");

      createElementSpy.mockRestore();
    });
  });
});
