import { useEffect, useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import { buildSeoImageAlt } from "../../utils/imageAltLabel";
import "./PortfolioGallery.scss";
import HeavyPhotoFlag from "../../components/UI/HeavyPhotoFlag";
import { isHeavyPhoto } from "../../../shared/media/photoWeight";

type PortfolioGalleryProps = {
  altBase?: string;
  minTotalImages?: number;
  /** White background, square photos (QR Moments guest page). */
  light?: boolean;
  /** Show the photos of this offer (/oferta/<slug>) instead of the homepage gallery, so changing them there changes them here. */
  offerSlug?: string;
  /** Many small photos: 3 columns on phones, 4 on tablets, 5 on desktop, with tight gaps (QR Moments). */
  dense?: boolean;
  /** Show only the photos from `offset` to `offset + limit` (e.g. 9 at the top, the rest further down). */
  offset?: number;
  limit?: number;
};

type OfferSectionAsset = { kind?: string; url: string; displayUrl?: string; sizeBytes?: number };
type OfferSection = { assets?: OfferSectionAsset[]; assetsMobile?: OfferSectionAsset[] };

/** The offer's photos per device, in the offer's order, without the heavy ones the landing hides too. */
export function offerGalleryPhotos(sections: OfferSection[]): { desktop: string[]; mobile: string[] } {
  const photos = (assets: OfferSectionAsset[] = []) => assets
    .filter((asset) => (asset.kind ?? "image") === "image" && !isHeavyPhoto(asset.sizeBytes))
    .map((asset) => asset.displayUrl ?? asset.url);
  return {
    desktop: sections.flatMap((section) => photos(section.assets)),
    mobile: sections.flatMap((section) => photos(section.assetsMobile)),
  };
}

const INITIAL_VISIBLE = 40;
const LOAD_MORE_STEP = 20;
const SKELETON_HEIGHTS = [280, 380, 240, 420, 300, 360, 260, 440, 310, 390, 270, 350];

// Dense mode: the thumbnails get alternating heights, so the masonry shows even when every photo
// has the same proportions (phones often get only portrait photos). The lightbox shows them whole.
const DENSE_RATIOS = ["3 / 4", "1 / 1", "4 / 5", "2 / 3", "5 / 4", "3 / 4", "4 / 5"];
export const denseRatio = (index: number, column: number) => DENSE_RATIOS[(index + column * 2) % DENSE_RATIOS.length];

function getDenseColumnCount(width: number) {
  if (width < 640) return 3;
  if (width < 1024) return 4;
  return 5;
}

function getColumnCount(width: number) {
  if (width < 640) return 1;
  if (width < 1024) return 2;
  return 3;
}

export default function PortfolioGallery({
  altBase = "fotograf videograf eveniment Anca Visuals",
  minTotalImages = 0,
  light = false,
  offerSlug,
  dense = false,
  offset = 0,
  limit,
}: PortfolioGalleryProps) {
  const sectionClass = ["pg-section", light && "pg-section--light", dense && "pg-section--dense"].filter(Boolean).join(" ");
  const columnsFor = dense ? getDenseColumnCount : getColumnCount;
  const [zoneData, setZoneData] = useState<{ desktop: string[]; mobile: string[] }>({ desktop: [], mobile: [] });
  // Admin only: photos over the weight limit, flagged (visitors don't get them).
  const [heavy, setHeavy] = useState<Record<string, number>>({});
  // The alt-text catalog (127 KB) loads after the gallery; until then photos use the generated alt.
  const [catalogAlt, setCatalogAlt] = useState<((src: string, fallback: string) => string) | null>(null);
  useEffect(() => {
    let active = true;
    import("../../utils/imageAlt")
      .then(({ getCatalogImageAlt }) => { if (active) setCatalogAlt(() => getCatalogImageAlt); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const [loading, setLoading] = useState(true);
  // An offer's photos are all shown (the owner picked each one); the homepage gallery pages them.
  const [visibleCount, setVisibleCount] = useState(offerSlug ? Number.POSITIVE_INFINITY : INITIAL_VISIBLE);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const [columnCount, setColumnCount] = useState(() =>
    columnsFor(typeof window !== "undefined" ? window.innerWidth : 1280)
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
      setColumnCount(columnsFor(window.innerWidth));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [columnsFor]);

  useEffect(() => {
    if (!offerSlug) return;
    fetch(`/api/oferte/${encodeURIComponent(offerSlug)}`)
      .then((response) => response.json())
      .then((data: { serviceSections?: OfferSection[] }) => setZoneData(offerGalleryPhotos(data.serviceSections ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [offerSlug]);

  useEffect(() => {
    if (offerSlug) return;
    fetch("/api/showcase-zones/homepage_gallery")
      .then((response) => response.json())
      .then(async (data: { desktop?: string[]; mobile?: string[]; heavy?: Record<string, number> }) => {
        if (data.heavy) setHeavy(data.heavy);
        const desktop = data.desktop ?? [];
        const mobile = data.mobile ?? [];
        // Zona nu a fost curatoriata inca din admin — pastram vechiul pool
        // de poze in loc sa aratam o galerie goala (sau prea subtire, daca
        // pagina cere un minim explicit prin minTotalImages).
        if (desktop.length + mobile.length <= minTotalImages) {
          const fallback = await fetch("/api/oferte/portfolio-images").then((r) => r.json());
          setZoneData({ desktop: Array.isArray(fallback.urls) ? fallback.urls : [], mobile: [] });
          return;
        }
        setZoneData({ desktop, mobile });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [minTotalImages, offerSlug]);

  // A device without its own curated set falls back to the other device's set.
  const images = useMemo(() => {
    const list = isMobile && zoneData.mobile.length > 0 ? zoneData.mobile : zoneData.desktop;
    const unique = Array.from(new Set(list));
    return unique.slice(offset, limit === undefined ? undefined : offset + limit);
  }, [zoneData, isMobile, offset, limit]);

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
      <section className={sectionClass}>
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
      <section className={sectionClass}>
        <div className="pg-container text-neutral-500 text-sm text-center py-16">
          Nu sunt imagini disponibile momentan.
        </div>
      </section>
    );
  }

  return (
    <>
      <section className={sectionClass}>
        <div className="pg-container">
          <div className="pg-masonry" style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}>
            {columns.map((col, colIndex) => (
              <div key={colIndex} className="pg-col">
                {col.map(({ src, index }) => (
                  <div key={src + index} className="pg-item" style={heavy[src] ? { position: "relative" } : undefined}>
                    <HeavyPhotoFlag bytes={heavy[src]} />
                    <button
                      type="button"
                      className="pg-img-trigger"
                      onClick={() => setLightboxIndex(index)}
                      aria-label="Deschide fotografia"
                    >
                      <img
                        src={src}
                        alt={catalogAlt ? catalogAlt(src, buildSeoImageAlt(altBase, index)) : buildSeoImageAlt(altBase, index)}
                        loading="lazy"
                        className="pg-img"
                        style={dense ? { aspectRatio: denseRatio(index, colIndex) } : undefined}
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
