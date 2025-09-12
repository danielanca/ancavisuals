import React from 'react';
import { useState } from 'react';
import '../../globals.css';
import './contact.css';
import Navbar from '../../components/Navbar/Navbar';
import Footer from '../../components/Navbar/Footer';
import Contacthero from './section';
import BookingWizard from './booking/BookingWizard';

const Contacts = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className='min-h-screen bg-black text-white'>
      <Navbar />
      <Contacthero />
      <BookingWizard />
      <Footer />
    </div>
  );
};

export default Contacts;
