import React from 'react';
import { useState } from "react"
import { Link } from 'react-router-dom';

const Featured = () => {
    return (
        <section className="py-32 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-20">
                    <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-6 uppercase">Recent Work</h2>
                    <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        Each frame tells a story of love, connection, and the beautiful imperfection of being human
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    <div className="col-span-1 aspect-square group cursor-pointer">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/50fc73f3-18c0-4408-ae56-feefefccf52e/kiki-doug-crested-butte-wedding-285.jpg?format=2500w"
                            alt="Intimate wedding moment captured on film"
                            width="400"
                            height="400"
                            className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                    <div className="col-span-1 aspect-[4/3] group cursor-pointer">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/3ed2192d-b4ac-4288-a279-693d587fe242/mallory-joseph-superlovefilm-472.jpg?format=1000w"
                            alt="Golden hour engagement session"
                            width="400"
                            height="300"
                            className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                    <div className="col-span-1 aspect-[3/4] group cursor-pointer">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/1733691209392-TX8IBLNIFLIHB03F2HKB/sarah-zach-zion-elopement-27_websize.jpg?format=2500w"
                            alt="Artistic bridal portrait on film"
                            width="400"
                            height="500"
                            className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                    <div className="col-span-1 aspect-square group cursor-pointer">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/55982968-1cd5-4181-8e9e-740a9ffe45bc/katie-josh-hawaii-elopement-250.jpg?format=2500w"
                            alt="Candid family moment"
                            width="400"
                            height="400"
                            className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                    <div className="col-span-2 aspect-[2/1] group cursor-pointer">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/6b770734-4eb7-4c17-a02b-381ad6e6e4b0/lexie-nate-superlove-finals-214.jpg?format=2500w"
                            alt="Wedding ceremony in natural light"
                            width="800"
                            height="400"
                            className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                    <div className="col-span-1 aspect-square group cursor-pointer">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/07453b81-52ce-42ab-8322-0ec1f3ad79ab/sarah-zach-zion-elopement-626.jpg?format=2500w"
                            alt="Romantic couple portrait"
                            width="400"
                            height="400"
                            className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                    <div className="col-span-1 aspect-[3/4] group cursor-pointer">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/1733690667531-IGBQ3MEB0C3GSFDZXEIP/Mallory_Joseph_Previews_-52_websize.jpg?format=2500w"
                            alt="Editorial fashion on film"
                            width="400"
                            height="500"
                            className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                    <div className="col-span-1 aspect-[4/3] group cursor-pointer">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/e8b3bf5f-3ec5-45a9-b200-5644755e2f07/katie-josh-hawaii-elopement-2.jpg?format=2500w"
                            alt="Wedding details and styling"
                            width="400"
                            height="300"
                            className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                    <div className="col-span-1 aspect-square group cursor-pointer">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/dc73b904-7e4f-4c94-8fe9-a6b48a6994ec/CAMP-Washington-EileanStark--2.jpg?format=2500w"
                            alt="Lifestyle portrait session"
                            width="400"
                            height="400"
                            className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                    <div className="col-span-2 aspect-[2/1] group cursor-pointer">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/2e609c78-fec0-46ac-bd98-6319965f7b58/annie-dustin-olympia-wedding-146.jpg?format=2500w"
                            alt="Destination wedding landscape"
                            width="800"
                            height="400"
                            className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Featured;