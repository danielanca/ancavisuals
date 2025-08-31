import React, { useEffect, useState } from 'react';
import { sendTriggerEmail } from '../../../client/utils/triggers';

const Hero = () => {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowVideo(true);
      sendTriggerEmail({ typeEvent: 'HeroVideo_START', url: window.location.pathname });
    }, 2500); // 2 secunde întârziere

    return () => clearTimeout(timer);
  }, []);

  return (
    <section className='relative h-screen flex items-center justify-center overflow-hidden'>
      <div className='absolute inset-0 flex'>
        <div className='w-full h-full relative'>
          {/* Fallback image */}
          {!isVideoLoaded && (
            <img
              src='https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FVertical-225.jpg?alt=media&token=bc2c762a-569a-4858-bfd6-5c46a34428ed'
              alt='Fallback'
              className='absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-700'
            />
          )}

          {/* Video appears after 2s */}
          {showVideo && (
            <video
              autoPlay
              muted
              loop
              playsInline
              className='w-full h-full object-cover z-0'
              onCanPlayThrough={() => setIsVideoLoaded(true)}
            >
              <source
                src='https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fvideos%2FFaraPOVText.mp4?alt=media&token=b6ea3ef1-13a1-4617-b246-f10a47d9b8e8'
                type='video/mp4'
              />
            </video>
          )}

          <div className='absolute inset-0 bg-black/20 z-20'></div>
        </div>
      </div>

      {/* Text Overlay */}
      <div className='relative z-40 text-center px-4 md:px-6'>
        <p className='text-xs md:text-sm lg:text-base tracking-[0.2em] md:tracking-[0.3em] uppercase mb-6 md:mb-8'>
          FOTOGRAFIE & VIDEOGRAFIE EVENIMENT
        </p>
        <h1 className='text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-extralight tracking-[0.02em] md:tracking-[0.05em] leading-tight'>
          PENTRU AMINTIRI
          <br />
          <span className='text-2xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl'>CE RAMÂN O VIAȚĂ</span>
        </h1>
      </div>

      {/* Scroll Indicator */}
      <div className='absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40'>
        <div className='w-px h-16 bg-white/50 mx-auto mb-4'></div>
        <p className='text-xs tracking-[0.3em] uppercase text-gray-300 rotate-90 origin-center'>Scroll</p>
      </div>
    </section>
  );
};

export default Hero;
