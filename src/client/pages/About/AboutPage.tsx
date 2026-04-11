import React from "react";
import "../../globals.css";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Breadcrumbs from "../../components/SEO/Breadcrumbs";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import AboutHero from "./AboutHero";
import Bio from "./Bio";

const AboutPage = () => {
  const breadcrumbs = [
    { label: "Acasă", to: "/" },
    { label: "Despre" },
  ];
  return (
    <div className="min-h-screen bg-black text-white">
      <SeoPageHead
        title="Despre Anca Visuals | Echipă Foto Video Pentru Nunți, Botezuri și Evenimente"
        description="Află cine este echipa Anca Visuals și cum lucrăm pentru nunți, botezuri, majorate și evenimente private, cu servicii foto, video și foto-video."
        canonicalPath="/despre"
        breadcrumbs={breadcrumbs}
        schema={{
          "@type": "AboutPage",
          "@id": "https://www.ancavisuals.ro/despre#about",
          name: "Despre Anca Visuals",
          description:
            "Pagina despre echipa Anca Visuals, cu informații despre stilul de lucru, servicii foto-video și abordarea în evenimente.",
        }}
        keywords={[
          "despre anca visuals",
          "echipa foto video nunta",
          "fotograf videograf turda",
          "foto video evenimente transilvania",
        ]}
      />
      <Navbar />
      <div className="mx-auto max-w-6xl px-6 pt-28">
        <Breadcrumbs items={breadcrumbs} />
      </div>
      <AboutHero />
      <Bio />
      <Footer />
    </div>
  );
};

export default AboutPage;
