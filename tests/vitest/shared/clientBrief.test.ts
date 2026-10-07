import { expect, test } from "vitest";
import { emptyBriefAnswers, getBriefMoments, validateBriefAnswers } from "src/shared/clientBrief/clientBrief";

test("every optional moment states dacă există and weddings include both homes and full religion", () => {
  for (const type of ["Nuntă", "Botez", "Majorat", "Cununie civilă", "Altele"]) {
    expect(getBriefMoments(type).every(m => m.label.includes("(dacă există)"))).toBe(true);
  }
  expect(getBriefMoments("Nuntă").find(m => m.id === "religious")?.integral).toBe(true);
});
test("sanitizes to known fields and ignores legacy photo opt-outs", () => {
  const answers = { ...emptyBriefAnswers(), priorities: " Familie ", pricing: "injected", moments: {
    religious: { presence: "no", capture: "both", coverage: "full", details: " Fără slujbă " },
    firstDance: { presence: "yes", capture: "photo", coverage: "full", details: "" },
    unknown: { anything: true },
  } };
  const clean = validateBriefAnswers(answers, getBriefMoments("Nuntă"));
  expect(clean.priorities).toBe("Familie");
  expect(clean).not.toHaveProperty("pricing");
  expect(clean.moments).not.toHaveProperty("unknown");
  expect(clean.moments.religious).toEqual({ presence: "no", coverage: "", details: "Fără slujbă" });
  expect(clean.moments.firstDance.coverage).toBe("full");
  expect(clean.moments.firstDance).not.toHaveProperty("capture");
});
test("rejects malformed choices rather than persisting arbitrary input", () => {
  expect(() => validateBriefAnswers({ ...emptyBriefAnswers(), moments: { religious: { presence: "yes", coverage: "invalid", details: "" } } }, getBriefMoments("Nuntă"))).toThrow();
});

test("full recording does not require opting into photos or video", () => {
  const result = validateBriefAnswers({ ...emptyBriefAnswers(), moments: {
    religious: { presence: "yes", coverage: "full", details: "Toată slujba" },
    firstDance: { presence: "yes", capture: "none", coverage: "full", details: "" },
  } }, getBriefMoments("Nuntă"));
  expect(result.moments.religious.coverage).toBe("full");
  expect(result.moments.firstDance).toEqual({ presence: "yes", coverage: "full", details: "" });
});
