/*
 * Purpose: WhatsApp / tel: clicks anywhere on the public site send the
 * "Persoană de contact" conversion once per session; album and admin pages don't.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireAdsAvailabilityMicroConversion, installAdsContactClickTracking } from "src/client/utils/googleAds";

const CONTACT = "AW-10941123412/MCYICIjAx_4cENSWkeEo";
const AVAILABILITY = "AW-10941123412/UaLJCL7Y0oQdENSWkeEo";

const click = (href: string) => {
  const a = document.createElement("a");
  a.href = href;
  a.innerHTML = "<span>WhatsApp</span>";
  a.addEventListener("click", (e) => e.preventDefault());
  document.body.appendChild(a);
  (a.firstChild as HTMLElement).click();
};
// Other suites in this run replace window.location without restoring it, so pushState alone is not enough.
const setPath = (path: string) => {
  window.history.pushState({}, "", path);
  if (window.location.pathname !== path) {
    Object.defineProperty(window, "location", { configurable: true, writable: true, value: { ...window.location, pathname: path } });
  }
};
const sentTo = (gtag: ReturnType<typeof vi.fn>) => gtag.mock.calls.map((c) => c[2].send_to);

describe("Google Ads contact tracking", () => {
  let gtag: ReturnType<typeof vi.fn>;
  let uninstall: () => void;

  beforeEach(() => {
    // Suites share one jsdom here; a private store keeps other files' session keys out.
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    document.body.innerHTML = "";
    setPath("/");
    gtag = vi.fn();
    (window as unknown as { gtag: unknown }).gtag = gtag;
    uninstall = installAdsContactClickTracking();
  });
  afterEach(() => {
    uninstall();
    vi.unstubAllGlobals();
  });

  test("WhatsApp and tel: links on any public page count once per session", () => {
    click("https://wa.me/40745469907");
    click("tel:+40745469907");
    expect(sentTo(gtag)).toEqual([CONTACT]);
  });

  test("ordinary links are ignored", () => {
    click("/portofoliu");
    expect(gtag).not.toHaveBeenCalled();
  });

  test("album and admin pages do not count", () => {
    setPath("/media/8august2026");
    click("https://wa.me/40745469907");
    setPath("/admin/live");
    click("https://wa.me/40745469907");
    expect(gtag).not.toHaveBeenCalled();
  });

  test("availability check counts once per session", () => {
    fireAdsAvailabilityMicroConversion();
    fireAdsAvailabilityMicroConversion();
    expect(sentTo(gtag)).toEqual([AVAILABILITY]);
  });
});
