import React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Contacthero = () => {
  return (
    <section className='contact-section'>
      <motion.h1
        initial={{ opacity: 0, y: 100, scale: 0.9, rotateX: 90 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className='text-[2rem] sm:text-[5.5rem] text-[#f9e791] mt-[100px] mb-[40px] leading-[1.2]'
      >
        BUNĂ, OAMENI FRUMOȘI!
      </motion.h1>

      <h2 className='subhead'>SALUTARE</h2>

      <div className="px-0 py-[15px] sm:px-[250px]">
        <p>
          Configurează-ți pachetul exact cum ai nevoie, vezi instant prețul, ce este inclus și dacă suntem disponibili în ziua ta.
        </p>
        <p>
          Iar dacă ai întrebări speciale, lasă-ne două rânduri în formular și revenim rapid cu o ofertă clară și sinceră.
        </p>
      </div>
    </section>
  );
};

export default Contacthero;
