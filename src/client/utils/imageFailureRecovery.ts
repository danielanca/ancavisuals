const FAILURE_THRESHOLD = 6;
const failedImages = new Map<string, Set<string>>();
const requestedReloads = new Set<string>();

/** Count each photo once, even when its signed CDN token changes. */
export function recordImageFailure(src: string): void {
  if (!src || typeof window === "undefined") return;
  const page = window.location.pathname;
  let photo: string;
  try {
    const url = new URL(src, window.location.href);
    photo = url.origin + url.pathname;
  } catch { return; }
  const failures = failedImages.get(page) ?? new Set<string>();
  failures.add(photo);
  failedImages.set(page, failures);
  if (failures.size < FAILURE_THRESHOLD || requestedReloads.has(page)) return;
  const key = `image-failure-reload:${page}`;
  try {
    if (sessionStorage.getItem(key)) return;
    // Persist BEFORE reloading. If storage is unavailable, avoid reload loops.
    sessionStorage.setItem(key, "1");
  } catch { return; }
  requestedReloads.add(page);
  window.location.reload();
}

/** Also cover ordinary gallery images, allowing retries/fallbacks time to load. */
export function installImageFailureRecovery(): () => void {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const onError = (event: Event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.retryManaged === "true") return;
    const page = window.location.pathname;
    const src = img.currentSrc || img.src;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (window.location.pathname === page && img.isConnected && img.complete && img.naturalWidth === 0) {
        recordImageFailure(src);
      }
    }, 8000);
    timers.add(timer);
  };
  document.addEventListener("error", onError, true);
  return () => {
    document.removeEventListener("error", onError, true);
    timers.forEach(clearTimeout);
  };
}
