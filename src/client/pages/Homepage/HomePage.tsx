import React, { useEffect, useMemo, useState } from "react";
import { WWW_ORIGIN } from "../../utils/address";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import Hero from "./Hero";
import Philosophy from "./Philosophy";
import Approach from "./Approach";
// import CTAPreview from "./CTAPreview/CTAPreview";
import FAQPage from "../Faq/FAQPage";
import VideoPreview from "../Videos/VideoPreview";
import AncaVisualsPromo from "../MediaDownload/AncaVisualsPromo";
import { Link } from "react-router-dom";
import { CITIES } from "../LocationSEO/locationData";

// Videourile sunt administrate din /admin/showcase/homepage_videos, cu liste
// separate pentru desktop si mobil.
//
// Folosite doar cat timp zona nu a fost inca curatoriata din admin, ca sectiunea
// sa nu dispara de pe homepage dupa acest deploy — primul admin care adauga un
// video in /admin/showcase/homepage_videos le inlocuieste definitiv.
const LEGACY_VIDEO_FALLBACK: string[] = [
  "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FBucurestiNunta.mp4?alt=media&token=74d6a5b5-0906-45e1-950c-9632bba7889b",
  "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FVideo_Daniel_Ana_instagram.mp4?alt=media&token=e9ca7716-f49b-4dfa-aa11-39fc3bd20cf3",
  // Mutat aici de la hero — ultimul video din listă.
  "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fvideos%2FFaraPOVText.mp4?alt=media&token=b6ea3ef1-13a1-4617-b246-f10a47d9b8e8",
];

function HomepageVideos() {
  const [zoneData, setZoneData] = useState<{ desktop: string[]; mobile: string[] }>({ desktop: [], mobile: [] });
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetch("/api/showcase-zones/homepage_videos")
      .then((response) => response.json())
      .then((data: { desktop?: string[]; mobile?: string[] }) => {
        const desktop = data.desktop ?? [];
        const mobile = data.mobile ?? [];
        setZoneData(desktop.length === 0 && mobile.length === 0 ? { desktop: LEGACY_VIDEO_FALLBACK, mobile: [] } : { desktop, mobile });
      })
      .catch(() => {});
  }, []);

  // A device without its own curated set falls back to the other device's set.
  const videos = useMemo(() => {
    const list = isMobile && zoneData.mobile.length > 0 ? zoneData.mobile : zoneData.desktop;
    return Array.from(new Set(list));
  }, [zoneData, isMobile]);

  if (videos.length === 0) return null;

  return (
    <div data-track-section="video">
      {videos.map((src) => (
        <VideoPreview key={src} src={src} poster="" />
      ))}
    </div>
  );
}

const HomePage = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <SeoPageHead
        title="Anca Visuals | Fotograf, Videograf și Foto Video Pentru Nunți, Botezuri și Evenimente"
        description="Anca Visuals oferă fotografie, videografie, pachete foto-video, fotocabină și Video Booth 360 pentru nunți, botezuri, majorate și evenimente în Turda, Cluj, Sibiu, Alba, Arad, Bistrița și împrejurimi."
        canonicalPath="/"
        schema={[
          {
            "@type": "Organization",
            "@id": `${WWW_ORIGIN}/#organization`,
            name: "Anca Visuals",
            url: `${WWW_ORIGIN}/`,
            telephone: "+40745469907",
            sameAs: ["https://instagram.com/ancavisuals", "https://tiktok.com/@ancavisuals"],
          },
          {
            "@type": "ProfessionalService",
            "@id": `${WWW_ORIGIN}/#service`,
            name: "Anca Visuals",
            url: `${WWW_ORIGIN}/`,
            description:
              "Servicii foto, video și foto-video pentru nunți, botezuri, majorate și evenimente private.",
            areaServed: CITIES.map(city => ({ "@type": "City", name: city.name })),
            serviceType: [
              "Fotografie nuntă",
              "Videografie nuntă",
              "Foto video botez",
              "Foto video evenimente",
              "Fotocabină",
              "Video Booth 360",
            ],
          },
        ]}
        keywords={[
          "fotograf turda",
          "videograf cluj",
          "foto video sibiu",
          "fotograf alba iulia",
          "videograf bistrita",
        ]}
      />
      <Navbar />
      <Hero />
      {/* <CTAPreview /> */}
      <AncaVisualsPromo />
      <HomepageVideos />
      <Philosophy />
      <div data-track-section="servicii"><Approach /></div>
      <div data-track-section="întrebări frecvente"><FAQPage /></div>
      <Footer />
    </div>
  );
};

export default HomePage;
