import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ACCENT } from "../../utils/theme";

interface Review {
  id: string;
  author: string;
  date: string;
  rating: number | null;
  text: string;
  photos: { url: string; name: string }[];
  verified: boolean;
}

interface ReviewsGridProps {
  category: "wedding" | "oferta";
  offerSlug?: string;
  title?: string;
  subtitle?: string;
  layout?: "masonry" | "horizontal";
  // Fiecare zonă a site-ului are propriul accent (amber pe site-ul principal, violet pe
  // paginile de ofertă) — implicit folosim ACCENT (amber), dar orice pagină poate să
  // paseze propriile clase ca recenziile să se încadreze vizual acolo unde apar.
  accentText?: string;
  accentBgSubtle?: string;
}

function Stars({ rating, accentText }: { rating: number | null; accentText: string }) {
  if (rating === null) return null;
  return (
    <div className="flex gap-0.5" aria-label={`${rating} din 5 stele`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" className={i < rating ? accentText : "text-gray-700"}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const ReviewsGrid: React.FC<ReviewsGridProps> = ({
  category,
  offerSlug,
  title = "Recenzii de la clienți",
  subtitle,
  layout = "masonry",
  accentText = ACCENT.text,
  accentBgSubtle = ACCENT.bgSubtle,
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openReview, setOpenReview] = useState<Review | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setOpenReview(null);
    const params = new URLSearchParams({ category });
    if (offerSlug) params.set("offerSlug", offerSlug);
    fetch(`/api/reviews?${params.toString()}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Reviews unavailable");
        return r.json();
      })
      .then((data) => setReviews(Array.isArray(data.reviews) ? data.reviews : []))
      .catch(() => { if (!controller.signal.aborted) setReviews([]); })
      .finally(() => { if (!controller.signal.aborted) setLoaded(true); });
    return () => controller.abort();
  }, [category, offerSlug]);

  useEffect(() => {
    if (!openReview) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenReview(null);
      else if (e.key === "ArrowLeft" && openReview.photos.length > 1) setPhotoIndex((i) => (i - 1 + openReview.photos.length) % openReview.photos.length);
      else if (e.key === "ArrowRight" && openReview.photos.length > 1) setPhotoIndex((i) => (i + 1) % openReview.photos.length);
      else if (e.key === "Tab") {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [openReview]);

  if (!loaded || reviews.length === 0) return null;

  return (
    <section data-track-section="recenzii" className="mx-auto max-w-6xl px-6 py-16">
      <div>
        <h2 className="text-2xl font-light md:text-3xl">{title}</h2>
        {subtitle && <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-400">{subtitle}</p>}
      </div>

      <div className={layout === "horizontal" ? "mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2" : "mt-8 columns-1 gap-6 sm:columns-2 lg:columns-3"}>
        {reviews.map((review) => (
          layout === "horizontal" ? (
            <article key={review.id} className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 transition-colors hover:border-amber-200/30">
              <button
                type="button"
                onClick={() => { setOpenReview(review); setPhotoIndex(0); }}
                aria-label={`Citește recenzia de la ${review.author}`}
                className="flex h-full min-h-[240px] w-full gap-4 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-amber-200 sm:gap-5 sm:p-5"
              >
                <div className="flex min-w-0 flex-1 flex-col py-1">
                  <h3 className="flex items-center gap-2 text-base font-medium text-white sm:text-lg">
                    <span className="break-words">{review.author}</span>
                    {review.verified && <span className={`shrink-0 ${accentText}`} aria-label="Recenzie verificată">✓</span>}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">{fmtDate(review.date)}</p>
                  <div className="mt-4"><Stars rating={review.rating} accentText={accentText} /></div>
                  <p className="mt-3 line-clamp-5 whitespace-pre-line text-sm leading-6 text-neutral-300">{review.text}</p>
                  <span className={`mt-auto pt-5 text-xs ${accentText}`}>Citește recenzia <span aria-hidden="true">↗</span></span>
                </div>
                {review.photos.length > 0 && (
                  <div className="relative w-[35%] shrink-0 self-stretch overflow-hidden rounded-2xl bg-black/30">
                    <img src={review.photos[0].url} alt={`Fotografie de la ${review.author}`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    {review.photos.length > 1 && <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">+{review.photos.length - 1}</span>}
                  </div>
                )}
              </button>
            </article>
          ) : <article key={review.id} className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-base font-medium text-white">
                  <span className="truncate">{review.author}</span>
                  {review.verified && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 ${accentText}`} aria-label="Recenzie verificată">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  )}
                </h3>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{fmtDate(review.date)}</p>
              </div>
              <Stars rating={review.rating} accentText={accentText} />
            </div>

            <p className="mt-4 text-sm leading-7 text-gray-300">{review.text}</p>

            {review.photos.length > 0 && (
              <button
                type="button"
                onClick={() => { setOpenReview(review); setPhotoIndex(0); }}
                className="relative mt-4 block w-full overflow-hidden rounded-2xl border border-white/10 transition-opacity hover:opacity-90"
              >
                <img src={review.photos[0].url} alt={`Poză de la ${review.author}`} className="w-full object-cover" loading="lazy" />
                {review.photos.length > 1 && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                    +{review.photos.length - 1}
                  </span>
                )}
              </button>
            )}
          </article>
        ))}
      </div>

      {openReview && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onClick={() => setOpenReview(null)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Recenzie de la ${openReview.author}`}
            className={`relative grid max-h-[90dvh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-neutral-900 shadow-2xl ${openReview.photos.length > 0 ? "md:grid-cols-[1.2fr_1fr]" : "max-w-xl"}`}
            onClick={(e) => e.stopPropagation()}
          >
              <button
                type="button"
                onClick={() => setOpenReview(null)}
                className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline focus-visible:outline-amber-200"
                aria-label="Închide"
              >
                ✕
              </button>
            {openReview.photos.length > 0 && <div className={`relative flex items-center justify-center ${accentBgSubtle}`}>
              <img src={openReview.photos[photoIndex].url} alt={`Poză de la ${openReview.author}`} className="max-h-[45dvh] w-full object-contain md:max-h-[85dvh]" />
              {openReview.photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setPhotoIndex((i) => (i - 1 + openReview.photos.length) % openReview.photos.length)}
                    className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    aria-label="Poza anterioară"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoIndex((i) => (i + 1) % openReview.photos.length)}
                    className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    aria-label="Poza următoare"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {openReview.photos.map((_, i) => (
                      <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === photoIndex ? "bg-white" : "bg-white/40"}`} />
                    ))}
                  </div>
                </>
              )}
            </div>}
            <div className={`flex flex-col p-6 md:max-h-[85dvh] md:overflow-y-auto md:p-8 ${openReview.photos.length === 0 ? "pt-20" : ""}`}>
              <h3 className="flex items-center gap-1.5 text-lg font-medium text-white">
                {openReview.author}
                {openReview.verified && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={accentText}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                )}
              </h3>
              <div className="mt-1.5 flex items-center gap-3">
                <Stars rating={openReview.rating} accentText={accentText} />
                <span className="text-xs text-gray-500">{fmtDate(openReview.date)}</span>
              </div>
              <p className="mt-6 whitespace-pre-line text-sm leading-7 text-gray-300">{openReview.text}</p>
              {openReview.verified && <p className={`mt-auto pt-8 text-xs ${accentText}`}>✓ Recenzie verificată</p>}
            </div>
          </div>
        </div>, document.body
      )}
    </section>
  );
};

export default ReviewsGrid;
