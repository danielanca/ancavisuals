import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import QRMomentsPage from "src/client/pages/QRMoments/QRMomentsPage";
import QRMomentsGalleryPage from "src/client/pages/QRMoments/QRMomentsGalleryPage";
import QRMomentsUnsubscribePage from "src/client/pages/QRMoments/QRMomentsUnsubscribePage";

vi.mock("firebase/storage", async () => {
  const actual = await vi.importActual<typeof import("firebase/storage")>("firebase/storage");
  return {
    ...actual,
    ref: vi.fn(() => ({})),
    listAll: vi.fn(async () => ({ items: [] })),
    getDownloadURL: vi.fn(),
  };
});

vi.mock("src/client/features/admin/auth/useAuth", () => ({
  default: () => ({
    auth: {
      authorise: false,
      accessToken: null,
      loading: false,
      user: null,
    },
  }),
}));

function renderUploadPage() {
  return render(
    <MemoryRouter initialEntries={["/qr-moments/27martie2028?pass=SECRET"]}>
      <Routes>
        <Route path="/qr-moments/:eventSlug" element={<QRMomentsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QRMomentsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
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

  test("submits guest registration and upload with the required pass", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          bride: "Ana",
          groom: "Dan",
          isOpen: true,
          deadline: "2028-03-28T01:00:00.000Z",
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          guestId: "guest-1",
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          uploadedCount: 1,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderUploadPage();

    fireEvent.change(await screen.findByLabelText("Numele tău *"), { target: { value: "Maria Ionescu" } });
    fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "maria@example.com" } });
    fireEvent.click(screen.getByLabelText("Accept prelucrarea datelor cu caracter personal *"));
    fireEvent.click(screen.getByLabelText("Sunt de acord să primesc notificări prin email *"));
    fireEvent.click(screen.getByRole("button", { name: /Continuă/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/qr-moments/guest/register",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            eventSlug: "27martie2028",
            name: "Maria Ionescu",
            email: "maria@example.com",
            gdprConsent: true,
            emailConsent: true,
            pass: "SECRET",
          }),
        }),
      );
    });

    const file = new File(["image"], "poza.jpg", { type: "image/jpeg" });
    const uploadButton = await screen.findByRole("button", { name: /\+ Alege poze/i });
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
    fireEvent.click(await screen.findByRole("button", { name: /Trimite 1 fișier/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/qr-moments/27martie2028/upload",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        }),
      );
    });

    const uploadCall = fetchMock.mock.calls.find(([url]) => url === "/api/qr-moments/27martie2028/upload");
    expect(uploadCall).toBeTruthy();
    const uploadRequest = uploadCall?.[1] as { body: FormData };
    expect(uploadRequest.body.get("guestId")).toBe("guest-1");
    expect(uploadRequest.body.get("pass")).toBe("SECRET");
    expect(await screen.findByText(/Fișierele tale au ajuns la miri/i)).toBeInTheDocument();

    createElementSpy.mockRestore();
  });

  test("loads comments only with eventSlug and pin in the gallery", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          groups: [
            {
              guest: { id: "guest-1", name: "Maria", hasEmail: false },
              uploads: [
                {
                  id: "upload-1",
                  type: "photo",
                  bunnyUrl: "https://cdn.example.com/photo.jpg",
                  mimeType: "image/jpeg",
                  originalName: "photo.jpg",
                  createdAt: "2028-03-27T10:00:00.000Z",
                  thankedAt: null,
                },
              ],
            },
          ],
          quickReplies: [],
        }),
      })
      // view-notify call fires when AssetModal mounts for a photo
      .mockResolvedValueOnce({ json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({
        json: async () => ({
          comments: [],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/qr-moments/27martie2028/gallery"]}>
        <Routes>
          <Route path="/qr-moments/:eventSlug/gallery" element={<QRMomentsGalleryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("ex: AB12CD"), { target: { value: "PIN123" } });
    fireEvent.click(screen.getByRole("button", { name: /Intră în galerie/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Deschide photo.jpg" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/qr-moments/comment/upload-1?eventSlug=27martie2028&pin=PIN123",
        expect.any(Object),
      );
    });
  });

  test("renders the unsubscribe confirmation page", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          json: async () => ({
            ok: true,
          }),
        });
      vi.stubGlobal("fetch", fetchMock);

      render(
        <MemoryRouter initialEntries={["/qr-moments/unsubscribe/guest-1"]}>
          <Routes>
            <Route path="/qr-moments/unsubscribe/:guestId" element={<QRMomentsUnsubscribePage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText(/Te-ai dezabonat cu succes/i)).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/api/qr-moments/unsubscribe/guest-1");
    });
});
