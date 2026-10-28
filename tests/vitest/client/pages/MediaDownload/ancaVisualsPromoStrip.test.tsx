/*
 * Purpose: the promo's photo strip rotates (downloading 18 new photos) only while it is on
 * screen — off screen it stays put instead of downloading photos nobody sees.
 */
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

let setOnScreen: (visible: boolean) => void = () => {};
class FakeObserver {
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    setOnScreen = (visible) => callback([{ isIntersecting: visible }]);
  }
  observe() {}
  disconnect() {}
}

const photos = Array.from({ length: 40 }, (_, i) => `https://cdn.test/p${i}.webp`);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ photos }) }));
  // Preloaded "next batch" images resolve at once.
  vi.stubGlobal("Image", class { onload?: () => void; set src(_v: string) { queueMicrotask(() => this.onload?.()); } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const firstStripPhoto = (container: HTMLElement) => container.querySelector("#media-promo-zone img")?.getAttribute("src");

test("rotates only while on screen", async () => {
  const { default: AncaVisualsPromo } = await import("src/client/pages/MediaDownload/AncaVisualsPromo");
  const { container } = render(<AncaVisualsPromo />);
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  expect(firstStripPhoto(container)).toBe(photos[0]);

  act(() => setOnScreen(false));
  await act(async () => { await vi.advanceTimersByTimeAsync(25_000); });
  expect(firstStripPhoto(container)).toBe(photos[0]);

  act(() => setOnScreen(true));
  await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });
  expect(firstStripPhoto(container)).toBe(photos[18]);
});
