/*
 * Purpose: edge-to-edge video for campaign landings — poster with one large gold play
 * button in front; native controls appear only once the video has started, and the
 * big button comes back on pause.
 */
import React, { useRef, useState } from "react";
import { sendLiveEvent } from "../../utils/liveEvent";

const STYLES = `
  @keyframes cvpPing { 0% { transform: scale(1); opacity: .55; } 80%, 100% { transform: scale(1.7); opacity: 0; } }
  .cvp-ping { animation: cvpPing 2.2s cubic-bezier(0,0,.2,1) infinite; }
  @media (prefers-reduced-motion: reduce) { .cvp-ping { animation: none; opacity: 0; } }
`;

export default function CampaignVideoPlayer({ src, poster, label }: { src: string; poster?: string; label?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const trackedRef = useRef(false);

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!trackedRef.current) {
      trackedRef.current = true;
      sendLiveEvent("video_played", { label: label ?? "Vezi-ne la lucru" });
    }
    setStarted(true);
    void video.play().catch(() => setPlaying(false));
  };

  return (
    <div className="relative w-full bg-black">
      <style>{STYLES}</style>
      <video
        ref={videoRef}
        // Without a poster iOS shows a black box; #t=0.1 makes it paint the first frame.
        src={poster || src.includes("#") ? src : `${src}#t=0.1`}
        poster={poster}
        controls={started}
        playsInline
        preload="metadata"
        onPlay={() => { setStarted(true); setPlaying(true); }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="block aspect-video w-full object-cover"
      />

      {!playing && (
        <button
          type="button"
          onClick={play}
          aria-label={started ? "Continuă videoclipul" : "Pornește videoclipul"}
          className={`group absolute inset-0 flex items-center justify-center ${started ? "bg-black/20" : "bg-gradient-to-t from-black/60 via-black/10 to-black/30"}`}
          // Leave the native control bar clickable once the video has started.
          style={started ? { bottom: "64px" } : undefined}
        >
          <span className="relative flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
            <span className="cvp-ping absolute inset-0 rounded-full bg-[#c9a96e]" />
            <span className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#a8823f] shadow-2xl shadow-black/50 ring-1 ring-white/30 transition-transform duration-300 group-hover:scale-110 group-active:scale-95">
              <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 fill-neutral-950 sm:h-10 sm:w-10" aria-hidden="true">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
              </svg>
            </span>
          </span>
          {!started && (
            <span className="absolute bottom-5 left-0 right-0 text-center text-xs font-medium uppercase tracking-[0.25em] text-white/80">
              Apasă pentru play
            </span>
          )}
        </button>
      )}
    </div>
  );
}
