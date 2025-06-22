import React from "react";
import { useState } from "react";
import "../../globals.css";
import "./contact.css";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Contacthero from "./section";
import ContactForm from "./form";

const Contacts = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <Contacthero />
      <ContactForm />
      <Footer />
    </div>
  );
};

export default Contacts;
