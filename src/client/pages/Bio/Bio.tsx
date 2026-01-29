import React from 'react';
import './Bio.scss';

// Replace these URLs with your actual images
const images = {
  mainCircle: "https://images.pexels.com/photos/8835417/pexels-photo-8835417.jpeg", // kissing groom & bride
  latestEvents: "https://images.pexels.com/photos/30772209/pexels-photo-30772209/free-photo-of-elegant-indoor-wedding-couple-portrait.jpeg",
  packages: "https://images.pexels.com/photos/16446632/pexels-photo-16446632.jpeg",
  photobooth: "https://cdn.prod.website-files.com/661d4fcb8b48b32233670a7e/6639062905a4dcfcfed552bd_wedding-photo-mosaic-wall-1-2182980.jpeg",
  qrMoments: "https://images.pexels.com/photos/15591485/pexels-photo-15591485/free-photo-of-smiling-women-in-dresses-on-party.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
};

const Bio: React.FC = () => {
  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>ANCA VISUALS</h1>
          <div className="tagline">YOU FEEL IT. WE FRAME IT.</div>

          <div className="main-photo-circle">
            <img src={images.mainCircle} alt="Couple kissing in nature" />
          </div>
        </div>
      </section>

      <main>
        <div className="container">
          <h2 className="brand-repeat">ANCA VISUALS</h2>
          <p className="subtitle">Fotografie &amp; Videografie Evenimente.</p>

          <a href="#contact" className="cta-big">
            Verificare disponibilitate &amp; rezervare
          </a>

          {/* Service blocks – exact order from your image */}
          <div className="service-block">
            <div className="image-wrapper">
              <img src={images.latestEvents} alt="Latest events" />
            </div>
            <div className="text-content">
              <h3>Ultimele evenimente</h3>
              <p className="subtitle-small">Vezi portofoliu</p>
              <a href="#portfolio" className="btn-pill">Vezi portofoliul</a>
            </div>
          </div>

          <div className="service-block">
            <div className="image-wrapper">
              <img src={images.packages} alt="Packages" />
            </div>
            <div className="text-content">
              <h3>Pachete &amp; prețuri</h3>
              <p className="subtitle-small">Vezi pachetele</p>
              <a href="#packages" className="btn-pill">Vezi pachetele</a>
            </div>
          </div>

          <div className="service-block">
            <div className="image-wrapper">
              <img src={images.photobooth} alt="Photobooth" />
            </div>
            <div className="text-content">
              <h3>Fotocabină</h3>
              <p className="subtitle-small">Detalii fotocabină</p>
              <a href="#photobooth" className="btn-pill">Detalii fotocabină</a>
            </div>
          </div>

          <div className="service-block">
            <div className="image-wrapper">
              <img src={images.qrMoments} alt="QR Moments" />
            </div>
            <div className="text-content">
              <h3>QR Moments</h3>
              <p className="subtitle-small">Află mai multe</p>
              <a href="#qrmoments" className="btn-pill">Află mai multe</a>
            </div>
          </div>

          {/* Contact bar */}
          <section className="contact-bar" id="contact">
            <div className="links">
              <a href="https://wa.me/40764123456">WhatsApp</a>
              <a href="tel:+40764123456">0764 123 456</a>
              <a href="mailto:anca@email.ro">anca@email.ro</a>
            </div>

            <div className="social-icons">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer">TikTok</a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer">YouTube</a>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default Bio;