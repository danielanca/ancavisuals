import React from "react";
import { WWW_ORIGIN } from "../../utils/address";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Breadcrumbs from "../../components/SEO/Breadcrumbs";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import PortfolioHero from "./PortfolioHero";
import PortfolioGallery from "./PortfolioGallery";
import AncaVisualsPromo from "../MediaDownload/AncaVisualsPromo";
import "./Portfolio.css";

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
          "@id": `${WWW_ORIGIN}/portofoliu#collection`,
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
      <div className="mx-auto max-w-6xl px-6 pt-28 pb-6">
        <Breadcrumbs items={breadcrumbs} />
      </div>
      <PortfolioHero />
      <PortfolioGallery />
      <AncaVisualsPromo />
      <Footer />
    </>
  );
};

export default Portfolio;
