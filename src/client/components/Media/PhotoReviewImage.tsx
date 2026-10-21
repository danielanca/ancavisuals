import { useState, type ReactNode } from "react";
import PhotoLightbox from "../../pages/MediaDownload/PhotoLightbox";
import styles from "./PhotoReviewGallery.module.scss";

type Props = {
  src: string; original: string; alt: string; enabled: boolean; busy?: boolean;
  onAccept?: () => void; onReject?: () => void;
  /** Badges / overlays laid over the photo itself (never over the buttons, which sit under it on phones). */
  children?: ReactNode;
};
export default function PhotoReviewImage({ src, original, alt, enabled, busy, onAccept, onReject, children }: Props) {
  const [viewing, setViewing] = useState(false);
  return (
    <>
      <div className={styles.photo}>
        <div className={styles.frame}>
          <img src={src} alt={alt} loading="lazy" className={styles.image}
            onError={event => { if (event.currentTarget.getAttribute("src") !== original) event.currentTarget.src = original; }} />
          {children}
        </div>
        {enabled && <div className={styles.actions}>
          {onAccept && <button type="button" aria-label={`Acceptă ${alt}`} disabled={busy} onClick={onAccept} className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40">Acceptă</button>}
          {onReject && <button type="button" aria-label={`Respinge ${alt}`} disabled={busy} onClick={onReject} className="bg-red-800 hover:bg-red-700 disabled:opacity-40">Respinge</button>}
          <button type="button" aria-label={`Vizualizează ${alt}`} onClick={() => setViewing(true)} className="bg-neutral-800 hover:bg-neutral-700">Vizualizează toată poza</button>
        </div>}
      </div>
      {viewing && <PhotoLightbox photos={[original]} currentIndex={0} onClose={() => setViewing(false)} onNext={() => {}} onPrev={() => {}} protectImages />}
    </>
  );
}
