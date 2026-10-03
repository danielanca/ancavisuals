import React, { useEffect, useRef, useState } from "react";
import SectionSkeleton from "./SectionSkeleton";

/**
 * Renders its section only once the visitor scrolls within about a screen of it, so
 * the page downloads its photos and videos section by section instead of all at
 * once. Until then a fixed-height skeleton holds its place. Once shown, it stays.
 */
export default function LazySection({ height, onShow, children }: {
  /** The skeleton's fixed height until the section mounts — roughly the section's own. */
  height: string;
  /** Called once when the section renders — e.g. to start downloading the next parts. */
  onShow?: () => void;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      setShown(true);
    }, { rootMargin: "100% 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (shown) onShow?.(); }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  return shown ? <>{children}</> : <div ref={ref}><SectionSkeleton height={height} /></div>;
}
