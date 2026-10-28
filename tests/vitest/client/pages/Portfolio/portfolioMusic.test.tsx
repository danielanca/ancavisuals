/*
 * Purpose: the portfolio song banner — nothing loads or plays until the visitor presses play;
 * play fades in through a GainNode, stop fades out then pauses, /admin/live hears about it once,
 * the speaker button only shows after play once the banner is off screen, and over the price
 * configurator the song goes quieter.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { sendLiveEventMock } = vi.hoisted(() => ({ sendLiveEventMock: vi.fn() }));
vi.mock("src/client/utils/liveEvent", () => ({ sendLiveEvent: sendLiveEventMock }));

import PortfolioMusic, { MUSIC_VOLUME, PORTFOLIO_SONG_URL, formatTime } from "src/client/pages/Portfolio/PortfolioMusic";

const ramps: number[] = [];
const audios: FakeAudio[] = [];
const observers: Array<{ target: Element | null; callback: IntersectionObserverCallback }> = [];

class FakeAudio {
  src = "";
  crossOrigin = "";
  loop = false;
  preload = "";
  volume = 1;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();
  currentTime = 0;
  listeners: Record<string, () => void> = {};
  addEventListener(type: string, listener: () => void) {
    this.listeners[type] = listener;
  }
  constructor() {
    audios.push(this);
  }
}

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
  createGain() {
    const gain = {
      gain: { value: 0, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn((v: number) => ramps.push(v)) },
      connect: (next: unknown) => next,
    };
    return gain;
  }
  createMediaElementSource() {
    return { connect: (next: unknown) => next };
  }
}

class FakeObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    observers.push({ target, callback: this.callback });
  }
  disconnect() {}
}

const intersect = (target: Element | null, isIntersecting: boolean) => {
  for (const o of observers.filter((entry) => entry.target === target)) {
    act(() => o.callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  ramps.length = 0;
  audios.length = 0;
  observers.length = 0;
  sendLiveEventMock.mockClear();
  window.localStorage.clear();
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("portfolio music", () => {
  test("loads nothing before play; play fades in and is reported once; stop fades out then pauses", async () => {
    render(<PortfolioMusic />);
    expect(audios).toHaveLength(0);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Pornește melodia/ })));
    expect(audios[0].src).toBe(PORTFOLIO_SONG_URL);
    expect(audios[0].play).toHaveBeenCalled();
    expect(ramps.at(-1)).toBe(MUSIC_VOLUME);
    expect(sendLiveEventMock).toHaveBeenCalledWith("portfolio_music_played", { meta: { how: "click" } });

    fireEvent.click(screen.getByRole("button", { name: /Oprește melodia/ }));
    expect(ramps.at(-1)).toBe(0);
    expect(audios[0].pause).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2000));
    expect(audios[0].pause).toHaveBeenCalled();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Pornește melodia/ })));
    expect(audios).toHaveLength(1);
    expect(sendLiveEventMock).toHaveBeenCalledTimes(1);
  });

  test("speaker button only after play, in the photos, once the banner is off screen", async () => {
    const { container } = render(<section className="ppg-section"><PortfolioMusic /></section>);
    const banner = container.querySelector(".ppg-music");
    expect(document.querySelector(".ppg-music-float")).toBeNull();

    await act(async () => intersect(container.querySelector(".ppg-section"), true));
    expect(document.querySelector(".ppg-music-float")).toBeNull();

    intersect(banner, false);
    const speaker = document.querySelector(".ppg-music-float") as HTMLElement;
    expect(speaker).not.toBeNull();
    fireEvent.click(speaker);
    expect(ramps.at(-1)).toBe(0);

    intersect(banner, true);
    expect(document.querySelector(".ppg-music-float")).toBeNull();
  });

  test("shows the song, its length, and the time as it plays; the bar jumps to a spot", async () => {
    render(<PortfolioMusic />);
    expect(screen.getByText(/Ordinary/)).toBeInTheDocument();
    expect(screen.getByText("3:07")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /Poziția/ })).toBeDisabled();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Pornește melodia/ })));
    const audio = audios[0];
    audio.currentTime = 42;
    act(() => audio.listeners.timeupdate());
    expect(screen.getByText("0:42")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: /Poziția/ }), { target: { value: "90" } });
    expect(audio.currentTime).toBe(90);
    expect(screen.getByText("1:30")).toBeInTheDocument();
  });

  test("formats times as m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(187.01)).toBe("3:07");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });

  test("the volume slider changes the level and is remembered", async () => {
    const { unmount } = render(<PortfolioMusic />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Pornește melodia/ })));
    fireEvent.change(screen.getByRole("slider", { name: "Volum" }), { target: { value: "0.8" } });
    expect(ramps.at(-1)).toBeCloseTo(0.8);
    unmount();

    render(<PortfolioMusic />);
    expect(screen.getByRole("slider", { name: "Volum" })).toHaveValue("0.8");
  });

  test("a video with sound stops the song; a muted clip does not", async () => {
    render(<PortfolioMusic />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Pornește melodia/ })));
    const startVideo = (muted: boolean) => {
      const video = document.createElement("video");
      Object.defineProperty(video, "paused", { value: false });
      video.muted = muted;
      document.body.appendChild(video);
      act(() => { video.dispatchEvent(new Event("play")); });
    };

    startVideo(true);
    expect(screen.getByRole("button", { name: /Oprește melodia/ })).toBeInTheDocument();

    startVideo(false);
    expect(screen.getByRole("button", { name: /Pornește melodia/ })).toBeInTheDocument();
    expect(ramps.at(-1)).toBe(0);
  });

  test("clicking into an embedded film stops the song", async () => {
    render(<PortfolioMusic />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Pornește melodia/ })));
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    frame.focus();
    act(() => {
      window.dispatchEvent(new Event("blur"));
      vi.runOnlyPendingTimers();
    });
    expect(screen.getByRole("button", { name: /Pornește melodia/ })).toBeInTheDocument();
  });

  describe("in the photos", () => {
    const renderInGallery = () => {
      const view = render(<section className="ppg-section"><PortfolioMusic /></section>);
      const section = view.container.querySelector(".ppg-section");
      return { section };
    };
    const activate = (active: boolean) =>
      Object.defineProperty(navigator, "userActivation", { configurable: true, value: { hasBeenActive: active, isActive: false } });
    afterEach(() => {
      delete (navigator as { userActivation?: unknown }).userActivation;
    });

    test("starts by itself on reaching the photos when the page was already touched, stops on leaving", async () => {
      activate(true);
      const { section } = renderInGallery();
      await act(async () => intersect(section, true));
      expect(audios).toHaveLength(1);
      expect(screen.getByRole("button", { name: /Oprește melodia/ })).toBeInTheDocument();
      expect(sendLiveEventMock).toHaveBeenCalledWith("portfolio_music_played", { meta: { how: "auto" } });

      intersect(section, false);
      expect(ramps.at(-1)).toBe(0);
      expect(screen.getByRole("button", { name: /Pornește melodia/ })).toBeInTheDocument();

      await act(async () => intersect(section, true));
      expect(screen.getByRole("button", { name: /Oprește melodia/ })).toBeInTheDocument();
    });

    test("not touched yet: downloads nothing, starts on the first tap in the photos", async () => {
      activate(false);
      const { section } = renderInGallery();
      intersect(section, true);
      expect(audios).toHaveLength(0);

      await act(async () => window.dispatchEvent(new Event("pointerup")));
      expect(audios).toHaveLength(1);
      expect(screen.getByRole("button", { name: /Oprește melodia/ })).toBeInTheDocument();
    });

    test("stopped by the visitor: does not start again by itself", async () => {
      activate(true);
      const { section } = renderInGallery();
      await act(async () => intersect(section, true));
      fireEvent.click(screen.getByRole("button", { name: /Oprește melodia/ }));
      intersect(section, false);
      await act(async () => intersect(section, true));
      await act(async () => window.dispatchEvent(new Event("pointerup")));
      expect(screen.getByRole("button", { name: /Pornește melodia/ })).toBeInTheDocument();
    });
  });
});
