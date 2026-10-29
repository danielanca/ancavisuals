import Lightbox, { ImageSlide, useController, useLightboxState, type RenderSlideProps, type SlotStyles } from "yet-another-react-lightbox";
import { useEffect, useLayoutEffect, useState } from "react";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "./PortfolioLightbox.scss";

// The full-screen photo viewer of the gallery (owner, 2026-10-29: "a nice, creative first
// impression on phones"): the photo edge to edge on a blurred glow of itself, square hairline
// buttons, a "03 / 24" counter; on phones the arrows sit under the photo next to the counter
// (the thumb reaches them), swipe and pinch-to-zoom work, pulling down closes it.

type Props = {
  open: boolean;
  index: number;
  close: () => void;
  slides: { src: string }[];
  /** The small gallery copy of each photo: what the glow behind it is blurred from. */
  glows?: string[];
  isMobile: boolean;
  /** First photo opened in this visit: a short "swipe" hint on phones. */
  swipeHint: boolean;
  selectedPrint?: Set<string>;
  onTogglePrint?: (fileName: string) => void;
  getFileName?: (src: string, index: number) => string;
  downloadHint?: boolean;
};

const pad = (value: number) => String(value).padStart(2, "0");

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// A mobile page can overflow its layout viewport (399px) while only 366px is
// visible. Fixed right:0 then clips controls. Size the portal to the visual viewport.
function useVisibleViewport(open: boolean) {
  const [bounds, setBounds] = useState<SlotStyles["root"]>();
  useBrowserLayoutEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const update = () => setBounds({
      position: "fixed",
      left: viewport?.offsetLeft ?? 0,
      top: viewport?.offsetTop ?? 0,
      width: viewport?.width ?? document.documentElement.clientWidth,
      height: viewport?.height ?? window.innerHeight,
      right: "auto",
      bottom: "auto",
    });
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open]);
  return bounds;
}

function Chevron({ left }: { left?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square">
      <path d={left ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// Phones with little memory (deviceMemory is Chrome-only; elsewhere the glow stays) skip the glow.
const lowEndDevice = () => typeof navigator !== "undefined" && ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 2;

/** Drawn inside the viewer: the glow behind the photo, the counter and (on phones) the arrows. */

function ViewerChrome({
  swipeHint,
  glows,
  selectedPrint,
  onTogglePrint,
  getFileName,
  downloadHint,
}: {
  swipeHint: boolean;
  glows?: string[];
  selectedPrint?: Set<string>;
  onTogglePrint?: (fileName: string) => void;
  getFileName?: (src: string, index: number) => string;
  downloadHint?: boolean;
}) {
  const { currentIndex, slides } = useLightboxState();
  const { prev, next } = useController();
  const src = lowEndDevice() ? undefined : glows?.[currentIndex];
  const currentSrc = slides[currentIndex]?.src ?? "";
  const currentFileName = getFileName ? getFileName(currentSrc, currentIndex) : currentSrc;
  const isInPrint = selectedPrint?.has(currentFileName) ?? false;
  return (
    <>
      {src && <div key={src} className="ppl-glow" style={{ backgroundImage: `url("${src}")` }} aria-hidden="true" />}
      <div className="ppl-brand" aria-label="Anca Visuals">
        <span className="ppl-brand__strong">Anca</span>
        <span className="ppl-brand__light">Visuals</span>
      </div>
      <button type="button" className="ppl-side-step ppl-side-step--prev" onClick={() => prev()} disabled={currentIndex === 0} aria-label="Poza anterioară">
        <Chevron left />
      </button>
      <button type="button" className="ppl-side-step ppl-side-step--next" onClick={() => next()} disabled={currentIndex >= slides.length - 1} aria-label="Poza următoare">
        <Chevron />
      </button>
      <div className="ppl-bar">
        <button type="button" className="ppl-step" onClick={() => prev()} disabled={currentIndex === 0} aria-label="Poza anterioară">
          <Chevron left />
        </button>
        <span className="ppl-count" aria-live="polite">
          <strong>{pad(currentIndex + 1)}</strong>
          <span className="ppl-count-line" aria-hidden="true" />
          {pad(slides.length)}
        </span>
        <button type="button" className="ppl-step" onClick={() => next()} disabled={currentIndex >= slides.length - 1} aria-label="Poza următoare">
          <Chevron />
        </button>
        {onTogglePrint && <button
          type="button"
          className={`ppl-print${isInPrint ? " ppl-print--active" : ""}`}
          onClick={() => onTogglePrint(currentFileName)}
          aria-label={isInPrint ? "Elimină din imprimare" : "Adaugă la imprimare"}
          title={isInPrint ? "Elimină din imprimare" : "Adaugă la imprimare"}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          <span>{isInPrint ? "Elimină" : "Imprimă"}</span>
        </button>}
      </div>
      {swipeHint && <span className="ppl-hint" aria-hidden="true">Glisează pentru următoarea</span>}
      {downloadHint && currentIndex === 0 && <div className="ppl-download-hint" aria-live="polite">
        <span>DESCĂRCAȚI POZELE FOLOSIND BUTONUL</span>
        <strong aria-hidden="true">↓</strong>
      </div>}
    </>
  );
}

function ViewerSlide({ slide, offset, rect, downloadHint }: RenderSlideProps & { downloadHint: boolean }) {
  const { currentIndex } = useLightboxState();
  const blur = downloadHint && currentIndex === 0 && offset === 0;
  return <ImageSlide
    slide={slide}
    offset={offset}
    rect={rect}
    imageProps={blur ? { className: "ppl-first-blur-image" } : undefined}
  />;
}

export default function PortfolioLightbox({ open, index, close, slides, glows, isMobile, swipeHint, selectedPrint, onTogglePrint, getFileName, downloadHint = false }: Props) {
  const viewportBounds = useVisibleViewport(open);
  const [mobileLayout, setMobileLayout] = useState(isMobile);

  useEffect(() => {
    const updateLayout = () => {
      const matches = typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 639px)").matches
        : isMobile || window.innerWidth < 640;
      setMobileLayout(matches);
    };
    updateLayout();
    window.addEventListener("resize", updateLayout, { passive: true });
    window.addEventListener("orientationchange", updateLayout, { passive: true });
    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("orientationchange", updateLayout);
    };
  }, []);

  return (
    <Lightbox
      open={open}
      index={index}
      close={close}
      slides={slides}
      plugins={[Zoom]}
      className="ppl"
      styles={{ root: viewportBounds }}
      carousel={{ finite: true, padding: mobileLayout ? 0 : 56, spacing: "12%" }}
      controller={{ closeOnPullDown: true, closeOnBackdropClick: true }}
      zoom={{ maxZoomPixelRatio: 2, scrollToZoom: false }}
      animation={{ swipe: 320, fade: 300 }}
      labels={{ Close: "Închide", Previous: "Poza anterioară", Next: "Poza următoare" }}
      render={{
        iconPrev: () => <Chevron left />,
        iconNext: () => <Chevron />,
        iconClose: () => <CloseIcon />,
        buttonZoom: () => null,
        slide: (props) => <ViewerSlide {...props} downloadHint={downloadHint} />,
        controls: () => <ViewerChrome
            swipeHint={swipeHint && mobileLayout}
            glows={glows}
            selectedPrint={selectedPrint}
            onTogglePrint={onTogglePrint}
            getFileName={getFileName}
            downloadHint={downloadHint}
          />,
      }}
    />
  );
}
