/*
 * Purpose: "Setări cookie" must open the Usercentrics banner even when it is the very
 * first interaction on the page (phones) — the CMP is then loaded on demand.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { LOAD_USERCENTRICS_EVENT, openCookieSettings } from "src/client/utils/cookieConsent";

const w = window as unknown as Record<string, unknown>;

afterEach(() => {
  delete w.UC_UI;
  vi.useRealTimers();
});

describe("openCookieSettings", () => {
  test("opens the banner right away when Usercentrics is loaded", () => {
    const showFirstLayer = vi.fn();
    w.UC_UI = { showFirstLayer };
    openCookieSettings();
    expect(showFirstLayer).toHaveBeenCalledTimes(1);
  });

  test("asks for the CMP to load and opens the banner once it is initialized", () => {
    const requested = vi.fn();
    window.addEventListener(LOAD_USERCENTRICS_EVENT, requested, { once: true });
    openCookieSettings();
    expect(requested).toHaveBeenCalledTimes(1);

    const showFirstLayer = vi.fn();
    w.UC_UI = { showFirstLayer };
    window.dispatchEvent(new Event("UC_UI_INITIALIZED"));
    expect(showFirstLayer).toHaveBeenCalledTimes(1);

    // A later event must not reopen it.
    window.dispatchEvent(new Event("UC_UI_INITIALIZED"));
    expect(showFirstLayer).toHaveBeenCalledTimes(1);
  });

  test("gives up quietly when the CMP never loads (localhost)", () => {
    vi.useFakeTimers();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    openCookieSettings();
    vi.advanceTimersByTime(10_000);
    expect(info).toHaveBeenCalled();
    info.mockRestore();
  });
});
