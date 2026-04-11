/*
 * Purpose: covers browser utility helpers for cookie reads, browser detection
 * and JWT cookie writes used by the auth flow.
 */
import { describe, expect, test } from "vitest";
import { getCookie, isBrowser, setJWT } from "../../../client/utils/functions";

describe("isBrowser", () => {
  test("reports true in the jsdom test environment", () => {
    expect(isBrowser()).toBe(true);
  });
});

describe("getCookie", () => {
  test("reads a value from an explicit cookie string", () => {
    expect(getCookie("jwt", "jwt=abc123; theme=dark")).toBe("abc123");
  });

  test("returns null when the cookie is not present in the string", () => {
    expect(getCookie("missing", "jwt=abc123; theme=dark")).toBeNull();
  });

  test("falls back to document.cookie when no cookie string is provided", () => {
    document.cookie = "jwt=browser-token";
    expect(getCookie("jwt")).toBe("browser-token");
  });

  test("returns null when explicit cookie string is empty", () => {
    expect(getCookie("jwt", "")).toBeNull();
  });

});

describe("setJWT", () => {
  test("writes a cookie with the provided name and value", async () => {
    await setJWT("jwt", "fresh-token", 2);
    expect(document.cookie).toContain("jwt=fresh-token");
  });
});
