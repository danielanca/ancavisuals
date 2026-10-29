import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

const sendLiveEvent = vi.fn();
vi.mock("src/client/utils/liveEvent", () => ({ sendLiveEvent }));

const { default: WeddingCta, OFFER_PATH, referralWhatsappUrl } = await import("src/client/pages/MediaDownload/WeddingCta");

test("asks guests whether they're getting married or know someone who is", () => {
  render(<WeddingCta />);
  expect(screen.getByRole("heading", { name: "Urmează o nuntă?" })).toBeInTheDocument();
  expect(screen.getByText("💍 Urmează să fii mire sau mireasă?")).toBeInTheDocument();
  expect(screen.getByText("👫 Cunoști pe cineva care se căsătorește?")).toBeInTheDocument();
  expect(screen.getByText("🎁 Acum: fotocabina toată ziua la 200 € în loc de 450 €, plus QR code inclus.")).toBeInTheDocument();
  expect(screen.queryByText(/gratuit/)).toBeNull(); // no free booth since 2026-10-29
});

test("'Verifică data' opens the offer at the date check and is logged as contact intent", () => {
  render(<WeddingCta />);
  const link = screen.getByRole("link", { name: "Verifică data →" });
  expect(link).toHaveAttribute("href", OFFER_PATH);
  expect(OFFER_PATH).toContain("#verifica-data");
  fireEvent.click(link);
  expect(sendLiveEvent).toHaveBeenCalledWith("contact_clicked", expect.objectContaining({ meta: { source: "share-page" } }));
});

test("the recommendation opens WhatsApp's contact picker with a ready message and the offer link", () => {
  const url = referralWhatsappUrl("https://ancavisuals.ro");
  expect(url.startsWith("https://wa.me/?text=")).toBe(true);
  expect(decodeURIComponent(url)).toContain("Bună! Vă recomand AncaVisuals dacă doriți fotograf și videograf la nuntă. Acum au fotocabina toată ziua la 200 € în loc de 450 €");
  expect(decodeURIComponent(url)).toContain("https://ancavisuals.ro/oferta?utm_source=recomandare");
});
