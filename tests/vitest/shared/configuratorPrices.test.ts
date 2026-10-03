import { describe, expect, test } from "vitest";
import { DEFAULT_CONFIGURATOR_PRICES, normalizeConfiguratorPrices, toPriceBook } from "src/shared/pricing/configuratorPrices";

describe("configurator prices", () => {
  test("keeps valid amounts (0 included) and falls back to defaults for the rest", () => {
    const prices = normalizeConfiguratorPrices({ fotocabina: 300, guests_200_500: 0, videobooth: -5, album: 12.5, nunta_foto: "", nimic: 9 });
    expect(prices.fotocabina).toBe(300);
    expect(prices.guests_200_500).toBe(0);
    expect(prices.videobooth).toBe(DEFAULT_CONFIGURATOR_PRICES.videobooth);
    expect(prices.album).toBe(DEFAULT_CONFIGURATOR_PRICES.album);
    expect(prices.nunta_foto).toBe(DEFAULT_CONFIGURATOR_PRICES.nunta_foto);
    expect(prices).not.toHaveProperty("nimic");
  });

  test("the price book merges starting prices and configurator prices", () => {
    const book = toPriceBook({ nunta: 1000 }, { fotocabina: 280 });
    expect(book.nunta).toBe(1000);
    expect(book.botez).toBe(250);
    expect(book.fotocabina).toBe(280);
    expect(book.corporate_base).toBe(100);
  });
});
