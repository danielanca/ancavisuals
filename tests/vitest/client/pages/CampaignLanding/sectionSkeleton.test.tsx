/*
 * Purpose: the landing's loading skeleton says the page is loading and has a progress bar that
 * waits while the skeleton is below the fold and starts from 0 when the visitor reaches it.
 */
import { act, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import SectionSkeleton from "src/client/pages/CampaignLanding/SectionSkeleton";

let report: (visible: boolean) => void = () => {};
class FakeObserver {
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    report = (visible) => callback([{ isIntersecting: visible }]);
  }
  observe() {}
  disconnect() {}
}
afterEach(() => vi.unstubAllGlobals());

test("says the page is loading, no photos, and the bar starts when the skeleton comes on screen", () => {
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  const { container } = render(<SectionSkeleton height="500px" />);
  expect(container).toHaveTextContent("Pagina se încarcă");
  expect(container.querySelector("img")).toBeNull();

  act(() => report(false));
  const waitingBar = container.querySelector(".av-skeleton-bar")!;
  expect(waitingBar).toHaveAttribute("data-waiting");

  act(() => report(true));
  const runningBar = container.querySelector(".av-skeleton-bar")!;
  expect(runningBar).not.toHaveAttribute("data-waiting");
  expect(runningBar).not.toBe(waitingBar); // remounted: the animation starts over from 0
});

test("already on screen: the bar keeps running, it doesn't restart", () => {
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  const { container } = render(<SectionSkeleton height="500px" />);
  const bar = container.querySelector(".av-skeleton-bar");
  act(() => report(true));
  expect(container.querySelector(".av-skeleton-bar")).toBe(bar);
});
