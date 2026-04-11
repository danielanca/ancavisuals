import React from "react";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import PortfolioHero from "./PortfolioHero";
import PortfolioGallery from "./PortfolioGallery";
import "./Portfolio.css";

const Portfolio = () => {
  return (
    <>
      <Navbar />
      <PortfolioHero />
      <PortfolioGallery />
      <Footer />
    </>
  );
};

export default Portfolio;
