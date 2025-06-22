import React, { useEffect, useState } from "react";
import Aos from "aos";
import "aos/dist/aos.css";

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/plugins/thumbnails.css";

const unsplash = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;

const images = [
  unsplash("photo-1519681393784-d120267933ba"),
  unsplash("photo-1506744038136-46273834b3fb"),
  unsplash("photo-1523413651479-597eb2da0ad6"),
  unsplash("photo-1499084732479-de2c02d45fc4"),
  unsplash("photo-1605460375648-278bcbd579a6"),
  unsplash("photo-1550439062-609e1531270e"),
  unsplash("photo-1593642532973-d31b6557fa68"),
  unsplash("photo-1519985176271-adb1088fa94c"),
  unsplash("photo-1506765515384-028b60a970df"),
  unsplash("photo-1529626455594-4ff0802cfb7e"),
  unsplash("photo-1559944375-4e029753f0b1"),
  unsplash("photo-1579546929518-9e396f3cc809"),
  unsplash("photo-1517841905240-472988babdf9"),
  unsplash("photo-1554151228-14d9def656e4"),
  unsplash("photo-1526170375885-4d8ecf77b99f"),
];

const rowPattern: string[][] = [
  ["w-full sm:w-[49%]", "w-full sm:w-[49%]"],
  ["w-full sm:w-[49%]", "w-full sm:w-[29%]", "w-full sm:w-[19%]"],
  ["w-full sm:w-[19%]", "w-full sm:w-[29%]", "w-full sm:w-[49%]"],
  ["w-full sm:w-[29%]", "w-full sm:w-[19%]", "w-full sm:w-[49%]"],
  ["w-full sm:w-[59%]", "w-full sm:w-[39%]"],
  ["w-full sm:w-[39%]", "w-full sm:w-[39%]", "w-full sm:w-[19%]"],
];

export default function PortfolioGallery() {
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    Aos.init({ duration: 800, once: true });
  }, []);

  const widthsFlat = rowPattern.flat();
  const gallery = widthsFlat.map((width, i) => ({
    width,
    src: images[i % images.length],
  }));

  let cursor = 0;
  const rows = rowPattern.map(pattern => {
    const slice = gallery.slice(cursor, cursor + pattern.length);
    cursor += pattern.length;
    return slice;
  });

  const lightboxSlides = gallery.map(g => ({ src: g.src }));

  return (
    <>
      <section className="myport max-w-screen-xl mx-auto px-4 py-12 space-y-6">
        {rows.map((row, r) => (
          <div key={r} className="flex flex-wrap gap-4">
            {row.map((item, i) => (
              <img
                key={i}
                src={item.src}
                alt=""
                loading="lazy"
                className={`${item.width} object-cover cursor-zoom-in rounded-md transition-transform duration-300 hover:scale-105`}
                data-aos="fade-up"
                data-aos-delay={i * 50}
                onClick={() => setIndex(rowPattern.slice(0, r).flat().length + i)}
              />
            ))}
          </div>
        ))}
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
