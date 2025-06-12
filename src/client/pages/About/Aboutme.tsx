import React from 'react';
import { useState } from "react"
import { Link } from 'react-router-dom';
import '../../globals.css'
import Navbar from '../../components/Navbar/Navbar';
import Footer from "../../components/Navbar/Footer";
import Aboutdani from './Aboutdani';
import Bio from './Bio';
import Profile from './Profile';
import Values from './Values';
import Ourlife from './Ourlife';

const Aboutme = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
        <Aboutdani />
        <Bio />
        <Profile />
        <Values />
        <Ourlife />
      <Footer />
    </div>
  );
};

export default Aboutme;