import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import FreePhotoboothContracts from "src/client/pages/CampaignLanding/FreePhotoboothContracts";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("free photobooth reservations", () => {
  it("shows the masked name, city and signing date in Romania", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ contracts: [
      { maskedName: "Ma***** Xu*****", city: "Sibiu", signedAt: "2026-10-11T22:30:00Z" },
    ] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<FreePhotoboothContracts />);
    const name = await screen.findByText("Ma***** Xu*****");
    expect(name.closest("li")?.textContent).toContain("din Sibiu a semnat contractul cu fotocabina gratuită în data de 12 octombrie 2026");
    expect(fetchMock).toHaveBeenCalledWith("/api/campaign/olx/free-photobooth-contracts", expect.any(Object));
  });
  it("shows an honest empty state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ contracts: [] }) }));
    render(<FreePhotoboothContracts />);
    await screen.findByText("Încă nu sunt contracte semnate cu fotocabina gratuită de afișat.");
  });
  it("allows retry after an error without claiming there are no reservations", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ contracts: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<FreePhotoboothContracts />);
    fireEvent.click(await screen.findByRole("button", { name: "Reîncearcă" }));
    await screen.findByText("Încă nu sunt contracte semnate cu fotocabina gratuită de afișat.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
