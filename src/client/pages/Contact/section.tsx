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

      <div className="px-0 py-[20px] sm:px-[250px] text-[17px] leading-relaxed text-gray-200">
      <p className="mb-3 text-[18px] sm:text-[19px] font-medium text-gray-100">
        În câteva minute îți poți configura pachetul perfect pentru ziua ta, exact așa cum îl imaginezi. Vezi pe loc prețul,
        disponibilitatea și tot ce este inclus — transparent, clar și adaptat nevoilor tale reale. Nu trebuie să aștepți un
        email, nu trebuie să ghicești: ai totul în fața ta.
      </p>
      </div>
    </section>
  );
};

export default Contacthero;
