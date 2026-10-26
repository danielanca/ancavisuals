import React from "react";
import { Link } from "react-router-dom";
import Footer from "../../components/Navbar/Footer";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import GuideBook from "../CampaignLanding/GuideBook";
import { FACES_PHOTO_URL } from "../CampaignLanding/MeetTheTeamStrip";
import { sendLiveEvent } from "../../utils/liveEvent";
import { measureOaiq } from "../../utils/oaiq";
import { WWW_ORIGIN } from "../../utils/address";

import { GUIDE_CHAPTERS, GUIDE_PDF_FILE, GUIDE_PDF_PATH, GUIDE_PDF_URL } from "./guideContent";

export { GUIDE_CHAPTERS, GUIDE_PDF_PATH, GUIDE_PDF_URL };

// /ghidul-mirilor-pdf (owner, 2026-10-26): a preview of the new guide, then the download.
// Built to rank for „ghidul mirilor", „ghidul mirilor pdf", „ghid pentru miri".



const TITLE = "Ghidul Mirilor PDF gratuit: sfaturi și mărturii reale de la miri | Anca Visuals";
const DESCRIPTION = "Descărcați gratuit Ghidul Mirilor (PDF, 30 de pagini): un ghid pentru miri cu sfaturi despre fotograf, videograf, sală, meniu, DJ și ziua nunții, plus 49 de mărturii reale ale mirilor din România și din alte țări.";

const schema = [
  {
    "@type": "DigitalDocument",
    "@id": `${WWW_ORIGIN}${GUIDE_PDF_PATH}#ghid`,
    name: "Ghidul Mirilor",
    alternateName: ["Ghidul Mirilor PDF", "Ghid pentru miri"],
    description: DESCRIPTION,
    inLanguage: "ro",
    encodingFormat: "application/pdf",
    url: GUIDE_PDF_URL,
    numberOfPages: 30,
    isAccessibleForFree: true,
    author: [
      { "@type": "Person", name: "Daniel", worksFor: { "@type": "Organization", name: "Anca Visuals" } },
      { "@type": "Person", name: "Estera", worksFor: { "@type": "Organization", name: "Anca Visuals" } },
    ],
    publisher: { "@type": "Organization", name: "Anca Visuals", url: WWW_ORIGIN },
    about: GUIDE_CHAPTERS,
  },
  {
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Unde pot descărca Ghidul Mirilor în PDF?",
        acceptedAnswer: { "@type": "Answer", text: "Ghidul Mirilor se descarcă gratuit, în format PDF, de pe ancavisuals.ro/ghidul-mirilor-pdf, fără să lăsați email sau telefon." },
      },
      {
        "@type": "Question",
        name: "Ce conține ghidul pentru miri?",
        acceptedAnswer: { "@type": "Answer", text: `Sfaturi pentru fiecare categorie (${GUIDE_CHAPTERS.slice(0, 8).join(", ")}), 49 de mărturii ale mirilor cu sursa fiecăreia și o listă de verificare de bifat împreună.` },
      },
      {
        "@type": "Question",
        name: "Cine a scris Ghidul Mirilor?",
        acceptedAnswer: { "@type": "Answer", text: "Daniel și Estera, de la Anca Visuals (foto și video de nuntă), din nunțile la care au lucrat și din răspunsurile mirilor adunate de pe site-uri din România și din alte țări." },
      },
    ],
  },
];

function DownloadButton() {
  const track = () => {
    sendLiveEvent("guide_downloaded", { label: "Ghidul Mirilor", meta: { file: GUIDE_PDF_FILE, page: GUIDE_PDF_PATH } });
    measureOaiq("guide_downloaded", { page_path: GUIDE_PDF_PATH });
  };
  return (
    <a
      href={GUIDE_PDF_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={track}
      className="guide-download-glow inline-flex w-full items-center justify-center gap-2.5 bg-emerald-700 px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-emerald-800 sm:w-auto"
    >
      Descarcă PDF-ul gratuit <span aria-hidden="true">↓</span>
      {/* A soft green glow that breathes, to draw the eye to the one action on the page. */}
      <style>{"@keyframes guideDownloadGlow{0%,100%{box-shadow:0 0 0 0 rgba(4,120,87,.45),0 10px 30px -10px rgba(4,120,87,.6)}50%{box-shadow:0 0 0 10px rgba(4,120,87,0),0 14px 40px -6px rgba(4,120,87,.75)}}.guide-download-glow{animation:guideDownloadGlow 2.4s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.guide-download-glow{animation:none;box-shadow:0 10px 30px -10px rgba(4,120,87,.6)}}"}</style>
    </a>
  );
}

export default function WeddingGuidePdfPage() {
  return (
    // Light, like the guide section on /oferta/olx (cream + warm brown).
    <div className="min-h-screen bg-[#f6f2ea] text-[#2f2a24]">
      <SeoPageHead
        title={TITLE}
        description={DESCRIPTION}
        canonicalPath={GUIDE_PDF_PATH}
        keywords={["ghidul mirilor", "ghidul mirilor pdf", "ghid pentru miri", "ghid nunta pdf", "sfaturi pentru miri", "organizare nunta"]}
        breadcrumbs={[{ label: "Acasă", to: "/" }, { label: "Ghidul Mirilor PDF" }]}
        schema={schema}
      />
      {/* The site Navbar is white text for dark pages — a plain dark wordmark here instead. */}
      <header className="px-6 py-6">
        <Link to="/" className="text-xs font-semibold uppercase tracking-[0.35em] text-[#2f2a24] hover:text-black">Anca Visuals</Link>
      </header>

      <main>
        {/* ── Headline + who wrote it ── */}
        <section className="mx-auto grid max-w-5xl items-center gap-12 px-6 pb-16 pt-8 md:pt-16 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
          {/* First on phones (floating, above the headline); left of the text on desktop, as on
              /oferta/olx — the cover swings open to the left, into empty space. */}
          {/* Phones: room under the book so its floating shadow doesn't smudge the text. Keep the
              book's own width (max 250px): the cover's text is sized for it and overflows when smaller. */}
          <div className="pb-8 md:pb-0">
            <GuideBook />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8a6d3b]">PDF gratuit · 30 de pagini</p>
            <h1 className="mt-5">
              {/* Two lines on purpose; the underline sits under „Mirilor" only, as wide as the word. */}
              <span className="block text-4xl font-bold uppercase leading-[1.05] tracking-[0.14em] sm:text-6xl">
                Ghidul{" "}
                <span className="relative inline-block whitespace-nowrap pb-3">
                  Mirilor
                  {/* Hand-drawn underline, traced once on load. */}
                  <svg aria-hidden="true" viewBox="0 0 300 16" preserveAspectRatio="none" className="guide-underline absolute -bottom-1 left-0 text-[#8a6d3b] h-3 w-[calc(100%-0.14em)] sm:h-4">
                    <path d="M3 11 C 60 4, 120 3, 180 6 S 270 12, 297 5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" pathLength={1} />
                  </svg>
                </span>
              </span>
              <span className="mt-6 block text-xl font-light leading-snug text-[#5c5348] sm:text-2xl">
                Ce ar fi vrut să știe <span className="underline decoration-[#8a6d3b] decoration-2 underline-offset-[6px]">mirii înainte de ziua cea mare</span>
              </span>
            </h1>
            <style>{".guide-underline path{stroke-dasharray:1;stroke-dashoffset:1;animation:guideUnderline 1.1s .3s cubic-bezier(.65,0,.35,1) forwards}@keyframes guideUnderline{to{stroke-dashoffset:0}}@media (prefers-reduced-motion:reduce){.guide-underline path{animation:none;stroke-dashoffset:0}}"}</style>
            <div className="mt-8 space-y-4 text-base leading-relaxed text-[#5c5348] sm:text-lg">
              <p>
                Un ghid pentru miri scris de <strong className="font-bold text-[#2f2a24]">Daniel și Estera</strong>, de la{" "}
                <strong className="font-bold text-[#2f2a24]">Anca Visuals</strong>, din nunțile la care am lucrat împreună ca echipă foto-video.
              </p>
              <p>
                Lângă sfaturile noastre veți găsi <strong className="font-bold text-[#2f2a24]">răspunsurile mirilor și mireselor care au trecut deja prin asta</strong>:
                experiențe agregate și colectate de pe forumuri, bloguri și site-uri de nunți din România și din alte țări,
                traduse fidel și fără nume. Fiecare mărturie are sursa trecută la finalul ghidului.
              </p>
            </div>
          </div>
        </section>

        {/* ── Download ── */}
        <section className="border-t border-[#2f2a24]/10 px-6 py-16 text-center sm:py-24">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-light sm:text-3xl">Descărcați Ghidul Mirilor în PDF</h2>
            <p className="mt-4 leading-relaxed text-[#5c5348]">
              <strong className="font-bold text-[#2f2a24]">Gratuit, fără email și fără telefon.</strong> Îl puteți citi pe telefon sau îl puteți printa și bifa împreună lista de verificare.
            </p>
            {/* A word from us, right before the button (owner, 2026-10-26). */}
            <figure className="mx-auto mt-12 max-w-md">
              {/* A framed photo hanging on the wall: nail + string, wooden frame, white mat, slight tilt. */}
              <div className="relative mx-auto w-48 pt-10 sm:w-52">
                <svg aria-hidden="true" viewBox="0 0 100 40" className="absolute left-0 top-0 h-10 w-full text-[#5c4630]">
                  <circle cx="50" cy="4" r="3" fill="currentColor" />
                  <path d="M50 4 L18 40 M50 4 L82 40" stroke="currentColor" strokeWidth="1" fill="none" />
                </svg>
                <div className="-rotate-2 bg-gradient-to-br from-[#8a6440] via-[#5c4126] to-[#3d2a17] p-2.5 shadow-[0_24px_40px_-16px_rgba(47,42,36,0.6),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
                  <div className="bg-[#fdfbf6] p-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)]">
                    <img
                      src={FACES_PHOTO_URL}
                      alt="Daniel și Estera, Anca Visuals"
                      width={256}
                      height={320}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[4/5] w-full object-cover ring-1 ring-black/10"
                    />
                  </div>
                </div>
              </div>
              <figcaption className="mt-8 text-base leading-relaxed text-[#5c5348] sm:text-lg">
                <strong className="font-bold text-[#2f2a24]">Noi suntem Daniel și Estera</strong> și{" "}
                <strong className="font-bold text-[#2f2a24]">sperăm să vă ajute acest ghid</strong>. Chiar dacă țineți cont
                de un singur lucru din{" "}
                <strong className="font-bold text-[#2f2a24] underline decoration-2 underline-offset-4">acest PDF</strong>, cu siguranță veți ieși{" "}
                <span className="whitespace-nowrap font-semibold text-emerald-700 underline decoration-emerald-600 decoration-2 underline-offset-4">foarte câștigați</span>.
              </figcaption>
            </figure>
            <div className="mt-10">
              <DownloadButton />
            </div>
          </div>
        </section>
      </main>

      <Footer light />
    </div>
  );
}
