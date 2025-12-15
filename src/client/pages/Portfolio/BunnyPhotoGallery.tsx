import { useEffect, useMemo, useState } from "react";
import styles from "./BunnyPhotoGallery.module.scss";

type Props = {
  photos: string[];
  variant?: "section" | "plain";
  selectable?: boolean;
  selected?: Set<string>;
  getKey?: (src: string) => string;
  onToggle?: (src: string) => void;
};

type ImgFormat = "webp" | "jpeg" | "png" | "avif" | "auto";

const withOptimizer = (
  src: string,
  opts: { width?: number; height?: number; quality?: number; format?: ImgFormat; sharpen?: boolean }
) => {
  const u = new URL(src);
  if (opts.width) u.searchParams.set("width", String(opts.width));
  if (opts.height) u.searchParams.set("height", String(opts.height));
  if (typeof opts.quality === "number") u.searchParams.set("quality", String(opts.quality));
  if (opts.format) u.searchParams.set("format", opts.format);
  if (typeof opts.sharpen === "boolean") u.searchParams.set("sharpen", String(opts.sharpen));
  return u.toString();
};

const isMobileNow = () => (typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false);

export default function BunnyPhotoGallery({
  photos,
  variant = "section",
  selectable = false,
  selected,
  getKey,
  onToggle,
}: Props) {
  const [visible, setVisible] = useState(90);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(isMobileNow());

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setVisible(90);
    setLightboxIndex(null);
  }, [photos]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i === null ? null : Math.min(i + 1, photos.length - 1)));
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i === null ? null : Math.max(i - 1, 0)));
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxIndex, photos.length]);

  const visiblePhotos = useMemo(() => photos.slice(0, visible), [photos, visible]);
  const activeSrc = lightboxIndex === null ? null : photos[lightboxIndex] ?? null;

  const openLightbox = (src: string) => {
    const idx = photos.indexOf(src);
    if (idx >= 0) setLightboxIndex(idx);
  };

  const thumbQ = selectable ? (isMobile ? 76 : 78) : (isMobile ? 82 : 84);
  const thumbBase = isMobile ? 820 : 1100;

  const renderItem = (src: string) => {
    const key = getKey ? getKey(src) : src;
    const isOn = selectable && selected ? selected.has(key) : false;

    const cls = [
      styles["pg-item"],
      selectable ? styles["pg-itemSelectable"] : "",
      isOn ? styles["pg-itemOn"] : "",
    ]
      .filter(Boolean)
      .join(" ");

    const src480 = withOptimizer(src, { width: 480, quality: thumbQ, format: "webp", sharpen: false });
    const src720 = withOptimizer(src, { width: 720, quality: thumbQ, format: "webp", sharpen: false });
    const src960 = withOptimizer(src, { width: 960, quality: thumbQ + 2, format: "webp", sharpen: false });
    const src1200 = withOptimizer(src, { width: 1200, quality: thumbQ + 2, format: "webp", sharpen: false });

    const finalSrc = withOptimizer(src, { width: thumbBase, quality: thumbQ, format: "webp", sharpen: false });

    return (
      <button
        key={src}
        className={cls}
        type="button"
        onClick={() => {
          if (selectable) {
            onToggle?.(src);
            return;
          }
          openLightbox(src);
        }}
      >
        {selectable && <div className={styles["pg-check"]}>{isOn ? "✓" : ""}</div>}
        <img
          className={styles["pg-img"]}
          src={finalSrc}
          srcSet={`${src480} 480w, ${src720} 720w, ${src960} 960w, ${src1200} 1200w`}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          loading="lazy"
          decoding="async"
          alt=""
        />
      </button>
    );
  };

  const masonry = (
    <>
      <div className={styles["pg-masonry"]}>{visiblePhotos.map(renderItem)}</div>

      {visible < photos.length && (
        <div className={styles["pg-load-more"]}>
          <button
            className={styles["pg-load-more-btn"]}
            onClick={() => setVisible((v) => Math.min(v + (isMobile ? 120 : 240), photos.length))}
            type="button"
          >
            Load more ({visible}/{photos.length})
          </button>
        </div>
      )}
    </>
  );

  const lightboxImg = activeSrc
    ? withOptimizer(activeSrc, { width: 2200, quality: 92, format: "auto", sharpen: false })
    : null;

  return (
    <>
      {variant === "plain" ? (
        masonry
      ) : (
        <section className={styles["pg-section"]}>
          <div className={styles["pg-container"]}>{masonry}</div>
        </section>
      )}

      {lightboxImg && (
        <div className={styles.lbBackdrop} onClick={() => setLightboxIndex(null)}>
          <div className={styles.lbModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.lbClose} type="button" onClick={() => setLightboxIndex(null)}>
              ×
            </button>

            <img className={styles.lbImg} src={lightboxImg} alt="" />

            {photos.length > 1 && (
              <>
                <button
                  className={`${styles.lbNav} ${styles.lbPrev}`}
                  type="button"
                  onClick={() => setLightboxIndex((i) => (i === null ? null : Math.max(i - 1, 0)))}
                  disabled={lightboxIndex === 0}
                >
                  ‹
                </button>

                <button
                  className={`${styles.lbNav} ${styles.lbNext}`}
                  type="button"
                  onClick={() => setLightboxIndex((i) => (i === null ? null : Math.min(i + 1, photos.length - 1)))}
                  disabled={lightboxIndex === photos.length - 1}
                >
                  ›
                </button>

                <div className={styles.lbCounter}>
                  {lightboxIndex! + 1}/{photos.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
