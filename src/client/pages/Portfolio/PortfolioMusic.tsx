import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sendLiveEvent } from "../../utils/liveEvent";

// Background song for the portfolio (owner, 2026-10-27): the visitor presses play under the
// "Portofoliu" title and it plays softly while they look at the photos — fading in and out,
// much quieter over the price configurator, with a small speaker button to stop it once the
// banner is out of view.
export const PORTFOLIO_SONG_URL = "https://ancavisuals.b-cdn.net/custom-download/Ordinary.mp3";
export const PORTFOLIO_SONG_TITLE = "Ordinary";
export const PORTFOLIO_SONG_ARTIST = "Alex Warren";
// Shown before the file loads (nothing is downloaded until play); the real length replaces it.
const PORTFOLIO_SONG_SECONDS = 187;
// Soft by default (owner found 0.6 too loud); the visitor can change it with the volume slider.
export const MUSIC_VOLUME = 0.35;
/** Over the configurator the song plays at this share of the chosen volume. */
export const CONFIGURATOR_SHARE = 0.25;
const VOLUME_STORAGE_KEY = "ppg-music-volume";
const FADE_IN_S = 2.5;
const FADE_OUT_S = 1.5;
const DUCK_S = 1.2;
const VOLUME_CHANGE_S = 0.15;

function savedVolume(): number {
  try {
    const value = Number(window.localStorage.getItem(VOLUME_STORAGE_KEY));
    return value > 0 && value <= 1 ? value : MUSIC_VOLUME;
  } catch {
    return MUSIC_VOLUME;
  }
}

type LegacyAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * One song with smooth volume changes. iOS ignores `audio.volume`, so when Web Audio is there
 * the fades go through a GainNode (needs the CDN's CORS header, which Bunny sends); otherwise
 * they step `audio.volume`.
 */
class SongPlayer {
  readonly audio: HTMLAudioElement;
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private frame = 0;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(src: string) {
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.audio.loop = true;
    this.audio.preload = "auto";
    this.audio.src = src;
  }

  /** Must run inside the click: browsers only let sound start from a gesture. */
  async play(target: number): Promise<void> {
    this.clearPause();
    if (!this.context) {
      const Ctor = window.AudioContext || (window as LegacyAudioWindow).webkitAudioContext;
      if (Ctor) {
        try {
          this.context = new Ctor();
          this.gain = this.context.createGain();
          this.gain.gain.value = 0;
          this.context.createMediaElementSource(this.audio).connect(this.gain).connect(this.context.destination);
        } catch {
          this.context = null;
          this.gain = null;
        }
      }
      if (!this.gain) this.audio.volume = 0;
    }
    if (this.context?.state === "suspended") await this.context.resume().catch(() => undefined);
    await this.audio.play();
    this.fadeTo(target, FADE_IN_S);
  }

  /** Fades out, then pauses where it was. */
  pause(): void {
    this.fadeTo(0, FADE_OUT_S);
    this.clearPause();
    this.pauseTimer = setTimeout(() => this.audio.pause(), FADE_OUT_S * 1000);
  }

  fadeTo(target: number, seconds: number): void {
    if (this.gain && this.context) {
      const now = this.context.currentTime;
      const param = this.gain.gain;
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(target, now + seconds);
      return;
    }
    cancelAnimationFrame(this.frame);
    const from = this.audio.volume;
    const start = performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - start) / (seconds * 1000));
      this.audio.volume = from + (target - from) * progress;
      if (progress < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  seek(seconds: number): void {
    this.audio.currentTime = seconds;
  }

  destroy(): void {
    this.clearPause();
    cancelAnimationFrame(this.frame);
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.context?.close().catch(() => undefined);
  }

  private clearPause() {
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
  }
}

export function formatTime(seconds: number): string {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d="M7 4.5v15l12.5-7.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      {muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}
    </svg>
  );
}

/** The banner under the portfolio title, plus the floating speaker button once it is out of view. */
export default function PortfolioMusic() {
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [bannerAway, setBannerAway] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(PORTFOLIO_SONG_SECONDS);
  const bannerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<SongPlayer | null>(null);
  const playingRef = useRef(false);
  const overConfiguratorRef = useRef(false);
  const pausedByHiddenTabRef = useRef(false);
  const reportedRef = useRef(false);

  const [volume, setVolume] = useState(MUSIC_VOLUME);
  const volumeRef = useRef(MUSIC_VOLUME);
  const targetVolume = () => volumeRef.current * (overConfiguratorRef.current ? CONFIGURATOR_SHARE : 1);

  // The volume this visitor chose last time (read after mount, so the server HTML matches).
  useEffect(() => {
    volumeRef.current = savedVolume();
    setVolume(volumeRef.current);
  }, []);

  const changeVolume = useCallback((value: number) => {
    volumeRef.current = value;
    setVolume(value);
    if (playingRef.current) playerRef.current?.fadeTo(targetVolume(), VOLUME_CHANGE_S);
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(value));
    } catch {
      /* private mode: the slider still works for this visit */
    }
  }, []);

  const start = useCallback(async () => {
    // Nothing is downloaded until the first press.
    if (!playerRef.current) {
      const player = new SongPlayer(PORTFOLIO_SONG_URL);
      const audio = player.audio;
      audio.addEventListener("timeupdate", () => setPosition(audio.currentTime));
      audio.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
      });
      playerRef.current = player;
    }
    try {
      await playerRef.current.play(targetVolume());
    } catch {
      return;
    }
    playingRef.current = true;
    setPlaying(true);
    setStarted(true);
    if (!reportedRef.current) {
      reportedRef.current = true;
      sendLiveEvent("portfolio_music_played");
    }
  }, []);

  const stop = useCallback(() => {
    playerRef.current?.pause();
    playingRef.current = false;
    setPlaying(false);
  }, []);

  const seek = useCallback((seconds: number) => {
    playerRef.current?.seek(seconds);
    setPosition(seconds);
  }, []);

  const toggle = useCallback(() => (playingRef.current ? stop() : void start()), [start, stop]);

  // Leaving the page (another route) stops the song.
  useEffect(() => () => playerRef.current?.destroy(), []);

  // Another tab or a locked screen: fade out, and come back when they return.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && playingRef.current) {
        pausedByHiddenTabRef.current = true;
        stop();
      } else if (!document.hidden && pausedByHiddenTabRef.current) {
        pausedByHiddenTabRef.current = false;
        void start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [start, stop]);

  // A video with sound starts (owner): the song stops for good — it does not come back by itself.
  // Muted clips (the hero, the package tiles) play on their own and are ignored.
  useEffect(() => {
    const stopForVideo = () => {
      if (!playingRef.current) return;
      pausedByHiddenTabRef.current = false;
      stop();
    };
    const onMedia = (event: Event) => {
      const video = event.target;
      if (video instanceof HTMLVideoElement && !video.paused && !video.muted && video.volume > 0) stopForVideo();
    };
    // Embedded films (iframe): the page cannot see inside, but a click into one takes the focus there.
    const onBlur = () => setTimeout(() => {
      if (document.activeElement instanceof HTMLIFrameElement) stopForVideo();
    }, 0);
    // Media events do not bubble — listen while they travel down (capture).
    document.addEventListener("play", onMedia, true);
    document.addEventListener("volumechange", onMedia, true);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("play", onMedia, true);
      document.removeEventListener("volumechange", onMedia, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [stop]);

  // The speaker button shows only after play was pressed and the banner left the screen.
  useEffect(() => {
    const banner = bannerRef.current;
    if (!started || !banner || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setBannerAway(!entry.isIntersecting));
    observer.observe(banner);
    return () => observer.disconnect();
  }, [started]);

  // Over the price configurator (offer pages) the song goes much quieter.
  useEffect(() => {
    if (!started || typeof IntersectionObserver === "undefined") return;
    const configurator = document.getElementById("configurator");
    if (!configurator) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        overConfiguratorRef.current = entry.isIntersecting;
        if (playingRef.current) playerRef.current?.fadeTo(targetVolume(), DUCK_S);
      },
      // "Over it" = it crosses the middle of the screen.
      { rootMargin: "-45% 0px -45% 0px" },
    );
    observer.observe(configurator);
    return () => observer.disconnect();
  }, [started]);

  return (
    <>
      {/* Wide and light on purpose (owner): visible, never in the way — a quiet invite with the song and its progress. */}
      <div ref={bannerRef} className={`ppg-music${playing ? " is-playing" : ""}`}>
        <button
          type="button"
          className="ppg-music-play"
          onClick={toggle}
          aria-pressed={playing}
          aria-label={playing ? "Oprește melodia" : "Pornește melodia"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="ppg-music-copy">
          <span className="ppg-music-label">
            {playing ? "Se aude încet, în fundal" : "Priviți pozele cu muzică"}
            {playing && (
              <span className="ppg-music-bars" aria-hidden="true">
                <i /><i /><i />
              </span>
            )}
          </span>
          <span className="ppg-music-song">
            {PORTFOLIO_SONG_TITLE} <span className="ppg-music-artist">· {PORTFOLIO_SONG_ARTIST}</span>
          </span>
          <span className="ppg-music-text">
            {playing
              ? "Lăsați-vă purtați de poze. O puteți opri oricând."
              : "Dați play: o melodie lină, încet, în surdină. Pozele se simt altfel cu ea."}
          </span>
        </div>
        <div className="ppg-music-progress">
          <span className="ppg-music-time">{formatTime(position)}</span>
          <input
            type="range"
            className="ppg-music-bar"
            min={0}
            max={duration}
            step={1}
            value={Math.min(position, duration)}
            disabled={!started}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Poziția în melodie"
            style={{ "--ppg-progress": `${(Math.min(position, duration) / duration) * 100}%` } as React.CSSProperties}
          />
          <span className="ppg-music-time">{formatTime(duration)}</span>
          <label className="ppg-music-volume">
            <SpeakerIcon muted={volume === 0} />
            <input
              type="range"
              className="ppg-music-bar"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(event) => changeVolume(Number(event.target.value))}
              aria-label="Volum"
              style={{ "--ppg-progress": `${volume * 100}%` } as React.CSSProperties}
            />
          </label>
        </div>
      </div>
      {started && bannerAway && typeof document !== "undefined" &&
        createPortal(
          <button
            type="button"
            className="ppg-music-float"
            onClick={toggle}
            aria-label={playing ? "Oprește melodia" : "Pornește melodia"}
          >
            <SpeakerIcon muted={!playing} />
          </button>,
          document.body,
        )}
    </>
  );
}
