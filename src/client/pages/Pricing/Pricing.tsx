import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";

import Process from "./Process";
const Pricing = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <Process />
      <Footer />
    </div>
  );
};

export default Pricing;
