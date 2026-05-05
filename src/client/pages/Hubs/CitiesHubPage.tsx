import React from "react";
import { WWW_ORIGIN } from "../../utils/address";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Breadcrumbs from "../../components/SEO/Breadcrumbs";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import { CITIES, SERVICES } from "../LocationSEO/locationData";

const CitiesHubPage: React.FC = () => {
  const breadcrumbs = [
    { label: "Acasă", to: "/" },
    { label: "Orașe" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <SeoPageHead
        title="Orașe Acoperite Pentru Foto Video | Anca Visuals"
        description="Vezi orașele în care Anca Visuals oferă fotografie, videografie și pachete foto-video pentru nunți, botezuri, majorate și evenimente private."
        canonicalPath="/orase"
        breadcrumbs={breadcrumbs}
        schema={{
          "@type": "CollectionPage",
          "@id": `${WWW_ORIGIN}/orase#collection`,
          name: "Orașe acoperite pentru foto video",
          description:
            "Hub local cu orașe și pagini pentru servicii foto, video și foto-video oferite de Anca Visuals.",
        }}
        keywords={[
          "fotograf turda",
          "videograf cluj",
          "foto video sibiu",
          "fotograf bistrita",
          "videograf alba iulia",
        ]}
      />
      <Navbar />

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-32">
        <Breadcrumbs items={breadcrumbs} />
        <div className="mt-8 max-w-4xl">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-200/70">Hub local</p>
          <h1 className="mt-4 text-4xl font-light md:text-6xl">Orașe în care lucrăm</h1>
          <p className="mt-6 text-base leading-8 text-gray-300 md:text-lg">
            Anca Visuals oferă servicii foto, video și pachete foto-video în orașe mari și mici din
            Cluj, Mureș, Alba, Sibiu, Bistrița-Năsăud, Arad, Bihor și Brașov. Folosește pagina
            aceasta ca punct de intrare spre serviciul și orașul care te interesează.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {CITIES.map(city => (
            <article key={city.slug} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-medium text-white">{city.name}</h2>
              <p className="mt-3 text-sm leading-7 text-gray-300">
                {city.description}. Zone apropiate: {city.nearbyAreas.slice(0, 3).join(", ")}.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {SERVICES.map(service => (
                  <Link
                    key={`${city.slug}-${service.slug}`}
                    to={`/foto-video-${service.slug}-${city.slug}`}
                    className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-gray-300 transition-colors hover:border-white/25 hover:text-white"
                  >
                    {service.name}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <h2 className="text-2xl font-light">Hub-uri pe servicii</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {SERVICES.map(service => (
              <Link
                key={service.slug}
                to={`/foto-video-${service.slug}`}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/25 hover:text-white"
              >
                Foto video {service.accusative}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CitiesHubPage;
