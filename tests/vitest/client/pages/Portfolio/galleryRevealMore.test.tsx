/*
 * Purpose: "Vezi mai multe poze" in the portfolio gallery — only `revealLimit` photos plus two
 * blurred rows are on the page until the button is clicked; each click opens as many again and
 * is reported to /admin/live. Without `revealLimit` (or with few photos) everything shows.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { sendLiveEventMock } = vi.hoisted(() => ({ sendLiveEventMock: vi.fn() }));

// Animations are not under test: every gsap call is a no-op that returns a chainable no-op.
vi.mock("gsap", () => {
  const noop: any = new Proxy(function () { return noop; }, { get: (_target, key) => (key === "revert" || key === "kill" ? () => undefined : noop) });
  return { default: noop, gsap: noop };
});
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { refresh: vi.fn(), create: vi.fn() } }));
vi.mock("gsap/SplitText", () => ({ SplitText: class { chars = []; words = []; lines = []; revert() {} } }));
vi.mock("src/client/utils/liveEvent", () => ({ sendLiveEvent: sendLiveEventMock }));
vi.mock("src/client/utils/galleryScrollRefresh", () => ({ installGalleryScrollRefresh: () => undefined, refreshGalleryScroll: vi.fn() }));

import PortfolioParallaxGallery from "src/client/pages/Portfolio/PortfolioParallaxGallery";

const photos = (count: number) => Array.from({ length: count }, (_, index) => `https://cdn.test/p${index}.webp`);
const realPhotos = () => document.querySelectorAll(".ppg-item:not(.ppg-peek) img").length;
const peekPhotos = () => document.querySelectorAll(".ppg-peek img").length;

beforeEach(() => {
  sendLiveEventMock.mockClear();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 }); // 4 columns
});

describe("gallery: Vezi mai multe poze", () => {
  test("shows the first photos and two blurred rows; each click opens as many again", () => {
    render(<PortfolioParallaxGallery images={photos(22)} revealLimit={8} />);
    expect(realPhotos()).toBe(8);
    expect(peekPhotos()).toBe(8); // two rows of 4, so no column has an empty blurred patch

    fireEvent.click(screen.getByRole("button", { name: /Vezi mai multe poze/ }));
    expect(realPhotos()).toBe(16);
    expect(peekPhotos()).toBe(6); // only 6 photos are left to tease
    expect(sendLiveEventMock).toHaveBeenLastCalledWith("gallery_more_clicked", expect.objectContaining({ meta: { count: 22, shownBefore: 8 } }));

    // 6 left = less than 16 + a row of 4 more: the next click opens the rest, no button after.
    fireEvent.click(screen.getByRole("button", { name: /Vezi mai multe poze/ }));
    expect(realPhotos()).toBe(22);
    expect(peekPhotos()).toBe(0);
    expect(screen.queryByRole("button", { name: /Vezi mai multe poze/ })).not.toBeInTheDocument();
  });

  test("with the button there is no 60-photo cap; without it the gallery stops at 60", () => {
    const { unmount } = render(<PortfolioParallaxGallery images={photos(70)} revealLimit={24} />);
    for (let click = 0; click < 2; click += 1) fireEvent.click(screen.getByRole("button", { name: /Vezi mai multe poze/ }));
    expect(realPhotos()).toBe(70);
    unmount();
    render(<PortfolioParallaxGallery images={photos(70)} />);
    expect(realPhotos()).toBe(60);
  });

  test("no button when there are few photos or no limit", () => {
    const { unmount } = render(<PortfolioParallaxGallery images={photos(10)} revealLimit={8} />);
    expect(screen.queryByRole("button", { name: /Vezi mai multe poze/ })).not.toBeInTheDocument();
    expect(realPhotos()).toBe(10);
    unmount();
    render(<PortfolioParallaxGallery images={photos(40)} />);
    expect(realPhotos()).toBe(40);
  });
});

describe("gallery: memory on long galleries", () => {
  test("photos far from the screen give up their image, keep their shape, and come back in the same place", () => {
    const observers: Array<{ callback: IntersectionObserverCallback; options?: IntersectionObserverInit }> = [];
    class FakeObserver {
      constructor(public callback: IntersectionObserverCallback, public options?: IntersectionObserverInit) { observers.push(this); }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);

    render(<PortfolioParallaxGallery images={photos(70)} revealLimit={24} />);
    fireEvent.click(screen.getByRole("button", { name: /Vezi mai multe poze/ })); // 48 open: parking starts
    // The parking watcher looks 3 screens around (the prefetch one looks 2 ahead).
    const parker = observers.find((observer) => observer.options?.rootMargin === `${Math.round(window.innerHeight * 3)}px 0px`);
    expect(parker).toBeDefined();

    const first = () => document.querySelector<HTMLElement>('[data-photo-index="0"]')!;
    const drawn = (img: HTMLImageElement, width: number, height: number) => {
      Object.defineProperty(img, "complete", { configurable: true, value: true });
      Object.defineProperty(img, "naturalWidth", { configurable: true, value: width });
      Object.defineProperty(img, "naturalHeight", { configurable: true, value: height });
    };
    const entry = (isIntersecting: boolean) => ({
      // The box is a 2/3 placeholder-like shape; the photo itself is landscape.
      target: first(), isIntersecting, boundingClientRect: { width: 208, height: 312 } as DOMRect,
    }) as unknown as IntersectionObserverEntry;

    // Not loaded yet: stays as it is.
    act(() => parker!.callback([entry(false)], {} as IntersectionObserver));
    expect(first().querySelector("img")).not.toBeNull();

    drawn(first().querySelector("img")!, 1400, 933);
    act(() => parker!.callback([entry(false)], {} as IntersectionObserver));
    expect(first().querySelector("img")).toBeNull();
    expect(first().style.aspectRatio).toBe("1400 / 933");

    act(() => parker!.callback([entry(true)], {} as IntersectionObserver));
    // Back with its own proportions holding the place ("auto": once drawn, the photo's own win).
    expect(first().querySelector("img")?.style.aspectRatio).toBe("auto 1400 / 933");
    vi.unstubAllGlobals();
  });
});

describe("gallery: next batch ready before the click", () => {
  test("downloads the next batch near the button, shows it at once on click, and then downloads the one after", () => {
    const observers: Array<{ callback: IntersectionObserverCallback; options?: IntersectionObserverInit; targets: Element[] }> = [];
    class FakeObserver {
      targets: Element[] = [];
      constructor(public callback: IntersectionObserverCallback, public options?: IntersectionObserverInit) { observers.push(this); }
      observe(target: Element) { this.targets.push(target); }
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    }
    const downloaded: string[] = [];
    class FakeImage { decoding = ""; set src(value: string) { downloaded.push(value); } }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    vi.stubGlobal("Image", FakeImage);

    render(<PortfolioParallaxGallery images={photos(70)} batchSize={12} revealLimit={24} />);
    const button = document.querySelector(".ppg-more")!;
    const watcher = observers.find((observer) => observer.targets.includes(button))!;
    act(() => watcher.callback([{ isIntersecting: true, target: button } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(downloaded).toEqual(photos(70).slice(24, 48));

    fireEvent.click(screen.getByRole("button", { name: /Vezi mai multe poze/ }));
    // Not batches of 12 after the click: the whole downloaded batch is on the page at once…
    expect(document.querySelectorAll('[data-photo-index="47"] img').length).toBe(1);
    // …and the batch the next click will open is already downloading.
    expect(downloaded).toEqual(photos(70).slice(24, 72));
    vi.unstubAllGlobals();
  });
});

describe("gallery: very wide photos on a phone", () => {
  test("take the whole row; the rest stay in two columns; slots already have the photo's shape", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 }); // 2 columns
    const list = photos(6);
    const ratios = { [list[0]]: 1067 / 1600, [list[1]]: 1400 / 933, [list[2]]: 1067 / 1600, [list[3]]: 1920 / 1080, [list[4]]: 1067 / 1600, [list[5]]: 1067 / 1600 };
    render(<PortfolioParallaxGallery images={list} ratios={ratios} batchSize={4} />);
    const wide = document.querySelector(".ppg-wide [data-photo-index='3'], .ppg-wide .ppg-slot");
    expect(document.querySelectorAll(".ppg-wide").length).toBe(1);
    expect(wide).not.toBeNull();
    expect(document.querySelectorAll(".ppg-block").length).toBe(2);
    // Photos 4 and 5 are not loaded yet (batch of 4): their slots already have the portrait shape.
    const slots = [...document.querySelectorAll<HTMLElement>(".ppg-slot")];
    expect(slots.length).toBe(2);
    expect(slots.every((slot) => slot.style.aspectRatio !== "")).toBe(true);
  });
});

describe("gallery: a click shows the photo bigger", () => {
  test("opens the lightbox with the photo's original (or the photo itself when it has none)", () => {
    const list = photos(3);
    render(<PortfolioParallaxGallery images={list} originals={{ [list[1]]: "https://cdn.test/p1-original.jpg" }} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Deschide fotografia" })[1]);
    expect(document.querySelector('.yarl__slide_current img')?.getAttribute("src")).toBe("https://cdn.test/p1-original.jpg");
  });
});

describe("gallery: batches while scrolling fast", () => {
  test("the next batch comes even when the visitor already scrolled past its first empty tile", () => {
    const observers: Array<{ callback: IntersectionObserverCallback; options?: IntersectionObserverInit; targets: Element[] }> = [];
    class FakeObserver {
      targets: Element[] = [];
      constructor(public callback: IntersectionObserverCallback, public options?: IntersectionObserverInit) { observers.push(this); }
      observe(target: Element) { this.targets.push(target); }
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const list = photos(30);
    // Shapes known (as on the offer pages): no waiting for the batch's photos to download.
    render(<PortfolioParallaxGallery images={list} batchSize={12} ratios={Object.fromEntries(list.map((src) => [src, 2 / 3]))} />);
    expect(document.querySelectorAll(".ppg-item img").length).toBe(12);

    const slot = document.querySelector(".ppg-slot")!;
    const watcher = observers.filter((observer) => observer.options?.rootMargin === "600px 0px" && observer.targets.includes(slot)).pop()!;
    // Far above the screen and not intersecting: the visitor is already below it.
    const passed = { target: slot, isIntersecting: false, boundingClientRect: { top: -3000, bottom: -2700 } as DOMRect } as unknown as IntersectionObserverEntry;
    act(() => watcher.callback([passed], {} as IntersectionObserver));
    expect(document.querySelectorAll(".ppg-item img").length).toBe(24);
    vi.unstubAllGlobals();
  });
});
