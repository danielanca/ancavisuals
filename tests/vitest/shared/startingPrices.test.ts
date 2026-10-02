import { describe, expect, test } from "vitest";
import { DEFAULT_STARTING_PRICES, startingPriceFor, startingPriceKey } from "src/shared/pricing/startingPrices";

describe("starting prices", () => {
  test("maps landing names and configurator keys to the same price", () => {
    expect(startingPriceFor("Nuntă")).toBe("950 €");
    expect(startingPriceFor("nunta")).toBe("950 €");
    expect(startingPriceFor("Botez")).toBe("350 €");
    expect(startingPriceFor("Majorat")).toBe("200 €");
    expect(startingPriceFor("Cununie civilă")).toBe("150 €");
    expect(startingPriceFor("Alt eveniment")).toBe("150 €");
  });

  test("unknown types use the 'Alt eveniment' price", () => {
    expect(startingPriceKey("Logodnă")).toBe("alt");
    expect(startingPriceFor("Aniversare", { ...DEFAULT_STARTING_PRICES, alt: 180 })).toBe("180 €");
  });
});
