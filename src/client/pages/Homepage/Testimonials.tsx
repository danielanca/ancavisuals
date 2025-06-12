import React from 'react';
import { useState } from "react"
import { Link } from 'react-router-dom';

const Testimonials = () => {
    return (
        <section className="py-32 px-6 bg-gray-900">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-20">
                    <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-6 uppercase">Kind Words</h2>
                    <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
                        The greatest honor is being trusted with your most precious moments. Here's what couples have shared about
                        their experience working with Superlove Film.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-16 mb-16">
                    <div className="space-y-6">
                        <div className="text-6xl text-gray-600 font-serif">"</div>
                        <p className="text-lg text-gray-300 leading-relaxed italic -mt-8">
                            Alma captured our wedding day in a way that felt like poetry in motion. Every single image tells a
                            story, and the film quality gives them a timeless feel that digital just can't match. When we look at
                            our photos, we don't just see what happened—we feel transported back to that exact moment, with all the
                            emotions and energy intact. These aren't just photographs; they're heirlooms.
                        </p>
                        <div className="pt-4">
                            <p className="text-white font-medium tracking-wide">Emma & James Richardson</p>
                            <p className="text-gray-400 text-sm">Malibu Wedding, September 2024</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="text-6xl text-gray-600 font-serif">"</div>
                        <p className="text-lg text-gray-300 leading-relaxed italic -mt-8">
                            The way Alma sees light and emotion is truly magical. Our engagement photos feel like they belong in a
                            gallery, but they're also deeply personal and authentic to who we are as a couple. She has this
                            incredible ability to make you forget the camera is there, which results in the most genuine, beautiful
                            images. The film grain adds such character—these photos will be treasured for generations.
                        </p>
                        <div className="pt-4">
                            <p className="text-white font-medium tracking-wide">Maria & David Chen</p>
                            <p className="text-gray-400 text-sm">Big Sur Engagement, October 2024</p>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    <div className="text-center space-y-4">
                        <p className="text-gray-300 italic leading-relaxed">
                            "Working with Alma was like having a friend document our day. She captured moments we didn't even know
                            were happening. The film quality is unmatched."
                        </p>
                        <div>
                            <p className="text-white text-sm font-medium">Sarah & Michael Torres</p>
                            <p className="text-gray-500 text-xs">Napa Valley, 2024</p>
                        </div>
                    </div>

                    <div className="text-center space-y-4">
                        <p className="text-gray-300 italic leading-relaxed">
                            "Every single frame is a work of art. Alma's eye for composition and her mastery of film photography
                            created images that take our breath away every time we look at them."
                        </p>
                        <div>
                            <p className="text-white text-sm font-medium">Jessica & Ryan Park</p>
                            <p className="text-gray-500 text-xs">Joshua Tree, 2024</p>
                        </div>
                    </div>

                    <div className="text-center space-y-4">
                        <p className="text-gray-300 italic leading-relaxed">
                            "The investment in film photography was the best decision we made for our wedding. These images will
                            never go out of style, and the quality is something we'll treasure forever."
                        </p>
                        <div>
                            <p className="text-white text-sm font-medium">Amanda & Chris Johnson</p>
                            <p className="text-gray-500 text-xs">Carmel-by-the-Sea, 2024</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

    );
};

export default Testimonials;