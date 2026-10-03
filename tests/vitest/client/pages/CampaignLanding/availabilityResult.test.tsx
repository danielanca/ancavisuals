/*
 * Purpose: after "Verifică disponibilitatea" the visitor gets a concrete next step —
 * starting price, a WhatsApp message prefilled with their date, the phone field
 * visible right away — and no date is preselected for them.
 */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("src/client/pages/Portfolio/PortfolioParallaxGallery", () => ({ default: () => null }));
vi.mock("src/client/pages/MediaDownload/AncaVisualsPromo", () => ({ default: () => null }));
vi.mock("src/client/utils/liveEvent", () => ({ reportAvailabilityCheck: vi.fn(), sendLiveEvent: vi.fn() }));
vi.mock("src/client/utils/googleAds", () => ({
  fireAdsAvailabilityMicroConversion: vi.fn(), fireAdsContactClickConversion: vi.fn(), fireAdsLeadConversion: vi.fn(),
}));
vi.mock("src/client/utils/oaiq", () => ({ measureOaiq: vi.fn() }));

import CampaignLandingPage, { type CampaignPage } from "src/client/pages/CampaignLanding/CampaignLandingPage";
import { sendLiveEvent } from "src/client/utils/liveEvent";

const nextYear = new Date().getFullYear() + 1;
const page: CampaignPage = {
  slug: "olx", title: "PACHET FOTO VIDEO", subtitle: "", ctaText: "", whatsappNumber: "+40 745 469 907", phoneNumber: "0745469907",
  heroImageUrl: "", heroVideoUrl: "", gallery: [], testimonials: [], active: true,
  packages: [
    { id: "a", name: "FULL", price: "1200 euro", features: [] },
    { id: "b", name: "STANDARD", price: "950 EURO", features: [] },
  ],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({
    ok: true,
    json: async () => (String(url).includes("booked-dates") ? { dates: [`${nextYear}-07-10`, `${nextYear}-07-24`] } : {}),
  })));
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { vi.unstubAllGlobals(); });

// /oferta/olx checks the date in the price configurator (its availability section is off),
// so the availability form is tested on a campaign without the configurator.
const availabilityPage: CampaignPage = { ...page, slug: "campanie-test" };

describe("availability result", () => {
  test("no date is preselected and a free date shows price, prefilled WhatsApp and phone field", async () => {
    render(<MemoryRouter><CampaignLandingPage page={availabilityPage} /></MemoryRouter>);

    const check = screen.getByRole("button", { name: "Alege data evenimentului" });
    expect(check).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Anul"), { target: { value: String(nextYear) } });
    fireEvent.change(screen.getByLabelText("Luna"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Ziua"), { target: { value: "18" } });
    fireEvent.click(screen.getByRole("button", { name: "Verifică disponibilitatea" }));

    expect(await screen.findByText(`🎉 Data ta, 18 iulie ${nextYear}, e liberă!`)).toBeInTheDocument();
    // The price configurator above shows prices too — look only at the availability result.
    const availability = within(document.getElementById("verifica-data")!);
    expect(availability.getByText("950 €")).toBeInTheDocument();
    // Booked dates load, but the "already N events this month" line is gone — owners found it confusing.
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText(/evenimente rezervate|eveniment rezervat/)).not.toBeInTheDocument();

    // Free-photobooth promo (until 2026-10-30) shows for weddings while it lasts.
    if (Date.now() < new Date("2026-10-30T23:59:59").getTime()) {
      expect(screen.getByText("+ Fotocabina e gratuită")).toBeInTheDocument();
    }

    const wa = screen.getByRole("link", { name: /Primește oferta pe WhatsApp/ });
    expect(decodeURIComponent(wa.getAttribute("href") ?? "")).toContain(`data de 18 iulie ${nextYear} e liberă`);
    expect(wa.getAttribute("href")).toContain("wa.me/40745469907");
    expect(screen.getByRole("button", { name: "Sunați-mă" })).toBeInTheDocument();
  });

  test("a christening shows the christening starting price", async () => {
    render(<MemoryRouter><CampaignLandingPage page={availabilityPage} /></MemoryRouter>);
    fireEvent.change(screen.getByDisplayValue("Nuntă"), { target: { value: "Botez" } });
    fireEvent.change(screen.getByLabelText("Anul"), { target: { value: String(nextYear) } });
    fireEvent.change(screen.getByLabelText("Luna"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Ziua"), { target: { value: "18" } });
    fireEvent.click(screen.getByRole("button", { name: "Verifică disponibilitatea" }));

    const availability = within(document.getElementById("verifica-data")!);
    expect(await availability.findByText("250 €")).toBeInTheDocument();
    expect(availability.queryByText("950 €")).not.toBeInTheDocument();
  });

  test("the olx landing offers the free wedding guide; other campaigns don't", () => {
    const { unmount } = render(<MemoryRouter><CampaignLandingPage page={page} /></MemoryRouter>);
    const guide = screen.getByRole("link", { name: /Descarcă ghidul gratuit/ });
    expect(guide.getAttribute("href")).toBe("https://ancavisuals.b-cdn.net/offers-assets/pdfs/Ghidul-Mirilor.pdf");
    fireEvent.click(guide);
    expect(sendLiveEvent).toHaveBeenCalledWith("guide_downloaded", expect.objectContaining({ label: "Ghidul Mirilor" }));
    unmount();

    render(<MemoryRouter><CampaignLandingPage page={{ ...page, slug: "botez" }} /></MemoryRouter>);
    expect(screen.queryByText(/Ghidul Mirilor/)).not.toBeInTheDocument();
  });

  test("a discounted package shows the old price struck through next to the new one", () => {
    // Packages are hidden on /oferta/olx (the configurator shows prices) — test them on another campaign.
    // CampaignPackages formats "1200 EURO" as "1.200 €" and splits the new price into amount + currency.
    const discounted = { ...availabilityPage, packages: [{ id: "f", name: "FULL - Fotocabina", price: "950 EURO", oldPrice: "1200 EURO", features: [] }] };
    render(<MemoryRouter><CampaignLandingPage page={discounted} /></MemoryRouter>);
    expect(screen.getByText("1.200 €").className).toContain("line-through");
    expect(within(document.getElementById("pachete")!).getByText("950")).toBeInTheDocument();
    expect(screen.getByText("Preț redus")).toBeInTheDocument();
  });
});
