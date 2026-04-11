import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import AboutHero from "./AboutHero";
import Bio from "./Bio";

const AboutPage = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <AboutHero />
      <Bio />
      <Footer />
    </div>
  );
};

export default AboutPage;
