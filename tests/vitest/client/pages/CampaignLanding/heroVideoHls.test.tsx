/*
 * Purpose: the hero clip as an adaptive Bunny Stream loop — `#t=start,end` picks the looped
 * segment of the full film; nothing streams before the hero is on screen or on 2G / data
 * saver (the photo stays); hls.js starts loading at the loop start with size-capped auto
 * quality; Safari streams natively; reaching the end jumps back to the loop start; an autoplay
 * refused (iPhone Low Power Mode) starts on the visitor's next tap anywhere.
 */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const hls = vi.hoisted(() => ({ instances: [] as Array<{ config: Record<string, unknown>; loadSource: ReturnType<typeof vi.fn>; attachMedia: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }> }));
vi.mock("hls.js", () => ({
  default: class {
    static isSupported() { return true; }
    loadSource = vi.fn(); attachMedia = vi.fn(); destroy = vi.fn();
    constructor(public config: Record<string, unknown>) { hls.instances.push(this as never); }
  },
}));
import HeroVideo, { parseLoopUrl } from "src/client/pages/CampaignLanding/HeroVideo";

const playlist = "https://vz-test.b-cdn.net/abc/playlist.m3u8";
let showHero: (visible: boolean) => void = () => {};
let canPlayHls = "";
const video = () => document.querySelector("video");

beforeEach(() => {
  hls.instances.length = 0; canPlayHls = "";
  vi.stubGlobal("IntersectionObserver", class {
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { showHero = (v) => act(() => cb([{ isIntersecting: v }])); }
    observe() {} disconnect() {}
  });
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation((type: string) => (type === "application/vnd.apple.mpegurl" ? canPlayHls : ""));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  Object.defineProperty(navigator, "connection", { configurable: true, value: undefined });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("parseLoopUrl", () => {
  test("reads the looped segment from the Media Fragments suffix", () => {
    expect(parseLoopUrl(`${playlist}#t=59,127`)).toEqual({ url: playlist, start: 59, end: 127 });
    expect(parseLoopUrl(`${playlist}#t=12.5`)).toEqual({ url: playlist, start: 12.5, end: null });
    expect(parseLoopUrl(playlist)).toEqual({ url: playlist, start: 0, end: null });
    expect(parseLoopUrl(`${playlist}#t=60,30`)).toEqual({ url: playlist, start: 60, end: null });
  });
});

describe("HeroVideo with a Bunny Stream playlist", () => {
  test("streams only once on screen, from the loop start, with size-capped auto quality", async () => {
    const { unmount } = render(<HeroVideo src={`${playlist}#t=59,127`} />);
    expect(video()).toBeNull();
    showHero(true);
    await waitFor(() => expect(hls.instances).toHaveLength(1));
    expect(hls.instances[0].config).toMatchObject({ capLevelToPlayerSize: true, startLevel: -1, startPosition: 59 });
    expect(hls.instances[0].loadSource).toHaveBeenCalledWith(playlist);
    expect(hls.instances[0].attachMedia).toHaveBeenCalledWith(video());
    expect(video()!.muted).toBe(true);

    Object.defineProperty(video()!, "currentTime", { configurable: true, writable: true, value: 127.1 });
    fireEvent.timeUpdate(video()!);
    expect(video()!.currentTime).toBe(59);

    unmount();
    expect(hls.instances[0].destroy).toHaveBeenCalled();
  });

  test("Safari streams the playlist natively", async () => {
    canPlayHls = "maybe";
    render(<HeroVideo src={`${playlist}#t=59,127`} />);
    showHero(true);
    await waitFor(() => expect(video()?.getAttribute("src") ?? video()?.src).toBe(playlist));
    expect(hls.instances).toHaveLength(0);
  });

  test("on 2G or with data saver the photo stays and nothing streams", async () => {
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
    render(<HeroVideo src={`${playlist}#t=59,127`} />);
    showHero(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(video()).toBeNull();
    expect(hls.instances).toHaveLength(0);
  });

  test("autoplay refused (iPhone Low Power Mode): plays on the next tap anywhere, until one works", async () => {
    canPlayHls = "maybe";
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("NotAllowedError"));
    render(<HeroVideo src={`${playlist}#t=59,127`} />);
    showHero(true);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });

    fireEvent.touchEnd(document.body); // a scroll: still refused
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    play.mockResolvedValue(undefined);
    fireEvent.click(document.body);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(3));
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(document.body); // playing: taps no longer touch the video
    expect(play).toHaveBeenCalledTimes(3);
  });
});
