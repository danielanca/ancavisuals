/*
 * Purpose: edge-to-edge video for campaign landings. It never starts by itself (owner): the
 * poster shows a big gold play button, which comes back on pause. Never the browser's native
 * controls (owner): our bottom bar — play/pause, sound on/off, seekable progress, time,
 * fullscreen — is ALWAYS visible, on phone and desktop (top-left buttons were tried: nobody
 * saw them). Scrolling the video off screen pauses it.
 */
import React, { useEffect, useRef, useState } from "react";
import { sendLiveEvent } from "../../utils/liveEvent";

const STYLES = `
  @keyframes cvpPing { 0% { transform: scale(1); opacity: .55; } 80%, 100% { transform: scale(1.7); opacity: 0; } }
  .cvp-ping { animation: cvpPing 2.2s cubic-bezier(0,0,.2,1) infinite; }
  @media (prefers-reduced-motion: reduce) { .cvp-ping { animation: none; opacity: 0; } }
  .cvp-range { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 9999px; cursor: pointer;
    background: linear-gradient(to right, #c9a96e var(--cvp-progress, 0%), rgba(255,255,255,.25) var(--cvp-progress, 0%)); }
  .cvp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 9999px; background: #e8c97a; border: 0; }
  .cvp-range::-moz-range-thumb { width: 14px; height: 14px; border-radius: 9999px; background: #e8c97a; border: 0; }
`;

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const Icon = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} fill-current`} aria-hidden="true"><path d={d} /></svg>
);
const ICONS = {
  play: "M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z",
  pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  soundOn: "M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z",
  soundOff: "M4 9v6h4l5 4V5L8 9H4zm16.6 3 2.1-2.1-1.4-1.4-2.1 2.1-2.1-2.1-1.4 1.4 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1 1.4-1.4z",
  fullscreen: "M5 5h5v2H7v3H5V5zm9 0h5v5h-2V7h-3V5zM5 14h2v3h3v2H5v-5zm12 3v-3h2v5h-5v-2h3z",
};

export default function CampaignVideoPlayer({ src, poster, label }: { src: string; poster?: string; label?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const trackedRef = useRef(false);

  // Leaving the screen pauses; it never resumes by itself.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !started || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting && !video.paused) video.pause();
    }, { threshold: 0.2 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [started]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) { video.pause(); return; }
    if (!trackedRef.current) {
      trackedRef.current = true;
      sendLiveEvent("video_played", { label: label ?? "Vezi-ne la lucru" });
    }
    setStarted(true);
    void video.play().catch(() => setPlaying(false));
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setTime(value);
  };

  const fullscreen = () => {
    const container = containerRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!container || !video) return;
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    // iPhone Safari has no element fullscreen — only the video's own native fullscreen.
    if (container.requestFullscreen) void container.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
    else video.webkitEnterFullscreen?.();
  };

  const progress = duration ? `${(time / duration) * 100}%` : "0%";

  return (
    <div ref={containerRef} className="relative w-full bg-black">
      <style>{STYLES}</style>
      <video
        ref={videoRef}
        // Without a poster iOS shows a black box; #t=0.1 makes it paint the first frame.
        src={poster || src.includes("#") ? src : `${src}#t=0.1`}
        poster={poster}
        playsInline
        preload="metadata"
        onPlay={() => { setStarted(true); setPlaying(true); }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onClick={togglePlay}
        className="block aspect-video w-full object-cover"
      />

      {/* Not playing (before the start or paused): the big gold play button, above the bar. */}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={started ? "Continuă videoclipul" : "Pornește videoclipul"}
          // The whole video, under the bar (no hard edge above it); the bottom padding keeps the
          // button centred in the picture above the bar.
          className={`group absolute inset-0 flex flex-col items-center justify-center gap-4 pb-12 sm:pb-14 ${started ? "bg-black/20" : "bg-black/25"}`}
        >
          <BigPlay />
          {!started && (
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-white/80">
              Apasă pentru play
            </span>
          )}
        </button>
      )}

      {/* Always on screen, phone and desktop. */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-1.5 px-2 pb-1.5 pt-10 text-white sm:gap-3 sm:px-4 sm:pb-3 sm:pt-16"
        // A long, soft fade (no visible top edge) so the controls read on bright footage too.
        style={{ background: "linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.45) 40%, rgba(0,0,0,.15) 75%, rgba(0,0,0,0) 100%)" }}
      >
        <ControlButton label={playing ? "Pauză" : "Play"} onClick={togglePlay} d={playing ? ICONS.pause : ICONS.play} />
        <ControlButton label={muted ? "Pornește sunetul" : "Oprește sunetul"} onClick={toggleMute} d={muted ? ICONS.soundOff : ICONS.soundOn} />
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Poziția în videoclip"
          className="cvp-range mx-1 min-w-0 flex-1"
          style={{ "--cvp-progress": progress } as React.CSSProperties}
        />
        <span className="shrink-0 text-[11px] tabular-nums text-white/85 sm:text-xs">{formatTime(time)} / {formatTime(duration)}</span>
        <ControlButton label="Ecran complet" onClick={fullscreen} d={ICONS.fullscreen} />
      </div>
    </div>
  );
}

function BigPlay() {
  return (
    <span className="relative flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
      <span className="cvp-ping absolute inset-0 rounded-full bg-[#c9a96e]" />
      <span className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#a8823f] shadow-2xl shadow-black/50 ring-1 ring-white/30 transition-transform duration-300 group-hover:scale-110 group-active:scale-95">
        {/* The triangle spans x 8–20.5: the viewBox shifts it back to centre, keeping
            ~1 unit to the right so it looks centred (a triangle's weight sits left). */}
        <svg viewBox="1.25 0 24 24" className="h-8 w-8 fill-neutral-950 sm:h-10 sm:w-10" aria-hidden="true">
          <path d={ICONS.play} />
        </svg>
      </span>
    </span>
  );
}

function ControlButton({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#e8c97a] transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8c97a] sm:h-10 sm:w-10"
    >
      <Icon d={d} />
    </button>
  );
}
