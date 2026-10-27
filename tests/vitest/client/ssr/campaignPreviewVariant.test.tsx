// @vitest-environment node
/*
 * Purpose: the "preview" variant of the offer landing (shown under /ghidul-mirilor-pdf) keeps
 * only the hero, portfolio and configurator — no header, reviews, final CTA or footer.
 */
import React from "react";
import { describe, expect, test } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import CampaignLandingPage from "src/client/pages/CampaignLanding/CampaignLandingPage";
import { offerToCampaign, type Offer } from "src/client/pages/OfertaPage";

const offer = {
  id: "o1", slug: "olx", clientName: "", title: "Oferta", description: "", pdfUrl: "", price: "",
  packageName: "", packages: [], validUntil: "", selectedServices: ["photo"],
  serviceSections: [{ id: "photo", label: "Fotografie", description: "", basePrice: "", assets: [], assetsMobile: [] }],
} as unknown as Offer;

const html = (variant?: "full" | "preview") => renderToString(
  <MemoryRouter><CampaignLandingPage page={offerToCampaign(offer)} variant={variant} /></MemoryRouter>,
);

describe("offer landing, preview variant", () => {
  test("keeps the hero and the configurator", () => {
    const preview = html("preview");
    expect(preview).toContain("Aflați prețul și disponibilitatea");
    expect(preview).toContain('id="configurator"');
  });

  test("drops the header, the final CTA and the footer that the full page has", () => {
    const full = html();
    const preview = html("preview");
    for (const part of ["Hai să vedem dacă data voastră e liberă.", "· ancavisuals.ro", "<header"]) {
      expect(full).toContain(part);
      expect(preview).not.toContain(part);
    }
  });
});
