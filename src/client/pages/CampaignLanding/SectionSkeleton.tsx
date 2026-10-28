import { useEffect, useRef, useState } from "react";

/**
 * Fixed-height stand-in for a section that is not on screen yet (LazySection) or whose
 * code is still downloading (lazyParts fallbacks). The page keeps its length while the
 * visitor scrolls; when the real section mounts, its own height takes over once.
 * Square, monochrome (ancavisuals style): pulsing blocks, "Pagina se încarcă" and a progress
 * bar that starts when the skeleton reaches the screen — 70% in 3 s, then slowly on until the
 * section shows (owner, 2026-10-28: no photos, just the skeleton, the text and the bar).
 */
export default function SectionSkeleton({ height }: { height: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Before hydration (slow JS) the bar simply runs; a skeleton below the fold waits, then starts from 0.
  const [waiting, setWaiting] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let waited = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) {
        waited = true;
        setWaiting(true);
        return;
      }
      // Already on screen: the bar keeps running. Reached later: it starts over from 0.
      if (waited) setRun((value) => value + 1);
      setWaiting(false);
      observer.disconnect();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="bg-[#0a0a0a] px-6 py-16" style={{ height }}>
      <div className="mx-auto flex h-full max-w-5xl flex-col gap-4">
        <div className="flex flex-col items-center gap-4 animate-pulse motion-reduce:animate-none">
          <div className="h-3 w-24 bg-white/10" />
          <div className="h-7 w-64 max-w-full bg-white/10" />
        </div>
        <div className="mx-auto mt-2 flex w-full max-w-xs flex-col items-center gap-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-400">Pagina se încarcă</p>
          <div className="h-px w-full bg-neutral-800">
            <div key={run} data-waiting={waiting ? "" : undefined} className="av-skeleton-bar h-px w-full bg-white" />
          </div>
        </div>
        <div className="mt-2 flex-1 bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}
