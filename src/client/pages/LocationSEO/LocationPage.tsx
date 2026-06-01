import React from "react";
import { WWW_ORIGIN } from "../../utils/address";
import { Link, Navigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Breadcrumbs from "../../components/SEO/Breadcrumbs";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import {
  CITIES,
  GOOGLE_REVIEWS,
  SERVICES,
  getCityBySlug,
  getServiceBySlug,
} from "./locationData";
import pricesData from "../../../shared/pricing/prices.json";
import PortfolioGallery from "../Portfolio/PortfolioGallery";

const photoPackage = pricesData.packages.find(pkg => pkg.id === "photo");
const videoPackage = pricesData.packages.find(pkg => pkg.id === "video");

if (!photoPackage || !videoPackage) {
  throw new Error("Missing base photo or video packages.");
}

const PACKAGES = [
  ...pricesData.packages.map(pkg => ({
    title: pkg.title,
    price: `${pkg.price} EUR`,
    note: pkg.note,
  })),
  {
    title: "Foto + Video",
    price: `${photoPackage.price + videoPackage.price} EUR`,
    note: "Pachet complet recomandat pentru acoperire foto-video.",
  },
];

const toMapsSearchUrl = (query: string, cityName: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query} ${cityName} Romania`)}`;

interface Props {
  citySlug: string;
  serviceSlug: string;
  canonicalPath: string;
  keywordLabel: string;
}

const LocationPage: React.FC<Props> = ({
  citySlug,
  serviceSlug,
  canonicalPath,
  keywordLabel,
}) => {
  const city = getCityBySlug(citySlug);
  const service = getServiceBySlug(serviceSlug);


  if (!city || !service) return <Navigate to="/" replace />;

  const title = `Foto video ${service.accusative} ${city.name} | Fotograf și videograf | Anca Visuals`;
  const metaDescription = `Anca Visuals oferă foto, video și pachete foto-video pentru ${service.accusative} în ${city.name}. Vezi portofoliu, review-uri Google, prețuri orientative și cere o ofertă personalizată.`;
  const canonicalUrl = `${WWW_ORIGIN}${canonicalPath}`;
  const galleryAltBase = `fotograf video ${service.slug} ${city.slug}`;
  const breadcrumbs = [
    { label: "Acasă", to: "/" },
    { label: "Orașe", to: "/orase" },
    { label: `Foto video ${service.accusative} ${city.name}` },
  ];
  const faqItems = [
    {
      question: `Lucrați pentru ${service.plural} și în ${city.name}, nu doar în oraș?`,
      answer: `Da. Acoperim ${city.name} și zonele apropiate precum ${city.nearbyAreas.join(", ")}.`,
    },
    {
      question: `Oferiți separat foto, video și pachet foto-video pentru ${service.accusative}?`,
      answer:
        "Da. Putem acoperi doar fotografia, doar videografia sau pachetul complet foto-video, în funcție de cum vrei să construiești evenimentul.",
    },
    {
      question: `Cum cer o ofertă pentru ${service.accusative} în ${city.name}?`,
      answer:
        "Intră în configuratorul de ofertă, alege data, tipul evenimentului și opțiunile dorite. Revenim rapid cu disponibilitatea și propunerea potrivită.",
    },
  ];

  const schemaOrg = [
    {
      "@type": "ProfessionalService",
      "@id": `${canonicalUrl}#service`,
      name: "Anca Visuals",
      url: canonicalUrl,
      image: `${WWW_ORIGIN}/android-chrome-512x512.png`,
      description: metaDescription,
      telephone: "+40745469907",
      areaServed: [
        { "@type": "City", name: city.name },
        ...city.nearbyAreas.map(area => ({ "@type": "City", name: area })),
      ],
      serviceType: [
        "Fotografie eveniment",
        "Videografie eveniment",
        "Foto-video eveniment",
        service.nameLong,
      ],
      priceRange: `${Math.min(...pricesData.packages.map(pkg => pkg.price))} EUR - ${photoPackage.price + videoPackage.price} EUR`,
      sameAs: ["https://instagram.com/ancavisuals", "https://tiktok.com/@ancavisuals"],
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "5",
        reviewCount: String(GOOGLE_REVIEWS.length),
        bestRating: "5",
        worstRating: "1",
      },
      review: GOOGLE_REVIEWS.slice(0, 4).map(review => ({
        "@type": "Review",
        author: { "@type": "Person", name: review.author },
        reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
        reviewBody: review.text,
        publisher: { "@type": "Organization", name: "Google Business Profile" },
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${canonicalUrl}#faq`,
      mainEntity: faqItems.map(item => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <SeoPageHead
        title={title}
        description={metaDescription}
        canonicalPath={canonicalPath}
        breadcrumbs={breadcrumbs}
        schema={schemaOrg}
        keywords={[
          `${keywordLabel} ${service.slug} ${city.name}`,
          `foto video ${service.slug} ${city.name}`,
          `fotograf ${service.slug} ${city.name}`,
          `videograf ${service.slug} ${city.name}`,
          `${service.plural} ${city.name}`,
        ]}
      />

      <Navbar />

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_44%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <Breadcrumbs items={breadcrumbs} className="mb-8" />
          <p className="mb-4 text-xs uppercase tracking-[0.35em] text-amber-200/70">
            {city.county} · România · {keywordLabel}
          </p>
          <h1 className="max-w-4xl text-4xl font-light leading-tight md:text-6xl">
            Foto, video și foto-video pentru {service.accusative} în{" "}
            <span className="font-semibold">{city.name}</span>
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-gray-300 md:text-lg">
            {service.description} În {city.name}, lucrăm {service.shortPitch}. {city.intro}
          </p>

          <div className="mt-8 flex flex-wrap gap-3 text-sm text-gray-300">
            <span className="rounded-full border border-white/15 px-4 py-2">
              25 review-uri de 5 stele pe Google
            </span>
            <span className="rounded-full border border-white/15 px-4 py-2">
              Pachete foto, video și foto-video
            </span>
            <span className="rounded-full border border-white/15 px-4 py-2">
              Acoperire în {city.name} și împrejurimi
            </span>
            <span className="rounded-full border border-white/15 px-4 py-2">
              Fotocabină și Video Booth 360 disponibile
            </span>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/contact"
              className="rounded-full bg-white px-6 py-3 text-sm font-medium uppercase tracking-[0.18em] text-black transition-transform hover:-translate-y-0.5"
            >
              Configurează oferta
            </Link>
            <Link
              to="/portofoliu"
              className="rounded-full border border-white/20 px-6 py-3 text-sm uppercase tracking-[0.18em] text-white transition-colors hover:border-white"
            >
              Vezi portofoliul
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-3">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-medium text-white">Unde lucrăm în {city.name}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {city.nearbyAreas.map(area => (
              <a
                key={area}
                href={toMapsSearchUrl(area, city.name)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-gray-300 transition-colors hover:border-white/25 hover:text-white"
              >
                {area}
              </a>
            ))}
          </div>
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-medium text-white">Locații populare</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {city.venues.map(venue => (
              <a
                key={venue}
                href={toMapsSearchUrl(venue, city.name)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-gray-300 transition-colors hover:border-white/25 hover:text-white"
              >
                {venue}
              </a>
            ))}
          </div>
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-medium text-white">Locuri bune pentru cadre</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {city.photoSpots.map(spot => (
              <a
                key={spot}
                href={toMapsSearchUrl(spot, city.name)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-gray-300 transition-colors hover:border-white/25 hover:text-white"
              >
                {spot}
              </a>
            ))}
          </div>
        </article>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-light md:text-3xl">
            {service.nameLong} în {city.name}
          </h2>
          <p className="mt-5 text-base leading-8 text-gray-300">
            Anca Visuals acoperă {service.plural} în {city.name} și în localitățile din jur, cu
            aceeași atenție pentru lumină, emoție și ritmul natural al zilei. Ne adaptăm ușor
            atât la evenimente intime, cât și la săli mari, iar livrarea rămâne clară: fotografie,
            videografie sau pachet foto-video, în funcție de cum vrei să construiești evenimentul.
          </p>
          <p className="mt-4 text-base leading-8 text-gray-300">
            {city.name} este {city.description}. Tocmai de aceea, alegem un stil de lucru care
            profită de locație fără să facă totul să pară regizat. Ne interesează mai mult să
            păstrăm ziua reală decât să o transformăm într-un shooting continuu.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-4 pt-10">
        <h2 className="text-2xl font-light tracking-wide text-center mb-4">Din portofoliul nostru</h2>
      </section>
      <PortfolioGallery altBase={galleryAltBase} />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-light md:text-3xl">Review-uri Google</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-400">
              Recenzii reale de la clienți care au lucrat cu noi pentru nunți, botezuri și alte
              evenimente.
            </p>
          </div>
          <div className="hidden text-right text-sm text-amber-200/80 md:block">
            Rating Google: 5/5 din 25 review-uri
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {GOOGLE_REVIEWS.map(review => (
            <article
              key={`${review.author}-${review.relativeDate}`}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-medium text-white">{review.author}</h3>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                    Google · {review.relativeDate}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
                  5/5
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-gray-300">{review.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-light tracking-wide text-center mb-10">
          Pachete disponibile pentru {service.accusative} în {city.name}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {PACKAGES.map(pkg => (
            <div
              key={pkg.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-white/25"
            >
              <h3 className="text-lg font-semibold mb-1">{pkg.title}</h3>
              <p className="text-2xl font-light text-white mb-2">{pkg.price}</p>
              <p className="text-sm leading-7 text-gray-400">{pkg.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 md:p-10">
          <h2 className="text-2xl font-light md:text-3xl">
            Extra opționale pentru eveniment
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300">
            Pe lângă fotografia și videografia clasică, putem include și fotocabină sau Video
            Booth 360 pentru un plus de interacțiune în timpul petrecerii. Sunt opțiuni potrivite
            mai ales pentru nunți, majorate și evenimente unde vrei conținut rapid și cadre
            memorabile pentru invitați.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h3 className="text-base font-medium text-white">Fotocabină / Photo Booth</h3>
              <p className="mt-2 text-sm leading-7 text-gray-300">
                Ideală pentru printuri rapide și pentru invitați care vor amintiri pe loc, fără să
                întrerupă ritmul petrecerii.
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h3 className="text-base font-medium text-white">Video Booth 360</h3>
              <p className="mt-2 text-sm leading-7 text-gray-300">
                O soluție bună pentru cadre dinamice, scurte și share-uibile, mai ales la intrări,
                dans și momente cu energie mare.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-8 md:p-10">
          <h2 className="text-2xl font-light md:text-3xl">
            Întrebări frecvente pentru {service.plural} în {city.name}
          </h2>
          <div className="mt-6 grid gap-4">
            {faqItems.map(item => (
              <article key={item.question} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <h3 className="text-base font-medium text-white">{item.question}</h3>
                <p className="mt-2 text-sm leading-7 text-gray-300">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 md:p-10">
          <h2 className="text-2xl font-light md:text-3xl">Servicii conexe în {city.name}</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {SERVICES.map(serviceEntry => (
              <Link
                key={serviceEntry.slug}
                to={`/foto-video-${serviceEntry.slug}-${city.slug}`}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/25 hover:text-white"
              >
                Foto video {serviceEntry.name.toLowerCase()} {city.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-950 py-16 text-center px-6">
        <h2 className="text-2xl md:text-3xl font-light mb-4">
          Configurează oferta pentru {service.accusative} în {city.name}
        </h2>
        <p className="text-gray-400 mb-8 max-w-2xl mx-auto leading-7">
          Dacă vrei doar fotografie, doar videografie sau pachetul complet foto-video, intră în
          configurator, alege data și tipul evenimentului și revenim cu disponibilitatea. Putem
          include și fotocabină sau Video Booth 360 dacă vrei un pachet mai amplu.
        </p>
        <Link
          to="/contact"
          className="inline-block rounded-full bg-white px-8 py-3 text-sm uppercase tracking-[0.2em] text-black transition-transform hover:-translate-y-0.5"
        >
          Deschide configuratorul
        </Link>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-xl font-light text-center mb-8 text-gray-300">
          Alte orașe în care lucrăm
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {CITIES.filter(entry => entry.slug !== city.slug).map(entry => (
            <Link
              key={entry.slug}
              to={`/foto-video-${service.slug}-${entry.slug}`}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-gray-400 transition-colors hover:border-white/25 hover:text-white"
            >
              {entry.name}
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export const LocationPageWrapper: React.FC<{
  citySlug: string;
  serviceSlug: string;
  canonicalPath: string;
  keywordLabel: string;
}> = ({ citySlug, serviceSlug, canonicalPath, keywordLabel }) => (
  <LocationPage
    citySlug={citySlug}
    serviceSlug={serviceSlug}
    canonicalPath={canonicalPath}
    keywordLabel={keywordLabel}
  />
);

export default LocationPage;
