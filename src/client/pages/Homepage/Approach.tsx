import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

const Approach = () => {
  return (
    <section className="py-32 px-6 bg-black">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <h3 className="text-3xl md:text-4xl font-light tracking-[0.05em] leading-tight">
              CAPTURING SOULS,
              <br />
              NOT JUST SMILES
            </h3>
            <div className="space-y-6 text-gray-300 leading-relaxed">
              <p className="text-lg">
                In a world obsessed with perfection, I believe in the raw beauty of authentic imperfection. The laugh
                lines that map a lifetime of joy, the tears that speak of overwhelming love, the quiet moments between
                the grand gestures that reveal who you truly are.
              </p>
              <p>
                Film photography forces us to slow down, to be present, to truly see. Each frame costs something, so
                every click matters. This intentionality creates images that breathe with life, that age like fine wine,
                becoming more precious with each passing year.
              </p>
              <p>
                My approach is documentary-style with an artistic soul. I'm not just capturing what happened—I'm
                preserving the essence of who you are, the energy between you, the love that fills the spaces between
                words. These aren't just photographs; they're heirlooms for generations yet to come.
              </p>
            </div>
            <div className="pt-6">
              <Link
                to="/about"
                className="inline-block text-sm tracking-[0.2em] uppercase border-b border-white pb-1 hover:border-gray-400 transition-colors"
              >
                Learn More About My Approach →
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="aspect-[3/4] group cursor-pointer">
                <img
                  src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/88b207ef-d29a-41b5-a44d-cbf7b32d5636/annie-dustin-previews-13.jpg?format=1500w"
                  alt="Behind the scenes film photography"
                  width="400"
                  height="500"
                  className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="aspect-square group cursor-pointer">
                <img
                  src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/3be0b38f-83e4-499a-9eff-b8105b984b6c/kiki-doug-portfolio-1.jpg?format=1500w"
                  alt="Vintage film camera collection"
                  width="400"
                  height="400"
                  className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>
            <div className="space-y-6 pt-12">
              <div className="aspect-square group cursor-pointer">
                <img
                  src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/4ba8d68b-ab7c-4382-9428-d8441d610073/AC_5607_Portra+800_030861-R1-023-10.jpg?format=2500w"
                  alt="Film development process"
                  width="400"
                  height="400"
                  className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="aspect-[4/3] group cursor-pointer">
                <img
                  src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/b1c915fd-d1df-4dc2-a2e9-129bbcbca946/provence-france-elopement-62.jpg?format=2500w"
                  alt="Artistic film photography setup"
                  width="400"
                  height="300"
                  className="w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Approach;
