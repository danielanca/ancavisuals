import React from 'react';
import { useState } from "react"
import { Link } from 'react-router-dom';

const Ourlife = () => {
    return (
        <section className="py-24 lg:py-32 px-6 bg-amber-50 text-black">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-20">
                    <h2 className="text-5xl md:text-7xl lg:text-8xl font-extralight tracking-[0.05em] mb-8">OUR LIFE</h2>
                    <p className="text-gray-600 max-w-4xl mx-auto text-lg md:text-xl leading-relaxed">
                        When we're not capturing your stories, we're living our own. Here's a glimpse into the adventures, quiet
                        moments, creative processes, and everyday magic that inspire our work and fuel our passion for authentic
                        storytelling through the timeless medium of film.
                    </p>
                </div>
 
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                    {/* Row 1 */}
                    <div className="col-span-1 aspect-[3/4]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/1737501034997-F5IQKTG1B1TEUPKSZ5XH/Feb24_EileanStark_-74.jpg?format=2500w"
                            alt="Mountain hiking adventure with backpacks"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-square">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/3be5d983-7ff0-4062-b857-3f2fc22396f2/Screen+Shot+2025-01-27+at+10.30.32+AM.png?format=2500w"
                            alt="Morning coffee and film rolls on table"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-[4/3]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/bcce50bf-1da4-460d-88a6-e47f8c2e5f59/AC_5764_Superia+400_022741-R1-049-23-1.jpg?format=2500w"
                            alt="Travel photography in foreign city"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-[3/4]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/6cd64c53-6b4f-4ea1-86ec-460fd00f4a8e/AC_0541_Cinestill+400D_114111-R1-E009-1.jpg?format=1000w"
                            alt="Behind the scenes at wedding"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-square">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/ad59ae68-6388-4cbd-9e22-2b884138c8b5/Credit+-+Oli+Sansom%2FBriars+Atlas?format=1000w"
                            alt="Vintage camera on wooden surface"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>

                    {/* Row 2 */}
                    <div className="col-span-2 aspect-[2/1]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/a0a532fa-98e6-4b3f-bcf1-24f0de09d22a/AC_1005_Kodak+200_112393-R1-046-21A-1.jpg?format=750w"
                            alt="Landscape photography during golden hour"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-[3/4]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/c255550f-0565-4bf7-96fb-54ae51b82132/AC_2970_Portra+400_113864-R1-073-35-1.jpg?format=1000w"
                            alt="Darkroom development process"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-square">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/d27083f1-b3cc-43de-b186-485c8af3d2b2/Credit+-+Oli+Sansom%2FBriars+Atlas?format=1500w"
                            alt="Film photography workshop teaching"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-[4/3]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/637fab8f-146a-4543-a954-7ae00c98d365/Credit+-+Oli+Sansom%2FBriars+Atlas?format=1500w"
                            alt="Travel moments in nature"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>

                    {/* Row 3 */}
                    <div className="col-span-1 aspect-square">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/c78e59ba-2544-4e77-938d-2a79694451f7/AC_5599_Ilford+XP2_030859-R1-012-4A-1.jpg?format=750w"
                            alt="Studio workspace with film equipment"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-[3/4]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/c150e1bc-a6ee-42a6-a5c3-c513423498bc/000074020014-1.jpg?format=1500w"
                            alt="Personal portrait session outdoors"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-2 aspect-[2/1]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/6f6e59e9-21fd-4366-8e20-b3dc85e8d454/AC_5593_Fuji+400_116564-R1-034-15A.jpg?format=1500w"
                            alt="Road trip adventure with vintage car"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-[3/4]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/ec8adc52-47cf-47cf-ae20-595068be6ae3/Alexa+Alex+Two-335_websize.jpg?format=750w"
                            alt="Creative process and inspiration"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>

                    {/* Row 4 */}
                    <div className="col-span-1 aspect-[4/3]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/27aaba6c-16a0-41a1-8a26-a9d030f6b91d/NorthSkyeHouse_-31.jpg?format=750w"
                            alt="Everyday moments at home"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-square">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/7d6f9c65-d1c3-44c0-b07a-ee06fa421b45/Screen+Shot+2025-01-27+at+10.32.32+AM.png?format=2500w"
                            alt="Film photography gear collection"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-[3/4]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/9d669082-5b15-45ff-889f-e6e5aff7212e/000074020034-1.jpg?format=2500w"
                            alt="Adventure photography in mountains"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-2 aspect-[2/1]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/50a463da-f299-4c0f-8ad7-da1345260e35/70420038_websize.jpg?format=2500w"
                            alt="Sunset photography session by ocean"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>

                    {/* Row 5 */}
                    <div className="col-span-1 aspect-[3/4]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/e89383d6-b037-48c1-b3e0-c59d0ae8dff6/70420011_websize+%281%29.jpg?format=1500w"
                            alt="Personal projects and artistic exploration"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-square">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/6f830eb8-5902-475b-8d15-d84aa25d363f/IMG_0735.jpg?format=2500w"
                            alt="Quiet moments of reflection"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-[4/3]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/47168120-2a40-4185-9985-f18db8b9072e/Credit+-+Oli+Sansom%2FBriars+Atlas?format=2500w"
                            alt="Life behind the camera"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-[3/4]">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/cf4e337e-e6d9-49ee-a1ca-a4a835816a74/AC_5597_Fuji+400_116566-R1-076-36A.jpg?format=750w"
                            alt="Travel photography adventures"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                    <div className="col-span-1 aspect-square">
                        <img
                            src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/e4abdefd-6a56-4c4e-9090-902c1fbfff83/000074020070-1.jpg?format=750w"
                            alt="Creative inspiration and process"
                            className="w-full h-full object-cover rounded-sm"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Ourlife;