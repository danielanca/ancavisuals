import { afterEach, describe, expect, test, vi } from "vitest";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { installGalleryScrollRefresh, refreshGalleryScroll } from "src/client/utils/galleryScrollRefresh";

vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { config: vi.fn(), refresh: vi.fn() } }));
let cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.forEach(fn => fn());
  cleanups = [];
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function setup() {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("innerHeight", 844);
  cleanups.push(installGalleryScrollRefresh());
}
describe("gallery refresh while completing a mobile form", () => {
  test("keyboard height changes do not refresh; rotation does", () => {
    setup();
    vi.stubGlobal("innerHeight", 420);
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(350);
    expect(ScrollTrigger.refresh).not.toHaveBeenCalled();
    vi.stubGlobal("innerWidth", 844);
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(350);
    expect(ScrollTrigger.refresh).toHaveBeenCalledTimes(1);
  });
  test("image refresh waits until editing ends, including moving between fields", () => {
    setup();
    document.body.innerHTML = '<input id="venue"><input id="county">';
    const venue = document.getElementById("venue")!;
    const county = document.getElementById("county")!;
    venue.focus();
    refreshGalleryScroll();
    county.focus();
    vi.advanceTimersByTime(350);
    expect(ScrollTrigger.refresh).not.toHaveBeenCalled();
    county.blur();
    vi.advanceTimersByTime(350);
    expect(ScrollTrigger.refresh).toHaveBeenCalledTimes(1);
  });
  test("shared listeners stay installed until the last gallery unmounts", () => {
    setup();
    const releaseSecond = installGalleryScrollRefresh();
    cleanups.pop()!();
    expect(ScrollTrigger.config).toHaveBeenCalledTimes(1);
    releaseSecond();
    expect(ScrollTrigger.config).toHaveBeenLastCalledWith({ autoRefreshEvents: "visibilitychange,DOMContentLoaded,load,resize" });
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(350);
    expect(ScrollTrigger.refresh).not.toHaveBeenCalled();
  });
});
