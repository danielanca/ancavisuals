/*
 * Purpose: verifies isLocalIp correctly identifies local/loopback IPs so that
 * trigger emails are skipped during local development.
 */
import { describe, expect, test } from "vitest";
import { isLocalIp } from "src/server/controllers/triggerEvent.controller";

describe("isLocalIp", () => {
  test("recognises 127.0.0.1 as local", () => {
    expect(isLocalIp("127.0.0.1")).toBe(true);
  });

  test("recognises ::1 (IPv6 loopback) as local", () => {
    expect(isLocalIp("::1")).toBe(true);
  });

  test("recognises the string 'localhost' as local", () => {
    expect(isLocalIp("localhost")).toBe(true);
  });

  test("strips ::ffff: prefix before checking", () => {
    expect(isLocalIp("::ffff:127.0.0.1")).toBe(true);
  });

  test("returns false for a public IP", () => {
    expect(isLocalIp("89.40.11.22")).toBe(false);
  });

  test("returns false for a private LAN IP (not loopback)", () => {
    expect(isLocalIp("192.168.1.100")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isLocalIp("")).toBe(false);
  });
});
