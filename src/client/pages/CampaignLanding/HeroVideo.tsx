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
 * The hero clip, layered over a photo (the hero, and the film section after the
 * portfolio), and only ever busy while its section is on screen: it downloads (after the page has loaded, on a good connection) only while
 * the visitor can see the hero — scrolling away pauses the download, coming back
 * resumes it — and plays only once the whole file is in, pausing whenever the hero
 * leaves the screen. Until then the photo shows.
 */
export default function HeroVideo({ src, hdSrc }: { src: string; hdSrc?: string }) {
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
    const sync = () => {
      if (visible && document.visibilityState === "visible") void video.play().catch(() => {});
      else video.pause();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
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
