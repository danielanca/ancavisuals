import React from "react";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Breadcrumbs from "../../components/SEO/Breadcrumbs";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import Portfoliohero from "./Hero";
import PortfolioGallery from "./PortfolioGallery";
import "./Portfolio.css";
import { Link } from "react-router-dom";

const Portfolio = () => {
  const breadcrumbs = [
    { label: "Acasă", to: "/" },
    { label: "Portofoliu" },
  ];
  return (
    <>
      <SeoPageHead
        title="Portofoliu Foto Video | Nunți, Botezuri și Evenimente | Anca Visuals"
        description="Vezi portofoliul Anca Visuals pentru fotografie, videografie și pachete foto-video de nuntă, botez, majorat și evenimente private."
        canonicalPath="/portofoliu"
        breadcrumbs={breadcrumbs}
        schema={{
          "@type": "CollectionPage",
          "@id": "https://www.ancavisuals.ro/portofoliu#collection",
          name: "Portofoliu Anca Visuals",
          description:
            "Colecție de imagini și materiale vizuale din nunți, botezuri, majorate și evenimente private.",
        }}
        keywords={[
          "portofoliu fotograf nunta",
          "portofoliu videograf botez",
          "galerie foto video evenimente",
          "anca visuals portofoliu",
        ]}
      />
      <Navbar />
      <div className="mx-auto max-w-6xl px-6 pt-28">
        <Breadcrumbs items={breadcrumbs} />
      </div>
      <Portfoliohero />
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white">
            <h2 className="text-2xl font-light">Ce vezi în portofoliu</h2>
            <p className="mt-4 text-sm leading-7 text-gray-300">
              Portofoliul include imagini din nunți, botezuri, majorate și evenimente private.
              Dacă vrei să vezi exemple mai aproape de orașul tău, intră în paginile locale.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/foto-video-nunta" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/25">
                Foto video nuntă
              </Link>
              <Link to="/foto-video-botez" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/25">
                Foto video botez
              </Link>
              <Link to="/foto-video-evenimente" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/25">
                Foto video evenimente
              </Link>
            </div>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white">
            <h2 className="text-2xl font-light">Intrări rapide pe orașe</h2>
            <p className="mt-4 text-sm leading-7 text-gray-300">
              Dacă te interesează o recomandare locală, intră direct pe paginile pentru Turda, Cluj,
              Sibiu, Alba Iulia, Bistrița sau alte orașe din hub-ul local.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/foto-video-nunta-turda" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/25">
                Turda
              </Link>
              <Link to="/foto-video-nunta-cluj" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/25">
                Cluj-Napoca
              </Link>
              <Link to="/foto-video-nunta-sibiu" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/25">
                Sibiu
              </Link>
              <Link to="/orase" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/25">
                Toate orașele
              </Link>
            </div>
          </article>
        </div>
      </section>
      <PortfolioGallery />
      <Footer />
    </>
  );
};

export default Portfolio;
