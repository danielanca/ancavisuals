import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { buildSeoImageAlt } from "../../utils/imageAltLabel";
import { sendLiveEvent } from "../../utils/liveEvent";
import { heavyPhotoNote } from "../../../shared/media/photoWeight";
import "./PortfolioParallaxGallery.scss";

gsap.registerPlugin(ScrollTrigger, SplitText);

type PortfolioParallaxGalleryProps = {
  altBase?: string;
  // Pozele de afișat, în ordinea dorită — când sunt date, componenta le
  // folosește direct și sare peste fetch-ul zonei globale "portfolio_gallery"
  // din Bibliotecă Media. Folosit de paginile de campanie, care au propria
  // lor galerie curatoriată per-campanie, distinctă de pool-ul global.
  images?: string[];
  /** Render this many photos first and add as many more each time the visitor nears the end (default: all at once). */
  batchSize?: number;
  /** Admin-only notes shown over a photo (e.g. "too large"), keyed by its URL. */
  warnings?: Record<string, string>;
};

const MAX_IMAGES = 60;
// Max drift, in pixels, between two adjacent columns — small and fixed
// regardless of gallery length, so no column can visually "run out" before
// the others (see the effect below for why yPercent broke this on long
// galleries). Smaller on mobile, where only 2 columns exist and the drift
// between them reads as a much stronger, more noticeable effect than the
// same pixel value spread across 4 columns on desktop.
const PARALLAX_PIXELS_MOBILE = 18;
const PARALLAX_PIXELS_DESKTOP = 50;

function getColumnCount(width: number) {
  if (width < 640) return 2;
  if (width < 1024) return 3;
  return 4;
}

export default function PortfolioParallaxGallery({
  altBase = "fotograf videograf eveniment Anca Visuals",
  images: imagesProp,
  batchSize,
  warnings: warningsProp,
}: PortfolioParallaxGalleryProps) {
  const [zoneData, setZoneData] = useState<{ desktop: string[]; mobile: string[] }>({ desktop: [], mobile: [] });
  const [loading, setLoading] = useState(!imagesProp);
  const [columnCount, setColumnCount] = useState(() =>
    getColumnCount(typeof window !== "undefined" ? window.innerWidth : 1280)
  );
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // The alt-text catalog (127 KB) loads after the gallery; until then photos use the generated alt.
  const [catalogAlt, setCatalogAlt] = useState<((src: string, fallback: string) => string) | null>(null);
  useEffect(() => {
    let active = true;
    import("../../utils/imageAlt")
      .then(({ getCatalogImageAlt }) => { if (active) setCatalogAlt(() => getCatalogImageAlt); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  // Admin only, in fetch mode: photos over the weight limit sent by the zone, flagged.
  const [zoneHeavy, setZoneHeavy] = useState<Record<string, number>>({});
  const warnings = useMemo(() => {
    const fromZone = Object.fromEntries(Object.entries(zoneHeavy).map(([url, bytes]) => [url, heavyPhotoNote(bytes)]));
    return Object.keys(fromZone).length || warningsProp ? { ...fromZone, ...warningsProp } : undefined;
  }, [zoneHeavy, warningsProp]);

  useEffect(() => {
    if (imagesProp) return;
    fetch("/api/showcase-zones/portfolio_gallery")
      .then((response) => response.json())
      .then(async (data: { desktop?: string[]; mobile?: string[]; heavy?: Record<string, number> }) => {
        if (data.heavy) setZoneHeavy(data.heavy);
        const desktop = data.desktop ?? [];
        const mobile = data.mobile ?? [];
        // Zona nu a fost curatoriata inca din admin pentru dispozitivul curent —
        // pastram vechiul pool de poze in loc sa aratam o galerie goala.
        const currentIsMobile = window.innerWidth < 640;
        const effective = currentIsMobile ? (mobile.length > 0 ? mobile : desktop) : (desktop.length > 0 ? desktop : mobile);
        if (effective.length === 0) {
          const fallback = await fetch("/api/oferte/portfolio-images").then((r) => r.json());
          const urls = Array.isArray(fallback.urls) ? fallback.urls : [];
          setZoneData({ desktop: urls, mobile: urls });
          return;
        }
        setZoneData({ desktop, mobile });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [imagesProp]);

  // A device without its own curated set falls back to the other device's set.
  const pool = useMemo(() => {
    if (imagesProp) return Array.from(new Set(imagesProp)).slice(0, MAX_IMAGES);
    const own = isMobile ? zoneData.mobile : zoneData.desktop;
    const other = isMobile ? zoneData.desktop : zoneData.mobile;
    const list = own.length > 0 ? own : other;
    return Array.from(new Set(list)).slice(0, MAX_IMAGES);
  }, [imagesProp, zoneData, isMobile]);


  useEffect(() => {
    const handleResize = () => {
      setColumnCount(getColumnCount(window.innerWidth));
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Photos arrive in batches: only the first ones download with the page.
  const [shown, setShown] = useState(batchSize ?? Number.POSITIVE_INFINITY);
  const visible = useMemo(() => pool.slice(0, shown), [pool, shown]);
  const allShown = visible.length >= pool.length;
  const moreRef = useRef<HTMLDivElement>(null);
  // The next batch waits until this one has loaded: unloaded photos have no height yet,
  // so the end of the gallery would look "near" and every batch would load at once.
  const [loadedCount, setLoadedCount] = useState(0);
  useEffect(() => {
    const more = moreRef.current;
    if (!batchSize || allShown || loadedCount < visible.length || !more || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setShown((n) => n + batchSize);
    }, { rootMargin: "600px 0px" });
    observer.observe(more);
    return () => observer.disconnect();
  }, [batchSize, allShown, visible.length, loadedCount]);

  // /admin/live: the visitor scrolled to the end of the gallery (once per page view).
  const imageCount = pool.length;
  useEffect(() => {
    const end = endRef.current;
    if (!end || !imageCount || !allShown || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      sendLiveEvent("gallery_seen_all", { label: `${imageCount} poze`, meta: { count: imageCount } });
    });
    observer.observe(end);
    return () => observer.disconnect();
  }, [imageCount, loading, allShown]);

  // New photos make the columns taller: re-measure the parallax once they have loaded.
  useEffect(() => {
    if (!batchSize || !containerRef.current) return;
    const count = visible.length;
    const settled = () => { ScrollTrigger.refresh(); setLoadedCount(count); };
    const pending = [...containerRef.current.querySelectorAll("img")].filter((img) => !img.complete);
    if (!pending.length) { settled(); return; }
    let remaining = pending.length;
    const onDone = () => { remaining -= 1; if (remaining <= 0) settled(); };
    pending.forEach((img) => {
      img.addEventListener("load", onDone, { once: true });
      img.addEventListener("error", onDone, { once: true });
    });
  }, [batchSize, visible.length]);

  // Every photo gets its slot from the start; photos of later batches show as skeleton
  // tiles until their batch comes, so the gallery doesn't grow (and the scrollbar
  // doesn't jump) with every batch.
  const columns = useMemo(() => {
    const groups: { src: string; index: number }[][] = Array.from({ length: columnCount }, () => []);
    pool.forEach((src, index) => groups[index % columnCount].push({ src, index }));
    return groups;
  }, [pool, columnCount]);

  useEffect(() => {
    if (!titleRef.current) return;
    const split = new SplitText(titleRef.current, { type: "lines" });
    gsap.set(titleRef.current, { visibility: "visible" });
    const tween = gsap.from(split.lines, {
      opacity: 0,
      y: 50,
      stagger: 0.15,
      duration: 1,
      ease: "power3.out",
    });
    return () => {
      tween.kill();
      split.revert();
    };
  }, []);

  // Tween-urile de parallax se creează o singură dată per layout (schimbare de
  // columnCount/isMobile), NU la fiecare rotație de poze — altfel, cu galeria
  // rotindu-se din 10 în 10 secunde, am distruge și reface scroll trigger-ele
  // exact cât utilizatorul scrollează, dând un mic salt vizual la fiecare
  // rotație. Recalcularea poziției (fără să distrugem tween-urile) se face
  // separat mai jos, doar pentru conținutul care chiar s-a schimbat.
  useEffect(() => {
    if (!containerRef.current || columnCount === 0) return;

    const ctx = gsap.context(() => {
      const parallaxPixels = isMobile ? PARALLAX_PIXELS_MOBILE : PARALLAX_PIXELS_DESKTOP;
      const cols = gsap.utils.toArray<HTMLElement>(".ppg-col");
      cols.forEach((col, index) => {
        // Fixed pixel offset (not yPercent, which scales with the column's OWN
        // height). All columns have ~the same total content height (masonry
        // splits images round-robin), but yPercent made later columns drift up
        // to ~1000px+ further than earlier ones on long galleries — visually
        // "running dry" mid-scroll, well before reaching the actual end, even
        // though both columns had identical remaining content. A small capped
        // pixel drift keeps every column's on-screen position within a few tens
        // of pixels of the others at any scroll position, on any gallery length.
        gsap.to(col, {
          y: -(index + 1) * parallaxPixels,
          ease: "none",
          scrollTrigger: {
            trigger: col,
            start: "top 85%",
            end: "bottom top",
            scrub: 1,
          },
        });
      });

      gsap.from(".ppg-grid", {
        opacity: 0,
        y: 80,
        duration: 1,
        delay: 0.15,
        ease: "power2.out",
        scrollTrigger: { trigger: ".ppg-grid", start: "top 95%", toggleActions: "play none none none" },
      });

      const imgs = containerRef.current!.querySelectorAll("img");
      let remaining = imgs.length;
      const onDone = () => {
        remaining -= 1;
        if (remaining <= 0) ScrollTrigger.refresh();
      };
      if (remaining === 0) ScrollTrigger.refresh();
      imgs.forEach((img) => {
        if (img.complete) {
          onDone();
        } else {
          img.addEventListener("load", onDone, { once: true });
          img.addEventListener("error", onDone, { once: true });
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, [columnCount, isMobile]);

  return (
    <section ref={containerRef} className="ppg-section bg-neutral-950 text-white">
      <div className="ppg-intro">
        <h1 ref={titleRef} className="ppg-title">
          Portofoliu
        </h1>
        <p className="ppg-subtitle">Emoția rămâne, imaginea o păstrează.</p>
      </div>

      {loading ? (
        <div className="ppg-wrap">
          <div className="ppg-loading" aria-hidden="true">
            {Array.from({ length: columnCount }).map((_, index) => (
              <div key={index} className="ppg-loading-col" />
            ))}
          </div>
        </div>
      ) : !pool.length ? (
        <div className="ppg-wrap text-neutral-500 text-sm text-center py-16">
          Nu sunt imagini disponibile momentan.
        </div>
      ) : (
        <>
          <div className="ppg-wrap">
            <div className="ppg-grid" style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}>
              {columns.map((col, colIndex) => (
                <div key={colIndex} className="ppg-col">
                  {col.map(({ src, index }) => index >= visible.length ? (
                    // The first skeleton tile is the "load the next batch" trigger.
                    <div key={src} ref={index === visible.length ? moreRef : undefined} className="ppg-item ppg-slot" aria-hidden="true" />
                  ) : (
                    <div key={src} className="ppg-item" style={warnings?.[src] ? { position: "relative", outline: "3px solid #dc2626" } : undefined}>
                      {warnings?.[src] && (
                        <span className="absolute left-2 right-2 top-2 z-10 rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold leading-snug text-white shadow-lg">
                          {warnings[src]}
                        </span>
                      )}
                      <FadeInImage
                        src={src}
                        // Images are dealt round-robin into columns: this is the photo's index in the gallery.
                        alt={catalogAlt ? catalogAlt(src, buildSeoImageAlt(altBase, index)) : buildSeoImageAlt(altBase, index)}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div ref={endRef} className="ppg-spacer" aria-hidden="true" />
        </>
      )}
    </section>
  );
}

/**
 * Photos fade in once loaded instead of popping in (no blur, no zoom). One already in
 * the browser cache just shows up. No requestAnimationFrame: it is paused in background
 * tabs and the photos would stay invisible.
 */
function FadeInImage({ src, alt }: { src: string; alt: string }) {
  const [shown, setShown] = useState(false);
  const show = () => setShown(true);
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`ppg-img ${shown ? "is-shown" : ""}`}
      ref={(img) => {
        // Cached images can finish before React attaches onLoad.
        if (img?.complete && img.naturalWidth && !shown) show();
      }}
      onLoad={show}
      onError={show}
    />
  );
}
