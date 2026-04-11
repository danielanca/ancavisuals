import { useEffect, useMemo, useRef, useState } from "react";
import Aos from "aos";
import "aos/dist/aos.css";
import Lightbox from "yet-another-react-lightbox";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { collection, getDocs, doc, setDoc, increment } from "firebase/firestore";
import { storage, db } from "../../firebase";
import { buildSeoImageAlt } from "../../utils/imageAlt";
import "./PortfolioGallery.scss";

type ImageItem = { src: string };

type PortfolioGalleryProps = { altBase?: string };

const FOLDER_PATH = "ancavisuals/PortfolioGallery";
const INITIAL_VISIBLE = 40;
const LOAD_MORE_STEP = 20;
const LONG_PRESS_MS = 500;

const REACTIONS = [
  { key: "heart", emoji: "❤️" },
  { key: "fire",  emoji: "🔥" },
  { key: "wow",   emoji: "😍" },
  { key: "clap",  emoji: "👏" },
] as const;

type ReactionKey = (typeof REACTIONS)[number]["key"];
type ReactionCounts = Partial<Record<ReactionKey, number>>;
// { [imageId]: reactionKey } — ce a ales userul
type MyReactions = Record<string, ReactionKey>;

/** Seed consistent între 10–25 per imagine + tip reacție */
const seedForReaction = (id: string, key: string): number => {
  const s = id + key;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return 10 + (Math.abs(h) % 16);
};

const getImageId = (src: string): string => {
  try {
    const match = src.match(/\/o\/([^?]+)/);
    if (match) {
      const decoded = decodeURIComponent(match[1]);
      return decoded.split("/").pop() ?? decoded;
    }
  } catch {}
  return src.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
};

export default function PortfolioGallery({
  altBase = "fotograf videograf eveniment Anca Visuals",
}: PortfolioGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Reactions state
  const [reactions, setReactions] = useState<Record<string, ReactionCounts>>({});
  const [myReactions, setMyReactions] = useState<MyReactions>({});
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const mobileTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Long-press tracking
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTriggered = useRef(false);

  useEffect(() => {
    Aos.init({ duration: 800, once: true });
  }, []);

  // Încarcă imaginile
  useEffect(() => {
    const fetchImages = async () => {
      try {
        const folderRef = ref(storage, FOLDER_PATH);
        const res = await listAll(folderRef);
        const urls = await Promise.all(res.items.map(i => getDownloadURL(i)));
        urls.sort();
        setImages(urls.map(src => ({ src })));
      } catch (err) {
        console.error("[Gallery] error loading images:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchImages();
  }, []);

  // Încarcă reacțiile proprii din localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pf_reactions_v2");
      if (raw) setMyReactions(JSON.parse(raw) as MyReactions);
    } catch {}
  }, []);

  // Încarcă contoarele din Firestore
  useEffect(() => {
    if (!images.length) return;
    getDocs(collection(db, "portfolioReactions"))
      .then(snap => {
        const counts: Record<string, ReactionCounts> = {};
        snap.forEach(d => {
          counts[d.id] = d.data() as ReactionCounts;
        });
        setReactions(counts);
      })
      .catch(() => {});
  }, [images]);

  // Mobil: adaugă/scoate clasa direct pe DOM — fără re-render, fără AOS re-trigger
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 768px)").matches) return;
    if (!images.length) return;

    const timersRef = mobileTimers.current;
    const VISIBLE_CLASS = "pg-item--reactions-visible";
    let currentVisible: HTMLElement | null = null;

    const showFor = (el: HTMLElement) => {
      if (currentVisible && currentVisible !== el) {
        currentVisible.classList.remove(VISIBLE_CLASS);
      }
      el.classList.add(VISIBLE_CLASS);
      currentVisible = el;
    };

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const el = entry.target as HTMLElement;
          const id = el.dataset.imageId;
          if (!id) return;

          if (entry.isIntersecting) {
            if (!timersRef.has(id)) {
              const t = setTimeout(() => {
                showFor(el);
                timersRef.delete(id);
              }, 2000);
              timersRef.set(id, t);
            }
          } else {
            const t = timersRef.get(id);
            if (t) { clearTimeout(t); timersRef.delete(id); }
            el.classList.remove(VISIBLE_CLASS);
            if (currentVisible === el) currentVisible = null;
          }
        });
      },
      { rootMargin: "0px", threshold: 0.5 },
    );

    document.querySelectorAll<HTMLElement>("[data-image-id]").forEach(el => observer.observe(el));

    return () => {
      observer.disconnect();
      timersRef.forEach(t => clearTimeout(t));
      timersRef.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, visibleCount]);

  // Închide picker-ul la click în afara lui
  useEffect(() => {
    if (!pickerFor) return;
    const close = () => setPickerFor(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [pickerFor]);

  /* ---- Long press handlers ---- */
  const onPressStart = (imageId: string) => {
    pressTriggered.current = false;
    pressTimer.current = setTimeout(() => {
      pressTriggered.current = true;
      setPickerFor(prev => (prev === imageId ? null : imageId));
    }, LONG_PRESS_MS);
  };

  const onPressEnd = (openLightbox: () => void) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (!pressTriggered.current) openLightbox();
    pressTriggered.current = false;
  };

  const onPressCancel = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTriggered.current = false;
  };

  /* ---- Apply reaction ---- */
  const handleReact = async (imageId: string, key: ReactionKey, e: React.MouseEvent) => {
    e.stopPropagation();
    setPickerFor(null);

    const prev = myReactions[imageId];
    const isSame = prev === key;

    // Optimistic update
    setReactions(r => {
      const cur = { ...(r[imageId] ?? {}) };
      if (prev) cur[prev] = Math.max(0, (cur[prev] ?? 0) - 1);
      if (!isSame) cur[key] = (cur[key] ?? 0) + 1;
      return { ...r, [imageId]: cur };
    });

    const next = { ...myReactions };
    if (isSame) delete next[imageId];
    else next[imageId] = key;
    setMyReactions(next);
    try { localStorage.setItem("pf_reactions_v2", JSON.stringify(next)); } catch {}

    // Firestore
    try {
      const update: Record<string, ReturnType<typeof increment>> = {};
      if (prev) update[prev] = increment(-1);
      if (!isSame) update[key] = increment(1);
      await setDoc(doc(db, "portfolioReactions", imageId), update, { merge: true });
    } catch {}
  };

  const lightboxSlides = useMemo(() => images.map(img => ({ src: img.src })), [images]);

  const SKELETON_HEIGHTS = [280, 380, 240, 420, 300, 360, 260, 440, 310, 390, 270, 350];

  if (loading) {
    return (
      <section className="pg-section">
        <div className="pg-container">
          <div className="pg-skeleton-masonry">
            {SKELETON_HEIGHTS.map((h, i) => (
              <div key={i} className="pg-skeleton-item" style={{ height: h }} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!images.length) {
    return (
      <section className="pg-section">
        <div className="pg-container text-red-300">
          Nu am găsit nici o imagine în <code>{FOLDER_PATH}</code>.
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="pg-section">
        <div className="pg-container">
          <div className="pg-masonry">
            {images.slice(0, visibleCount).map((img, i) => {
              const imageId = getImageId(img.src);
              const myKey = myReactions[imageId];
              const counts = reactions[imageId] ?? {};
              const isPickerOpen = pickerFor === imageId;

              return (
                <div
                  key={img.src + i}
                  className="pg-item"
                  data-aos="fade-up"
                  data-aos-delay={i * 40}
                  data-image-id={imageId}
                >
                  {/* Zona imagine — click scurt = lightbox, ținut = picker */}
                  <button
                    type="button"
                    className="pg-img-trigger"
                    onMouseDown={() => onPressStart(imageId)}
                    onMouseUp={() => onPressEnd(() => setLightboxIndex(i))}
                    onMouseLeave={onPressCancel}
                    onTouchStart={() => onPressStart(imageId)}
                    onTouchEnd={() => onPressEnd(() => setLightboxIndex(i))}
                    onTouchCancel={onPressCancel}
                    onContextMenu={e => e.preventDefault()}
                    aria-label="Deschide fotografia"
                  >
                    <img
                      src={img.src}
                      alt={buildSeoImageAlt(altBase, i)}
                      loading="lazy"
                      className="pg-img"
                    />
                  </button>

                  {/* Picker emoji — apare la long press sau click pe cercul gri */}
                  {isPickerOpen && (
                    <div className="pg-picker" onClick={e => e.stopPropagation()}>
                      {REACTIONS.map(r => (
                        <button
                          key={r.key}
                          type="button"
                          className={`pg-picker-btn${myKey === r.key ? " pg-picker-btn--active" : ""}`}
                          onClick={e => handleReact(imageId, r.key, e)}
                        >
                          {r.emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Rând badge-uri per tip de reacție */}
                  <div className="pg-reaction-bar" onClick={e => e.stopPropagation()}>
                    {REACTIONS.map(r => {
                      const count = (counts[r.key] ?? 0) + seedForReaction(imageId, r.key);
                      const isMe = myKey === r.key;
                      return (
                        <button
                          key={r.key}
                          type="button"
                          className={`pg-reaction-badge${isMe ? " pg-reaction-badge--active" : ""}`}
                          style={{ background: isMe ? "#3a1020" : "#2a2a2a" }}
                          onClick={e => handleReact(imageId, r.key, e)}
                          aria-label={r.emoji}
                        >
                          {r.emoji}
                          <span className="pg-reaction-count">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {visibleCount < images.length && (
            <div className="pg-load-more">
              <button
                onClick={() => setVisibleCount(prev => prev + LOAD_MORE_STEP)}
                className="pg-load-more-btn"
                type="button"
              >
                MAI MULTE POZE
              </button>
            </div>
          )}
        </div>
      </section>

      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => setLightboxIndex(-1)}
        slides={lightboxSlides}
        plugins={[Thumbnails]}
      />
    </>
  );
}
