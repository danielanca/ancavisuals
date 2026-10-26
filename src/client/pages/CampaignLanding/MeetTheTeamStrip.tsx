import React from "react";
import { ABOUT_PHOTO_URL } from "../About/AboutSummary";

// Short "who you'd work with" band right under the hero (owner audit, 2026-10-26): the couple
// story used to show up only ~15 screens down, after the configurator. Full story stays below.
// Window over the 2000×3000 photo: x 47–92%, y 15–52% (both heads and shoulders).
const FACES_CROP: React.CSSProperties = { width: "222%", left: "-104%", top: "-40%" };

export default function MeetTheTeamStrip() {
  return (
    <section data-track-section="cine suntem" className="border-y border-neutral-800 bg-neutral-950 px-6 py-8 text-white sm:py-10" aria-labelledby="meet-team-title">
      <div className="mx-auto flex max-w-3xl items-center gap-5 sm:gap-8">
        {/* Zoomed on our faces: the photo is a 2:3 full-length shot, too small here to read faces otherwise. */}
        <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden sm:w-32">
          <img
            src={ABOUT_PHOTO_URL}
            alt="Dani și Estera, echipa Anca Visuals"
            decoding="async"
            className="absolute max-w-none"
            style={FACES_CROP}
          />
        </div>
        <div>
          <h2 id="meet-team-title" className="text-lg font-light leading-snug sm:text-xl">
            Suntem Dani (video) și Estera (foto), soț și soție.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-300">
            Ne-am cunoscut la volei și de atunci lucrăm în echipă. Știm cum e să fii mire, pentru că am fost și noi.
          </p>
          <a href="#despre-noi" className="mt-3 inline-block text-xs text-neutral-400 underline underline-offset-4 transition-colors hover:text-white">
            Povestea noastră ↓
          </a>
        </div>
      </div>
    </section>
  );
}
