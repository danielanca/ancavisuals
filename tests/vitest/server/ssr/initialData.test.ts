/*
 * Purpose: city pages get the /admin/preturi prices from the server, so the first HTML
 * (what Google and AI crawlers read) shows the current prices.
 */
import { describe, expect, test, vi } from "vitest";

vi.mock("src/server/routes/campaign.routes", () => ({ getPublicCampaignCached: vi.fn(async () => null) }));
vi.mock("src/server/routes/oferte.routes", () => ({ getPublicOfferCached: vi.fn(async () => null) }));
vi.mock("src/server/routes/startingPrices.routes", () => ({ getPriceBook: vi.fn(async () => ({ nunta: 1380 })) }));

import { loadInitialData } from "src/server/ssr/initialData";

describe("loadInitialData", () => {
  test.each(["/foto-video-nunta-turda", "/fotograf-botez-sibiu", "/videograf-nunta-brasov/"])("%s gets the price book", async (path) => {
    expect(await loadInitialData(path)).toEqual({ slug: "", priceBook: { nunta: 1380 } });
  });

  test("other pages don't", async () => {
    expect(await loadInitialData("/portofoliu")).toBeNull();
    expect(await loadInitialData("/oferta/olx")).toBeNull();
  });
});
