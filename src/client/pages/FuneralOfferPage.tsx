import React from "react";
import { Link } from "react-router-dom";
import SeoPageHead from "../components/SEO/SeoPageHead";
import PhoneNumberReveal from "../components/PhoneReveal/PhoneNumberReveal";
import "./FuneralOfferPage.css";

const whatsappUrl = `https://wa.me/40745469907?text=${encodeURIComponent("Bună ziua. Aș dori să discut despre servicii foto-video pentru o înmormântare. Data: … Localitatea: …")}`;

const services = [
  { number: "01", title: "Fotografie", text: "Documentarea discretă a ceremoniei, a florilor și a momentelor de reculegere, în acord cu dorințele familiei.", details: "Fotografii selectate și editate, livrate în format digital." },
  { number: "02", title: "Filmarea ceremoniei", text: "O înregistrare pentru familie și pentru cei apropiați care nu pot fi prezenți. Stabilim împreună momentele care vor fi filmate.", details: "Material video montat, cu durata și forma de livrare stabilite înainte." },
  { number: "03", title: "Foto și video", text: "Fotografie și filmare într-un singur serviciu, cu o organizare adaptată programului ceremoniei.", details: "Acoperirea și livrarea materialelor se stabilesc într-o singură discuție." },
];

function ContactActions() {
  return <div className="funeral-actions">
    <PhoneNumberReveal phone="0745469907" display="0745 469 907" buttonLabel="Afișează numărul de telefon" context="Ofertă înmormântări" className="funeral-button funeral-button-primary" />
    <a className="funeral-button funeral-button-secondary" href={whatsappUrl} target="_blank" rel="noopener noreferrer">Scrie-ne pe WhatsApp <span aria-hidden="true">↗</span></a>
  </div>;
}

export default function FuneralOfferPage() {
  return <div className="funeral-page">
    <SeoPageHead title="Foto video înmormântări | AncaVisuals" description="Servicii foto și video pentru înmormântări, cu discreție și respect pentru familie. Contactează AncaVisuals pentru disponibilitate și o ofertă personalizată." canonicalPath="/oferta/inmormantari" />
    <header className="funeral-header funeral-container">
      <Link to="/" className="funeral-brand" aria-label="AncaVisuals — pagina principală">Anca<span>Visuals</span></Link>
      <a href="#contact">Discută cu noi <span aria-hidden="true">↗</span></a>
    </header>
    <main>
      <section className="funeral-hero funeral-container">
        <div className="funeral-hero-copy">
          <p className="funeral-eyebrow">FOTO · VIDEO · ÎNMORMÂNTĂRI</p>
          <h1>Cu discreție.<br />Cu respect.<br /><em>Pentru amintire.</em></h1>
          <p className="funeral-intro">În momentele de rămas-bun, fiecare familie are propriul fel de a păstra amintirile. Dacă vă doriți fotografii sau o înregistrare a ceremoniei, suntem aici să vă ajutăm cu grijă și discreție.</p>
          <ContactActions />
          <p className="funeral-note">Comunică-ne data și localitatea pentru a confirma disponibilitatea.</p>
        </div>
        <aside className="funeral-hero-aside" aria-label="Abordarea noastră">
          <div className="funeral-motif" aria-hidden="true"><span /></div>
          <p>O prezență discretă.<br />Grijă pentru ceea ce rămâne.</p>
          <span>În ritmul ceremoniei, cu respect pentru familie.</span>
        </aside>
      </section>
      <div className="funeral-principles"><div className="funeral-container"><span>Respect pentru ceremonie</span><span>Momente alese de familie</span><span>Livrare digitală</span></div></div>
      <section className="funeral-section funeral-container" aria-labelledby="services-title">
        <p className="funeral-eyebrow">SERVICII</p>
        <h2 id="services-title">Alegeți ce doriți să păstrați.</h2>
        <p className="funeral-section-intro">Putem documenta ceremonia religioasă, cortegiul sau momentele de comemorare. Stabilim înainte ce fotografiem, ce filmăm și ce rămâne privat.</p>
        <div className="funeral-services">{services.map(service => <article key={service.number}>
          <span className="funeral-service-number">{service.number}</span>
          <h3>{service.title}</h3><p>{service.text}</p><p className="funeral-service-detail">{service.details}</p>
        </article>)}</div>
      </section>
      <section className="funeral-care"><div className="funeral-container funeral-care-grid">
        <div><p className="funeral-eyebrow">CUM LUCRĂM</p><h2>Familia stabilește limitele.<br /><em>Noi le respectăm.</em></h2></div>
        <div className="funeral-steps">
          <article><h3>O discuție simplă, înainte</h3><p>Ne spuneți data, localitatea, programul și serviciul dorit. Confirmăm disponibilitatea, costul și termenul de livrare înainte de colaborare.</p></article>
          <article><h3>Fără a întrerupe ceremonia</h3><p>Stabilim cu familia și cu persoana care oficiază unde putem fotografia sau filma. Respectăm momentele în care nu se dorește înregistrarea.</p></article>
          <article><h3>Materiale pentru cei apropiați</h3><p>Livrăm materialele familiei, în formatul convenit. Nu publicăm fotografii sau filmări din ceremonie fără acordul explicit al familiei.</p></article>
        </div>
      </div></section>
      <section className="funeral-section funeral-container funeral-faq" aria-labelledby="faq-title">
        <div><p className="funeral-eyebrow">DETALII UTILE</p><h2 id="faq-title">Întrebări frecvente</h2></div>
        <div>
          <details><summary>Cât costă serviciile foto-video?</summary><p>Oferta depinde de localitate, durata prezenței și serviciile alese. Ne puteți trimite aceste detalii prin WhatsApp sau le putem discuta la telefon, pentru un preț confirmat înainte.</p></details>
          <details><summary>Putem solicita serviciile cu puțin timp înainte?</summary><p>Da, ne puteți contacta și pentru o ceremonie apropiată. Verificăm programul și vă confirmăm direct dacă putem fi prezenți.</p></details>
          <details><summary>Putem alege doar anumite momente?</summary><p>Da. Familia decide momentele care vor fi documentate și ne poate comunica persoanele sau situațiile care nu trebuie fotografiate ori filmate.</p></details>
          <details><summary>Cum primim fotografiile și filmarea?</summary><p>Materialele sunt livrate digital. Stabilim împreună modalitatea de acces și termenul de predare, astfel încât să le puteți păstra și transmite celor apropiați.</p></details>
        </div>
      </section>
      <section id="contact" className="funeral-contact funeral-container">
        <p className="funeral-eyebrow">SUNTEM AICI SĂ VĂ AJUTĂM</p><h2>Spuneți-ne de ce aveți nevoie.</h2>
        <p>O dată, o localitate și câteva detalii sunt suficiente pentru a începe discuția. Vă răspundem cu disponibilitatea și o ofertă adaptată.</p>
        <ContactActions />
      </section>
    </main>
    <footer className="funeral-footer funeral-container"><span>AncaVisuals · Foto & video</span><nav aria-label="Informații legale"><Link to="/privacy">Confidențialitate</Link><Link to="/terms">Termeni și condiții</Link></nav></footer>
    <div className="funeral-mobile-contact"><a className="funeral-button funeral-button-primary" href="#contact">Contact și disponibilitate <span aria-hidden="true">↗</span></a></div>
  </div>;
}
