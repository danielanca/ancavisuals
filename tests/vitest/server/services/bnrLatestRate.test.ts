/*
 * Purpose: getBnrLatestRate reads BNR's daily feed (the latest published rate, i.e. today's once
 * BNR publishes) and caches it only briefly, so the contract payment email uses today's rate.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

const feed = (date: string, eur: string) =>
  `<DataSet><Body><Cube date="${date}"><Rate currency="USD">4.60</Rate><Rate currency="EUR">${eur}</Rate></Cube></Body></DataSet>`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

describe("getBnrLatestRate", () => {
  test("returns the EUR rate and its day from the daily feed; refreshes after ten minutes", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => feed("2026-10-27", "5.3401") })
      .mockResolvedValueOnce({ ok: true, text: async () => feed("2026-10-28", "5.3495") });
    vi.stubGlobal("fetch", fetchMock);
    const { getBnrLatestRate } = await import("src/server/services/bnrExchangeRate.service");

    expect(await getBnrLatestRate("EUR")).toEqual({ rate: 5.3401, date: "2026-10-27" });
    expect(fetchMock).toHaveBeenCalledWith("https://curs.bnr.ro/nbrfxrates.xml");
    expect(await getBnrLatestRate("EUR")).toEqual({ rate: 5.3401, date: "2026-10-27" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(await getBnrLatestRate("EUR")).toEqual({ rate: 5.3495, date: "2026-10-28" });
  });

  test("a failed feed is an error (the email then skips the lei line)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const { getBnrLatestRate, BnrRateError } = await import("src/server/services/bnrExchangeRate.service");
    await expect(getBnrLatestRate("EUR")).rejects.toBeInstanceOf(BnrRateError);
  });
});
