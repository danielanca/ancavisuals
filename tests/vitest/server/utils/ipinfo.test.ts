/*
 * Purpose: verifies getClientIp and fetchIpInfo from the ipInfo utility —
 * IP extraction from various request shapes and API call behaviour.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchIpInfo, getClientIp } from "src/server/utils/ipinfo";
import type { Request } from "express";

function makeReq(overrides: Partial<{ headers: Record<string, string | string[]>; ip: string }>): Request {
  return {
    headers: {},
    ip: "",
    ...overrides,
  } as unknown as Request;
}

describe("getClientIp", () => {
  test("returns the first IP from a string x-forwarded-for header", () => {
    const req = makeReq({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  test("trims whitespace from the forwarded IP", () => {
    const req = makeReq({ headers: { "x-forwarded-for": "  9.8.7.6 , 1.1.1.1" } });
    expect(getClientIp(req)).toBe("9.8.7.6");
  });

  test("returns the first entry when x-forwarded-for is an array", () => {
    const req = makeReq({ headers: { "x-forwarded-for": ["3.3.3.3, 4.4.4.4", "5.5.5.5"] } });
    expect(getClientIp(req)).toBe("3.3.3.3");
  });

  test("falls back to req.ip when no forwarded header is present", () => {
    const req = makeReq({ ip: "10.0.0.1" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  test("strips ::ffff: prefix from IPv4-mapped IPv6 addresses", () => {
    const req = makeReq({ ip: "::ffff:192.168.1.1" });
    expect(getClientIp(req)).toBe("192.168.1.1");
  });

  test("returns empty string when ip is undefined and no header present", () => {
    const req = makeReq({});
    expect(getClientIp(req)).toBe("");
  });

  test("ignores x-forwarded-for when it is an empty string", () => {
    const req = makeReq({ headers: { "x-forwarded-for": "" }, ip: "7.7.7.7" });
    expect(getClientIp(req)).toBe("7.7.7.7");
  });

  test("ignores x-forwarded-for when it is an empty array", () => {
    const req = makeReq({ headers: { "x-forwarded-for": [] }, ip: "8.8.8.8" });
    expect(getClientIp(req)).toBe("8.8.8.8");
  });

  test("returns empty string when req.ip is undefined and no header present", () => {
    const req = { headers: {} } as unknown as Request;
    expect(getClientIp(req)).toBe("");
  });
});

describe("fetchIpInfo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("returns null when IPINFO_TOKEN is not set", async () => {
    vi.stubEnv("IPINFO_TOKEN", "");
    const result = await fetchIpInfo("1.2.3.4");
    expect(result).toBeNull();
  });

  test("returns null for the loopback address 127.0.0.1", async () => {
    vi.stubEnv("IPINFO_TOKEN", "test-token");
    const result = await fetchIpInfo("127.0.0.1");
    expect(result).toBeNull();
  });

  test("returns null for the IPv6 loopback ::1", async () => {
    vi.stubEnv("IPINFO_TOKEN", "test-token");
    const result = await fetchIpInfo("::1");
    expect(result).toBeNull();
  });

  test("returns null for an empty IP string", async () => {
    vi.stubEnv("IPINFO_TOKEN", "test-token");
    const result = await fetchIpInfo("");
    expect(result).toBeNull();
  });

  test("returns null when the API responds with a non-OK status", async () => {
    vi.stubEnv("IPINFO_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await fetchIpInfo("89.40.11.22");
    expect(result).toBeNull();
  });

  test("returns parsed IpInfo on a successful API response", async () => {
    vi.stubEnv("IPINFO_TOKEN", "test-token");
    const mockData = { ip: "89.40.11.22", city: "Bucharest", country: "RO", timezone: "Europe/Bucharest" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }));
    const result = await fetchIpInfo("89.40.11.22");
    expect(result).toEqual(mockData);
  });
});
