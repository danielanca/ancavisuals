import React from "react";

const QR_CARD_IMAGE = "https://ancavisuals.b-cdn.net/resources/QR-site.jpg";
const QR_SCAN_IMAGE = "https://ancavisuals.b-cdn.net/resources/QR-site2.jpg";

interface QRMomentsPromoProps {
  whatsappHref: string;
  onCta?: () => void;
}

export default function QRMomentsPromo({ whatsappHref, onCta }: QRMomentsPromoProps) {
  return (
    <section className="overflow-hidden border-t border-[#d9c19a]/20 bg-[#211e1b] px-6 py-16 text-[#f6f2ea] sm:py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-10 lg:gap-14">
        <div className="relative mx-auto w-full max-w-[330px] min-w-0 pb-5 sm:max-w-[430px] sm:pb-0">
          <div className="absolute -left-1 top-1 z-10 rounded-full bg-[#d9c19a] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#2f2a24] shadow-sm -rotate-6 sm:-left-5 sm:top-6 sm:px-3 sm:text-[10px] sm:tracking-[0.18em]">
            Pentru invitați
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-white p-3 shadow-[0_25px_50px_-15px_rgba(47,42,36,0.35)] ring-1 ring-[#2f2a24]/10">
            <img src={QR_CARD_IMAGE} alt="Card QR Code Moments pentru eveniment" className="aspect-[4/3] w-full rounded-xl object-cover object-center" loading="lazy" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-[36%] overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_20px_40px_-15px_rgba(47,42,36,0.4)] ring-1 ring-[#2f2a24]/10 sm:-bottom-6 sm:-right-5 sm:w-[45%] sm:p-2">
            <img src={QR_SCAN_IMAGE} alt="Invitați care scanează codul QR" className="aspect-[4/5] w-full rounded-xl object-cover" loading="lazy" />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d9c19a]">Un cadou gratuit pentru nunta voastră</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">QR Code Moments</h2>
          <p className="mt-4 text-base leading-[1.38] text-[#d8d0c4] sm:leading-relaxed">
            Îl primiți gratuit: un singur cod QR, iar invitații pot trimite poze, video și mesaje vocale direct de pe telefon — fără aplicație și fără cont complicat.
          </p>
          <div className="mt-5 inline-flex items-center rounded-full bg-[#d9c19a] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#2f2a24] sm:px-4 sm:text-xs sm:tracking-[0.16em]">
            Inclus gratuit
          </div>
          <ul className="mt-6 grid gap-2.5 text-sm sm:grid-cols-2">
            {[
              "Poze și video de la toți invitații",
              "Mesaje vocale pentru miri",
              "Acces direct de pe telefon",
              "Totul într-un singur album privat",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d9c19a] text-[11px] text-[#2f2a24]">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onCta}
            className="mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#d9c19a] px-6 py-4 text-sm font-semibold text-[#2f2a24] transition-colors hover:bg-[#ead8b8] sm:w-auto"
          >
            Vreau QR Code Moments
            <span aria-hidden="true">→</span>
          </a>
          <p className="mt-3 text-xs text-[#d8d0c4]/75">Îți explicăm cum funcționează și îl pregătim pentru evenimentul vostru.</p>
        </div>
      </div>
    </section>
  );
}
