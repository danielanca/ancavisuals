import { useEffect, useMemo, useRef, useState } from "react";
import { FixedSizeGrid as Grid } from "react-window";
import styles from "./BunnyPhotoGallery.module.scss";
import { buildSeoImageAlt, getCatalogImageAlt } from "../../utils/imageAlt";

type Props = {
  orgPhoto: string[];
  photos: string[];
  variant?: "section" | "plain";
  selectable?: boolean;
  selected?: Set<string>;
  getKey?: (src: string) => string;
  onToggle?: (src: string) => void;
  onPhotoClick?: (src: string) => void;
  virtualized?: boolean;
  scrollable?: boolean;
  mobileColumns?: 1 | 2;
  altBase?: string;
  protectImages?: boolean;
  onProtectedContextMenu?: () => void;
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
    const element = ref.current;
    if (!element) return;
    if (typeof ResizeObserver === "undefined") return;

    const resizeObserver = new ResizeObserver(entries => {
      const contentRect = entries[0]?.contentRect;
      if (!contentRect) return;
      setSize({ width: Math.floor(contentRect.width), height: Math.floor(contentRect.height) });
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  return { ref, size };
};

export default function BunnyPhotoGallery({
  orgPhoto,
  photos,
  variant = "section",
  selectable = false,
  selected,
  getKey,
  onToggle,
  onPhotoClick,
  virtualized = false,
  scrollable = false,
  mobileColumns,
  altBase = "fotograf videograf eveniment Anca Visuals",
  protectImages = false,
  onProtectedContextMenu,
}: Props) {
  const [visible, setVisible] = useState(90);
  const [isMobile, setIsMobile] = useState(isMobileNow());

  const { ref: viewportRef, size } = useElementSize();

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const onChange = () => setIsMobile(mediaQuery.matches);
    onChange();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setVisible(90);
  }, [photos]);

  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

  const thumbQ = selectable ? (isMobile ? 74 : 76) : isMobile ? 78 : 80;

  const columnCount = useMemo(() => {
    if (isMobile) return mobileColumns ?? 2;
    return 4;
  }, [isMobile, mobileColumns]);

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
  const masonryColumns = useMemo(() => {
    const cols = Array.from({ length: Math.max(1, columnCount) }, () => [] as Array<{ src: string; index: number }>);
    visiblePhotos.forEach((src, index) => {
      cols[index % Math.max(1, columnCount)].push({ src, index });
    });
    return cols;
  }, [visiblePhotos, columnCount]);

  const renderThumbImg = (src: string, sizes: string, maxW: number, index?: number) => {
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
        alt={getCatalogImageAlt(src, buildSeoImageAlt(altBase, index))}
        {...(protectImages ? {
          draggable: false,
          onContextMenu: (e) => { e.preventDefault(); onProtectedContextMenu?.(); },
          style: { WebkitTouchCallout: "none" as React.CSSProperties["WebkitTouchCallout"], userSelect: "none" },
        } : {})}
      />
    );
  };

  const renderItem = (src: string, index: number) => {
    const key = getKey ? getKey(src) : src;
    const isOn = selectable && selected ? selected.has(key) : false;
    const downloadSrc = orgPhoto[index] ?? src;

    const cls = [styles["pg-item"], selectable ? styles["pg-itemSelectable"] : "", isOn ? styles["pg-itemOn"] : ""]
      .filter(Boolean)
      .join(" ");

    const sizes = isMobile ? "50vw" : "20vw";

    return (
      <button
        key={src}
        className={cls}
        type="button"
        data-photo-src={src}
        {...(protectImages && index === 0 ? { 'data-onboarding': 'photo' } : {})}
        onClick={() => {
          if (selectable) {
            onToggle?.(src);
            return;
          }
          onPhotoClick?.(src);
        }}
      >
        {selectable && <div className={styles["pg-check"]}>{isOn ? "✓" : ""}</div>}
        {!selectable && (
          <button
            type="button"
            className={styles["pg-downloadBtn"]}
            aria-label="Descarcă poza"
            onClick={async (event) => {
              event.stopPropagation();
              const fileName = downloadSrc.split("?")[0].split("/").pop() ?? "photo.jpg";
              try {
                const response = await fetch(downloadSrc);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = blobUrl;
                anchor.download = fileName;
                anchor.click();
                URL.revokeObjectURL(blobUrl);
              } catch {
                window.open(downloadSrc, "_blank");
              }
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="M7 10l5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </button>
        )}
        {renderThumbImg(src, sizes, 720, index)}
        {!selectable && (
          <svg className={styles["pg-eye"]} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    );
  };

  const masonry = (
    <div className={styles.pgColumns}>
      {masonryColumns.map((column, columnIndex) => (
        <div key={columnIndex} className={styles.pgColumn}>
          {column.map((item) => renderItem(item.src, item.index))}
        </div>
      ))}
    </div>
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
                  data-photo-src={src}
                  onClick={() => {
                    if (selectable) {
                      onToggle?.(src);
                      return;
                    }
                    onPhotoClick?.(src);
                  }}
                  onContextMenu={protectImages ? (e) => { e.preventDefault(); onProtectedContextMenu?.(); } : undefined}
                >
                  {selectable && <div className={styles["pg-check"]}>{isOn ? "✓" : ""}</div>}
                  {renderThumbImg(src, sizes, 720, index)}
                </button>
              </div>
            );
          }}
        </Grid>
      )}
    </div>
  );

  const content = canVirtual ? virtualGrid : masonry;

  return variant === "plain" ? (
    content
  ) : (
    <section className={styles["pg-section"]}>
      <div className={styles["pg-container"]}>{content}</div>
    </section>
  );
}
