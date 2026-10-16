/*
 * Purpose: adaptive quality for the "Vezi-ne la lucru" player — an HLS playlist (Bunny
 * Stream) plays natively where the browser can (Safari, keeps play() inside the tap), and
 * through hls.js elsewhere, loaded only on the first play, with quality capped to the
 * player's size; plain MP4 links never touch hls.js.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const hls = vi.hoisted(() => ({ instances: [] as Array<{ config: unknown; loadSource: ReturnType<typeof vi.fn>; attachMedia: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }>, supported: true }));
vi.mock("hls.js", () => ({
  default: class {
    static isSupported() { return hls.supported; }
    loadSource = vi.fn(); attachMedia = vi.fn(); destroy = vi.fn();
    constructor(public config: unknown) { hls.instances.push(this as never); }
  },
}));
vi.mock("src/client/utils/liveEvent", () => ({ sendLiveEvent: vi.fn() }));
import CampaignVideoPlayer from "src/client/pages/CampaignLanding/CampaignVideoPlayer";

const playlist = "https://vz-test.b-cdn.net/abc-123/playlist.m3u8";
const video = () => document.querySelector("video")!;
let canPlayHls = "";

beforeEach(() => {
  hls.instances.length = 0; hls.supported = true; canPlayHls = "";
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation((type: string) => (type === "application/vnd.apple.mpegurl" ? canPlayHls : ""));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test("outside Safari, hls.js attaches the playlist on the first play with size-capped auto quality", async () => {
  const { unmount } = render(<CampaignVideoPlayer src={playlist} />);
  expect(video().getAttribute("src")).toBeNull();
  expect(video().getAttribute("poster")).toBe("https://vz-test.b-cdn.net/abc-123/thumbnail.jpg");
  expect(hls.instances).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "Pornește videoclipul" }));
  await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
  expect(hls.instances).toHaveLength(1);
  expect(hls.instances[0].config).toMatchObject({ capLevelToPlayerSize: true, startLevel: -1 });
  expect(hls.instances[0].loadSource).toHaveBeenCalledWith(playlist);
  expect(hls.instances[0].attachMedia).toHaveBeenCalledWith(video());

  unmount();
  expect(hls.instances[0].destroy).toHaveBeenCalled();
});

test("Safari plays the playlist natively, without hls.js", async () => {
  canPlayHls = "maybe";
  render(<CampaignVideoPlayer src={playlist} poster="https://example.com/poster.jpg" />);
  await waitFor(() => expect(video().getAttribute("src")).toBe(playlist));
  expect(video().getAttribute("poster")).toBe("https://example.com/poster.jpg");
  fireEvent.click(screen.getByRole("button", { name: "Pornește videoclipul" }));
  await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
  expect(hls.instances).toHaveLength(0);
});

test("MP4 links keep the direct source and never load hls.js", async () => {
  render(<CampaignVideoPlayer src="https://cdn.example.com/film-1080p.mp4" />);
  expect(video().getAttribute("src")).toBe("https://cdn.example.com/film-1080p.mp4#t=0.1");
  fireEvent.click(screen.getByRole("button", { name: "Pornește videoclipul" }));
  await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
  expect(hls.instances).toHaveLength(0);
});
