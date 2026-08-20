import React from "react";
import { WWW_ORIGIN } from "../../utils/address";
import "./contact.css";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Breadcrumbs from "../../components/SEO/Breadcrumbs";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import ContactHero from "./ContactHero";
import BookingWizard from "./booking/BookingWizard";
import AncaVisualsPromo from "../MediaDownload/AncaVisualsPromo";

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
          "@id": `${WWW_ORIGIN}/contact#contact`,
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
      <AncaVisualsPromo compact />
      <Footer />
    </div>
  );
};

export default ContactPage;
