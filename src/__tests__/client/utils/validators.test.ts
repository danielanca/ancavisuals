/*
 * Purpose: keeps the shared booking phone validator stable for the public
 * contact and booking flows.
 */
import { describe, expect, test } from "vitest";
import { PHONE_RE } from "../../../client/pages/Contact/booking/utils/validators";

describe("booking validators", () => {
  test("accepts valid phone formats used in the booking flow", () => {
    const validPhones = [
      "+40 745 000 000",
      "0745000000",
      "+40 (745) 000-000",
      "0040 745 000 000",
    ];

    for (const phone of validPhones) {
      expect(PHONE_RE.test(phone)).toBe(true);
    }
  });

  test("rejects obviously invalid phone input", () => {
    const invalidPhones = [
      "abc-def-ghij",
      "123",
      "+40_745_000_000",
      "++40!!!!",
    ];

    for (const phone of invalidPhones) {
      expect(PHONE_RE.test(phone)).toBe(false);
    }
  });
});
