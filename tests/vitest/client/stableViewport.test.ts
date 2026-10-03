import { afterEach, describe, expect, it } from "vitest";
import { installStableViewport, stableVh } from "../../../src/client/utils/stableViewport";

const resizeTo = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  window.dispatchEvent(new Event("resize"));
};
const value = () => document.documentElement.style.getPropertyValue("--stable-vh");

describe("installStableViewport", () => {
  let stop: (() => void) | undefined;
  afterEach(() => { stop?.(); document.documentElement.style.removeProperty("--stable-vh"); });

  it("ignores height-only changes (keyboard, browser bar) and follows rotation", () => {
    resizeTo(390, 800);
    stop = installStableViewport();
    expect(value()).toBe("8px");
    resizeTo(390, 450); // keyboard opens
    expect(value()).toBe("8px");
    resizeTo(800, 390); // rotation
    expect(value()).toBe("3.9px");
  });

  it("builds a calc with a vh fallback", () => {
    expect(stableVh(85)).toBe("calc(var(--stable-vh, 1vh) * 85)");
  });
});
