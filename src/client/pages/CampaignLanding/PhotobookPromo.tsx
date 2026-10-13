import React from "react";

const PHOTOBOOK_IMAGE = "https://ancavisuals.b-cdn.net/resources/fotocarte.jpg";
const BOX_IMAGE = "https://ancavisuals.b-cdn.net/resources/cutie.jpg";

export default function PhotobookPromo() {
  return (
    <section className="border-t border-[#2f2a24]/10 bg-[#fbfaf7] px-5 py-14 text-[#2f2a24] sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d3b]">Amintirile voastre, pe hârtie</p>
          <h2 className="mt-3 font-serif text-3xl leading-tight sm:text-5xl">Fotocartea sau cutia voastră</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#5c5348] sm:text-base">
            Cele mai frumoase fotografii merită să rămână cu voi și după ce ecranul se stinge — într-o fotocarte elegantă sau într-o cutie pentru amintiri.
          </p>
        </div>

        <div className="mt-9 grid gap-5 sm:mt-10 sm:grid-cols-2 sm:gap-6">
          <article>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px w-8 bg-[#b8955a]" />
              <h3 className="font-serif text-2xl leading-tight text-[#2f2a24] sm:text-3xl">Fotocarte</h3>
            </div>
            <div className="overflow-hidden rounded-md shadow-[0_18px_35px_-24px_rgba(47,42,36,0.7)] ring-1 ring-[#2f2a24]/10">
              <img src={PHOTOBOOK_IMAGE} alt="Fotocarte cu fotografiile evenimentului" className="block h-auto w-full" loading="lazy" />
            </div>
            <p className="mt-3 text-sm text-[#5c5348]">Poate include până la 30 de pagini.</p>
          </article>

          <article>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px w-8 bg-[#b8955a]" />
              <h3 className="font-serif text-2xl leading-tight text-[#2f2a24] sm:text-3xl">Cutie foto</h3>
            </div>
            <div className="overflow-hidden rounded-md shadow-[0_18px_35px_-24px_rgba(47,42,36,0.7)] ring-1 ring-[#2f2a24]/10">
              <img src={BOX_IMAGE} alt="Cutie pentru păstrarea fotocărții și amintirilor" className="block h-auto w-full" loading="lazy" />
            </div>
            <p className="mt-3 text-sm text-[#5c5348]">Include 100 de fotografii.</p>
          </article>
        </div>

      </div>
    </section>
  );
}
