import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

const Profile = () => {
  return (
    <section className="py-24 lg:py-32 px-6 bg-white text-black">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-20">
          {/* Alexa Profile */}
          <div className="space-y-8">
            <div className="aspect-[3/4] relative mb-8">
              <img
                src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/6248d566-392a-442e-801b-b0d70683835f/AC_1601_Ilford+XP2_020026-R1-029-13.jpg?format=2500w"
                alt="Portrait of Alexa with film camera"
                className="w-full h-full object-cover rounded-sm"
              />
            </div>
            <div className="space-y-6">
              <h3 className="text-4xl md:text-5xl font-extralight tracking-[0.05em]">ALEXA</h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p className="text-lg font-medium text-black">Lead Photographer & Creative Visionary</p>
                <p>
                  Born and raised in the Pacific Northwest, I've always been drawn to the moody, ethereal quality of
                  overcast skies and misty mornings. This aesthetic deeply influences my work—I seek out those quiet,
                  contemplative moments that speak to the soul and reveal the poetry in everyday life.
                </p>
                <p>
                  My technical expertise spans over 20 different film stocks, from the dreamy pastels of Kodak Portra
                  400 to the rich, dramatic tones of Ilford HP5 Plus. I believe that choosing the right film is like
                  choosing the right words for a poem—each has its own voice, character, and emotional resonance.
                </p>
                <p>
                  Beyond weddings, I'm passionate about teaching the art of film photography through workshops and
                  mentoring programs. There's something magical about watching someone fall in love with the analog
                  process for the first time—the anticipation, the intentionality, the beautiful unpredictability of it
                  all.
                </p>
                <p>
                  When I'm not photographing love stories, you'll find me exploring remote hiking trails, collecting
                  vintage cameras, or experimenting with alternative developing techniques in my home darkroom.
                </p>
              </div>
            </div>
          </div>

          {/* Alex Profile */}
          <div className="space-y-8">
            <div className="aspect-[3/4] relative mb-8">
              <img
                src="https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/1bd00c55-0634-479d-a66e-eab142874471/000016080002.jpg?format=2500w"
                alt="Portrait of Alex with documentary style"
                className="w-full h-full object-cover rounded-sm"
              />
            </div>
            <div className="space-y-6">
              <h3 className="text-4xl md:text-5xl font-extralight tracking-[0.05em]">ALEX</h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p className="text-lg font-medium text-black">Documentary Photographer & Storytelling Specialist</p>
                <p>
                  While Alexa captures the poetry, I focus on the raw, unguarded moments that happen in between the
                  planned shots. My background in photojournalism brings a documentary edge to our collaborative work,
                  ensuring that no precious moment—no matter how fleeting—goes unnoticed or uncaptured.
                </p>
                <p>
                  I specialize in capturing the energy and authentic emotion of celebrations—the tears during vows, the
                  explosive laughter during toasts, the quiet conversations between generations, the spontaneous dance
                  floor moments that become family legends. My goal is to be invisible while being everywhere at once.
                </p>
                <p>
                  My approach is rooted in patience and observation. I study the rhythm of your day, learn the dynamics
                  of your family, and position myself to capture those split-second expressions that reveal the true
                  depth of connection and joy.
                </p>
                <p>
                  Together, Alexa and I create a comprehensive visual narrative that honors both the grand, sweeping
                  moments and the intimate, quiet details. We work in perfect harmony, anticipating each other's
                  movements and ensuring complete, seamless coverage of your celebration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Profile;
