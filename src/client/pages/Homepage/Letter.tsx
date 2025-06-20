import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

const Letter = () => {
  return (
    <section className="py-32 px-6 bg-amber-50 text-black">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <h3 className="text-3xl md:text-4xl font-light tracking-[0.05em]">A LETTER FROM DANI</h3>
          <div className="space-y-6 text-base md:text-lg leading-relaxed">
            <p>Dear beautiful human reading this,</p>
            <p>
              There's something I need to tell you about the magic that happens when we slow down and truly see each
              other. In our hyperconnected, always-on world, we've forgotten the art of being present—really, truly
              present.
            </p>
            <p>
              Film photography is my rebellion against the digital noise. It's my love letter to intentionality, to the
              belief that some moments are too precious to be captured carelessly. When I hold my camera, loaded with
              just 36 frames of possibility, every click becomes a conscious choice.
            </p>
            <p>
              I've spent over a decade perfecting this craft, not just technically, but emotionally. I've learned to
              read the light like poetry, to anticipate the moment before it happens, to become invisible so your
              authentic self can shine through.
            </p>
            <p>
              When you choose film, you're choosing to invest in memories that will age like fine wine—getting more
              beautiful with time, carrying the warmth and character that only analog can provide. Your children's
              children will hold these images and feel the love that created them.
            </p>
            <p>This isn't just photography. This is legacy work.</p>
            <p className="italic pt-4">
              With endless love and light,
              <br />
              <span className="text-2xl font-light">DANI</span>
            </p>
          </div>
        </div>
        <div className="relative">
          <div className="aspect-[4/5] relative">
            <img
              src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/78f7cbf2-b84d-4865-bdae-5b507244d582/000062.jpg?format=2500w"
              alt="Portrait of Alma, film photographer"
              width="500"
              height="600"
              className="w-full h-full object-cover rounded-sm shadow-2xl"
            />
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white rounded-sm shadow-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-light">10+</div>
                <div className="text-xs tracking-wider uppercase">Years</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Letter;
