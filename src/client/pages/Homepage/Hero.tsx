import React from 'react';
import { useState } from "react"
import { Link } from 'react-router-dom';

const Hero = () => {
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    return (
        <section className="relative h-screen flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 flex">
                <div className="w-full h-full relative">
                    {!isVideoLoaded && (
                        <img
                            src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80"
                            alt="Fallback"
                            className="absolute inset-0 w-full h-full object-cover z-10"
                        />
                    )}
                    <video
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                        onCanPlayThrough={() => setIsVideoLoaded(true)}
                    >
                        <source
                            src="https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4"
                            type="video/mp4"
                        />
                        <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-black/20 z-20"></div>
                </div>
            </div>

            <div className="relative z-10 text-center px-4 md:px-6">
                <p className="text-xs md:text-sm lg:text-base tracking-[0.2em] md:tracking-[0.3em] uppercase text-gray-200 mb-6 md:mb-8">
                    Documentary Film Wedding Photography
                </p>
                <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-extralight tracking-[0.02em] md:tracking-[0.05em] leading-tight">
                    FOR HUMANS
                    <br />
                    <span className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl">CRAVING LIFE</span>
                </h1>
            </div>

            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
                <div className="w-px h-16 bg-white/50 mx-auto mb-4"></div>
                <p className="text-xs tracking-[0.3em] uppercase text-gray-300 rotate-90 origin-center">Scroll</p>
            </div>
        </section>
    );
};

export default Hero;