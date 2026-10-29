import Lightbox, { useController, useLightboxState } from "yet-another-react-lightbox";
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
};

const pad = (value: number) => String(value).padStart(2, "0");

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

function ViewerChrome({ swipeHint, glows }: { swipeHint: boolean; glows?: string[] }) {
  const { currentIndex, slides } = useLightboxState();
  const { prev, next } = useController();
  const src = lowEndDevice() ? undefined : glows?.[currentIndex];
  return (
    <>
      {src && <div key={src} className="ppl-glow" style={{ backgroundImage: `url("${src}")` }} aria-hidden="true" />}
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
      </div>
      {swipeHint && <span className="ppl-hint" aria-hidden="true">Glisează pentru următoarea</span>}
    </>
  );
}

export default function PortfolioLightbox({ open, index, close, slides, glows, isMobile, swipeHint }: Props) {
  return (
    <Lightbox
      open={open}
      index={index}
      close={close}
      slides={slides}
      plugins={[Zoom]}
      className="ppl"
      carousel={{ finite: true, padding: isMobile ? 0 : 56, spacing: "12%" }}
      controller={{ closeOnPullDown: true, closeOnBackdropClick: true }}
      zoom={{ maxZoomPixelRatio: 2, scrollToZoom: false }}
      animation={{ swipe: 320, fade: 300 }}
      labels={{ Close: "Închide", Previous: "Poza anterioară", Next: "Poza următoare" }}
      render={{
        iconPrev: () => <Chevron left />,
        iconNext: () => <Chevron />,
        iconClose: () => <CloseIcon />,
        buttonZoom: () => null,
        controls: () => <ViewerChrome swipeHint={swipeHint && isMobile} glows={glows} />,
      }}
    />
  );
}
