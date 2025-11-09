import { useEffect, useState } from "react";
import Aos from "aos";
import "aos/dist/aos.css";
import Lightbox from "yet-another-react-lightbox";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase"; // verify path

export default function PortfolioGallery() {
  const [index, setIndex] = useState(-1);
  const [images, setImages] = useState<string[]>([]);
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
        console.log("[Gallery] items found:", res.items.length, res);
        console.log("[Gallery] bucket from config:", (storage as any).app.options.storageBucket);
        const urls = await Promise.all(
          res.items.map((itemRef) => getDownloadURL(itemRef))
        );

        console.log("[Gallery] urls:", urls);
        urls.sort();
        setImages(urls);
      } catch (error) {
        console.error("[Gallery] error loading images:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  const lightboxSlides = images.map((src) => ({ src }));

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
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Portofoliu foto ${i}`}
                loading="lazy"
                className="w-full h-full object-cover cursor-zoom-in rounded-md transition-transform duration-300 hover:scale-105"
                data-aos="fade-up"
                data-aos-delay={i * 40}
                onClick={() => setIndex(i)}
              />
            ))}
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
