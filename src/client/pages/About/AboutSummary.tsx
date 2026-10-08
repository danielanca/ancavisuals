import React from "react";
import { Link } from "react-router-dom";

export default function AboutSummary() {
  return (
    <section id="despre-noi" data-track-section="despre noi" className="bg-neutral-950 px-6 py-16 text-white sm:py-24" aria-labelledby="about-summary-title">
      <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-2 md:gap-14">
        <img
          src="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FDespreNoi%2FPoze-218.jpg?alt=media&token=c515b80e-3026-420b-bf4f-d05e850548ed"
          alt="Dani și Estera, echipa Anca Visuals"
          loading="lazy"
          decoding="async"
          className="aspect-[4/5] w-full rounded-xl object-cover"
        />
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-amber-200">Despre noi</p>
          <h2 id="about-summary-title" className="text-3xl font-extralight tracking-[0.05em] sm:text-4xl">Suntem Dani și Estera</h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-neutral-300">
            <p>Ne-am cunoscut la volei: Dani făcea poze, Estera dădea pase. De atunci, suntem o echipă în viață și în spatele camerelor. El se ocupă de video, ea de fotografie, iar când ziua o cere, schimbăm rolurile firesc.</p>
            <p>Lucrăm calm, discret și cu grijă pentru oamenii din fața noastră. Ne plac râsetele sincere, lacrimile neașteptate și momentele care spun povestea voastră. Noi avem grijă de imagini, voi vă bucurați de zi.</p>
          </div>
          <Link to="/despre" className="mt-6 inline-block py-2 text-sm text-amber-200 underline underline-offset-4 transition-colors hover:text-white">Mai multe despre noi →</Link>
        </div>
      </div>
    </section>
  );
}
