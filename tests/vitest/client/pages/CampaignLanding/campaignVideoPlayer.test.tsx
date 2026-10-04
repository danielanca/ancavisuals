/*
 * Purpose: the "Vezi-ne la lucru" player never shows native controls and never starts by
 * itself; play/pause and sound live in an always-visible bottom bar.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("src/client/utils/liveEvent", () => ({ sendLiveEvent: vi.fn() }));
import { sendLiveEvent } from "src/client/utils/liveEvent";
import CampaignVideoPlayer from "src/client/pages/CampaignLanding/CampaignVideoPlayer";

let fire: (visible: boolean) => void = () => {};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { fire = (v) => cb([{ isIntersecting: v }]); }
    observe() {} disconnect() {}
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: false });
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: true });
    this.dispatchEvent(new Event("pause"));
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const video = () => document.querySelector("video")!;

describe("CampaignVideoPlayer", () => {
  test("no native controls; play/pause then sound sit side by side in the bar", () => {
    render(<CampaignVideoPlayer src="/v.mp4" />);
    expect(video().hasAttribute("controls")).toBe(false);
    const bar = screen.getByRole("button", { name: "Play" }).parentElement!;
    expect(bar.children[1].getAttribute("aria-label")).toBe("Oprește sunetul");
  });

  test("does not start by itself, even on screen", async () => {
    render(<CampaignVideoPlayer src="/v.mp4" />);
    await act(async () => { fire(true); });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pornește videoclipul" })).toBeTruthy();
  });

  test("big play starts with sound; scrolling away pauses and it stays paused", async () => {
    render(<CampaignVideoPlayer src="/v.mp4" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Pornește videoclipul" })); });
    expect(video().muted).toBe(false);
    expect(screen.getByRole("button", { name: "Pauză" })).toBeTruthy();
    expect(sendLiveEvent).toHaveBeenCalledTimes(1);

    await act(async () => { fire(false); });
    expect(video().paused).toBe(true);
    await act(async () => { fire(true); });
    expect(video().paused).toBe(true);
    expect(screen.getByRole("button", { name: "Continuă videoclipul" })).toBeTruthy();
  });
});
