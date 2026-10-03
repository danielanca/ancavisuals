import { ScrollTrigger } from "gsap/ScrollTrigger";

const isEditing = () => document.activeElement?.matches("input, textarea, select, [contenteditable='true']");
let users = 0;
let pending = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let teardown: (() => void) | undefined;
const release = () => { if (--users === 0) { teardown?.(); teardown = undefined; } };

/** A refresh temporarily resets window scroll; never do that during form entry. */
export function refreshGalleryScroll() {
  if (isEditing()) { pending = true; return; }
  pending = false;
  ScrollTrigger.refresh();
}

export function installGalleryScrollRefresh() {
  if (++users > 1) return release;
  // Own these events so keyboard height changes cannot trigger a global refresh.
  ScrollTrigger.config({ autoRefreshEvents: "none" });
  let width = window.innerWidth;
  let height = window.innerHeight;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(refreshGalleryScroll, 300);
  };
  const resize = () => {
    const widthChanged = width !== window.innerWidth;
    const heightChanged = height !== window.innerHeight;
    width = window.innerWidth;
    height = window.innerHeight;
    const touch = window.matchMedia("(any-pointer: coarse)").matches;
    // Keyboard and browser chrome change only height. Rotation still refreshes.
    if (widthChanged || (heightChanged && !touch)) schedule();
  };
  const blur = () => { if (pending) schedule(); };
  const visibility = () => { if (!document.hidden) schedule(); };
  window.addEventListener("resize", resize);
  window.addEventListener("load", schedule);
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("focusout", blur);
  teardown = () => {
    clearTimeout(timer);
    pending = false;
    window.removeEventListener("resize", resize);
    window.removeEventListener("load", schedule);
    document.removeEventListener("visibilitychange", visibility);
    document.removeEventListener("focusout", blur);
    ScrollTrigger.config({ autoRefreshEvents: "visibilitychange,DOMContentLoaded,load,resize" });
  };
  return release;
}
