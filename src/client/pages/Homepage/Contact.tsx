import React from 'react';
import { useState } from "react"
import { Link } from 'react-router-dom';

const Contact = () => {
    return (
        <section className="py-32 px-6 bg-amber-50 text-black">
            <div className="max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-16">
                    <div className="space-y-8">
                        <h2 className="text-3xl md:text-4xl font-light tracking-[0.05em] leading-tight">
                            FIND ME
                            <br />
                            ELSEWHERE
                        </h2>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <h3 className="font-medium text-lg tracking-wide">EMAIL</h3>
                                <p className="text-gray-700">hello@superlovefilm.com</p>
                                <p className="text-sm text-gray-500">I personally respond to every inquiry within 24 hours</p>
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-medium text-lg tracking-wide">INSTAGRAM</h3>
                                <p className="text-gray-700">@superlovefilm</p>
                                <p className="text-sm text-gray-500">Daily inspiration and behind-the-scenes moments</p>
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-medium text-lg tracking-wide">BASED IN</h3>
                                <p className="text-gray-700">Los Angeles, California</p>
                                <p className="text-sm text-gray-500">Available for travel worldwide</p>
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-medium text-lg tracking-wide">STUDIO VISITS</h3>
                                <p className="text-gray-700">By appointment in West Hollywood</p>
                                <p className="text-sm text-gray-500">View sample albums and discuss your vision in person</p>
                            </div>
                        </div>

                        <div className="pt-8">
                            <Link
                                to="/contact"
                                className="inline-block bg-black text-white px-8 py-4 text-sm tracking-[0.2em] uppercase hover:bg-gray-800 transition-colors"
                            >
                                Start Your Story
                            </Link>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <h3 className="text-xl font-light mb-6 tracking-wide">COMPREHENSIVE SERVICES</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-2">
                                    <p>• Wedding Photography</p>
                                    <p>• Engagement Sessions</p>
                                    <p>• Elopement Packages</p>
                                    <p>• Portrait Photography</p>
                                    <p>• Maternity & Newborn</p>
                                    <p>• Family Sessions</p>
                                </div>
                                <div className="space-y-2">
                                    <p>• Editorial & Fashion</p>
                                    <p>• Commercial Projects</p>
                                    <p>• Film Processing</p>
                                    <p>• Photography Workshops</p>
                                    <p>• Mentoring Programs</p>
                                    <p>• Print & Album Design</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-light mb-6 tracking-wide">RECOGNITION & AWARDS</h3>
                            <div className="space-y-3 text-sm text-gray-600">
                                <div className="flex justify-between">
                                    <span>The Knot Best of Weddings</span>
                                    <span>2022, 2023, 2024</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>WeddingWire Couples' Choice</span>
                                    <span>2023, 2024</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Fearless Photographers Member</span>
                                    <span>Since 2020</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Film Photography Podcast Guest</span>
                                    <span>2024</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-light mb-6 tracking-wide">RECENT DESTINATIONS</h3>
                            <div className="text-sm text-gray-600 space-y-1">
                                <p>• Tuscany, Italy • Santorini, Greece • Tulum, Mexico</p>
                                <p>• Big Sur, California • Jackson Hole, Wyoming</p>
                                <p>• Martha's Vineyard • Napa Valley • Joshua Tree</p>
                                <p>• Paris, France • Banff, Canada • Maui, Hawaii</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Contact;