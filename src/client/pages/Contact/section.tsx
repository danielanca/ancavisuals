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

      <h2 className='subhead'>TRIMITE-NE UN MESAJ.</h2>

      <div className='px-0 py-[15px] sm:px-[250px]'>
        <p>
          Spune-ne ce urmează în viața voastră! Știm că nu e mereu ușor să scrii tot ce ai în gând, dar fiecare detaliu
          ne ajută să înțelegem mai bine cum vedeți ziua voastră specială. După ce apeși butonul de trimitere, noi —
          Dani și Estera, două suflete pasionate de povești și oameni — vom citi cu bucurie tot și îți vom răspunde în
          cel mult 24 de ore.
        </p>
        <p>
          Dacă preferi să sari peste email, poți <a href='#'>programa un apel video</a> în care povestim despre idei,
          prețuri și disponibilitate. Abia așteptăm să vă cunoaștem și să vă fim aproape în ziua voastră!
        </p>
        <p className='footer-note'>
          Să ajungă cu bine mesajul tău în inboxul nostru, și fie să înceapă o frumoasă colaborare 🙏
        </p>
      </div>
    </section>
  );
};

export default Contacthero;
