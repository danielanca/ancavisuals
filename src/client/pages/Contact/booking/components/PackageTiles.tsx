import React, { useEffect, useMemo, useRef, useState, memo } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import styles from './PackageTiles.module.scss';
import { PACKAGES_NEW } from '../../packages';

type PackageLike = {
  id: string;
  title: string;
  price: number;
  recommended?: boolean;
  note?: React.ReactNode | string;
  samples?: string[];
  type?: 'photo' | 'video';
};

type Props = {
  packages?: PackageLike[];
  selected: string[];
  onChange: (next: string[]) => void;
};

const fmtRON = (n: number) => n.toLocaleString('ro-RO');


// ✅ Define hook outside (so it's stable, not re-created each render)
function useInViewAutoplay(ref: React.RefObject<HTMLVideoElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.9 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}

// ✅ Memoized video component – doesn’t re-render on parent state change
const VideoSlide = memo(({ src }: { src: string }) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  useInViewAutoplay(ref);

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="none"
      className={styles.slideMedia}
    />
  );
});
VideoSlide.displayName = "VideoSlide";

export default function PackageTiles({ packages, selected, onChange }: Props) {
  const list = PACKAGES_NEW;
  const [expandedNotes, setExpandedNotes] = useState<string[]>([]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const toggleNote = (id: string) => {
    setExpandedNotes(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const total = useMemo(
    () => selected.reduce((sum, id) => sum + (list.find(p => p.id === id)?.price || 0), 0),
    [selected, list]
  );

  return (
    <fieldset className={styles['pkg-tiles']}>
      <legend>Alege pachetul/pachetele</legend>

      <div className={styles.grid}>
        {list.map(p => {
          const checked = selected.includes(p.id);

          return (
            <div
              className={`${styles.tile} ${checked ? styles.checked : ''}`}
              key={p.id}
            >
              <input
                type="checkbox"
                id={`pkg-${p.id}`}
                name="packages"
                value={p.id}
                checked={checked}
                onChange={() => toggle(p.id)}
              />

              <div className={styles.cardContent}>
                <label htmlFor={`pkg-${p.id}`}>
                  <div className="title-row">
                    <span className="title">{p.title}</span>
                    {p.recommended && <span className="badge">Recomandat</span>}
                  </div>

                  <div className="meta-row">
                    <span className="price">{fmtRON(p.price)} RON</span>
                  </div>
                </label>

                {/* ✅ Swiper */}
                {p.samples && (
                  <div className={styles.sliderRow}>
                    <Swiper
                      modules={[Navigation]}
                      navigation
                      slidesPerView={1}
                      spaceBetween={8}
                      className={styles.slider}
                    >
                      {p.samples.map((url, idx) => (
                        <SwiperSlide key={idx}>
                          {p.type === 'video' ? (
                            <VideoSlide src={url} />
                          ) : (
                            <img
                              src={url}
                              alt={`${p.title} sample ${idx + 1}`}
                              loading="lazy"
                              className={styles.slideMedia}
                            />
                          )}
                        </SwiperSlide>
                      ))}
                    </Swiper>
                  </div>
                )}

                {p.note && (
                  <div className={styles.collapsible}>
                    <button
                      className={styles.toggleButton}
                      onClick={() => toggleNote(p.id)}
                      aria-expanded={expandedNotes.includes(p.id)}
                    >
                      {expandedNotes.includes(p.id)
                        ? 'Hide details'
                        : 'Show details'}
                    </button>

                    <div
                      className={`${styles.content} ${
                        expandedNotes.includes(p.id) ? styles.open : ''
                      }`}
                    >
                      {p.note}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </fieldset>
  );
}
