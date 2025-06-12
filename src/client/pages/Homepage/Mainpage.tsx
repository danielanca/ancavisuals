import React from 'react';
import { useState } from "react"
import { Link } from 'react-router-dom';
import '../../globals.css'
import Navbar from '../../components/Navbar/Navbar';
import Footer from "../../components/Navbar/Footer";
import Hero from './Hero';
import Featured from './Featured';
import Philosophy from './Philosophy';
import Approach from './Approach';
import Letter from './Letter';
import Process from './Process';
import Testimonials from './Testimonials';
import News from './News';
import Contact from './Contact';

const Mainpage = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
        <Hero />
        <Featured />
        <Philosophy />
        <Approach />
        <Letter />
        <Process />
        <Testimonials />
        <News />
        <Contact />
      <Footer />
    </div>
  );
};

export default Mainpage;
