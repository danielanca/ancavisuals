import { useEffect, useMemo, useState } from "react";
import Aos from "aos";
import "aos/dist/aos.css";
import Lightbox from "yet-another-react-lightbox";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase";
import "./PortfolioGallery.scss";

type ImageItem = {
  src: string;
};

const FOLDER_PATH = "ancavisuals/PortfolioGallery";
const INITIAL_VISIBLE = 40;
const LOAD_MORE_STEP = 20;

export default function PortfolioGallery() {
  const [index, setIndex] = useState(-1);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  useEffect(() => {
    Aos.init({ duration: 800, once: true });
  }, []);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const folderRef = ref(storage, FOLDER_PATH);
        const res = await listAll(folderRef);

        const urls = await Promise.all(res.items.map(itemRef => getDownloadURL(itemRef)));

        // poți schimba sortarea dacă vrei altă ordine
        urls.sort();

        setImages(urls.map(src => ({ src })));
      } catch (error) {
        console.error("[Gallery] error loading images:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  const lightboxSlides = useMemo(() => images.map(img => ({ src: img.src })), [images]);

  // Înălțimi variate ca să simuleze aspect ratio-uri diferite de poze
  const SKELETON_HEIGHTS = [280, 380, 240, 420, 300, 360, 260, 440, 310, 390, 270, 350];

  if (loading) {
    return (
      <section className="pg-section">
        <div className="pg-container">
          <div className="pg-skeleton-masonry">
            {SKELETON_HEIGHTS.map((h, i) => (
              <div key={i} className="pg-skeleton-item" style={{ height: h }} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!images.length) {
    return (
      <section className="pg-section">
        <div className="pg-container text-red-300">
          Nu am găsit nici o imagine în <code>{FOLDER_PATH}</code>.
        </div>
      </section>
    );
  }

  const visibleImages = images.slice(0, visibleCount);

  return (
    <>
      <section className="pg-section">
        <div className="pg-container">
          {/* Masonry CSS-based: coloane, fără găuri */}
          <div className="pg-masonry">
            {visibleImages.map((img, i) => (
              <button
                key={img.src + i}
                type="button"
                className="pg-item"
                data-aos="fade-up"
                data-aos-delay={i * 40}
                onClick={() => setIndex(i)}
              >
                <img src={img.src} alt={`Portofoliu foto ${i + 1}`} loading="lazy" className="pg-img" />
              </button>
            ))}
          </div>

          {visibleCount < images.length && (
            <div className="pg-load-more">
              <button
                onClick={() => setVisibleCount(prev => prev + LOAD_MORE_STEP)}
                className="pg-load-more-btn"
                type="button"
              >
                MAI MULTE POZE
              </button>
            </div>
          )}
        </div>
      </section>

      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={lightboxSlides}
        plugins={[Thumbnails]}
      />
    </>
  );
}
