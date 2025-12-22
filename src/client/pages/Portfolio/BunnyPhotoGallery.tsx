import { useEffect, useMemo, useRef, useState } from "react";
import { FixedSizeGrid as Grid } from "react-window";
import styles from "./BunnyPhotoGallery.module.scss";

type Props = {
  photos: string[];
  variant?: "section" | "plain";
  selectable?: boolean;
  selected?: Set<string>;
  getKey?: (src: string) => string;
  onToggle?: (src: string) => void;
  virtualized?: boolean;
  scrollable?: boolean;
};

type ImgFormat = "webp" | "jpeg" | "png" | "avif" | "auto";

const withOptimizer = (
  src: string,
  opts: { width?: number; height?: number; quality?: number; format?: ImgFormat; sharpen?: boolean },
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

const useElementSize = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(entries => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ width: Math.floor(cr.width), height: Math.floor(cr.height) });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
};

export default function BunnyPhotoGallery({
  photos,
  variant = "section",
  selectable = false,
  selected,
  getKey,
  onToggle,
  virtualized = false,
  scrollable = false,
}: Props) {
  const [visible, setVisible] = useState(90);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(isMobileNow());

  const { ref: viewportRef, size } = useElementSize();

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
      if (e.key === "ArrowRight") setLightboxIndex(i => (i === null ? null : Math.min(i + 1, photos.length - 1)));
      if (e.key === "ArrowLeft") setLightboxIndex(i => (i === null ? null : Math.max(i - 1, 0)));
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxIndex, photos.length]);

  const openLightboxByIndex = (idx: number) => {
    if (idx < 0 || idx >= photos.length) return;
    setLightboxIndex(idx);
  };

  const openLightbox = (src: string) => {
    const idx = photos.indexOf(src);
    if (idx >= 0) setLightboxIndex(idx);
  };

  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

  const thumbQ = selectable ? (isMobile ? 74 : 76) : isMobile ? 78 : 80;

  const columnCount = useMemo(() => {
    if (isMobile) return 2;
    const w = size.width;
    if (w >= 1100) return 5;
    if (w >= 900) return 4;
    if (w >= 640) return 3;
    return 2;
  }, [isMobile, size.width]);

  const gap = 16;

  const tileW = useMemo(() => {
    if (size.width <= 0) return 0;
    return Math.max(140, Math.floor((size.width - gap * (columnCount - 1)) / columnCount));
  }, [size.width, columnCount]);

  const tileH = useMemo(() => {
    if (tileW <= 0) return 0;
    const ratio = isMobile ? 0.82 : 0.75;
    return Math.floor(tileW * ratio);
  }, [tileW, isMobile]);

  const colW = tileW > 0 ? tileW + gap : 0;
  const rowH = tileH > 0 ? tileH + gap : 0;

  const rowCount = useMemo(() => Math.ceil(photos.length / Math.max(1, columnCount)), [photos.length, columnCount]);

  const canVirtual = virtualized && scrollable && size.width > 0 && size.height > 0 && tileW > 0 && tileH > 0;

  const visiblePhotos = useMemo(() => photos.slice(0, visible), [photos, visible]);

  const renderThumbImg = (src: string, sizes: string, maxW: number) => {
    const w1 = Math.min(maxW, Math.max(280, Math.round(tileW * dpr)));
    const w2 = Math.min(maxW * 2, w1 * 2);

    const src1 = withOptimizer(src, { width: w1, quality: thumbQ, format: "webp", sharpen: false });
    const src2 = withOptimizer(src, { width: w2, quality: thumbQ, format: "webp", sharpen: false });

    return (
      <img
        className={styles["pg-img"]}
        src={src1}
        srcSet={`${src1} ${w1}w, ${src2} ${w2}w`}
        sizes={sizes}
        loading="lazy"
        decoding="async"
        alt=""
      />
    );
  };

  const renderItem = (src: string) => {
    const key = getKey ? getKey(src) : src;
    const isOn = selectable && selected ? selected.has(key) : false;

    const cls = [styles["pg-item"], selectable ? styles["pg-itemSelectable"] : "", isOn ? styles["pg-itemOn"] : ""]
      .filter(Boolean)
      .join(" ");

    const sizes = isMobile ? "50vw" : "20vw";

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
        {renderThumbImg(src, sizes, 720)}
      </button>
    );
  };

  const getColCount = () => {
    if (typeof window === "undefined") return 2;
    if (window.matchMedia("(min-width: 1024px)").matches) return 4;
    if (window.matchMedia("(min-width: 640px)").matches) return 3;
    return 2;
  };

  const [colCount, setColCount] = useState(getColCount());

  useEffect(() => {
    const mq640 = window.matchMedia("(min-width: 640px)");
    const mq1024 = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setColCount(getColCount());

    onChange();
    mq640.addEventListener("change", onChange);
    mq1024.addEventListener("change", onChange);

    return () => {
      mq640.removeEventListener("change", onChange);
      mq1024.removeEventListener("change", onChange);
    };
  }, []);

  const columns = useMemo(() => {
    const cols = Array.from({ length: colCount }, () => [] as string[]);
    for (let i = 0; i < visiblePhotos.length; i += 1) {
      cols[i % colCount].push(visiblePhotos[i]);
    }
    return cols;
  }, [visiblePhotos, colCount]);

  const masonry = (
    <>
      <div className={styles.pgColumns}>
        {columns.map((col, idx) => (
          <div key={idx} className={styles.pgColumn}>
            {col.map(renderItem)}
          </div>
        ))}
      </div>
    </>
  );

  const virtualGrid = (
    <div className={styles.pgViewport} ref={viewportRef}>
      {canVirtual && (
        <Grid
          className={styles.pgWindow}
          columnCount={columnCount}
          columnWidth={colW}
          height={size.height}
          rowCount={rowCount}
          rowHeight={rowH}
          width={size.width}
          overscanRowCount={4}
        >
          {({ columnIndex, rowIndex, style }) => {
            const index = rowIndex * columnCount + columnIndex;
            if (index >= photos.length) return null;

            const src = photos[index];
            const key = getKey ? getKey(src) : src;
            const isOn = selectable && selected ? selected.has(key) : false;

            const cls = [
              styles["pg-item"],
              styles["pg-itemGrid"],
              selectable ? styles["pg-itemSelectable"] : "",
              isOn ? styles["pg-itemOn"] : "",
            ]
              .filter(Boolean)
              .join(" ");

            const cellStyle = {
              ...style,
              width: colW,
              height: rowH,
            } as React.CSSProperties;

            const sizes = isMobile ? "50vw" : "20vw";

            return (
              <div style={cellStyle} className={styles.pgCell}>
                <button
                  className={cls}
                  type="button"
                  style={{ width: tileW, height: tileH }}
                  onClick={() => {
                    if (selectable) {
                      onToggle?.(src);
                      return;
                    }
                    openLightboxByIndex(index);
                  }}
                >
                  {selectable && <div className={styles["pg-check"]}>{isOn ? "✓" : ""}</div>}
                  {renderThumbImg(src, sizes, 720)}
                </button>
              </div>
            );
          }}
        </Grid>
      )}
    </div>
  );

  const activeSrc = lightboxIndex === null ? null : photos[lightboxIndex] ?? null;

  const lightboxImg = activeSrc
    ? withOptimizer(activeSrc, { width: 1600, quality: 86, format: "auto", sharpen: false })
    : null;

  const content = canVirtual ? virtualGrid : masonry;

  return (
    <>
      {variant === "plain" ? (
        content
      ) : (
        <section className={styles["pg-section"]}>
          <div className={styles["pg-container"]}>{content}</div>
        </section>
      )}

      {lightboxImg && (
        <div className={styles.lbBackdrop} onClick={() => setLightboxIndex(null)}>
          <div className={styles.lbModal} onClick={e => e.stopPropagation()}>
            <button className={styles.lbClose} type="button" onClick={() => setLightboxIndex(null)}>
              ×
            </button>

            <img className={styles.lbImg} src={lightboxImg} alt="" />

            {photos.length > 1 && (
              <>
                <button
                  className={`${styles.lbNav} ${styles.lbPrev}`}
                  type="button"
                  onClick={() => setLightboxIndex(i => (i === null ? null : Math.max(i - 1, 0)))}
                  disabled={lightboxIndex === 0}
                >
                  ‹
                </button>

                <button
                  className={`${styles.lbNav} ${styles.lbNext}`}
                  type="button"
                  onClick={() => setLightboxIndex(i => (i === null ? null : Math.min(i + 1, photos.length - 1)))}
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
