/*
 * Purpose: /ghidul-mirilor-pdf shows the guide preview with its authors in bold, the
 * download reports `guide_downloaded` (the owner gets an email). SEO head: ssr/weddingGuidePdfSsr.test.tsx.
 */
import React from "react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import WeddingGuidePdfPage, { GUIDE_PDF_URL } from "src/client/pages/WeddingGuide/WeddingGuidePdfPage";
import { sendLiveEvent } from "src/client/utils/liveEvent";

vi.mock("src/client/utils/liveEvent", () => ({ sendLiveEvent: vi.fn() }));
vi.mock("src/client/utils/oaiq", () => ({ measureOaiq: vi.fn() }));
vi.mock("src/client/components/Navbar/Footer", () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const renderPage = () => render(<HelmetProvider><MemoryRouter><WeddingGuidePdfPage /></MemoryRouter></HelmetProvider>);

test("explains who wrote it, in bold, and where the testimonials come from", () => {
  renderPage();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Ghidul Mirilor");
  // The book cover also says „Anca Visuals" — the intro's names are the bold ones.
  expect(screen.getAllByText("Daniel și Estera").some((el) => el.tagName === "STRONG")).toBe(true);
  expect(screen.getAllByText("Anca Visuals").some((el) => el.tagName === "STRONG")).toBe(true);
  expect(document.body.textContent).toContain("din România și din alte țări");
});

test("before the download: our photo and note, with „foarte câștigați” underlined in green", () => {
  renderPage();
  expect(screen.getByAltText("Daniel și Estera, Anca Visuals")).toBeInTheDocument();
  expect(screen.getByText("Noi suntem Daniel și Estera").tagName).toBe("STRONG");
  expect(screen.getByText("sperăm să vă ajute acest ghid").tagName).toBe("STRONG");
  expect(screen.getByText("foarte câștigați").className).toMatch(/underline.*|text-emerald-700/);
  // The note sits before the button.
  const note = screen.getByText("foarte câștigați");
  const button = screen.getByRole("link", { name: /Descarcă PDF-ul/ });
  expect(note.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("the download button opens the PDF and reports the download", () => {
  renderPage();
  const link = screen.getByRole("link", { name: /Descarcă PDF-ul/ });
  expect(link.getAttribute("href")).toBe(GUIDE_PDF_URL);
  fireEvent.click(link);
  expect(sendLiveEvent).toHaveBeenCalledWith("guide_downloaded", expect.objectContaining({
    meta: expect.objectContaining({ page: "/ghidul-mirilor-pdf" }),
  }));
});
