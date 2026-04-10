/*
 * Purpose: covers the booking trigger API helper, including JSON parsing,
 * fallback behavior in development and error propagation in production.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("booking api safeTrigger", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("uses the configured booking email when present", async () => {
    vi.stubEnv("VITE_BOOKING_EMAIL", "studio@example.com");

    const module = await import("../../../../../../client/pages/Contact/booking/utils/api");

    expect(module.BOOKING_TO).toBe("studio@example.com");
  });

  test("falls back to the default booking email when env is missing", async () => {
    const module = await import("../../../../../../client/pages/Contact/booking/utils/api");

    expect(module.BOOKING_TO).toBe("ancadaniel1994@gmail.com");
  });

  test("returns parsed json for successful json responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue("application/json; charset=utf-8") },
      json: vi.fn().mockResolvedValue({ success: true, id: "evt_1" }),
      text: vi.fn(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { safeTrigger } = await import("../../../../../../client/pages/Contact/booking/utils/api");
    const payload = { typeEvent: "booking_step_completed" };

    await expect(safeTrigger(payload)).resolves.toEqual({ ok: true, success: true, id: "evt_1" });
    expect(fetchMock).toHaveBeenCalledWith("/triggerEvent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  test("returns only ok for non-json responses after consuming the text body", async () => {
    const textMock = vi.fn().mockResolvedValue("queued");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        headers: { get: vi.fn().mockReturnValue("text/plain") },
        json: vi.fn(),
        text: textMock,
      }),
    );

    const { safeTrigger } = await import("../../../../../../client/pages/Contact/booking/utils/api");

    await expect(safeTrigger({ typeEvent: "contact_submit" })).resolves.toEqual({ ok: false });
    expect(textMock).toHaveBeenCalledOnce();
  });

  test("tolerates invalid json bodies and still returns the response ok state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: vi.fn().mockReturnValue("application/json") },
        json: vi.fn().mockRejectedValue(new Error("invalid json")),
        text: vi.fn(),
      }),
    );

    const { safeTrigger } = await import("../../../../../../client/pages/Contact/booking/utils/api");

    await expect(safeTrigger({ typeEvent: "hero_view" })).resolves.toEqual({ ok: true });
  });

  test("returns a dev fallback and logs the payload when fetch fails outside production", async () => {
    vi.stubEnv("PROD", "");
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    const { safeTrigger } = await import("../../../../../../client/pages/Contact/booking/utils/api");
    const payload = { typeEvent: "faq_view", url: "/faq" };

    await expect(safeTrigger(payload)).resolves.toEqual({ ok: true, dev: true });
    expect(consoleLog).toHaveBeenCalledWith("[dev] /triggerEvent fallback:", payload);
  });

  test("rethrows fetch errors in production", async () => {
    vi.stubEnv("PROD", "1");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const { safeTrigger } = await import("../../../../../../client/pages/Contact/booking/utils/api");

    await expect(safeTrigger({ typeEvent: "pricing_view" })).rejects.toThrow("network down");
  });
});
