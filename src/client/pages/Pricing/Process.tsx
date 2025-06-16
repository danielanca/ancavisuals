import React from 'react';
import { useState } from "react"
import { Link } from 'react-router-dom';

const Process = () => {
    return (
        <section className="py-32 px-6 bg-gray-100 text-black">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-20">
                    <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-6 uppercase">The Experience</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">
                        From our first conversation to your final gallery delivery, every step is designed to be as meaningful as
                        the memories we're creating together.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 mb-16">
                    <div className="bg-white p-8 rounded-sm shadow-lg border border-gray-200 text-center space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-medium tracking-wide">Portrait Experience</h3>
                            <div className="text-4xl font-light text-gray-800">$1,200</div>
                            <p className="text-sm text-gray-500 uppercase tracking-wider">Starting Investment</p>
                        </div>
                        <div className="space-y-4 text-left">
                            <div className="border-t border-gray-200 pt-4">
                                <h4 className="font-medium mb-2">What's Included:</h4>
                                <ul className="text-sm text-gray-600 space-y-1">
                                    <li>• Pre-session consultation & planning</li>
                                    <li>• 2-3 hour photography session</li>
                                    <li>• 4-6 rolls of premium film stock</li>
                                    <li>• Professional lab development</li>
                                    <li>• Expert color correction & editing</li>
                                    <li>• 75-100 high-resolution digital images</li>
                                    <li>• Online gallery with download access</li>
                                    <li>• Print release for personal use</li>
                                </ul>
                            </div>
                            <div className="text-xs text-gray-500 italic">
                                Perfect for engagements, anniversaries, families, and personal branding
                            </div>
                        </div>
                    </div>

                    <div className="bg-black text-white p-8 rounded-sm shadow-2xl border-2 border-gray-800 text-center space-y-6 transform scale-105">
                        <div className="space-y-2">
                            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Most Popular</div>
                            <h3 className="text-2xl font-medium tracking-wide">Wedding Collection</h3>
                            <div className="text-4xl font-light">$4,800</div>
                            <p className="text-sm text-gray-400 uppercase tracking-wider">Complete Experience</p>
                        </div>
                        <div className="space-y-4 text-left">
                            <div className="border-t border-gray-700 pt-4">
                                <h4 className="font-medium mb-2 text-white">What's Included:</h4>
                                <ul className="text-sm text-gray-300 space-y-1">
                                    <li>• Complimentary engagement session</li>
                                    <li>• 8-10 hours wedding day coverage</li>
                                    <li>• 15-20 rolls of premium film stock</li>
                                    <li>• Professional lab development</li>
                                    <li>• Master-level color correction</li>
                                    <li>• 400-600 curated digital images</li>
                                    <li>• Private online gallery</li>
                                    <li>• USB drive with full resolution files</li>
                                    <li>• Print release & archival guidance</li>
                                    <li>• Timeline planning & vendor coordination</li>
                                </ul>
                            </div>
                            <div className="text-xs text-gray-500 italic">Includes travel within 100 miles of Los Angeles</div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-sm shadow-lg border border-gray-200 text-center space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-medium tracking-wide">Elopement Package</h3>
                            <div className="text-4xl font-light text-gray-800">$2,800</div>
                            <p className="text-sm text-gray-500 uppercase tracking-wider">Intimate Celebration</p>
                        </div>
                        <div className="space-y-4 text-left">
                            <div className="border-t border-gray-200 pt-4">
                                <h4 className="font-medium mb-2">What's Included:</h4>
                                <ul className="text-sm text-gray-600 space-y-1">
                                    <li>• Pre-elopement consultation</li>
                                    <li>• 4-6 hours of coverage</li>
                                    <li>• 8-12 rolls of premium film</li>
                                    <li>• Professional development & scanning</li>
                                    <li>• Expert editing & color correction</li>
                                    <li>• 200-300 digital images</li>
                                    <li>• Online gallery with sharing options</li>
                                    <li>• Print release included</li>
                                    <li>• Location scouting assistance</li>
                                </ul>
                            </div>
                            <div className="text-xs text-gray-500 italic">Perfect for intimate ceremonies up to 20 guests</div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-8 rounded-sm">
                    <h3 className="text-2xl font-light mb-6 text-center tracking-wide">Add-On Services</h3>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <span className="font-medium">Second Photographer</span>
                                <span className="text-gray-600">+$800</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <span className="font-medium">Additional Hour of Coverage</span>
                                <span className="text-gray-600">+$400</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <span className="font-medium">Rush Processing (48 hours)</span>
                                <span className="text-gray-600">+$300</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <span className="font-medium">Travel (per day beyond 100 miles)</span>
                                <span className="text-gray-600">+$500</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <span className="font-medium">Custom Album Design</span>
                                <span className="text-gray-600">$800-2,400</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <span className="font-medium">Fine Art Print Package</span>
                                <span className="text-gray-600">$400-1,200</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <span className="font-medium">Film Photography Workshop</span>
                                <span className="text-gray-600">$600</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <span className="font-medium">International Travel</span>
                                <span className="text-gray-600">Custom Quote</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Process;