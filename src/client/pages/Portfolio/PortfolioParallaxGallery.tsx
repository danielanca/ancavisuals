import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { buildSeoImageAlt, getCatalogImageAlt } from "../../utils/imageAlt";
import "./PortfolioParallaxGallery.scss";

gsap.registerPlugin(ScrollTrigger, SplitText);

type PortfolioParallaxGalleryProps = {
  altBase?: string;
  // Pozele de afișat, în ordinea dorită — când sunt date, componenta le
  // folosește direct și sare peste fetch-ul zonei globale "portfolio_gallery"
  // din Bibliotecă Media. Folosit de paginile de campanie, care au propria
  // lor galerie curatoriată per-campanie, distinctă de pool-ul global.
  images?: string[];
  // Când e true, toată galeria vizibilă se reînnoiește periodic (aceleași
  // poze, reordonate), cu efect de mozaic — ca fâșia din footer. Implicit
  // false, ca /portofoliu să rămână static (doar parallax la scroll).
  rotate?: boolean;
};

const MAX_IMAGES = 60;
const ROTATE_INTERVAL_MS = 10000;
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
  rotate = false,
}: PortfolioParallaxGalleryProps) {
  const [zoneData, setZoneData] = useState<{ desktop: string[]; mobile: string[] }>({ desktop: [], mobile: [] });
  const [loading, setLoading] = useState(!imagesProp);
  const [columnCount, setColumnCount] = useState(() =>
    getColumnCount(typeof window !== "undefined" ? window.innerWidth : 1280)
  );
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const [rotateTick, setRotateTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (imagesProp) return;
    fetch("/api/showcase-zones/portfolio_gallery")
      .then((response) => response.json())
      .then(async (data: { desktop?: string[]; mobile?: string[] }) => {
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

  // La fiecare ROTATE_INTERVAL_MS, rotim ordinea pozelor cu o poziție — fiecare
  // loc din grilă ajunge să arate altă poză, "una câte una", fără să schimbăm
  // efectiv poolul (toate pozele curatoriate sunt deja vizibile în galerie,
  // nu există o rezervă ascunsă de unde să aducem altele complet noi).
  useEffect(() => {
    if (!rotate) return;
    const interval = window.setInterval(() => setRotateTick((tick) => tick + 1), ROTATE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [rotate]);

  // A device without its own curated set falls back to the other device's set.
  const pool = useMemo(() => {
    if (imagesProp) return Array.from(new Set(imagesProp)).slice(0, MAX_IMAGES);
    const own = isMobile ? zoneData.mobile : zoneData.desktop;
    const other = isMobile ? zoneData.desktop : zoneData.mobile;
    const list = own.length > 0 ? own : other;
    return Array.from(new Set(list)).slice(0, MAX_IMAGES);
  }, [imagesProp, zoneData, isMobile]);

  const images = useMemo(() => {
    if (!rotate || pool.length === 0) return pool;
    const offset = rotateTick % pool.length;
    return [...pool.slice(offset), ...pool.slice(0, offset)];
  }, [pool, rotate, rotateTick]);

  useEffect(() => {
    const handleResize = () => {
      setColumnCount(getColumnCount(window.innerWidth));
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const columns = useMemo(() => {
    const groups: string[][] = Array.from({ length: columnCount }, () => []);
    images.forEach((src, index) => groups[index % columnCount].push(src));
    return groups;
  }, [images, columnCount]);

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

  // O rotație poate schimba ușor înălțimea fiecărei coloane (poze cu proporții
  // diferite) — doar recalculăm pozițiile de start/final ale trigger-elor deja
  // existente, fără să le distrugem.
  useEffect(() => {
    if (!rotate) return;
    const id = window.requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => window.cancelAnimationFrame(id);
  }, [images, rotate]);

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
      ) : !images.length ? (
        <div className="ppg-wrap text-neutral-500 text-sm text-center py-16">
          Nu sunt imagini disponibile momentan.
        </div>
      ) : (
        <>
          <div className="ppg-wrap">
            <div className="ppg-grid" style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}>
              {columns.map((col, colIndex) => (
                <div key={colIndex} className="ppg-col">
                  {col.map((src, index) => (
                    <div key={rotate ? `${colIndex}-${index}-${rotateTick}` : src} className="ppg-item">
                      <img
                        src={src}
                        alt={getCatalogImageAlt(src, buildSeoImageAlt(altBase, colIndex * col.length + index))}
                        loading="lazy"
                        className="ppg-img"
                        style={rotate ? {
                          animation: `ppg-mosaic-in 700ms ease ${(colIndex * 173 + index * 97) % 650}ms 1 normal both`,
                        } : undefined}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="ppg-spacer" aria-hidden="true" />
        </>
      )}
    </section>
  );
}
