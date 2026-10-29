// @vitest-environment node
/*
 * Purpose: the pages the server renders (ssrLazy preloads them all at start) must import without a
 * browser. On Node 21+ `navigator` exists, and plyr then touched `document` on import — every page
 * of the site answered 500 "document is not defined" (2026-10-29). Imported here like on the server.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";

describe("server-rendered pages import without a browser (Node 22 has `navigator`)", () => {
  const hadNavigator = "navigator" in globalThis;
  beforeAll(() => {
    if (!hadNavigator) Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "Node.js/22", language: "en-US" } });
  });
  afterAll(() => {
    if (!hadNavigator) delete (globalThis as { navigator?: unknown }).navigator;
  });

  test("no document here, like on the server", () => {
    expect(typeof document).toBe("undefined");
  });

  test("the video preview of the homepage", async () => {
    await expect(import("src/client/pages/Videos/VideoPreview")).resolves.toBeDefined();
  });
});
