import { describe, expect, test } from "vitest";
import { containsKeyword, emptySeoPage, seoPageChecks, seoPageScore } from "src/shared/seoLandingPages";

describe("seo landing page checks", () => {
  test("keyword match ignores diacritics, case and order", () => {
    expect(containsKeyword("Fotocabină în Dej pentru nunți", "fotocabina dej")).toBe(true);
    expect(containsKeyword("Fotocabină Cluj", "fotocabina dej")).toBe(false);
  });

  test("an empty page fails, a complete one passes everything", () => {
    const empty = emptySeoPage("fotocabina dej", "Dej");
    expect(seoPageScore(empty)).toBeLessThan(20);
    const words = "cuvânt ".repeat(160);
    const full = {
      ...empty,
      slug: "fotocabina-dej",
      seoTitle: "Fotocabina Dej pentru nunți și botezuri | Anca Visuals",
      metaDescription: "Fotocabină în Dej pentru nunți, botezuri și petreceri: poze printate pe loc, recuzită și galerie online. Cere oferta.",
      h1: "Fotocabină în Dej",
      intro: `<p>Fotocabina Dej de la noi ${words}</p>`,
      sections: Array.from({ length: 4 }, (_, i) => ({ heading: `Secțiunea ${i}`, html: `<p>${words}</p>${i === 0 ? '<p><a href="/contact">contact</a></p>' : ""}` })),
      faq: Array.from({ length: 3 }, (_, i) => ({ question: `Întrebarea ${i}?`, answer: "Răspuns." })),
    };
    expect(seoPageChecks(full).filter((check) => !check.ok).map((check) => check.id)).toEqual([]);
    expect(seoPageScore(full)).toBe(100);
  });
});
