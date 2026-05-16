import { useEffect, useRef, useCallback } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import styles from './PhotoLightbox.module.scss';

type PhotoLightboxProps = {
  photos: string[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  selectedPrint?: Set<string>;
  onTogglePrint?: (fileName: string) => void;
  getFileName?: (src: string, index: number) => string;
};

const SWIPE_THRESHOLD = 50;

export default function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  selectedPrint,
  onTogglePrint,
  getFileName,
}: PhotoLightboxProps) {
  useBodyScrollLock(true);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const mouseStartXRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const currentSrc = photos[currentIndex];
  const currentFileName = getFileName ? getFileName(currentSrc, currentIndex) : currentSrc;
  const isInPrint = selectedPrint?.has(currentFileName) ?? false;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') onNext();
    else if (event.key === 'ArrowLeft') onPrev();
    else if (event.key === 'Escape') onClose();
  }, [onNext, onPrev, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartXRef.current = event.touches[0].clientX;
    touchStartYRef.current = event.touches[0].clientY;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = event.changedTouches[0].clientY - touchStartYRef.current;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX < 0) onNext();
      else onPrev();
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    mouseStartXRef.current = event.clientX;
    isDraggingRef.current = true;
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    if (!isDraggingRef.current || mouseStartXRef.current === null) return;
    const deltaX = event.clientX - mouseStartXRef.current;
    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX < 0) onNext();
      else onPrev();
    }
    mouseStartXRef.current = null;
    isDraggingRef.current = false;
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !isDraggingRef.current) onClose();
  };

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      role="dialog"
      aria-modal="true"
      aria-label="Vizualizare foto"
    >
      <button className={styles.closeBtn} onClick={onClose} aria-label="Închide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <button
        className={`${styles.navBtn} ${styles.navBtnPrev}`}
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Poza anterioară"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div className={styles.imageWrap}>
        <img
          key={currentIndex}
          src={currentSrc}
          alt={`Foto ${currentIndex + 1}`}
          className={styles.image}
          draggable={false}
        />
      </div>

      <button
        className={`${styles.navBtn} ${styles.navBtnNext}`}
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Poza următoare"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      <div className={styles.bottomBar}>
        <div className={styles.counter}>
          {currentIndex + 1} / {photos.length}
        </div>

        {onTogglePrint && (
          <button
            className={`${styles.printBtn} ${isInPrint ? styles.printBtnActive : ''}`}
            onClick={() => onTogglePrint(currentFileName)}
            aria-label={isInPrint ? 'Elimină din imprimare' : 'Adaugă la imprimare'}
            data-onboarding="print-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>{isInPrint ? 'Elimină din imprimare' : '+ Adaugă la imprimare'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
