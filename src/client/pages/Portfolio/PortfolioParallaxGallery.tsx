import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { buildSeoImageAlt } from "../../utils/imageAltLabel";
import { sendLiveEvent } from "../../utils/liveEvent";
import { heavyPhotoNote } from "../../../shared/media/photoWeight";
import { installGalleryScrollRefresh, refreshGalleryScroll } from "../../utils/galleryScrollRefresh";
import "./PortfolioParallaxGallery.scss";
import { GALLERY_MAX_PHOTOS } from "./galleryLimits";
import { galleryBlocks } from "./galleryLayout";

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
  /**
   * Show only this many photos; the next row appears blurred and darkened under a
   * "Vezi mai multe poze" button. Each click opens as many again (and tells /admin/live
   * someone wanted more), until all photos are shown.
   */
  revealLimit?: number;
  /**
   * Each photo's width / height by URL (from the sizes the server saved on the photos): the
   * layout is known before anything loads, and on phones very wide photos take the whole row.
   */
  ratios?: Record<string, number>;
  /** The full-resolution original of a shown (compressed) photo, by its URL: what opens on click. */
  originals?: Record<string, string>;
};


// Max drift, in pixels, between two adjacent columns — small and fixed
// regardless of gallery length, so no column can visually "run out" before
// the others (see the effect below for why yPercent broke this on long
// galleries). Smaller on mobile, where only 2 columns exist and the drift
// between them reads as a much stronger, more noticeable effect than the
// same pixel value spread across 4 columns on desktop.
const PARALLAX_PIXELS_MOBILE = 18;
// Memory: a portfolio photo takes 5–6.5 MB once decoded (1400 px wide), so a long gallery can
// make a phone reload the page. Past this many photos, those further than PARK_DISTANCE screens
// from the visible area give up their image (an empty box of the same height keeps the layout);
// coming back shows them again from the browser cache.
const PARK_AFTER_PHOTOS = 36;
const PARK_DISTANCE_SCREENS = 3;
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
  revealLimit,
  ratios,
  originals: originalsProp,
}: PortfolioParallaxGalleryProps) {
  const [zoneData, setZoneData] = useState<{ desktop: string[]; mobile: string[] }>({ desktop: [], mobile: [] });
  const [loading, setLoading] = useState(!imagesProp);
  const [zoneOriginals, setZoneOriginals] = useState<Record<string, string>>({});
  const originals = originalsProp ?? zoneOriginals;
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [columnCount, setColumnCount] = useState(() =>
    getColumnCount(typeof window !== "undefined" ? window.innerWidth : 1280)
  );
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // The alt-text catalog (127 KB) loads after the gallery; until then photos use the generated alt.
  const [catalogAlt, setCatalogAlt] = useState<((src: string, fallback: string) => string) | null>(null);
  useEffect(installGalleryScrollRefresh, []);

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
      .then(async (data: { desktop?: string[]; mobile?: string[]; heavy?: Record<string, number>; originals?: Record<string, string> }) => {
        if (data.heavy) setZoneHeavy(data.heavy);
        if (data.originals) setZoneOriginals(data.originals);
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
    // With "Vezi mai multe poze" the visitor opens the rest batch by batch: no cap.
    const max = revealLimit !== undefined ? Number.POSITIVE_INFINITY : GALLERY_MAX_PHOTOS;
    if (imagesProp) return Array.from(new Set(imagesProp)).slice(0, max);
    const own = isMobile ? zoneData.mobile : zoneData.desktop;
    const other = isMobile ? zoneData.desktop : zoneData.mobile;
    const list = own.length > 0 ? own : other;
    return Array.from(new Set(list)).slice(0, max);
  }, [imagesProp, zoneData, isMobile, revealLimit]);


  useEffect(() => {
    const handleResize = () => {
      setColumnCount(getColumnCount(window.innerWidth));
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // "Vezi mai multe poze": only `revealed` photos + one blurred row exist; every click adds
  // `revealLimit` more. The last batch is not gated when only a row or less would be left.
  const [revealed, setRevealed] = useState(revealLimit ?? Number.POSITIVE_INFINITY);
  // Two blurred rows: with photos of different heights one row left some columns empty.
  const peekCount = columnCount * 2;
  const gated = revealLimit !== undefined && pool.length > revealed + columnCount;
  const limit = gated ? revealed : pool.length;
  const peekEnd = gated ? Math.min(pool.length, limit + peekCount) : pool.length;
  // Downloads photos into the browser cache without drawing them (no decoded memory yet).
  const prefetched = useRef(new Set<string>());
  const prefetch = (sources: string[]) => {
    for (const src of sources) {
      if (prefetched.current.has(src)) continue;
      prefetched.current.add(src);
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    }
  };
  const openMore = () => {
    setRevealed((current) => current + revealLimit!);
    // The new batch was downloaded while the visitor approached the button: show it all at once,
    // and start downloading the batch after it, so the next click finds it ready too.
    setShown((current) => Math.max(current, limit + revealLimit!));
    prefetch(pool.slice(limit + revealLimit!, limit + 2 * revealLimit!));
    sendLiveEvent("gallery_more_clicked", { label: `${limit} → ${Math.min(pool.length, limit + revealLimit!)} din ${pool.length} poze`, meta: { count: pool.length, shownBefore: limit } });
  };

  // Photos arrive in batches: only the first ones download with the page.
  const [shown, setShown] = useState(batchSize ?? Number.POSITIVE_INFINITY);
  const visible = useMemo(() => pool.slice(0, Math.min(shown, limit)), [pool, shown, limit]);
  const allShown = visible.length >= limit;
  // While gated, the gallery is cut at the end of its shortest column, so the blurred zone
  // under the button is full of photos in every column (no empty patches).
  const gridRef = useRef<HTMLDivElement>(null);
  const [clipHeight, setClipHeight] = useState<number | null>(null);
  // Where the blurred photos start: the blur layer begins a little above them.
  const [peekTop, setPeekTop] = useState<number | null>(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!gated || !grid) { setClipHeight(null); setPeekTop(null); return; }
    const measure = () => {
      const top = grid.getBoundingClientRect().top;
      // The columns of the last block (or the grid itself), or a last full-width photo.
      const lastBlock = grid.classList.contains("ppg-grid--blocks") ? grid.lastElementChild : grid;
      const columnsOrWide = !lastBlock ? [] : lastBlock === grid || lastBlock.classList.contains("ppg-block") ? [...lastBlock.children] : [lastBlock];
      const ends = columnsOrWide.map((column) => {
        const last = column.lastElementChild ?? column;
        return last.getBoundingClientRect().bottom - top;
      });
      const shortest = Math.min(...ends);
      setClipHeight(Number.isFinite(shortest) && shortest > 0 ? Math.round(shortest) : null);
      const peekTops = [...grid.querySelectorAll(".ppg-peek")].map((item) => item.getBoundingClientRect().top - top);
      setPeekTop(peekTops.length ? Math.max(0, Math.round(Math.min(...peekTops) - 200)) : null);
    };
    measure();
    // Photos change the column heights as they load (load events do not bubble: capture).
    grid.addEventListener("load", measure, true);
    window.addEventListener("resize", measure);
    return () => { grid.removeEventListener("load", measure, true); window.removeEventListener("resize", measure); };
  }, [gated, peekEnd, columnCount, visible.length]);
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

  // The first batch behind "Vezi mai multe poze" downloads in the background once the button is
  // within two screens (each click then downloads the one after), so a click shows its photos
  // at once, from the browser cache.
  const moreButtonRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = moreButtonRef.current;
    if (!gated || !box || typeof IntersectionObserver === "undefined") return;
    const nextBatch = pool.slice(limit, limit + revealLimit!);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      prefetch(nextBatch);
    }, { rootMargin: `${Math.round(window.innerHeight * 2)}px 0px` });
    observer.observe(box);
    return () => observer.disconnect();
  }, [gated, limit, pool, revealLimit]);

  // /admin/live: the visitor scrolled to the end of the gallery (once per page view).
  const imageCount = pool.length;
  useEffect(() => {
    const end = endRef.current;
    if (!end || !imageCount || !allShown || gated || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      sendLiveEvent("gallery_seen_all", { label: `${imageCount} poze`, meta: { count: imageCount } });
    });
    observer.observe(end);
    return () => observer.disconnect();
  }, [imageCount, loading, allShown, gated]);

  // New photos make the columns taller: re-measure the parallax once they have loaded.
  useEffect(() => {
    if (!batchSize || !containerRef.current) return;
    const count = visible.length;
    const settled = () => { refreshGalleryScroll(); setLoadedCount(count); };
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
  // Indices of the photos parked far from the screen, and each one's shape ("width / height"):
  // the empty box keeps it, and so does the photo when it comes back, so its place never moves
  // (also after a resize or a phone rotation — a fixed height would not survive those).
  const [parked, setParked] = useState<Set<number>>(() => new Set());
  const parkedRatios = useRef(new Map<number, string>());
  const parking = visible.length > PARK_AFTER_PHOTOS;
  const parkObserver = useRef<IntersectionObserver | null>(null);
  // Every photo box (image or parked) is watched from the moment it mounts: parking swaps the element.
  const watchPhoto = useCallback((item: HTMLDivElement | null) => {
    if (item) parkObserver.current?.observe(item);
  }, []);
  useEffect(() => {
    const container = containerRef.current;
    if (!parking || !container || typeof IntersectionObserver === "undefined") { setParked(new Set()); return; }
    const observer = new IntersectionObserver((entries) => {
      setParked((current) => {
        let next = current;
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.photoIndex);
          if (Number.isNaN(index)) continue;
          // Only a photo already drawn is parked, with ITS proportions (not its box's: before
          // loading the box is a 2/3 placeholder, and forcing that shape later stretched the photo).
          const photo = (entry.target as HTMLElement).querySelector("img");
          const loaded = photo && photo.complete && photo.naturalWidth > 0 && photo.naturalHeight > 0;
          if (!entry.isIntersecting && !current.has(index) && loaded) {
            parkedRatios.current.set(index, `${photo.naturalWidth} / ${photo.naturalHeight}`);
            if (next === current) next = new Set(current);
            next.add(index);
          } else if (entry.isIntersecting && current.has(index)) {
            if (next === current) next = new Set(current);
            next.delete(index);
          }
        }
        return next;
      });
    }, { rootMargin: `${Math.round(window.innerHeight * PARK_DISTANCE_SCREENS)}px 0px` });
    parkObserver.current = observer;
    container.querySelectorAll<HTMLElement>("[data-photo-index]").forEach((item) => observer.observe(item));
    return () => { observer.disconnect(); parkObserver.current = null; };
  }, [parking, columnCount]);

  // Laid out once for ALL photos (not only the open ones), so a photo never moves when more open.
  const lightboxSlides = useMemo(() => pool.slice(0, limit).map((src) => ({ src: originals[src] ?? src })), [pool, limit, originals]);
  const blocks = useMemo(() => galleryBlocks(pool.map((src) => ratios?.[src]), columnCount), [pool, ratios, columnCount]);
  // Blocks = rows of columns broken by full-width photos (phones, with very wide photos).
  const spanning = blocks.some((block) => block.kind === "wide");
  const knownRatio = (src: string) => (ratios?.[src] ? String(ratios[src]) : undefined);

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
      // With full-width photos the drifting columns would slide over them: no drift then.
      const cols = spanning ? [] : gsap.utils.toArray<HTMLElement>(".ppg-col");
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
        if (remaining <= 0) refreshGalleryScroll();
      };
      if (remaining === 0) refreshGalleryScroll();
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
  }, [columnCount, isMobile, spanning]);

  /** One photo of the grid: a "there is more" photo, a not-yet-loaded slot, parked, or the photo. */
  const renderPhoto = (src: string, index: number) => {
    if (index >= limit) {
      return (
        // The "there is more" photos under the blur layer and the button.
        <div key={src} className="ppg-item ppg-peek" aria-hidden="true">
          <img src={src} alt="" loading="lazy" decoding="async" className="ppg-img is-shown" style={knownRatio(src) ? { aspectRatio: `auto ${knownRatio(src)}` } : undefined} />
          {/* Each photo has its own blur layer, so the dark gaps between photos are never
              smeared into them; the second row is blurred more than the first. */}
          <span className={`ppg-peek-blur ${index - limit >= columnCount ? "is-far" : ""}`}>
            <span /><span /><span /><span />
          </span>
        </div>
      );
    }
    if (index >= visible.length) {
      // Not loaded yet (the first one is the "load the next batch" trigger): already the photo's shape when known.
      return <div key={src} ref={index === visible.length ? moreRef : undefined} className="ppg-item ppg-slot" style={knownRatio(src) ? { aspectRatio: knownRatio(src) } : undefined} aria-hidden="true" />;
    }
    if (parked.has(index)) {
      // Far from the screen: no image in memory, same shape so nothing moves.
      return <div key={src} ref={watchPhoto} data-photo-index={index} className="ppg-item" style={{ aspectRatio: parkedRatios.current.get(index) }} aria-hidden="true" />;
    }
    return (
      <div key={src} ref={watchPhoto} data-photo-index={index} className="ppg-item" style={warnings?.[src] ? { position: "relative", outline: "3px solid #dc2626" } : undefined}>
        {warnings?.[src] && (
          <span className="absolute left-2 right-2 top-2 z-10 rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold leading-snug text-white shadow-lg">
            {warnings[src]}
          </span>
        )}
        <button type="button" className="ppg-trigger" onClick={() => setLightboxIndex(index)} aria-label="Deschide fotografia">
          <FadeInImage
            src={src}
            // Its shape while it loads (or is redrawn after parking), so its place never moves.
            ratio={parkedRatios.current.get(index) ?? knownRatio(src)}
            alt={catalogAlt ? catalogAlt(src, buildSeoImageAlt(altBase, index)) : buildSeoImageAlt(altBase, index)}
          />
        </button>
      </div>
    );
  };

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
          <div className="ppg-wrap" style={gated ? { position: "relative", overflow: "hidden", height: clipHeight ?? undefined } : undefined}>
            {spanning ? (
              <div ref={gridRef} className="ppg-grid ppg-grid--blocks">
                {blocks.map((block, blockIndex) => (block.kind === "wide" ? (
                  block.index < peekEnd ? <div key={`wide-${block.index}`} className="ppg-wide">{renderPhoto(pool[block.index], block.index)}</div> : null
                ) : block.columns.some((column) => column.some((index) => index < peekEnd)) ? (
                  <div key={`block-${blockIndex}`} className="ppg-block" style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}>
                    {block.columns.map((column, columnIndex) => (
                      <div key={columnIndex} className="ppg-col">
                        {column.filter((index) => index < peekEnd).map((index) => renderPhoto(pool[index], index))}
                      </div>
                    ))}
                  </div>
                ) : null))}
              </div>
            ) : (
              <div ref={gridRef} className="ppg-grid" style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}>
                {(blocks[0]?.kind === "columns" ? blocks[0].columns : []).map((column, columnIndex) => (
                  <div key={columnIndex} className="ppg-col">
                    {column.filter((index) => index < peekEnd).map((index) => renderPhoto(pool[index], index))}
                  </div>
                ))}
              </div>
            )}
            {gated && (
              <div ref={moreButtonRef} className="ppg-more" style={peekTop !== null ? { top: peekTop } : undefined}>
                <button type="button" onClick={openMore} className="ppg-more-btn">
                  Vezi mai multe poze <span aria-hidden="true">↓</span>
                </button>
              </div>
            )}
          </div>
          <div ref={endRef} className="ppg-spacer" aria-hidden="true" />
          {/* The photos opened so far (not the blurred ones), each at its original resolution. */}
          <Lightbox
            open={lightboxIndex >= 0}
            index={lightboxIndex}
            close={() => setLightboxIndex(-1)}
            slides={lightboxSlides}
          />
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
function FadeInImage({ src, alt, ratio }: { src: string; alt: string; ratio?: string }) {
  const [shown, setShown] = useState(false);
  const show = () => setShown(true);
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`ppg-img ${shown ? "is-shown" : ""}`}
      // "auto": the photo's own proportions win as soon as it is drawn; the remembered ones only
      // hold its place until then, so it can never be stretched.
      style={ratio ? { aspectRatio: `auto ${ratio}` } : undefined}
      ref={(img) => {
        // Cached images can finish before React attaches onLoad.
        if (img?.complete && img.naturalWidth && !shown) show();
      }}
      onLoad={show}
      onError={show}
    />
  );
}
