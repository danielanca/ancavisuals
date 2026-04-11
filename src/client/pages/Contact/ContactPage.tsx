import React from "react";
import { useState } from "react";
import "./contact.css";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import ContactHero from "./ContactHero";
import BookingWizard from "./booking/BookingWizard";

const ContactPage = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <ContactHero />
      <BookingWizard />
      <Footer />
    </div>
  );
};

export default ContactPage;
