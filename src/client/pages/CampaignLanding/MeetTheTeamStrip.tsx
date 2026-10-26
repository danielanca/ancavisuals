import React from "react";

// Short "who you'd work with" band right under the hero (owner audit, 2026-10-26): the couple
// story used to show up only ~15 screens down, after the configurator. Full story stays below.
// The About photo (2000×3000, 3.5 MB) pre-cropped on our faces, 256×320 WebP (~13 KB). Linking the
// original here made PageSpeed mobile LCP 22.8 s — it ate the throttled bandwidth right after the hero.
export const FACES_PHOTO_URL = "/images/dani-estera-fete.webp";

export default function MeetTheTeamStrip() {
  return (
    <section data-track-section="cine suntem" className="border-y border-neutral-800 bg-neutral-950 px-6 py-8 text-white sm:py-10" aria-labelledby="meet-team-title">
      <div className="mx-auto flex max-w-3xl items-center gap-5 sm:gap-8">
        <img
          src={FACES_PHOTO_URL}
          alt="Dani și Estera, echipa Anca Visuals"
          width={256}
          height={320}
          loading="lazy"
          decoding="async"
          className="aspect-[4/5] w-24 shrink-0 object-cover sm:w-32"
        />
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
