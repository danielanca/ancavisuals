import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import "../../globals.css";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Aboutdani from "./Aboutdani";
import Bio from "./Bio";

const Aboutme = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <Aboutdani />
      <Bio />
      <Footer />
    </div>
  );
};

export default Aboutme;
