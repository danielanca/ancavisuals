import React, { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import { getCityBySlug, getServiceBySlug } from "./locationData";
import pricesData from "../../../data/prices.json";
import { sendTriggerEmail } from "../../utils/triggers";
import PortfolioGallery from "../Portfolio/PortfolioGallery";

const PACKAGES = [
  ...pricesData.packages.map(s => ({ title: s.title, price: `${s.price} EUR`, note: s.note })),
  { title: "Foto + Video", price: `${pricesData.packages.find(s => s.id === "photo")!.price + pricesData.packages.find(s => s.id === "video")!.price} EUR`, note: "Pachet complet recomandat" },
];

interface Props {
  citySlug: string;
  serviceSlug: string;
}

const LocationPage: React.FC<Props> = ({ citySlug, serviceSlug }) => {
  const city = getCityBySlug(citySlug);
  const service = getServiceBySlug(serviceSlug);

  useEffect(() => {
    if (!city || !service) return;
    sendTriggerEmail({ typeEvent: "Vizitator nou pe pagini locale", url: window.location.pathname });
  }, []);

  if (!city || !service) return <Navigate to="/" replace />;

  const title = `Fotograf ${service.name} ${city.name} | Anca Visuals`;
  const metaDescription = `Fotograf și videograf profesionist pentru ${service.name.toLowerCase()} în ${city.name}. Anca Visuals oferă pachete foto-video complete. Vezi prețuri și disponibilitate.`;
  const canonicalUrl = `https://www.ancavisuals.ro/fotograf-${service.slug}-${city.slug}`;

  const schemaOrg = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Anca Visuals",
    description: metaDescription,
    url: canonicalUrl,
    telephone: "+40745469907",
    areaServed: {
      "@type": "City",
      name: city.name,
    },
    serviceType: service.nameLong,
    priceRange: `${Math.min(...pricesData.packages.map(s => s.price))} EUR - ${pricesData.packages.find(s => s.id === "photo")!.price + pricesData.packages.find(s => s.id === "video")!.price} EUR`,
    image: "https://www.ancavisuals.ro/android-chrome-512x512.png",
    sameAs: [
      "https://instagram.com/ancavisuals",
      "https://tiktok.com/@ancavisuals",
    ],
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(schemaOrg)}</script>
      </Helmet>

      <Navbar />

      {/* Hero */}
      <section className="relative h-96 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/80" />
        <div className="relative z-10 text-center px-6">
          <p className="text-xs tracking-[0.3em] uppercase text-gray-400 mb-4">
            {city.county} · România
          </p>
          <h1 className="text-4xl md:text-6xl font-extralight tracking-wide mb-4">
            Fotograf {service.name}
            <br />
            <span className="font-semibold">{city.name}</span>
          </h1>
          <p className="text-gray-300 text-sm md:text-base max-w-xl mx-auto">
            {service.description}
          </p>
        </div>
      </section>

      {/* About city */}
      <section className="py-16 text-center">
        <div style={{ maxWidth: "620px", margin: "0 auto", padding: "0 2rem" }}>
          <h2 className="text-2xl md:text-3xl font-light tracking-wide mb-6">
            {service.nameLong} în {city.name}
          </h2>
          <p className="text-gray-400 leading-relaxed text-base md:text-lg">
            <strong className="text-white">Anca Visuals</strong> acoperă evenimente în{" "}
            <strong className="text-white">{city.name}</strong> și împrejurimi —{" "}
            <span dangerouslySetInnerHTML={{ __html: city.description }} />. Indiferent de locație, aducem același nivel de
            profesionalism, echipament de top și o abordare discretă care lasă
            momentele să se desfășoare natural.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-4">
        <h2 className="text-2xl font-light tracking-wide text-center mb-4">Din portofoliul nostru</h2>
      </section>
      <PortfolioGallery />

      {/* Packages */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-light tracking-wide text-center mb-10">
          Pachete disponibile în {city.name}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {PACKAGES.map(pkg => (
            <div
              key={pkg.title}
              className="border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition-colors"
            >
              <h3 className="text-lg font-semibold mb-1">{pkg.title}</h3>
              <p className="text-2xl font-light text-white mb-2">{pkg.price}</p>
              <p className="text-gray-500 text-sm">{pkg.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-950 py-16 text-center px-6">
        <h2 className="text-2xl md:text-3xl font-light mb-4">
          Rezervă fotograf {service.name.toLowerCase()} în {city.name}
        </h2>
        <p className="text-gray-400 mb-8 max-w-lg mx-auto">
          Verifică disponibilitatea pentru data ta și solicită o ofertă personalizată.
        </p>
        <Link
          to="/contact"
          className="inline-block px-8 py-3 border border-white text-sm tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-colors"
        >
          Solicită Ofertă
        </Link>
      </section>

      {/* Other cities */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-xl font-light text-center mb-8 text-gray-400">
          Acoperim și alte orașe din Transilvania
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {["Sibiu", "Cluj-Napoca", "Brașov", "Alba Iulia", "Turda", "Arad", "Târgu Mureș", "Oradea", "Luduș", "Câmpia Turzii"]
            .filter(c => c !== city.name)
            .map(c => (
              <span key={c} className="text-sm text-gray-500 border border-gray-800 px-3 py-1 rounded-full">
                {c}
              </span>
            ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};

// Wrapper that reads URL params (for dynamic usage if needed)
export const LocationPageWrapper: React.FC<{ citySlug: string; serviceSlug: string }> = ({
  citySlug,
  serviceSlug,
}) => <LocationPage citySlug={citySlug} serviceSlug={serviceSlug} />;

export default LocationPage;
