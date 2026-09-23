import { useEffect, useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import { buildSeoImageAlt, getCatalogImageAlt } from "../../utils/imageAlt";
import "./PortfolioGallery.scss";

type PortfolioGalleryProps = { altBase?: string };

const INITIAL_VISIBLE = 40;
const LOAD_MORE_STEP = 20;
const SKELETON_HEIGHTS = [280, 380, 240, 420, 300, 360, 260, 440, 310, 390, 270, 350];

function getColumnCount(width: number) {
  if (width < 640) return 1;
  if (width < 1024) return 2;
  return 3;
}

export default function PortfolioGallery({
  altBase = "fotograf videograf eveniment Anca Visuals",
}: PortfolioGalleryProps) {
  const [zoneData, setZoneData] = useState<{ desktop: string[]; mobile: string[] }>({ desktop: [], mobile: [] });
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const [columnCount, setColumnCount] = useState(() =>
    getColumnCount(typeof window !== "undefined" ? window.innerWidth : 1280)
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
      setColumnCount(getColumnCount(window.innerWidth));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetch("/api/showcase-zones/homepage_gallery")
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
    return Array.from(new Set(list));
  }, [zoneData, isMobile]);

  const lightboxSlides = useMemo(() => images.map((src) => ({ src })), [images]);

  // Distribuție round-robin pe coloane (nu CSS column-count) — pozele deja
  // afișate rămân exact pe loc când apeși "mai multe poze"; CSS multi-column
  // reflow-uia tot layout-ul la fiecare imagine nouă adăugată.
  const columns = useMemo(() => {
    const cols: Array<Array<{ src: string; index: number }>> = Array.from({ length: columnCount }, () => []);
    images.slice(0, visibleCount).forEach((src, index) => {
      cols[index % columnCount].push({ src, index });
    });
    return cols;
  }, [images, visibleCount, columnCount]);

  if (loading) {
    return (
      <section className="pg-section">
        <div className="pg-container">
          <div className="pg-skeleton-masonry">
            {SKELETON_HEIGHTS.map((height, index) => (
              <div key={index} className="pg-skeleton-item" style={{ height }} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!images.length) {
    return (
      <section className="pg-section">
        <div className="pg-container text-neutral-500 text-sm text-center py-16">
          Nu sunt imagini disponibile momentan.
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="pg-section">
        <div className="pg-container">
          <div className="pg-masonry" style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}>
            {columns.map((col, colIndex) => (
              <div key={colIndex} className="pg-col">
                {col.map(({ src, index }) => (
                  <div key={src + index} className="pg-item">
                    <button
                      type="button"
                      className="pg-img-trigger"
                      onClick={() => setLightboxIndex(index)}
                      aria-label="Deschide fotografia"
                    >
                      <img
                        src={src}
                        alt={getCatalogImageAlt(src, buildSeoImageAlt(altBase, index))}
                        loading="lazy"
                        className="pg-img"
                      />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {visibleCount < images.length && (
            <div className="pg-load-more">
              <button
                type="button"
                className="pg-load-more-btn"
                onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_STEP)}
              >
                MAI MULTE POZE
              </button>
            </div>
          )}
        </div>
      </section>

      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => setLightboxIndex(-1)}
        slides={lightboxSlides}
        plugins={[Thumbnails]}
      />
    </>
  );
}
