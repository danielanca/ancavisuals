import React from "react";
import { WWW_ORIGIN } from "../../utils/address";
import { Link, Navigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Breadcrumbs from "../../components/SEO/Breadcrumbs";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import { CITIES, getServiceBySlug, type ServiceType } from "../LocationSEO/locationData";

interface Props {
  serviceSlug: ServiceType;
}

const ServiceHubPage: React.FC<Props> = ({ serviceSlug }) => {
  const service = getServiceBySlug(serviceSlug);

  if (!service) return <Navigate to="/" replace />;

  const canonicalPath = `/foto-video-${service.slug}`;
  const title = `Foto video ${service.accusative} | Orașe și pachete | Anca Visuals`;
  const description = `Descoperă orașele în care Anca Visuals oferă fotografie, videografie și pachete foto-video pentru ${service.accusative}. Vezi paginile locale și cere ofertă.`;
  const breadcrumbs = [
    { label: "Acasă", to: "/" },
    { label: "Servicii", to: "/orase" },
    { label: `Foto video ${service.accusative}` },
  ];

  const schema = {
    "@type": "CollectionPage",
    "@id": `${WWW_ORIGIN}${canonicalPath}#collection`,
    name: title,
    description,
    about: service.nameLong,
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SeoPageHead
        title={title}
        description={description}
        canonicalPath={canonicalPath}
        breadcrumbs={breadcrumbs}
        schema={schema}
        keywords={[
          `foto video ${service.slug}`,
          `fotograf ${service.slug}`,
          `videograf ${service.slug}`,
          `${service.plural} romania`,
        ]}
      />
      <Navbar />

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-32">
        <Breadcrumbs items={breadcrumbs} />
        <div className="mt-8 max-w-4xl">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-200/70">Hub servicii</p>
          <h1 className="mt-4 text-4xl font-light md:text-6xl">
            Foto, video și foto-video pentru {service.accusative}
          </h1>
          <p className="mt-6 text-base leading-8 text-gray-300 md:text-lg">
            Pagina aceasta centralizează toate orașele în care oferim {service.nameLong.toLowerCase()}.
            Dacă vrei să vezi rapid disponibilitatea sau exemple relevante pentru un oraș, mergi pe
            pagina locală și deschide configuratorul din contact.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CITIES.map(city => (
            <Link
              key={city.slug}
              to={`/foto-video-${service.slug}-${city.slug}`}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-white/25"
            >
              <h2 className="text-xl font-medium text-white">{city.name}</h2>
              <p className="mt-3 text-sm leading-7 text-gray-300">
                {service.nameLong} în {city.name}, {city.county}. Locații populare: {city.venues.slice(0, 2).join(", ")}.
              </p>
              <span className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-amber-200/80">
                Vezi pagina locală
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <h2 className="text-2xl font-light">Ce găsești pe paginile locale</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <p className="text-sm leading-7 text-gray-300">
              Fiecare pagină locală are context despre oraș, zone apropiate, locații populare pentru
              eveniment, locuri potrivite pentru poze, review-uri Google și CTA direct spre configurator.
            </p>
            <p className="text-sm leading-7 text-gray-300">
              Dacă vrei doar fotografie, doar videografie sau pachet complet foto-video, structura este
              aceeași, iar canonical-ul este stabil pe varianta `foto-video`.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ServiceHubPage;
