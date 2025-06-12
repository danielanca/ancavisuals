import React from 'react';
import { useState } from "react"
import { Link } from 'react-router-dom';

const Philosophy = () => {
    return (
        <section className="py-32 px-6 bg-gray-900">
            <div className="max-w-5xl mx-auto text-center">
                <h2 className="text-4xl md:text-6xl lg:text-7xl font-extralight tracking-[0.05em] mb-12 leading-tight">
                    YOUR MEMORIES
                    <br />
                    <span className="text-2xl md:text-4xl lg:text-5xl text-gray-300">
                        [WRAPPED IN MAGICAL
                        <br />
                        FILM GOODNESS* AND
                        <br />
                        STANDING THE TEST OF TIME]
                    </span>
                </h2>
                <div className="max-w-3xl mx-auto space-y-8">
                    <p className="text-lg md:text-xl text-gray-300 leading-relaxed font-light">
                        There's something magical about film photography that digital just can't replicate. The grain tells
                        stories, the colors breathe with life, and the way light dances across each frame creates pure poetry in
                        motion.
                    </p>
                    <p className="text-base md:text-lg text-gray-400 leading-relaxed">
                        Every shot is intentional, every moment precious, because you can't just delete and try again. This
                        intentionality creates images that don't just capture what happened—they preserve how it felt, how the air
                        smelled, how your heart raced in that perfect, unrepeatable moment.
                    </p>
                    <div className="text-sm text-gray-500 italic pt-8">
                        *Film goodness includes but is not limited to: authentic grain structure, unmatched color depth, archival
                        longevity, and that indefinable soul that makes your heart skip a beat every single time.
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Philosophy;