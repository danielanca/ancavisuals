import { useEffect, useRef, useState } from "react";

type Connection = { saveData?: boolean; effectiveType?: string; downlink?: number };

/**
 * Which clip this connection gets: none on a very weak or metered one (2G, data saver —
 * the photo stays), the light one on a modest one (3G, or under ~5 Mbps), the HD one on
 * a good one. Unknown (iPhone Safari doesn't tell) gets the light one, to be safe.
 */
function clipForConnection(src: string, hdSrc?: string): string | null {
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  if (!connection) return src;
  if (connection.saveData || connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return null;
  const good = connection.effectiveType === "4g" && (connection.downlink === undefined || connection.downlink >= 5);
  return good && hdSrc ? hdSrc : src;
}

// A clip fully downloaded once (hero) is reused by the second place it plays.
const downloaded = new Map<string, string>();

/**
 * iPhone in Low Power Mode refuses every autoplay, muted or not, but allows a play() inside
 * the visitor's tap: a refused play() retries on the next tap anywhere on the page.
 * Returns the cleanup for the waiting listeners.
 */
function playOrWaitForTap(video: HTMLVideoElement): () => void {
  // A touch that scrolls the page doesn't count as a tap for iOS, so keep listening until a play works.
  let stopped = false;
  const stop = () => {
    stopped = true;
    document.removeEventListener("touchend", retry, true);
    document.removeEventListener("click", retry, true);
  };
  const retry = () => { if (document.visibilityState === "visible") video.play().then(stop, () => {}); };
  video.play().catch(() => {
    if (stopped) return; // the hero left the screen meanwhile
    document.addEventListener("touchend", retry, { capture: true, passive: true });
    document.addEventListener("click", retry, true);
  });
  return stop;
}

/**
 * The hero clip, layered over a photo (the hero, and the film section after the
 * portfolio), and only ever busy while its section is on screen: it downloads (after the page has loaded, on a good connection) only while
 * the visitor can see the hero — scrolling away pauses the download, coming back
 * resumes it — and plays only once the whole file is in, pausing whenever the hero
 * leaves the screen. Until then the photo shows.
 */
export default function HeroVideo({ src, hdSrc }: { src: string; hdSrc?: string }) {
  // A Bunny Stream playlist streams with adaptive quality instead of a full download.
  if (isHlsUrl(src)) return <HlsHeroLoop src={src} />;
  return <Mp4HeroVideo src={src} hdSrc={hdSrc} />;
}

function Mp4HeroVideo({ src, hdSrc }: { src: string; hdSrc?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const resumeRef = useRef<(() => void) | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(() => downloaded.get(src) ?? (hdSrc ? downloaded.get(hdSrc) : undefined) ?? null);
  const [playing, setPlaying] = useState(false);

  // Is the hero on screen?
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      const onScreen = Boolean(entry?.isIntersecting);
      visibleRef.current = onScreen;
      setVisible(onScreen);
      if (onScreen) { resumeRef.current?.(); resumeRef.current = null; }
    }, { threshold: 0.25 });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Download chunk by chunk; between chunks, wait while the hero is off screen
  // (not reading makes the browser hold the rest of the transfer back).
  useEffect(() => {
    if (downloaded.has(src) || (hdSrc && downloaded.has(hdSrc))) return;
    const controller = new AbortController();
    const whileVisible = () =>
      visibleRef.current ? Promise.resolve() : new Promise<void>((resolve) => { resumeRef.current = resolve; });

    const download = async () => {
      const clip = clipForConnection(src, hdSrc);
      if (!clip) return;
      await whileVisible();
      // The other place may have finished it while this one waited off screen.
      const ready = downloaded.get(clip);
      if (ready) { setBlobUrl(ready); return; }
      const res = await fetch(clip, { signal: controller.signal });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const chunks: BlobPart[] = [];
      for (;;) {
        await whileVisible();
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const url = URL.createObjectURL(new Blob(chunks, { type: res.headers.get("content-type") || "video/mp4" }));
      // Kept for the page's lifetime (shared), so not revoked on unmount.
      downloaded.set(clip, url);
      setBlobUrl(url);
    };
    const start = () => { download().catch(() => { /* aborted or failed: the photo stays */ }); };

    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      controller.abort();
      resumeRef.current = null;
    };
  }, [src, hdSrc]);

  // Play only while on screen — and again when the visitor comes back to the tab
  // (browsers hold media back in background tabs).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !blobUrl) return;
    let stopWaiting = () => {};
    const sync = () => {
      stopWaiting();
      stopWaiting = () => {};
      if (visible && document.visibilityState === "visible") stopWaiting = playOrWaitForTap(video);
      else video.pause();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => { stopWaiting(); document.removeEventListener("visibilitychange", sync); };
  }, [visible, blobUrl]);

  return (
    <div ref={boxRef} aria-hidden="true" className="absolute inset-0">
      {blobUrl && (
        <video
          ref={videoRef}
          src={blobUrl}
          muted
          loop
          playsInline
          onPlaying={() => setPlaying(true)}
          className={`h-full w-full object-cover transition-opacity duration-700 ${playing ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}

// ─── HLS (Bunny Stream) ───────────────────────────────────────────────────────

const isHlsUrl = (url: string) => /\.m3u8(?:[?#]|$)/i.test(url);

/**
 * `…/playlist.m3u8#t=59,127` → the playlist plus the looped segment (Media Fragments
 * syntax: start[,end] in seconds). Lets one uploaded film serve both the "Vezi-ne la lucru"
 * player (whole film) and the hero (just the loop), without a separate cut.
 */
export function parseLoopUrl(url: string): { url: string; start: number; end: number | null } {
  const [base, fragment = ""] = url.split("#");
  const match = /(?:^|&)t=([\d.]+)(?:,([\d.]+))?/.exec(fragment);
  const start = match ? Number(match[1]) : 0;
  const end = match?.[2] ? Number(match[2]) : null;
  return { url: base, start: Number.isFinite(start) ? start : 0, end: end !== null && end > start ? end : null };
}

/** No video on 2G or with data saver on — the photo stays. */
function connectionAllowsVideo(): boolean {
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  return !(connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g");
}

type HlsInstance = { loadSource: (url: string) => void; attachMedia: (video: HTMLMediaElement) => void; destroy: () => void };

/**
 * The hero clip as an adaptive stream: nothing loads before the page has, the hero is on
 * screen and the connection allows it; then quality follows the visitor's bandwidth (capped
 * to the hero's size on screen), loading starts right at the loop's start, and the loop
 * replays from what is already buffered. Plays only while on screen; the photo stays under
 * it until the first frame plays.
 */
function HlsHeroLoop({ src }: { src: string }) {
  const { url, start, end } = parseLoopUrl(src);
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.25 });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // First time the hero is visible after the page has loaded: start streaming (once).
  useEffect(() => {
    if (active || !visible || !connectionAllowsVideo()) return;
    const begin = () => setActive(true);
    if (document.readyState === "complete") begin();
    else window.addEventListener("load", begin, { once: true });
    return () => window.removeEventListener("load", begin);
  }, [active, visible]);

  useEffect(() => {
    const video = videoRef.current;
    if (!active || !video) return;
    let hls: HlsInstance | null = null;
    let cancelled = false;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url; // Safari: native HLS
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) return; // the photo stays
        hls = new Hls({ capLevelToPlayerSize: true, startLevel: -1, startPosition: start, maxBufferLength: 20 });
        hls.loadSource(url);
        hls.attachMedia(video);
      }).catch(() => { /* the photo stays */ });
    }
    return () => { cancelled = true; hls?.destroy(); };
  }, [active, url, start]);

  // Play only while on screen and the tab is visible.
  useEffect(() => {
    const video = videoRef.current;
    if (!active || !video) return;
    let stopWaiting = () => {};
    const sync = () => {
      stopWaiting();
      stopWaiting = () => {};
      if (visible && document.visibilityState === "visible") stopWaiting = playOrWaitForTap(video);
      else video.pause();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => { stopWaiting(); document.removeEventListener("visibilitychange", sync); };
  }, [active, visible]);

  const backToStart = (video: HTMLVideoElement) => {
    video.currentTime = start;
    void video.play().catch(() => {});
  };

  return (
    <div ref={boxRef} aria-hidden="true" className="absolute inset-0">
      {active && (
        <video
          ref={videoRef}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => { if (start > 0 && e.currentTarget.currentTime < start) e.currentTarget.currentTime = start; }}
          onTimeUpdate={(e) => {
            const video = e.currentTarget;
            const loopEnd = end ?? video.duration - 0.25;
            if (Number.isFinite(loopEnd) && loopEnd > start && video.currentTime >= loopEnd) backToStart(video);
          }}
          onEnded={(e) => backToStart(e.currentTarget)}
          onPlaying={() => setPlaying(true)}
          className={`h-full w-full object-cover transition-opacity duration-700 ${playing ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
