import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { buildSeoImageAlt, getCatalogImageAlt } from "../../utils/imageAlt";
import "./PortfolioParallaxGallery.scss";

gsap.registerPlugin(ScrollTrigger, SplitText);

type PortfolioParallaxGalleryProps = { altBase?: string };

const MAX_IMAGES = 60;
const PARALLAX_FACTOR = 0.13;

function getColumnCount(width: number) {
  if (width < 640) return 2;
  if (width < 1024) return 3;
  return 4;
}

export default function PortfolioParallaxGallery({
  altBase = "fotograf videograf eveniment Anca Visuals",
}: PortfolioParallaxGalleryProps) {
  const [zoneData, setZoneData] = useState<{ desktop: string[]; mobile: string[] }>({ desktop: [], mobile: [] });
  const [loading, setLoading] = useState(true);
  const [columnCount, setColumnCount] = useState(() =>
    getColumnCount(typeof window !== "undefined" ? window.innerWidth : 1280)
  );
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    fetch("/api/showcase-zones/portfolio_gallery")
      .then((response) => response.json())
      .then(async (data: { desktop?: string[]; mobile?: string[] }) => {
        const desktop = data.desktop ?? [];
        const mobile = data.mobile ?? [];
        // Zona nu a fost curatoriata inca din admin — pastram vechiul pool
        // de poze in loc sa aratam o galerie goala.
        if (desktop.length === 0 && mobile.length === 0) {
          const fallback = await fetch("/api/oferte/portfolio-images").then((r) => r.json());
          setZoneData({ desktop: Array.isArray(fallback.urls) ? fallback.urls : [], mobile: [] });
          return;
        }
        setZoneData({ desktop, mobile });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // A device without its own curated set falls back to the other device's set.
  const images = useMemo(() => {
    const list = isMobile && zoneData.mobile.length > 0 ? zoneData.mobile : zoneData.desktop;
    return Array.from(new Set(list)).slice(0, MAX_IMAGES);
  }, [zoneData, isMobile]);

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

  useEffect(() => {
    if (!containerRef.current || columns.every((col) => col.length === 0)) return;

    const ctx = gsap.context(() => {
      const cols = gsap.utils.toArray<HTMLElement>(".ppg-col");
      cols.forEach((col, index) => {
        gsap.to(col, {
          yPercent: -100 * (index + 1) * PARALLAX_FACTOR,
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
  }, [columns]);

  return (
    <section ref={containerRef} className="ppg-section bg-neutral-950 text-white">
      <div className="ppg-intro">
        <h1 ref={titleRef} className="ppg-title">
          Portofoliu
        </h1>
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
                    <div key={src} className="ppg-item">
                      <img
                        src={src}
                        alt={getCatalogImageAlt(src, buildSeoImageAlt(altBase, colIndex * col.length + index))}
                        loading="lazy"
                        className="ppg-img"
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
