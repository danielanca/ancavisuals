// Ad landings (/oferta/:slug, /p/:slug) must spend their first seconds on what the
// visitor sees. Non-essential work (Firebase sign-in state, internal-traffic tagging)
// waits there until the page has loaded and the browser is idle; elsewhere it runs at once.
const LANDING_PATH = /^\/(?:oferta|p)\//;
const IDLE_TIMEOUT_MS = 3000;

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/** Runs `run` now, or — on a landing — after `load` + idle. Returns a cancel function. */
export function whenLandingSettled(run: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (!LANDING_PATH.test(window.location.pathname)) {
    run();
    return () => {};
  }
  const w = window as IdleWindow;
  let cancelled = false;
  let idleId: number | undefined;
  let timer: number | undefined;
  const go = () => { if (!cancelled) run(); };
  const onLoad = () => {
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(go, { timeout: IDLE_TIMEOUT_MS });
    else timer = window.setTimeout(go, 1500);
  };
  if (document.readyState === "complete") onLoad();
  else window.addEventListener("load", onLoad, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", onLoad);
    if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
    if (timer !== undefined) window.clearTimeout(timer);
  };
}
