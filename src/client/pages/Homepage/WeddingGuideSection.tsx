import React from "react";
import GuideBook from "../CampaignLanding/GuideBook";
import { sendLiveEvent } from "../../utils/liveEvent";
import { measureOaiq } from "../../utils/oaiq";

const WEDDING_GUIDE_URL = "https://ancavisuals.b-cdn.net/offers-assets/pdfs/Ghidul-Mirilor.pdf";
const WEDDING_GUIDE_HIGHLIGHTS = [
  "În ce ordine rezervați furnizorii",
  "Actele pentru cununia civilă și religioasă",
  "Calendarul organizării, lună cu lună",
  "Desfășurătorul zilei nunții",
  "Sfaturi pentru poze și film frumoase",
  "Trusa de urgență pentru ziua nunții",
];

export default function WeddingGuideSection() {
  const trackGuideDownload = () => {
    sendLiveEvent("guide_downloaded", { label: "Ghidul Mirilor", meta: { file: "Ghidul-Mirilor.pdf" } });
    measureOaiq("guide_downloaded", { page_path: "/" });
  };

  return (
    <section data-track-section="ghidul mirilor" className="bg-[#f6f2ea] px-6 py-16 text-[#2f2a24] sm:py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
        <GuideBook />

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d3b]">PDF gratuit · 15 pagini</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">Ghidul Mirilor</h2>
          <p className="mt-4 text-base leading-relaxed text-[#5c5348]">
            Tot ce ne-ar fi plăcut să știe toți mirii de la început, adunat din zecile de nunți la care am fost alături de cupluri.
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
            onClick={trackGuideDownload}
            className="mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#2f2a24] px-6 py-4 text-sm font-semibold text-[#f6f2ea] transition-colors hover:bg-black sm:w-auto"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Descarcă ghidul gratuit
          </a>
          <p className="mt-3 text-xs text-[#5c5348]/80">Fără email, fără înregistrare — se deschide direct.</p>
        </div>
      </div>
    </section>
  );
}
