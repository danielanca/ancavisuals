/**
 * `--stable-vh`: 1% of the screen height, measured once and updated only when the width changes
 * (rotation). On phones the keyboard and the browser's bottom bar change the viewport height —
 * in-app browsers (Facebook, Instagram) and Samsung/Firefox even change `vh` — so sections sized
 * in `vh` above a form shrink/grow while the visitor types and push the focused field away.
 * Use `stableVh(85)` / `calc(var(--stable-vh,1vh)*85)` instead of `85vh` for such sections.
 */
export const stableVh = (n: number) => `calc(var(--stable-vh, 1vh) * ${n})`;

export function installStableViewport() {
  const root = document.documentElement;
  let width = -1;
  const update = () => {
    if (window.innerWidth === width) return;
    width = window.innerWidth;
    root.style.setProperty("--stable-vh", `${window.innerHeight / 100}px`);
  };
  update();
  window.addEventListener("resize", update);
  return () => window.removeEventListener("resize", update);
}
