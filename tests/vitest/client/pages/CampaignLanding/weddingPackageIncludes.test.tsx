import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WeddingPackageIncludes, { DEFAULT_SELECTION, packageItems } from "src/client/pages/CampaignLanding/WeddingPackageIncludes";
import { PROMO_DEADLINE, type FreePhotoboothOffer } from "src/client/pages/CampaignLanding/freePhotoboothOffer";
afterEach(cleanup);
const NOW = PROMO_DEADLINE - 86_400_000;
const offer = (patch: Partial<FreePhotoboothOffer> = {}): FreePhotoboothOffer =>
  ({ contracts: [], totalSlots: 5, remaining: 2, failed: false, retry: vi.fn(), ...patch });
const renderBlock = (props: Partial<React.ComponentProps<typeof WeddingPackageIncludes>> = {}) =>
  render(<WeddingPackageIncludes offer={offer()} now={NOW} referral={false} whatsappHref="https://wa.me/40745469907" {...props} />);
const labels = (selection = DEFAULT_SELECTION) => packageItems(selection).map((i) => i.label);
describe("WeddingPackageIncludes", () => {
  it("lists the default package in one block, with a single CTA", () => {
    const onCta = vi.fn();
    renderBlock({ onCta });
    expect(screen.getByRole("heading", { name: "Ce primiți în pachetul Foto + Video" })).toBeInTheDocument();
    for (const item of labels()) expect(screen.getByText(item)).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    fireEvent.click(links[0]);
    expect(onCta).toHaveBeenCalledTimes(1);
  });
  it("shows no booth and no album until they are ticked in the configurator", () => {
    expect(labels().join(" ")).not.toMatch(/Fotocabină|Videobooth|Album/);
    renderBlock();
    expect(screen.queryByText(/Cadou/)).toBeNull();
  });
  it("adds exactly what is ticked, with the album variant and the gift marked", () => {
    renderBlock({ selection: { ...DEFAULT_SELECTION, extras: ["videobooth", "album_nunta"], albumVariant: 1, gift: "videobooth" } });
    expect(screen.getByText(/^Videobooth 360:/)).toBeInTheDocument();
    expect(screen.getByText(/^Album foto · Fotocarte:/)).toBeInTheDocument();
    expect(screen.queryByText(/Fotocabină/)).toBeNull();
    expect(screen.getByText("Cadou")).toBeInTheDocument();
    expect(screen.getByText("· Până pe 30 octombrie · Locuri rămase: 2 din 5")).toBeInTheDocument();
  });
  it("follows the service: photo only has no film, video only no photo gallery line", () => {
    expect(labels({ ...DEFAULT_SELECTION, service: "foto" })).not.toContain("Film lung + highlight, filmate 4K");
    expect(labels({ ...DEFAULT_SELECTION, service: "video" })).toContain("Galerie online privată");
    renderBlock({ selection: { ...DEFAULT_SELECTION, service: "foto" } });
    expect(screen.getByRole("heading", { name: "Ce primiți în pachetul Foto" })).toBeInTheDocument();
  });
  it("on a recommendation: gift without slots, no public reservations list", () => {
    renderBlock({ referral: true, selection: { ...DEFAULT_SELECTION, extras: ["fotocabina"], gift: "fotocabina" } });
    expect(screen.getByText("· Ați venit prin recomandare.")).toBeInTheDocument();
    expect(screen.queryByText("Cine a încheiat cu noi un contract în ultimele zile, cu fotocabina gratuită")).toBeNull();
  });
});
