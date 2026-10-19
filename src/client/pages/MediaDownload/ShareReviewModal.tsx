/*
 * Purpose: last check before the anonymous link goes out. With 40 pages of photos the client
 * can't remember everything ticked across pages, so "Trimite-le pe WhatsApp" first shows every
 * selected photo (masonry, natural aspect ratio — nothing cropped), lets them drop one, and only
 * "Confirmă și trimite" creates the link and opens WhatsApp / SMS. Full screen on mobile,
 * centered dialog on desktop; the photo list scrolls, header and buttons stay put.
 */
import { useEffect, useRef } from "react";

export type ShareReviewPhoto = { fileName: string; src: string };

type Props = {
  photos: ShareReviewPhoto[];
  channel: "whatsapp" | "sms";
  sending: boolean;
  onRemove: (fileName: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ShareReviewModal({ photos, channel, sending, onRemove, onClose, onConfirm }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = photos.length;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const confirmLabel = channel === "whatsapp" ? `✓ Confirmă și trimite pe WhatsApp (${count})` : `✓ Confirmă și alege cui trimiți prin SMS (${count})`;

  return (
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-black/85 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-review-title"
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full flex-col border-[#22c55e] bg-[#06150c] sm:h-auto sm:max-h-[90vh] sm:max-w-5xl sm:border"
      >
        <header className="flex items-start gap-3 border-b border-[#166534] px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id="share-review-title" className="text-base font-bold text-[#4ade80] sm:text-lg">
              Verifică pozele înainte să le trimiți
            </h2>
            <p className="mt-0.5 text-xs text-[#bbf7d0]">
              {count === 1 ? "1 poză" : `${count} poze`} în linkul nou. Apasă × pe o poză ca s-o scoți.
              <span className="block text-[#86efac]">🔒 Invitații văd doar aceste poze, fără acces la albumul vostru.</span>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#166534] text-xl leading-none text-[#bbf7d0] hover:bg-[#166534]"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5" data-testid="share-review-list">
          {count === 0 ? (
            <p className="py-10 text-center text-sm text-[#bbf7d0]">Ai scos toate pozele. Închide și bifează altele.</p>
          ) : (
            <ul className="columns-2 gap-2 sm:columns-3 lg:columns-4">
              {photos.map((photo) => (
                <li key={photo.fileName} className="relative mb-2 break-inside-avoid">
                  <img src={photo.src} alt={`Poză de trimis: ${photo.fileName}`} loading="lazy" draggable={false} className="block h-auto w-full bg-[#0f2a18]" />
                  <button
                    type="button"
                    onClick={() => onRemove(photo.fileName)}
                    aria-label={`Scoate ${photo.fileName} din trimitere`}
                    title="Scoate din trimitere"
                    className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center border border-white/40 bg-black/70 text-2xl font-light leading-none text-white hover:bg-red-600"
                  >
                    <span aria-hidden>×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-[#166534] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#166534] px-4 py-2.5 text-sm font-semibold text-[#bbf7d0] hover:bg-[#0f2a18]"
          >
            ← Înapoi la selecție
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={count === 0 || sending}
            className="bg-gradient-to-r from-[#22c55e] to-[#16a34a] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:from-[#4ade80] disabled:from-[#14532d] disabled:to-[#14532d] disabled:text-[#86efac]"
          >
            {sending ? "Se pregătește linkul…" : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
