import React from 'react';
import { useState } from "react"
import { Link } from 'react-router-dom'; 

const Bio = () => {
  return (
 <section className="py-24 lg:py-32 px-6 bg-amber-50 text-black">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-extralight tracking-[0.05em] mb-8">HI BABE</h2>
            <div className="space-y-6 text-base md:text-lg leading-relaxed text-gray-800">
              <p>
                I'm Alexa, and I've been chasing light and capturing souls for over a decade. What started as a college
                photography class turned into an obsession with the magic that happens when film meets light, when
                authentic moments unfold naturally, and when two people are so lost in each other that they forget the
                camera exists.
              </p>
              <p>
                My journey began in the mountains of Colorado, where I first fell in love with the way golden hour light
                dances across faces and landscapes alike. There's something about film that digital just can't
                replicate—the grain tells stories, the colors breathe with life, and every single frame carries the
                weight of intention because you can't just delete and try again.
              </p>
              <p>
                When I'm not behind the camera, you'll find me hiking with my partner Alex, experimenting with new film
                stocks in my darkroom, or curled up with a good book and way too much coffee. I believe that to capture
                authentic moments, you must first live authentically yourself—which means embracing the messy,
                beautiful, imperfect reality of being human.
              </p>
              <p>
                My approach is simple: be present, be patient, and let your story unfold naturally. I'm not here to
                direct your day or pose you into perfection—I'm here to witness the magic that already exists between
                you and transform it into something that will make your heart skip a beat for generations to come.
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] relative">
              <img
                src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/50cd41ed-e70f-481a-a5ff-232a6bdd584e/Screen+Shot+2024-10-21+at+3.27.19+PM.jpg?format=2500w"
                alt="Alexa in her element, camera in hand, natural light"
                className="w-full h-full object-cover rounded-sm shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>
      );
};

export default Bio;