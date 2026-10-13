import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import ReviewsGrid, { type Review } from "../../components/Reviews/ReviewsGrid";

// Local fixtures only: never saved to siteReviews or used by the offer page.
const demoReviews: Review[] = [
  {
    id: "demo-1", author: "Ana și Vlad · exemplu", city: "Cluj-Napoca", date: "2026-09-12", rating: 5, verified: false,
    text: "Ne era puțin teamă că o să fim rigizi în fața camerei, dar cu Dani și Estera ne-am simțit în largul nostru. Ne-au ghidat când aveam nevoie și au surprins momentele dintre noi fără să simțim că pozăm. Fotografii pline de emoție, exact cum ne doream.",
    photos: [
      "1787017601559-tgnl9d-Picture_0605.webp", "1787017601536-pmgw21-Picture_0466.webp", "1787017601546-ka859y-Picture_0507.webp", "1787017601530-yyjngk-Picture_0429.webp",
    ].map(name => ({ url: `https://ancavisuals.b-cdn.net/offers-assets/photo/${name}`, name: "Fotografie ilustrativă din portofoliu" })),
  },
  {
    id: "demo-2", author: "Ioana și Andrei · exemplu", city: "Turda", date: "2026-08-29", rating: 5, verified: false,
    text: "Filmul nunții ne-a făcut să retrăim toată ziua. Au prins și lucruri pe care noi nici nu le observasem: reacțiile părinților, prietenii de la petrecere și toate micile momente. Ne bucurăm că avem amintirile astea și în fotografii, și în video.",
    photos: [
      "1787017601534-gxsruf-Picture_0452.webp", "1787017601544-5hu7ax-Picture_0570.webp", "1787017601545-q29h4k-Picture_0572.webp", "1787017601514-wgd65f-Picture_0299.webp",
    ].map(name => ({ url: `https://ancavisuals.b-cdn.net/offers-assets/photo/${name}`, name: "Fotografie ilustrativă din portofoliu" })),
  },
  {
    id: "demo-3", author: "Maria și Radu · exemplu", city: "Alba Iulia", date: "2026-08-15", rating: 5, verified: false,
    text: "Fotocabina a fost unul dintre punctele de atracție ale serii. Invitații s-au întors de mai multe ori, iar pozele au rămas o amintire frumoasă pentru toată lumea. Ne-a plăcut că am discutat toate detaliile din timp și în ziua nunții ne-am putut bucura de petrecere.",
    photos: [
      "1787017601544-5hu7ax-Picture_0570.webp", "1787017601566-bfsmuk-Picture_0723.webp", "1787017601525-xgmaob-Picture_0331.webp", "1787017601509-ku8eta-Picture_0419.webp",
    ].map(name => ({ url: `https://ancavisuals.b-cdn.net/offers-assets/photo/${name}`, name: "Fotografie ilustrativă din portofoliu" })),
  },
  {
    id: "demo-4", author: "Elena și Mihai · exemplu", city: "Oradea", date: "2026-07-25", rating: null, verified: false,
    text: "De la prima discuție am știut ce include pachetul și cum o să decurgă colaborarea. În ziua nunții au fost calmi, atenți și mereu aproape când aveam nevoie. Galeria online a fost ușor de trimis familiei. Mulțumim pentru răbdare și pentru amintiri!",
    photos: [
      "1787017601545-q29h4k-Picture_0572.webp", "1787017601566-e26j2m-Picture_0720.webp", "1787017601552-6sm2l1-Picture_0348.webp", "1787017601532-4mvbwu-Picture_0431.webp",
    ].map(name => ({ url: `https://ancavisuals.b-cdn.net/offers-assets/photo/${name}`, name: "Fotografie ilustrativă din portofoliu" })),
  },
];

export default function ReviewsPreviewPage() {
  return (
    <main className="reviews-preview min-h-screen bg-[#faf9f7] text-neutral-950">
      <style>{`
        [data-review-tone="light"] article { background: #fff; border-color: #e5e5e5; box-shadow: 0 12px 30px rgba(17, 17, 17, .06); }
        [data-review-tone="light"] article:hover { border-color: #cfcfcf; }
        [data-review-tone="light"] article h3, [data-review-tone="light"] article p { color: #171717; }
        [data-review-tone="light"] article p.text-neutral-500, [data-review-tone="light"] article p.text-gray-500 { color: #737373; }
        [data-review-tone="light"] article span.text-amber-200 { color: #171717; }
        [data-review-tone="light"].fixed { background: rgba(20, 20, 20, .42); }
        [data-review-tone="light"].fixed > div { background: #fff; border-color: #e5e5e5; }
        [data-review-tone="light"].fixed > div > div { background-color: #f3f1ee; }
        [data-review-tone="light"].fixed > div > div:last-child { background: #fff; }
        [data-review-tone="light"].fixed h3, [data-review-tone="light"].fixed p, [data-review-tone="light"].fixed span { color: #171717; }
        [data-review-tone="light"].fixed .text-gray-500 { color: #737373; }
        [data-review-tone="light"].fixed button { color: #171717; }
        [data-review-tone="light"].fixed > div > div:last-child { padding: 3.25rem 3.5rem; }
        [data-review-tone="light"].fixed > div > div:last-child h3 { font-size: 1.8rem; letter-spacing: -.03em; }
        [data-review-tone="light"] h1, [data-review-tone="light"] h2, [data-review-tone="light"] h3,
        [data-review-tone="light"].fixed h3 { font-family: Georgia, "Times New Roman", serif; font-weight: 500; }
        [data-review-tone="light"] h1, [data-review-tone="light"] h2 { letter-spacing: -.025em; }
        [data-review-tone="light"].fixed > div > div:last-child p.whitespace-pre-line { font-size: 1.05rem; line-height: 1.85; }
        [data-review-tone="light"].fixed > div > div:first-child > img { min-height: 62dvh; object-fit: cover; }
      `}</style>
      <Helmet>
        <title>Previzualizare recenzii OLX | Anca Visuals</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <header className="mx-auto max-w-6xl px-6 pt-10">
        <Link to="/oferta/olx" className="text-sm text-amber-200 underline underline-offset-4">← Oferta OLX</Link>
        <div className="mt-8 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <h1 className="text-lg font-medium">Previzualizare · 4 recenzii de test</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600">Numele, textele, datele și stelele sunt fictive. Fotografiile din portofoliu sunt ilustrative și nu reprezintă autorii exemplelor. Aceste recenzii nu sunt publicate în oferta OLX.</p>
        </div>
      </header>
      <ReviewsGrid
        category="oferta"
        offerSlug="olx"
        layout="horizontal"
        title="Ce spun clienții noștri"
        subtitle="Experiențele celor care ne-au ales pentru evenimentul lor."
        previewReviews={demoReviews}
        reviewTone="light"
      />
    </main>
  );
}
