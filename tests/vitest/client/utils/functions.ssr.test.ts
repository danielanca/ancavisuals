// @vitest-environment node
/*
 * Purpose: covers the server-side (SSR/Node) branches of getCookie and setJWT
 * where window and document are not available.
 */
import { describe, expect, test } from "vitest";
import { getCookie, isBrowser, setJWT } from "src/client/utils/functions";

describe("functions in Node (SSR) environment", () => {
  test("isBrowser returns false when window is not defined", () => {
    expect(isBrowser()).toBe(false);
  });

  test("getCookie returns null when no cookieString and not in a browser", () => {
    expect(getCookie("jwt")).toBeNull();
  });

  test("getCookie still reads from an explicit cookie string on the server", () => {
    expect(getCookie("jwt", "jwt=server-value; other=x")).toBe("server-value");
  });

  test("setJWT resolves to false without writing when not in a browser", async () => {
    const result = await setJWT("jwt", "should-not-set", 1);
    expect(result).toBe(false);
  });
});
