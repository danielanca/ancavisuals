'use client';
import React from 'react';
import { TypeAnimation } from 'react-type-animation';
import { motion } from 'framer-motion';
const phrases = [
  'Lumină care spune povești.',
  2500,
  'Clipe care rămân vii.',
  2500,
  'Viziunea mea, amintirile tale.',
  2500,
];

const Portfoliohero = () => {
  return (
    <section className='relative flex items-center justify-center w-full min-h-[80vh] px-6 py-24 md:py-32 bg-neutral-950 overflow-hidden'>
      <div className='absolute inset-0 -z-10'>
        <div className='absolute inset-0 bg-black/50' />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className='text-center'
      >
        <h1 className='font-display font-semibold leading-tight tracking-tight text-[2rem] md:text-6xl text-white inline-block relative'>
          <TypeAnimation
            sequence={phrases}
            wrapper='span'
            cursor={true}
            speed={70}
            repeat={Infinity}
            className='whitespace-nowrap'
          />
        </h1>

        <p className='mt-6 text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto'>
          I don’t just take photos. I frame feelings, light, and little moments that whisper the truth of your story.
        </p>

        <motion.div
          key='underline'
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.9, duration: 0.8, ease: 'easeOut' }}
          className='h-[2px] bg-yellow-200 origin-left mt-6 w-24 mx-auto'
        />
      </motion.div>
    </section>
  );
};

export default Portfoliohero;
