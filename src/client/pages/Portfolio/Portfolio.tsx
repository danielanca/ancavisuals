import React from "react";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Portfoliohero from "./Hero";
import Allimages from "./Allimages";
import PortfolioGallery from "./PortfolioGallery";
import "./Portfolio.css";

const Portfolio = () => {
  return (
    <>
      <Navbar />
      <Portfoliohero />
      <PortfolioGallery />
      <Footer />
    </>
  );
};

export default Portfolio;
