import React from "react";
import "../../globals.css";
import "./contact.css";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Breadcrumbs from "../../components/SEO/Breadcrumbs";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import ContactHero from "./ContactHero";
import BookingWizard from "./booking/BookingWizard";
import { Link } from "react-router-dom";
import { CITIES, SERVICES } from "../LocationSEO/locationData";

const ContactPage = () => {
  const breadcrumbs = [
    { label: "Acasă", to: "/" },
    { label: "Contact" },
  ];
  return (
    <div className="min-h-screen bg-black text-white">
      <SeoPageHead
        title="Contact și Configurator Ofertă | Foto Video Nuntă, Botez și Evenimente | Anca Visuals"
        description="Configurează online oferta pentru fotografie, videografie, pachete foto-video, fotocabină și Video Booth 360. Lucrăm în Turda, Cluj, Sibiu, Alba, Arad, Bistrița și împrejurimi."
        canonicalPath="/contact"
        breadcrumbs={breadcrumbs}
        schema={{
          "@type": "ContactPage",
          "@id": "https://www.ancavisuals.ro/contact#contact",
          name: "Contact și configurator ofertă Anca Visuals",
          description:
            "Pagină de contact și configurare ofertă pentru foto, video, foto-video, fotocabină și Video Booth 360.",
        }}
        keywords={[
          "oferta fotograf nunta",
          "oferta videograf botez",
          "configurator foto video",
          "contact anca visuals",
        ]}
      />
      <Navbar />
      <div className="mx-auto max-w-6xl px-6 pt-28">
        <Breadcrumbs items={breadcrumbs} />
      </div>
      <ContactHero />
      <BookingWizard />
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-12">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-light">Ce poți configura aici</h2>
            <p className="mt-4 text-sm leading-7 text-gray-300">
              Alege data, tipul evenimentului, pachetul dorit și spune-ne dacă vrei fotografie,
              videografie, foto-video, fotocabină sau Video Booth 360.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {SERVICES.map(service => (
                <Link
                  key={service.slug}
                  to={`/foto-video-${service.slug}`}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/25"
                >
                  {service.nameLong}
                </Link>
              ))}
            </div>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-light">Lucrăm în</h2>
            <p className="mt-4 text-sm leading-7 text-gray-300">
              Turda, Cluj-Napoca, Dej, Gherla, Sibiu, Mediaș, Alba Iulia, Sebeș, Bistrița, Beclean,
              Târgu Mureș, Luduș, Arad și alte orașe din zonă.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {CITIES.slice(0, 12).map(city => (
                <Link
                  key={city.slug}
                  to={`/foto-video-nunta-${city.slug}`}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/25"
                >
                  {city.name}
                </Link>
              ))}
              <Link to="/orase" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/25">
                Toate orașele
              </Link>
            </div>
          </article>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default ContactPage;
