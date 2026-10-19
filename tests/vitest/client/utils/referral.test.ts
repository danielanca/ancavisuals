import { afterEach, expect, test } from "vitest";
import { captureReferral } from "src/client/utils/referral";

afterEach(() => localStorage.clear());

test("utm_source=recomandare marks the visitor as referred, and it is remembered on later visits", () => {
  expect(captureReferral("?utm_source=share")).toBe(false);
  expect(captureReferral("?utm_source=recomandare")).toBe(true);
  // Later, browsing without the UTM (e.g. /oferta/olx#verifica-data): still free.
  expect(captureReferral("")).toBe(true);
});

test("a normal visitor is not referred", () => {
  expect(captureReferral("?gclid=abc")).toBe(false);
});
