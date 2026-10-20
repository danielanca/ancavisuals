/*
 * Purpose: the "Video scurt" section on /media/:slug, in the Anca Visuals look (black, square,
 * thin uppercase title with a grey [subtitle], no gold). Our own player, never the browser's:
 * - Stream ready + CDN hostname set → the HLS playlist (quality follows the viewer's speed);
 * - Stream ready without a hostname → Bunny's iframe player;
 * - otherwise (transcoding, failed, Stream off) → the original MP4 from Storage.
 * Download always gives the original file.
 */
import { useEffect, useState } from "react";
import CampaignVideoPlayer from "../CampaignLanding/CampaignVideoPlayer";
import type { AlbumShortVideo } from "../../../shared/albumShortVideo";

type Props = { slug: string; fallbackSrc: string };

const fmtSize = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;

export default function ShortVideoPlayer({ slug, fallbackSrc }: Props) {
  const [video, setVideo] = useState<AlbumShortVideo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/album/${encodeURIComponent(slug)}/short-video`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { video?: AlbumShortVideo | null } | null) => { if (!cancelled) setVideo(data?.video ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug, fallbackSrc]);

  const stream = video?.stream?.status === "ready" ? video.stream : null;
  const adaptive = Boolean(stream?.hlsUrl || stream?.embedUrl);

  return (
    <section aria-labelledby="short-video-title" className="mx-auto my-10 w-full max-w-5xl">
      <header className="mb-5 text-center">
        <h2 id="short-video-title" className="text-2xl font-extralight uppercase tracking-[0.18em] text-white sm:text-3xl">
          Video scurt
        </h2>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-neutral-500">[ ziua voastră, în câteva minute ]</p>
      </header>

      <div className="border border-white/15 bg-black p-1 sm:p-2">
        {stream?.hlsUrl ? (
          <CampaignVideoPlayer variant="mono" src={stream.hlsUrl} label="Video scurt album" />
        ) : stream?.embedUrl ? (
          <div className="relative aspect-video w-full">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={stream.embedUrl}
              title="Video scurt"
              loading="lazy"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              data-testid="short-video-stream"
            />
          </div>
        ) : (
          <CampaignVideoPlayer variant="mono" src={fallbackSrc} label="Video scurt album" />
        )}
      </div>

      <div className="mt-4 flex flex-col items-center gap-4 border-b border-white/10 pb-6 sm:flex-row sm:justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
          {adaptive ? "Calitate automată după internetul tău" : "Calitate originală"}
          {video?.size ? <span className="text-neutral-600"> · {fmtSize(video.size)}</span> : null}
        </p>
        <a
          href={`/api/album/${encodeURIComponent(slug)}/short-video/download`}
          download
          className="inline-flex items-center gap-3 border border-white bg-white px-6 py-3 text-xs font-medium uppercase tracking-[0.2em] text-black transition-colors hover:bg-transparent hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6" aria-hidden="true">
            <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" strokeLinecap="square" />
          </svg>
          Descarcă videoul
        </a>
      </div>
    </section>
  );
}
