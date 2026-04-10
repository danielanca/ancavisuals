/*
 * Purpose: validates the booking phone regex at supported length boundaries
 * and rejects unsupported input characters.
 */
import { describe, expect, test } from "vitest";
import { PHONE_RE } from "../../../../../../client/pages/Contact/booking/utils/validators";

describe("booking phone validator", () => {
  test("accepts phone numbers within allowed characters and length boundaries", () => {
    expect(PHONE_RE.test("07123456")).toBe(true);
    expect(PHONE_RE.test("+40 712 345 678")).toBe(true);
    expect(PHONE_RE.test("(+40) 712-345-678")).toBe(true);
    expect(PHONE_RE.test("12345678901234567890")).toBe(true);
  });

  test("rejects phone numbers shorter than 8 or longer than 20 characters", () => {
    expect(PHONE_RE.test("1234567")).toBe(false);
    expect(PHONE_RE.test("123456789012345678901")).toBe(false);
  });

  test("rejects unsupported characters", () => {
    expect(PHONE_RE.test("0712abc678")).toBe(false);
    expect(PHONE_RE.test("0712_345_678")).toBe(false);
  });
});
