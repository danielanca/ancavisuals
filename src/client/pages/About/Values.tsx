import React from 'react';
import { useState } from "react"
import { Link } from 'react-router-dom';

const Values = () => {
    return (
        <section className="py-24 lg:py-32 px-6 bg-black">
            <div className="max-w-7xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-20 items-start">
                    <div className="space-y-16">
                        <h2 className="text-6xl md:text-8xl lg:text-9xl font-extralight tracking-[0.05em] leading-[0.85]">
                            VALUES
                        </h2>

                        <div className="space-y-12">
                            <div className="space-y-4">
                                <h3 className="text-2xl md:text-3xl font-light tracking-wide">AUTHENTICITY</h3>
                                <p className="text-gray-300 leading-relaxed text-lg">
                                    We believe in capturing real moments, real emotions, and real connections. No forced poses, no
                                    artificial scenarios—just the beautiful, messy, perfect truth of who you are and how you love. Every
                                    image should feel like a genuine reflection of your story.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-2xl md:text-3xl font-light tracking-wide">ARTISTRY</h3>
                                <p className="text-gray-300 leading-relaxed text-lg">
                                    Every frame is composed with intention, every moment captured with artistic vision and technical
                                    mastery. We don't just document events—we create visual heirlooms that will be treasured and admired
                                    for generations, growing more precious with time.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-2xl md:text-3xl font-light tracking-wide">INTENTIONALITY</h3>
                                <p className="text-gray-300 leading-relaxed text-lg">
                                    Film photography demands presence, patience, and purpose. Every click of the shutter is deliberate,
                                    every frame precious and irreplaceable. This mindfulness creates images with soul, substance, and
                                    emotional depth that transcends mere documentation.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-2xl md:text-3xl font-light tracking-wide">TIMELESSNESS</h3>
                                <p className="text-gray-300 leading-relaxed text-lg">
                                    While trends come and go, true beauty endures forever. We create images that will feel as relevant,
                                    moving, and breathtaking in 50 years as they do today—classic, elegant, and eternally beautiful.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/f81cf698-98dd-404d-92d7-273060128732/Alexa+Alex+Home-253.jpg?format=2500w"
                            alt="Film photography process - hands developing film"
                            className="w-full h-full object-cover rounded-sm"
                        />
                        <div className="grid grid-cols-2 gap-6">
                            <div className="aspect-square relative">
                                <img
                                    src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/a767f6b3-30c7-4c2c-b6ce-8fa60f4ab00c/Credit+-+Oli+Sansom%2FBriars+Atlas?format=1500w"
                                    alt="Vintage camera collection on wooden table"
                                    className="w-full h-full object-cover rounded-sm"
                                />
                            </div>
                            <div className="aspect-square relative">
                                <img
                                    src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/1dfa5b08-9918-434f-8d41-e04957b4f4bb/000056.jpg?format=750w"
                                    alt="Film strips hanging in darkroom"
                                    className="w-full h-full object-cover rounded-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Values;