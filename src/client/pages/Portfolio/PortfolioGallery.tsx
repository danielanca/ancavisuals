import { useEffect, useMemo, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import { buildSeoImageAlt } from "../../utils/imageAlt";
import "./PortfolioGallery.scss";

type PortfolioGalleryProps = { altBase?: string };

const INITIAL_VISIBLE = 40;
const LOAD_MORE_STEP = 20;
const SKELETON_HEIGHTS = [280, 380, 240, 420, 300, 360, 260, 440, 310, 390, 270, 350];

export default function PortfolioGallery({
  altBase = "fotograf videograf eveniment Anca Visuals",
}: PortfolioGalleryProps) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  useEffect(() => {
    fetch("/api/oferte/portfolio-images")
      .then((response) => response.json())
      .then((data: { urls?: string[] }) => {
        if (Array.isArray(data.urls)) setImages(data.urls);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const lightboxSlides = useMemo(() => images.map((src) => ({ src })), [images]);

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
          <div className="pg-masonry">
            {images.slice(0, visibleCount).map((src, index) => (
              <div
                key={src + index}
                className="pg-item"
              >
                <button
                  type="button"
                  className="pg-img-trigger"
                  onClick={() => setLightboxIndex(index)}
                  aria-label="Deschide fotografia"
                >
                  <img
                    src={src}
                    alt={buildSeoImageAlt(altBase, index)}
                    loading="lazy"
                    className="pg-img"
                  />
                </button>
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
