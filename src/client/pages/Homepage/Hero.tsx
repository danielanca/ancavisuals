import React, { useEffect, useState } from "react";
import { getCatalogImageAlt } from "../../utils/imageAlt";

const HERO_IMAGE_URL =
  "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FVertical-225.jpg?alt=media&token=bc2c762a-569a-4858-bfd6-5c46a34428ed";

// Același video de hero folosit pe oferta/olx (PetcuShort.mp4).
const HERO_VIDEO_URL = "https://ancavisuals.b-cdn.net/offers-assets/video/1778536704893-ye9ph3-PetcuShort.mp4";

// Pornește de la 0:59 și se reia tot de acolo, în buclă — fără ultimele
// HERO_VIDEO_LOOP_END_MARGIN secunde (la fel ca tratamentul de pe oferta/olx).
const HERO_VIDEO_LOOP_START = 59;
const HERO_VIDEO_LOOP_END_MARGIN = 6;

const Hero = () => {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowVideo(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 flex">
        <div className="w-full h-full relative">
          {/* Fallback image */}
          {!isVideoLoaded && (
            <img
              src={HERO_IMAGE_URL}
              alt={getCatalogImageAlt(HERO_IMAGE_URL, "Fotografie de eveniment Anca Visuals")}
              className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-700"
            />
          )}

          {/* Video appears after 2s */}
          {showVideo && (
            <video
              src={HERO_VIDEO_URL}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover z-0"
              onCanPlayThrough={() => setIsVideoLoaded(true)}
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                if (Number.isFinite(video.duration) && video.duration > HERO_VIDEO_LOOP_START) {
                  video.currentTime = HERO_VIDEO_LOOP_START;
                }
              }}
              onTimeUpdate={(e) => {
                const video = e.currentTarget;
                if (!Number.isFinite(video.duration)) return;
                const loopEnd = video.duration - HERO_VIDEO_LOOP_END_MARGIN;
                if (loopEnd > HERO_VIDEO_LOOP_START && video.currentTime >= loopEnd) {
                  video.currentTime = HERO_VIDEO_LOOP_START;
                }
              }}
              onEnded={(e) => {
                const video = e.currentTarget;
                video.currentTime = HERO_VIDEO_LOOP_START;
                void video.play();
              }}
            />
          )}

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
