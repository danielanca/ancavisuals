/*
 * Purpose: how far each person got through an album (used to score a photo only among the people
 * who reached it) — personal links, „Am terminat”, account votes, someone else on a link.
 */
import { expect, test, vi } from "vitest";

vi.mock("src/server/firestore", () => ({ firestore: () => ({}) }));
const { albumCoverage, cleanReviewerInput } = await import("src/server/services/photoReviewers.service");

test("furthest photo per person; finished = whole album; account voters saw everything", () => {
  const coverage = albumCoverage(1279, [
    { reviewerId: "salomeea", visitors: {
      a: { name: "Salomeea", viewedCount: 616 },
      b: { name: "Estera", viewedCount: 141 }, // Estera on Salomeea's link → Estera's progress
      c: { name: "Salomeea", viewedCount: 900, completedAt: { done: true } },
    } },
    { visitors: { d: { name: "Prieten", viewedCount: 50 } } }, // generic link: nobody's vote
  ], ["daniel"]);
  expect(coverage).toEqual({ total: 1279, seen: { salomeea: 1279, estera: 141, daniel: 1279 } });
});

test("profile input is cleaned and validated", () => {
  expect(cleanReviewerInput({ name: "  Ana ", email: "", phone: "" })).toEqual({ name: "Ana", email: "", phone: "" });
  expect(cleanReviewerInput({ name: "Ana", phone: "abc" })).toEqual({ error: "Numărul de telefon nu pare corect." });
});
