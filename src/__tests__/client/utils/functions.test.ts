import { describe, expect, test } from "vitest";
import { getCookie, isBrowser, setJWT } from "../../../client/utils/functions";

describe("client utility helpers", () => {
  test("isBrowser reports true in the jsdom test environment", () => {
    expect(isBrowser()).toBe(true);
  });

  test("getCookie reads a value from a raw cookie string", () => {
    expect(getCookie("jwt", "jwt=abc123; theme=dark")).toBe("abc123");
    expect(getCookie("missing", "jwt=abc123; theme=dark")).toBeNull();
  });

  test("getCookie falls back to document.cookie in the browser", () => {
    document.cookie = "jwt=browser-token";

    expect(getCookie("jwt")).toBe("browser-token");
  });

  test("setJWT writes a cookie with the provided name and value", async () => {
    await setJWT("jwt", "fresh-token", 2);

    expect(document.cookie).toContain("jwt=fresh-token");
  });
});
