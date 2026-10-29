import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import FreePhotoboothContracts, { signedAgo } from "src/client/pages/CampaignLanding/FreePhotoboothContracts";
import { FREE_PHOTOBOOTH_PROMO_ON, PROMO_DEADLINE, isPromoOpen, useFreePhotoboothOffer, type FreePhotoboothOffer } from "src/client/pages/CampaignLanding/freePhotoboothOffer";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const BEFORE_DEADLINE = PROMO_DEADLINE - 86_400_000;
// The offer is off since 2026-10-29 (FREE_PHOTOBOOTH_PROMO_ON = false): the hook fetches nothing,
// so the list is checked with the data handed to it directly, as it would come from the server.
const offerOf = (body: { contracts: object[]; totalSlots: number; remaining: number }): FreePhotoboothOffer =>
  ({ contracts: body.contracts as FreePhotoboothOffer["contracts"], totalSlots: body.totalSlots, remaining: body.remaining, failed: false, retry: () => undefined });
const reservation = { maskedName: "Ma***** Xu*****", city: "Sibiu", signedAt: "2026-10-11T22:30:00Z" };
describe("free photobooth reservations", () => {
  it("shows the masked name, city and the signing date in Romania, bold, with how long ago", () => {
    render(<FreePhotoboothContracts offer={offerOf({ contracts: [reservation], totalSlots: 5, remaining: 4 })} now={Date.parse("2026-10-26T10:00:00Z")} />);
    const name = screen.getByText("Ma***** Xu*****");
    expect(name.closest("li")?.textContent).toContain("din Sibiu a semnat contractul cu fotocabina gratuită în data de 12 octombrie 2026 (acum 14 zile).");
    expect(screen.getByText("12 octombrie 2026").className).toContain("font-semibold");
  });
  it("shows the remaining slots computed by the server, next to the list", () => {
    render(<FreePhotoboothContracts offer={offerOf({ contracts: [reservation, reservation, reservation], totalSlots: 5, remaining: 2 })} now={BEFORE_DEADLINE} />);
    screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "Fotocabina sau videobooth-ul (doar una dintre ele, la alegere), cadou pentru 5 nunți rezervate până pe 30 octombrie. Locuri rămase: 2. Când se termină, oferta se închide.");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
  it("closes the offer when no slots are left", () => {
    render(<FreePhotoboothContracts offer={offerOf({ contracts: Array(5).fill(reservation), totalSlots: 5, remaining: 0 })} now={BEFORE_DEADLINE} />);
    screen.getByText("Oferta s-a încheiat. Fotocabina și videobooth-ul rămân disponibile în configurator, la prețul obișnuit.");
    expect(screen.queryByText(/Locuri rămase/)).toBeNull();
  });
  it("closes the offer after the deadline even with slots left", () => {
    render(<FreePhotoboothContracts offer={offerOf({ contracts: [], totalSlots: 5, remaining: 5 })} now={PROMO_DEADLINE + 1} />);
    screen.getByText(/Oferta s-a încheiat/);
  });
  it("shows an honest empty state", () => {
    render(<FreePhotoboothContracts offer={offerOf({ contracts: [], totalSlots: 5, remaining: 5 })} now={BEFORE_DEADLINE} />);
    screen.getByText("Încă nu sunt contracte semnate cu fotocabina gratuită de afișat.");
  });
});
describe("offer switched off (owner, 2026-10-29)", () => {
  it("fetches nothing and is never open, even before the deadline with slots left", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    function Probe() {
      const offer = useFreePhotoboothOffer();
      return <p>{offer.remaining === null ? "nimic" : "date"}</p>;
    }
    render(<Probe />);
    expect(FREE_PHOTOBOOTH_PROMO_ON).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    screen.getByText("nimic");
    expect(isPromoOpen({ remaining: 2 }, BEFORE_DEADLINE)).toBe(false);
  });
});
describe("signedAgo", () => {
  it("counts calendar days in Romania, with the Romanian \"de\" from 20 up", () => {
    const now = Date.parse("2026-10-26T10:00:00Z");
    expect(signedAgo("2026-10-26T06:00:00Z", now)).toBe("azi");
    // 23:30 UTC on the 25th is already the 26th in Bucharest.
    expect(signedAgo("2026-10-25T23:30:00Z", now)).toBe("azi");
    expect(signedAgo("2026-10-25T08:00:00Z", now)).toBe("ieri");
    expect(signedAgo("2026-10-24T08:00:00Z", now)).toBe("acum 2 zile");
    expect(signedAgo("2026-10-21T08:00:00Z", now)).toBe("acum 5 zile");
    expect(signedAgo("2026-10-06T08:00:00Z", now)).toBe("acum 20 de zile");
  });
});
