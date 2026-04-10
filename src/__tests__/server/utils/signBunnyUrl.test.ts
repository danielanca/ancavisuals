/*
 * Purpose: ensures Bunny CDN URLs are signed with the expected token and expiry
 * so generated media links stay stable and secure.
 */
import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { signBunnyUrl } from "../../../server/utils/signBunnyUrl";

describe("signBunnyUrl", () => {
  const originalEnv = {
    BUNNY_CDN_DOMAIN: process.env.BUNNY_CDN_DOMAIN,
    BUNNY_API_KEY: process.env.BUNNY_API_KEY,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T12:00:00Z"));
    process.env.BUNNY_CDN_DOMAIN = "https://ancavisuals.b-cdn.net";
    process.env.BUNNY_API_KEY = "test-security-key";
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.BUNNY_CDN_DOMAIN = originalEnv.BUNNY_CDN_DOMAIN;
    process.env.BUNNY_API_KEY = originalEnv.BUNNY_API_KEY;
  });

  test("returns a signed Bunny CDN url with a token and expiry", () => {
    const path = "/events/demo/photo.jpg";
    const expires = Math.floor(new Date("2026-04-10T12:00:00Z").getTime() / 1000) + 3600;
    const expectedToken = crypto
      .createHash("sha256")
      .update(`test-security-key${path}${expires}`)
      .digest("hex");

    const signedUrl = signBunnyUrl(path);

    expect(signedUrl).toBe(
      `https://ancavisuals.b-cdn.net${path}?token=${expectedToken}&expires=${expires}`,
    );
  });
});
