import React, { useEffect, useRef, useState } from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import "./video.css";

interface VideoPreviewProps {
  src: string;
  poster?: string;
  previewTime?: number; // secunda din video pentru thumbnail
}

type PlyrWithPoster = Plyr & {
  poster: string;
};

const VideoPreview: React.FC<VideoPreviewProps> = ({ src, poster, previewTime = 3 }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);

  const [computedPoster, setComputedPoster] = useState<string | undefined>(poster);

  // 1) Initialize Plyr
  useEffect(() => {
    if (!videoRef.current) return;

    let player: Plyr | null = null;

    try {
      player = new Plyr(videoRef.current, {
        controls: ["play", "progress", "current-time", "mute", "volume", "settings", "fullscreen"],
        settings: ["quality", "speed"],
      });

      playerRef.current = player;
      console.log("[VideoPreview] Plyr init OK");
    } catch (err) {
      console.error("[VideoPreview] Plyr init FAILED:", err);
    }

    return () => {
      if (player) {
        player.destroy();
      }
      playerRef.current = null;
    };
  }, [src]);

  // 2) Generate poster if not provided via props
  useEffect(() => {
    if (poster) {
      setComputedPoster(poster);
      if (playerRef.current) {
        (playerRef.current as PlyrWithPoster).poster = poster;
      }
      return;
    }

    let cancelled = false;

    const generatePosterFromVideo = async () => {
      try {
        const tmpVideo = document.createElement("video");
        tmpVideo.src = src;
        tmpVideo.crossOrigin = "anonymous";
        tmpVideo.preload = "metadata";

        await new Promise<void>((resolve, reject) => {
          tmpVideo.addEventListener("loadedmetadata", () => resolve(), {
            once: true,
          });
          tmpVideo.addEventListener("error", () => reject(new Error("Failed to load video")), { once: true });
        });

        if (cancelled) return;

        const targetTime = Math.min(previewTime, tmpVideo.duration || previewTime);
        tmpVideo.currentTime = targetTime;

        await new Promise<void>(resolve => {
          tmpVideo.addEventListener("seeked", () => resolve(), { once: true });
        });

        if (cancelled) return;

        const canvas = document.createElement("canvas");
        canvas.width = tmpVideo.videoWidth;
        canvas.height = tmpVideo.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(tmpVideo, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

        setComputedPoster(dataUrl);

        if (playerRef.current) {
          (playerRef.current as PlyrWithPoster).poster = dataUrl;
        }
      } catch (err) {
        console.warn("[VideoPreview] Could not generate poster from video:", err);
      }
    };

    generatePosterFromVideo();

    return () => {
      cancelled = true;
    };
  }, [src, poster, previewTime]);

  return (
    <div className="video-wrapper">
      <video
        ref={videoRef}
        className="plyr-react plyr"
        playsInline
        controls // 👈 important ca fallback
        poster={computedPoster}
        preload="metadata"
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
};

export default VideoPreview;
