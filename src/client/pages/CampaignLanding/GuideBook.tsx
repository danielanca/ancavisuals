import React, { useEffect, useRef, useState } from "react";

// The real table of contents of Ghidul-Mirilor.pdf.
const CHAPTERS = [
  "Primii pași",
  "Furnizorii și ordinea rezervărilor",
  "Actele pentru cununie",
  "Calendarul, lună cu lună",
  "Lista miresei & a mirelui",
  "Desfășurătorul zilei",
  "Sfaturi pentru poze și film",
  "Trusa de urgență",
  "După nuntă",
];

const CHAPTER_STEP_MS = 650;
const PAGES_IN_MS = 450 + CHAPTERS.length * 70 + 300; // cover swing + contents fading in
const REOPEN_AFTER_MS = 15_000;

const STYLES = `
  @keyframes guideBookFloat {
    0%, 100% { transform: translateY(0) rotate(-2deg); }
    50% { transform: translateY(-8px) rotate(-1deg); }
  }
  .guide-book { perspective: 1400px; }
  .guide-book__body {
    position: relative; transform-style: preserve-3d;
    transition: transform 900ms cubic-bezier(.2,.8,.2,1);
    animation: guideBookFloat 5s ease-in-out infinite;
  }
  .guide-book--open .guide-book__body { animation: none; transform: translateX(22%) rotate(0deg); }
  .guide-book__cover {
    position: absolute; inset: 0; transform-origin: left center; transform-style: preserve-3d;
    transition: transform 1100ms cubic-bezier(.2,.8,.2,1);
  }
  .guide-book--open .guide-book__cover { transform: rotateY(-158deg); }
  .guide-book__face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
  .guide-book__inside { transform: rotateY(180deg); }
  .guide-book__page li { opacity: 0; transform: translateX(-6px); transition: opacity 400ms ease, transform 400ms ease; }
  .guide-book--open .guide-book__page li { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) {
    .guide-book__body, .guide-book__cover, .guide-book__page li { animation: none !important; transition: none !important; }
  }
`;

/** Decorative book: opens on its own while in view (or on hover/click), walks its contents, closes, repeats every 15s. Downloading happens only from the section's button. */
export default function GuideBook() {
  const ref = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);
  // A click opens it right away (no dwell wait) or restarts the walk; it never downloads.
  const [clicks, setClicks] = useState(0);

  // Desktop: opens once the visitor lingers on the section, closes when they scroll away.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(max-width: 767px)").matches) return; // phones: stays closed unless tapped
    let timer: number | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      window.clearTimeout(timer);
      if (entry.isIntersecting) timer = window.setTimeout(() => setInView(true), 600);
      else { setInView(false); setClicks(0); }
    }, { threshold: 0.6 });
    observer.observe(el);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, []);

  const hoveredRef = useRef(false);
  hoveredRef.current = hovered;
  const active = hovered || inView || clicks > 0;
  const [open, setOpen] = useState(false);
  const [activeChapter, setActiveChapter] = useState(-1);

  // While the visitor is on the section: open, walk the contents once (one bold line
  // at a time), close, wait 15s, repeat. Stays open while the mouse is on the book.
  useEffect(() => {
    setActiveChapter(-1);
    if (!active) { setOpen(false); return; }
    setOpen(true);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)); };
    const run = () => {
      setOpen(true);
      let at = PAGES_IN_MS;
      CHAPTERS.forEach((_, i) => { later(() => setActiveChapter(i), at); at += CHAPTER_STEP_MS; });
      later(() => {
        setActiveChapter(-1);
        if (!hoveredRef.current) setOpen(false);
      }, at);
      later(run, at + REOPEN_AFTER_MS);
    };
    run();
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [active, clicks]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => setClicks((n) => n + 1)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Răsfoiește Ghidul Mirilor"
      className={`guide-book mx-auto block w-full max-w-[250px] cursor-pointer text-left ${open ? "guide-book--open" : ""}`}
    >
      <style>{STYLES}</style>
      <div className="guide-book__body aspect-[3/4]">
        {/* First page, revealed when the cover opens */}
        <div className="guide-book__page absolute inset-0 rounded-r-lg bg-[#fffdf8] px-5 py-6 text-left shadow-[0_25px_50px_-12px_rgba(47,42,36,0.45)] ring-1 ring-[#2f2a24]/10">
          <p className="text-[9px] uppercase tracking-[0.3em] text-[#8a6d3b]">Cuprins</p>
          <ol className="mt-3 space-y-1.5">
            {CHAPTERS.map((chapter, i) => (
              <li key={chapter} className={`flex gap-2 text-[11px] leading-tight text-[#2f2a24] ${activeChapter === i ? "font-bold" : ""}`} style={{ transitionDelay: open ? `${450 + i * 70}ms` : "0ms" }}>
                <span className={`w-4 shrink-0 font-serif ${activeChapter === i ? "text-[#8a6d3b]" : "text-[#b8955a]"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span>{chapter}</span>
              </li>
            ))}
          </ol>
          <p className="absolute bottom-4 left-5 right-5 border-t border-[#b8955a]/40 pt-2 text-[10px] font-semibold text-[#8a6d3b]">15 pagini · PDF gratuit</p>
        </div>

        {/* Cover: front face + inside of the cover */}
        <div className="guide-book__cover">
          <div className="guide-book__face rounded-r-lg rounded-l-sm bg-gradient-to-br from-[#fffdf8] to-[#efe6d4] p-6 shadow-[0_25px_50px_-12px_rgba(47,42,36,0.45)] ring-1 ring-[#2f2a24]/10">
            <div className="absolute inset-y-0 left-0 w-3 rounded-l-sm bg-gradient-to-r from-[#2f2a24]/15 to-transparent" />
            <div className="flex h-full flex-col items-center justify-between border border-[#b8955a]/40 px-3 py-5 text-center">
              <p className="text-[8px] uppercase tracking-[0.35em] text-[#8a6d3b]">Un ghid pentru viitorii miri</p>
              <div>
                <p className="font-serif text-4xl leading-none text-[#2f2a24]">Ghidul</p>
                <p className="font-serif text-4xl italic leading-tight text-[#8a6d3b]">Mirilor</p>
                <div className="mx-auto my-3 h-px w-10 bg-[#b8955a]" />
                <p className="text-[11px] leading-snug text-[#5c5348]">Tot ce e bine să știți pentru o nuntă frumoasă, liniștită și fără griji</p>
              </div>
              <p className="text-[8px] uppercase tracking-[0.35em] text-[#2f2a24]/70">Anca Visuals</p>
            </div>
            <span className="absolute -right-3 -top-3 rounded-full bg-amber-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-950 shadow-md">Gratuit</span>
          </div>
          <div className="guide-book__face guide-book__inside rounded-l-lg bg-gradient-to-bl from-[#e9dfcb] to-[#d9cbb0] p-6">
            <div className="flex h-full items-center justify-center border border-[#b8955a]/30">
              <p className="px-4 text-center font-serif text-sm italic text-[#5c5348]">„Ziua aceasta este despre voi doi.”</p>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
