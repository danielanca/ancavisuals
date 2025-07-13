import React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../../globals.css';
import Navbar from '../../components/Navbar/Navbar';
import Footer from '../../components/Navbar/Footer';
import Hero from './Hero';
import Featured from './Featured';
import Philosophy from './Philosophy';
import Approach from './Approach';
import Letter from './Letter';
import Process from './Process';
import Testimonials from './Testimonials';
import News from './News';
import Contact from './Contact';
import Faq from '../Faq/Faq';
import MyVideo from '../Videos/MyVideo';

const Mainpage = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className='min-h-screen bg-black text-white'>
      <Navbar />
      <Hero />
      <Featured />
      <Philosophy />
      <Approach />
      <Letter />
      <MyVideo
        src='https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FBucurestiNunta.mp4?alt=media&token=74d6a5b5-0906-45e1-950c-9632bba7889b'
        poster=''
      />
      <MyVideo
        src='https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FClaudiu%20Scurt.mp4?alt=media&token=c79e0f29-501f-4efb-be3a-73f52b3d2e38'
        poster=''
      />
      <Faq />
      <Footer />
    </div>
  );
};

export default Mainpage;
