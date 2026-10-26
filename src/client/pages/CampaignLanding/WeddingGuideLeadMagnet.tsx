import React from "react";
import { sendLiveEvent } from "../../utils/liveEvent";
import { measureOaiq } from "../../utils/oaiq";
import { GUIDE_PDF_FILE, GUIDE_PDF_PATH, GUIDE_PDF_URL } from "../WeddingGuide/guideContent";

// Ghidul Mirilor (owner, 2026-10-25): opens directly, no email/phone asked. Shown at the END of
// the page — before the price it was one more "free gift" that diluted the offer and delayed "cât costă?".
export const WEDDING_GUIDE_URL = GUIDE_PDF_URL;
const WEDDING_GUIDE_HIGHLIGHTS = [
  "Fotograful și videograful: ce să cereți",
  "Fotocabina, cabina 360 și QR Moments",
  "Sala și meniul: clauzele din contract",
  "DJ, formație și cine coordonează ziua",
  "49 de mărturii reale ale mirilor",
  "Lista de verificare, de bifat împreună",
];

export default function WeddingGuideLeadMagnet({
  book,
  pagePath,
}: {
  /** The 3D book cover — the landing passes its lazy-loaded copy. */
  book: React.ReactNode;
  /** Where the visitor is, for the analytics (ex. "/oferta/olx", "/"). */
  pagePath: string;
}) {
  const trackOpen = () => {
    sendLiveEvent("guide_downloaded", { label: "Ghidul Mirilor", meta: { file: GUIDE_PDF_FILE, page: pagePath } });
    measureOaiq("guide_downloaded", { page_path: pagePath });
  };

  return (
    <section data-track-section="ghidul mirilor" className="bg-[#f6f2ea] px-6 py-16 text-[#2f2a24] sm:py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
        {book}

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d3b]">PDF · 30 de pagini</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">Ghidul Mirilor</h2>
          <p className="mt-4 text-base leading-relaxed text-[#5c5348]">
            Tot ce ne-ar fi plăcut să știe toți mirii de la început, adunat din zecile de nunți la care am fost alături de cupluri,
            plus răspunsurile mirilor care au trecut deja prin asta.{" "}
            {/* Internal link to the guide's own page — helps it rank for „ghidul mirilor pdf". */}
            <a href={GUIDE_PDF_PATH} className="underline underline-offset-4 hover:text-[#2f2a24]">Vedeți ce conține</a>
          </p>
          <ul className="mt-6 grid gap-2.5 text-sm sm:grid-cols-2">
            {WEDDING_GUIDE_HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2f2a24] text-[11px] text-[#f6f2ea]">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <a
            href={WEDDING_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackOpen}
            className="mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#2f2a24] px-6 py-4 text-sm font-semibold text-[#f6f2ea] transition-colors hover:bg-black sm:w-auto"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Deschide Ghidul Mirilor
          </a>
        </div>
      </div>
    </section>
  );
}
