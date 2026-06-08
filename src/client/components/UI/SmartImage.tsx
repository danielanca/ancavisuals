import React, { useState, useCallback, useRef, Fragment } from "react";

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  /** Show orange dot flag if image > threshold KB. Parent must have position:relative. */
  showSizeFlag?: boolean;
  flagThresholdKb?: number;
}

// Convert photos/ URL → photos_preview/ WebP
export function toPreviewUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.pathname.includes("/photos/")) return null;
    const path = u.pathname
      .replace("/photos/", "/photos_preview/")
      .replace(/\.(jpg|jpeg|png)$/i, ".webp");
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return null;
  }
}

export function isPreviewUrl(url: string): boolean {
  return url.includes("/photos_preview/") || /\.webp(\?|$)/i.test(url);
}

function getTransferSize(url: string): number {
  try {
    const entries = performance.getEntriesByName(url, "resource") as PerformanceResourceTiming[];
    if (!entries.length) return 0;
    const last = entries[entries.length - 1];
    return last.transferSize || last.encodedBodySize || 0;
  } catch {
    return 0;
  }
}

export default function SmartImage({
  src,
  showSizeFlag = true,
  flagThresholdKb = 200,
  ...imgProps
}: SmartImageProps) {
  const threshold = flagThresholdKb * 1024;
  const preview = !isPreviewUrl(src) ? toPreviewUrl(src) : null;

  const [activeSrc, setActiveSrc] = useState<string>(preview ?? src);
  const [usedFallback, setUsedFallback] = useState(false);
  const [isHeavy, setIsHeavy] = useState(false);

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (showSizeFlag) {
      setTimeout(() => {
        const loadedSrc = (e.target as HTMLImageElement).src;
        const size = getTransferSize(loadedSrc);
        setIsHeavy(size > 0 && size > threshold);
      }, 150);
    }
    imgProps.onLoad?.(e);
  }, [showSizeFlag, threshold, imgProps.onLoad]);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (preview && !usedFallback && activeSrc === preview) {
      setUsedFallback(true);
      setActiveSrc(src);
    }
    imgProps.onError?.(e);
  }, [preview, usedFallback, activeSrc, src, imgProps.onError]);

  return (
    <Fragment>
      <img
        {...imgProps}
        src={activeSrc}
        onLoad={handleLoad}
        onError={handleError}
      />
      {isHeavy && showSizeFlag && (
        <span
          title={`Imagine ${flagThresholdKb}KB+ — fără versiune optimizată`}
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#f97316",
            boxShadow: "0 0 0 1.5px rgba(0,0,0,0.7), 0 0 4px rgba(249,115,22,0.6)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}
    </Fragment>
  );
}
