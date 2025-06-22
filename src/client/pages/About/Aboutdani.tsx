import React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const Aboutdani = () => {
  return (
    <section className='relative min-h-screen flex items-center justify-center overflow-hidden'>
      <div className='absolute inset-0 grid grid-cols-1 lg:grid-cols-2 pt-110'>
        {/* Left side - Text */}
        <div className='bg-black flex items-center justify-center p-8 lg:p-16'>
          <div className='text-center lg:text-left'>
            <h1 className='text-5xl md:text-7xl lg:text-8xl xl:text-9xl font-extralight tracking-[0.05em] leading-[0.9]'>
              DESPRE <br />
              <span className='text-4xl md:text-6xl lg:text-7xl xl:text-8xl'>familia ANCA</span>
            </h1>
          </div>
        </div>

        {/* Right side - Image */}
        <div className='relative h-64 lg:h-full'>
          <img
            src='https://images.squarespace-cdn.com/content/v1/6536d7241d25f545badd3b3f/1f315059-74b5-4aa7-9783-e3b660d0d593/superlove-branding--1.jpg?format=2500w'
            alt='Alexa standing on a cliff overlooking dramatic landscape'
            className='object-cover'
          />
          <div className='absolute inset-0 bg-black/20'></div>
        </div>
      </div>
    </section>
  );
};

export default Aboutdani;
