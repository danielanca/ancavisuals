import { useEffect, useState } from "react";
import Aos from "aos";
import "aos/dist/aos.css";
import Lightbox from "yet-another-react-lightbox";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase";
import "./PortfolioGallery.css"; // adaugă fișierul de mai jos

type Aspect = "landscape" | "portrait" | "tall" | "square";

type ImageItem = {
  src: string;
  aspect?: Aspect;
};

export default function PortfolioGallery() {
  const [index, setIndex] = useState(-1);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Aos.init({ duration: 800, once: true });
  }, []);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        console.log("[Gallery] start fetch");
        const folderRef = ref(storage, "ancavisuals/PortfolioGallery");
        const res = await listAll(folderRef);
        console.log("[Gallery] items found:", res.items.length);

        const urls = await Promise.all(
          res.items.map((itemRef) => getDownloadURL(itemRef))
        );

        urls.sort();
        setImages(urls.map((src) => ({ src })));
      } catch (error) {
        console.error("[Gallery] error loading images:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  const handleImageLoad = (idx: number, el: HTMLImageElement | null) => {
    if (!el) return;
    const { naturalWidth: w, naturalHeight: h } = el;
    if (!w || !h) return;

    const ratio = w / h;
    let aspect: Aspect;

    if (ratio > 1.5) {
      // foarte lat
      aspect = "landscape";
    } else if (ratio >= 1.1 && ratio <= 1.5) {
      // ușor landscape / aproape 16:9
      aspect = "square";
    } else if (ratio < 0.5) {
      // gen 9:16 sau mai extrem
      aspect = "tall";
    } else if (ratio < 1) {
      // portret clasic
      aspect = "portrait";
    } else {
      aspect = "square";
    }

    setImages((prev) => {
      const clone = [...prev];
      const current = clone[idx];
      if (!current || current.aspect === aspect) return prev;
      clone[idx] = { ...current, aspect };
      return clone;
    });
  };

  const lightboxSlides = images.map((img) => ({ src: img.src }));

  if (loading) {
    return (
      <section className="w-full bg-[#050509]">
        <div className="max-w-screen-xl mx-auto px-4 py-12 text-gray-300">
          Loading photos...
        </div>
      </section>
    );
  }

  if (!images.length) {
    return (
      <section className="w-full bg-[#050509]">
        <div className="max-w-screen-xl mx-auto px-4 py-12 text-red-300">
          Nu am găsit nici o imagine în <code>ancavisuals/PortfolioGallery</code>.
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="w-full bg-[#050509]">
        <div className="max-w-screen-xl mx-auto px-4 py-12">
          <div className="pg-grid">
            {images.map((img, i) => {
              const aspectClass =
                img.aspect ? `pg-item--${img.aspect}` : "";

              return (
                <button
                  key={img.src + i}
                  type="button"
                  className={`pg-item ${aspectClass}`}
                  data-aos="fade-up"
                  data-aos-delay={i * 40}
                  onClick={() => setIndex(i)}
                >
                  <img
                    src={img.src}
                    alt={`Portofoliu foto ${i + 1}`}
                    loading="lazy"
                    className="pg-img"
                    ref={(el) => handleImageLoad(i, el)}
                  />
                </button>
              );
            })}
          </div>
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
