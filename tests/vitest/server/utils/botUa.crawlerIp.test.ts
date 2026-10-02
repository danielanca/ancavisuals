import { describe, expect, test } from "vitest";
import { isCrawlerIp } from "src/server/utils/botUa";

describe("isCrawlerIp", () => {
  test("Meta data-center addresses are crawlers", () => {
    expect(isCrawlerIp("2a03:2880:ff:9::")).toBe(true);
    expect(isCrawlerIp("2A03:2880:f003:c07::1")).toBe(true);
    expect(isCrawlerIp("173.252.107.1")).toBe(true);
    expect(isCrawlerIp("::ffff:66.220.149.20")).toBe(true);
    expect(isCrawlerIp("57.141.0.12")).toBe(true);
  });

  test("ordinary visitors are not", () => {
    expect(isCrawlerIp("86.124.10.5")).toBe(false);
    expect(isCrawlerIp("2a02:2f0e:1::1")).toBe(false);
    expect(isCrawlerIp("173.253.0.1")).toBe(false);
    expect(isCrawlerIp("")).toBe(false);
  });
});
