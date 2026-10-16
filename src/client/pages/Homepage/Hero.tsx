import React from "react";
import { getCatalogImageAlt } from "../../utils/imageAlt";
import HeroVideo from "../CampaignLanding/HeroVideo";

const HERO_IMAGE_URL =
  "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FVertical-225.jpg?alt=media&token=bc2c762a-569a-4858-bfd6-5c46a34428ed";

// Filmul din Bunny Stream (același ca „Vezi-ne la lucru” de pe oferta/olx), streamat adaptiv:
// doar segmentul 0:59–2:07 rulează în buclă (#t=start,end). Înainte era un MP4 4K de 420 MB.
const HERO_VIDEO_STREAM_URL =
  "https://vz-ecdf7b2c-31b.b-cdn.net/c98d7802-3fb4-48a9-acf0-49ebfef3c40e/playlist.m3u8#t=59,127";

const Hero = () => {
  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 flex">
        <div className="w-full h-full relative">
          {/* Poza rămâne dedesubt până pornește clipul (și pe 2G / economizor de date). */}
          <img
            src={HERO_IMAGE_URL}
            alt={getCatalogImageAlt(HERO_IMAGE_URL, "Fotografie de eveniment Anca Visuals")}
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
          <div className="absolute inset-0 z-10">
            <HeroVideo src={HERO_VIDEO_STREAM_URL} />
          </div>

          <div className="absolute inset-0 bg-black/20 z-20"></div>
        </div>
      </div>

      {/* Text Overlay */}
      <div className="relative z-40 text-center px-4 md:px-6">
        <p className="text-xs md:text-sm lg:text-base font-medium tracking-[0.2em] md:tracking-[0.3em] uppercase mb-6 md:mb-8">
          FOTOGRAFIE & VIDEOGRAFIE EVENIMENT
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-light tracking-[0.02em] md:tracking-[0.05em] leading-tight">
          PENTRU AMINTIRI
          <br />
          <span className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl">CE RAMÂN O VIAȚĂ</span>
        </h1>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40">
        <div className="w-px h-16 bg-white/50 mx-auto mb-4"></div>
        <p className="text-xs tracking-[0.3em] uppercase text-gray-300 rotate-90 origin-center">Scroll</p>
      </div>
    </section>
  );
};

export default Hero;
