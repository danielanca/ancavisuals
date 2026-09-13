/**
 * Events that count as a real human touching the page — a click, a scroll,
 * a key press, a touch, cursor movement. A backgrounded or silently
 * reloaded tab (iOS refreshing a saved tab, a browser relaunch flashing the
 * last-active tab, a prefetch) can never produce any of these, so waiting
 * for one before treating a page load as "a visit" filters those out
 * completely — no timing guesswork needed.
 */
const INTERACTION_EVENTS = ["click", "scroll", "keydown", "touchstart", "mousedown", "mousemove"] as const;

/**
 * Calls `fire` exactly once, the first time the visitor genuinely interacts
 * with the page — anywhere on the site, any kind of interaction. Every
 * "someone is on the site" signal (view emails, live-panel events, the
 * pageview counter) should be built on this, so a page nobody actually
 * touched never counts as a visit.
 *
 * Returns a cleanup function that removes the listeners without firing —
 * call it from the effect's cleanup if the component unmounts (route
 * change, etc.) before any interaction happens.
 */
export function whenVisitorInteracts(fire: () => void): () => void {
  let done = false;
  const handler = () => {
    if (done) return;
    done = true;
    cleanup();
    fire();
  };
  const cleanup = () => {
    INTERACTION_EVENTS.forEach((ev) => window.removeEventListener(ev, handler, true));
  };
  INTERACTION_EVENTS.forEach((ev) => window.addEventListener(ev, handler, { capture: true, passive: true }));
  return cleanup;
}
