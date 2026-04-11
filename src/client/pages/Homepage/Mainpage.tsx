import React from "react";
import "../../globals.css";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import Hero from "./Hero";
import Featured from "./Featured";
import Philosophy from "./Philosophy";
import Approach from "./Approach";
import CTAPreview from "./CTAPreview/CTAPreview";
import Faq from "../Faq/Faq";
import MyVideo from "../Videos/MyVideo";
import { Link } from "react-router-dom";
import { CITIES } from "../LocationSEO/locationData";

const Mainpage = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <SeoPageHead
        title="Anca Visuals | Fotograf, Videograf și Foto Video Pentru Nunți, Botezuri și Evenimente"
        description="Anca Visuals oferă fotografie, videografie, pachete foto-video, fotocabină și Video Booth 360 pentru nunți, botezuri, majorate și evenimente în Turda, Cluj, Sibiu, Alba, Arad, Bistrița și împrejurimi."
        canonicalPath="/"
        schema={[
          {
            "@type": "Organization",
            "@id": "https://www.ancavisuals.ro/#organization",
            name: "Anca Visuals",
            url: "https://www.ancavisuals.ro/",
            telephone: "+40745469907",
            sameAs: ["https://instagram.com/ancavisuals", "https://tiktok.com/@ancavisuals"],
          },
          {
            "@type": "ProfessionalService",
            "@id": "https://www.ancavisuals.ro/#service",
            name: "Anca Visuals",
            url: "https://www.ancavisuals.ro/",
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
      <CTAPreview />
      <Featured />
      <MyVideo
        src="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FBucurestiNunta.mp4?alt=media&token=74d6a5b5-0906-45e1-950c-9632bba7889b"
        poster=""
      />
      <MyVideo
        src="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FVideo_Daniel_Ana_instagram.mp4?alt=media&token=e9ca7716-f49b-4dfa-aa11-39fc3bd20cf3"
        poster="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FVideo_Daniel_Ana_instagram.mp4.jpg?alt=media&token=359882e0-7e12-4925-bb31-bcb5978fa59a"
      />
      <MyVideo
        src="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FClaudiu%20Scurt.mp4?alt=media&token=c79e0f29-501f-4efb-be3a-73f52b3d2e38"
        poster="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FClaudiu%20Scurt.jpg?alt=media&token=02cc0535-5268-43fb-8a6c-63ede75b2c6f"
      />
      <Philosophy />
      <Approach />
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-light">Servicii foto, video și foto-video</h2>
            <p className="mt-4 text-sm leading-7 text-gray-300">
              Lucrăm pentru nunți, botezuri, majorate și evenimente private. Pe lângă pachetele de
              fotografie și videografie, putem include fotocabină și Video Booth 360.
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
          <article className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-light">Lucrăm în orașe mari și mici</h2>
            <p className="mt-4 text-sm leading-7 text-gray-300">
              Acoperim Turda, Cluj-Napoca, Sibiu, Alba Iulia, Sebeș, Arad, Bistrița, Târgu Mureș,
              Luduș și multe alte localități din zonă.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/orase" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/25">
                Vezi toate orașele
              </Link>
              <Link to="/contact" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/25">
                Configurează oferta
              </Link>
            </div>
          </article>
        </div>
      </section>
      <Faq />
      <Footer />
    </div>
  );
};

export default Mainpage;
