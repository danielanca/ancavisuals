import React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const Philosophy = () => {
  return (
    <section className='py-32 px-6 bg-gray-900'>
      <div className='max-w-5xl mx-auto text-center'>
        <h2 className='text-4xl md:text-6xl lg:text-7xl font-extralight tracking-[0.05em] mb-12 leading-tight'>
          AMINTIRILE TALE
          <br />
          <span className='text-2xl md:text-4xl lg:text-5xl text-gray-300'>
            [MAI MULT DECÂT POZE,
            <br />
            MAI MULT DECÂT MOMENTE,
            <br />
            SUNT TRĂIRI PĂSTRATE]
          </span>
        </h2>
        <div className='max-w-3xl mx-auto space-y-8'>
          <p className='text-lg md:text-xl text-gray-300 leading-relaxed font-light'>
            Nu e vorba doar despre imagini digitale. E despre zâmbetele sincere, privirile care spun tot și momentele
            care trec prea repede. Fiecare cadru surprinde exact ce contează: emoția trăită, nu doar ce s-a văzut.
          </p>
          <p className='text-base md:text-lg text-gray-400 leading-relaxed'>
            Fiecare fotografie, fiecare secvență video este gândită cu grijă. Pentru că unele clipe nu se mai întorc. Și
            tocmai de aceea, vrem să le păstrăm vii – așa cum au fost simțite: reale, imperfecte și pline de suflet.
          </p>
          <div className='text-sm text-gray-500 italic pt-8'>
            *Pe lângă livrările digitale, oferim și amintiri palpabile: fotografii printate 10x15 cm, pentru momente
            care merită ținute în mână, nu doar pe ecran.
          </div>
        </div>
      </div>
    </section>
  );
};

export default Philosophy;
