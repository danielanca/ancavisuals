import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import FreePhotoboothContracts, { signedAgo } from "src/client/pages/CampaignLanding/FreePhotoboothContracts";
import { PROMO_DEADLINE, isPromoOpen, useFreePhotoboothOffer } from "src/client/pages/CampaignLanding/freePhotoboothOffer";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const BEFORE_DEADLINE = PROMO_DEADLINE - 86_400_000;
function Harness({ now = BEFORE_DEADLINE }: { now?: number }) {
  return <FreePhotoboothContracts offer={useFreePhotoboothOffer()} now={now} />;
}
const reservation = { maskedName: "Ma***** Xu*****", city: "Sibiu", signedAt: "2026-10-11T22:30:00Z" };
const respond = (body: object) => vi.fn().mockResolvedValue({ ok: true, json: async () => body });
describe("free photobooth reservations", () => {
  it("shows the masked name, city and the signing date in Romania, bold, with how long ago", async () => {
    const fetchMock = respond({ contracts: [reservation], totalSlots: 5, remaining: 4 });
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness now={Date.parse("2026-10-26T10:00:00Z")} />);
    const name = await screen.findByText("Ma***** Xu*****");
    expect(name.closest("li")?.textContent).toContain("din Sibiu a semnat contractul cu fotocabina gratuită în data de 12 octombrie 2026 (acum 14 zile).");
    expect(screen.getByText("12 octombrie 2026").className).toContain("font-semibold");
    expect(fetchMock).toHaveBeenCalledWith("/api/campaign/olx/free-photobooth-contracts", expect.any(Object));
  });
  it("shows the remaining slots computed by the server, next to the list", async () => {
    vi.stubGlobal("fetch", respond({ contracts: [reservation, reservation, reservation], totalSlots: 5, remaining: 2 }));
    render(<Harness />);
    await screen.findByText((_, el) => el?.tagName === "P" && el.textContent === "Fotocabina sau videobooth-ul (doar una dintre ele, la alegere), cadou pentru 5 nunți rezervate până pe 30 octombrie. Locuri rămase: 2. Când se termină, oferta se închide.");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
  it("closes the offer when no slots are left", async () => {
    vi.stubGlobal("fetch", respond({ contracts: Array(5).fill(reservation), totalSlots: 5, remaining: 0 }));
    render(<Harness />);
    await screen.findByText("Oferta s-a încheiat. Fotocabina și videobooth-ul rămân disponibile în configurator, la prețul obișnuit.");
    expect(screen.queryByText(/Locuri rămase/)).toBeNull();
  });
  it("closes the offer after the deadline even with slots left", async () => {
    vi.stubGlobal("fetch", respond({ contracts: [], totalSlots: 5, remaining: 5 }));
    render(<Harness now={PROMO_DEADLINE + 1} />);
    await screen.findByText(/Oferta s-a încheiat/);
  });
  it("shows an honest empty state", async () => {
    vi.stubGlobal("fetch", respond({ contracts: [], totalSlots: 5, remaining: 5 }));
    render(<Harness />);
    await screen.findByText("Încă nu sunt contracte semnate cu fotocabina gratuită de afișat.");
  });
  it("allows retry after an error without claiming there are no reservations", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ contracts: [], totalSlots: 5, remaining: 5 }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness />);
    expect(screen.queryByText(/Locuri rămase/)).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Reîncearcă" }));
    await screen.findByText("Încă nu sunt contracte semnate cu fotocabina gratuită de afișat.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
describe("isPromoOpen", () => {
  it("is open only before the deadline with confirmed free slots", () => {
    expect(isPromoOpen({ remaining: 2 }, BEFORE_DEADLINE)).toBe(true);
    expect(isPromoOpen({ remaining: 0 }, BEFORE_DEADLINE)).toBe(false);
    expect(isPromoOpen({ remaining: null }, BEFORE_DEADLINE)).toBe(false);
    expect(isPromoOpen({ remaining: 2 }, PROMO_DEADLINE)).toBe(false);
  });
});
