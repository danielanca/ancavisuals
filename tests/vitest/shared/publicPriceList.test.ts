/*
 * Purpose: city pages and llms.txt quote the /admin/preturi prices (not the old prices.json),
 * so Google, ChatGPT and the configurator never show different amounts.
 */
import { describe, expect, test } from "vitest";
import { DEFAULT_PRICE_BOOK } from "src/shared/pricing/configuratorPrices";
import { llmsPriceSection, priceLinesFor, priceSentence, withLivePrices } from "src/shared/pricing/publicPriceList";

const book = { ...DEFAULT_PRICE_BOOK, nunta: 1380, nunta_foto: 800, nunta_video: 700, corporate_base: 100, corporate_extra_hour: 55, cununie: 150 };

describe("public price list", () => {
  test("wedding: foto + video first, then foto, then video", () => {
    expect(priceSentence(priceLinesFor("nunta", book))).toBe("Foto + Video de la 1380 EUR, foto de la 800 EUR, video de la 700 EUR.");
  });

  test("corporate is priced by the hour; other events use their starting price", () => {
    expect(priceLinesFor("corporate", book)).toEqual([{ label: "Foto · primele 2 ore", price: 100, note: "Fiecare oră în plus: 55 EUR." }]);
    expect(priceLinesFor("cununie-civila", book)[0].price).toBe(150);
    expect(priceLinesFor("logodna", book)[0].price).toBe(book.alt);
  });

  test("replaces only the price block of llms.txt, including old per-year blocks", () => {
    const before = "Intro\n\nPrețuri orientative:\n- Fotografie: de la 500 EUR\n\nPentru evenimente din 2027:\n- Nuntă: vechi\n\nCe trebuie înțeles:\n- x\n";
    const after = withLivePrices(before, book, { "2028": { ...book, nunta: 1400 } });
    expect(after).toContain("- Nuntă: Foto + Video de la 1380 EUR");
    expect(after).toContain("Pentru evenimente din 2028:\n- Nuntă: Foto + Video de la 1400 EUR");
    expect(after).not.toContain("500 EUR");
    expect(after).not.toContain("vechi");
    expect(after.startsWith("Intro\n\n")).toBe(true);
    expect(after).toContain("\n\nCe trebuie înțeles:\n- x\n");
    // Running it twice changes nothing more.
    expect(withLivePrices(after, book, { "2028": { ...book, nunta: 1400 } })).toBe(after);
  });

  test("the section starts with its heading", () => {
    expect(llmsPriceSection(book, {}).split("\n")[0]).toMatch(/^Prețuri orientative/);
  });
});
