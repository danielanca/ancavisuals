import React from 'react';
import './BioPage.scss';

// Replace with your actual images (or keep these)
const images = {
  mainCircle: "https://images.pexels.com/photos/8835417/pexels-photo-8835417.jpeg",
  latestEvents: "https://images.pexels.com/photos/30772209/pexels-photo-30772209/free-photo-of-elegant-indoor-wedding-couple-portrait.jpeg",
  packages: "https://images.pexels.com/photos/16446632/pexels-photo-16446632.jpeg",
  photobooth: "https://cdn.prod.website-files.com/661d4fcb8b48b32233670a7e/6639062905a4dcfcfed552bd_wedding-photo-mosaic-wall-1-2182980.jpeg",
  qrMoments: "https://images.pexels.com/photos/15591485/pexels-photo-15591485/free-photo-of-smiling-women-in-dresses-on-party.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
};

const BioPage: React.FC = () => {
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
          <div className="top">
          <h2 className="brand-repeat">ANCA VISUALS</h2>
          <p className="subtitle">Fotografie & Videografie Evenimente.</p>

          <a href="#contact" className="cta-big">
            Verificare disponibilitate & rezervare →
          </a>
          </div>

          {/* Service items – styled like screenshot */}
          <div className="service-items">
            <a href="#portfolio" className="service-row">
              <div className="service-thumb">
                <img src={images.latestEvents} alt="Latest events" />
              </div>
              <div className="service-text">
                <h3>Ultimele evenimente</h3>
                <p>Vezi portofoliu</p>
              </div>
              <span className="arrow">→</span>
            </a>

            <a href="#packages" className="service-row">
              <div className="service-thumb">
                <img src={images.packages} alt="Packages" />
              </div>
              <div className="service-text">
                <h3>Pachete & prețuri</h3>
                <p>Vezi pachetele</p>
              </div>
              <span className="arrow">→</span>
            </a>

            <a href="#photobooth" className="service-row">
              <div className="service-thumb">
                <img src={images.photobooth} alt="Photobooth" />
              </div>
              <div className="service-text">
                <h3>Fotocabină</h3>
                <p>Detalii fotocabină</p>
              </div>
              <span className="arrow">→</span>
            </a>

            <a href="#qrmoments" className="service-row">
              <div className="service-thumb">
                <img src={images.qrMoments} alt="QR Moments" />
              </div>
              <div className="service-text">
                <h3>QR Moments</h3>
                <p>Află mai multe</p>
              </div>
              <span className="arrow">→</span>
            </a>
          </div>

          {/* Contact bar */}
          <section className="contact-bar" id="contact">
            <div className="contact-buttons">
              <a href="https://wa.me/40764123456" className="contact-btn whatsapp">
                <span className="icon">WhatsApp</span> {/* Replace with real icon */}
              </a>
              <a href="tel:+40764123456" className="contact-btn phone">
                <span className="icon">📞 0764 123 456</span>
              </a>
              <a href="mailto:anca@email.ro" className="contact-btn email">
                <span className="icon">✉️ anca@email.ro</span>
              </a>
            </div>

            <div className="social-icons">
              <a href="https://instagram.com/yourprofile" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a href="https://tiktok.com/@yourprofile" target="_blank" rel="noopener noreferrer">TikTok</a>
              <a href="https://youtube.com/yourchannel" target="_blank" rel="noopener noreferrer">YouTube</a>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default BioPage;
