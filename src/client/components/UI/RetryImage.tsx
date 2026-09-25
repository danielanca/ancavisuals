import { useRef, useState, type ImgHTMLAttributes } from "react";

import { recordImageFailure } from "../../utils/imageFailureRecovery";

// Fires a single retry a few seconds after a failed load (CDN hiccup /
// propagation delay), and only reports+gives up if the retry also fails —
// avoids flooding monitoring with one-off network blips.
export function reportBrokenImage(url: string, context?: string) {
  try {
    fetch("/api/monitoring/client-error", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `[IMAGE LOAD FAILED] ${url}`,
        stack: context ? `Context: ${context}` : "",
        page: window.location.pathname,
      }),
    }).catch(() => {});
  } catch {
    // ignore — best-effort reporting only
  }
  recordImageFailure(url);
}

interface RetryImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "onError"> {
  src: string;
  retryDelayMs?: number;
  context?: string;
  onGiveUp?: (src: string) => void;
}

export default function RetryImage({ src, retryDelayMs = 3500, context, onGiveUp, ...imgProps }: RetryImageProps) {
  const [attempt, setAttempt] = useState(0);
  const [dead, setDead] = useState(false);
  const retriedRef = useRef(false);

  if (dead) return null;

  const effectiveSrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}_retry=${attempt}`;

  return (
    <img
      {...imgProps}
      src={effectiveSrc}
      data-retry-managed="true"
      onError={() => {
        if (!retriedRef.current) {
          retriedRef.current = true;
          window.setTimeout(() => setAttempt((a) => a + 1), retryDelayMs);
          return;
        }
        setDead(true);
        reportBrokenImage(src, context);
        onGiveUp?.(src);
      }}
    />
  );
}
