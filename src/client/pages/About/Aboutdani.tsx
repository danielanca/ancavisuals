import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

const Aboutdani = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 grid grid-cols-1 lg:grid-cols-2 pt-110">
        {/* Left side - Text */}
        <div className="bg-black flex items-center justify-center p-8 lg:p-16">
          <div className="text-center lg:text-left">
            <h1 className="text-5xl md:text-7xl lg:text-8xl xl:text-9xl font-extralight tracking-[0.05em] leading-[0.9]">
              DESPRE <br />
              <span className="text-4xl md:text-6xl lg:text-7xl xl:text-8xl">familia ANCA</span>
            </h1>
          </div>
        </div>

        {/* Right side - Image */}
        <div className="relative h-64 lg:h-full">
          <img
            src="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FDespreNoi%2FMitre-165-2.jpg?alt=media&token=c011ba14-aaa8-4770-aa19-9781d8262013"
            alt="Alexa standing on a cliff overlooking dramatic landscape"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/20"></div>
        </div>
      </div>
    </section>
  );
};

export default Aboutdani;
