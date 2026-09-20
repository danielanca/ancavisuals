import React, { useEffect, useState } from "react";
import { ACCENT } from "../../utils/theme";

interface Review {
  id: string;
  author: string;
  date: string;
  rating: number;
  text: string;
  photos: { url: string; name: string }[];
  verified: boolean;
}

interface ReviewsGridProps {
  category: "wedding" | "oferta";
  offerSlug?: string;
  title?: string;
  subtitle?: string;
  // Fiecare zonă a site-ului are propriul accent (amber pe site-ul principal, violet pe
  // paginile de ofertă) — implicit folosim ACCENT (amber), dar orice pagină poate să
  // paseze propriile clase ca recenziile să se încadreze vizual acolo unde apar.
  accentText?: string;
  accentBgSubtle?: string;
}

function Stars({ rating, accentText }: { rating: number; accentText: string }) {
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
  accentText = ACCENT.text,
  accentBgSubtle = ACCENT.bgSubtle,
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openReview, setOpenReview] = useState<Review | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams({ category });
    if (offerSlug) params.set("offerSlug", offerSlug);
    fetch(`/api/reviews?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setReviews(Array.isArray(data.reviews) ? data.reviews : []))
      .catch(() => setReviews([]))
      .finally(() => setLoaded(true));
  }, [category, offerSlug]);

  useEffect(() => {
    if (!openReview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenReview(null);
      else if (e.key === "ArrowLeft") setPhotoIndex((i) => (i - 1 + openReview.photos.length) % openReview.photos.length);
      else if (e.key === "ArrowRight") setPhotoIndex((i) => (i + 1) % openReview.photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openReview]);

  if (!loaded || reviews.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div>
        <h2 className="text-2xl font-light md:text-3xl">{title}</h2>
        {subtitle && <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-400">{subtitle}</p>}
      </div>

      <div className="mt-8 columns-1 gap-6 sm:columns-2 lg:columns-3">
        {reviews.map((review) => (
          <article key={review.id} className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-white/5 p-6">
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

      {openReview && openReview.photos.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpenReview(null)}
        >
          <div
            className="grid max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl md:grid-cols-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`relative flex items-center justify-center ${accentBgSubtle} p-2`}>
              <button
                type="button"
                onClick={() => setOpenReview(null)}
                className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                aria-label="Închide"
              >
                ✕
              </button>
              <img src={openReview.photos[photoIndex].url} alt={`Poză de la ${openReview.author}`} className="max-h-[80vh] w-full object-contain" />
              {openReview.photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setPhotoIndex((i) => (i - 1 + openReview.photos.length) % openReview.photos.length)}
                    className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    aria-label="Poza anterioară"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoIndex((i) => (i + 1) % openReview.photos.length)}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
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
            </div>
            <div className="overflow-y-auto p-6 md:p-8">
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
              <p className="mt-4 text-sm leading-7 text-gray-300">{openReview.text}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ReviewsGrid;
