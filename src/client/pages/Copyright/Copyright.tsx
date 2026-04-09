import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import "../../globals.css";

const Copyright = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 py-32">
        <h1 className="text-3xl md:text-4xl font-light tracking-[0.1em] uppercase mb-4">
          Copyright & Drepturi de Autor
        </h1>
        <p className="text-gray-500 text-sm tracking-widest uppercase mb-16">
          Ultima actualizare: Aprilie 2026
        </p>

        <div className="space-y-12 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              1. Proprietatea conținutului
            </h2>
            <p>
              Toate fotografiile, videoclipurile, textele, logo-urile și orice alt conținut vizual
              publicat pe acest site (ancavisuals.ro) sunt proprietatea exclusivă a{" "}
              <strong className="text-white font-normal">Anca Visuals</strong> și sunt protejate
              de legislația română și internațională privind drepturile de autor (Legea nr. 8/1996
              privind dreptul de autor și drepturile conexe).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              2. Ce este interzis
            </h2>
            <ul className="space-y-2 list-none">
              {[
                "Reproducerea, copierea sau distribuirea fotografiilor/videoclipurilor fără acordul scris prealabil",
                "Utilizarea imaginilor în scopuri comerciale sau promoționale fără licență",
                "Modificarea, editarea sau recadrarea conținutului original",
                "Ștergerea sau alterarea watermark-urilor și a informațiilor de autor",
                "Publicarea conținutului pe platforme terțe fără atribuire corespunzătoare",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-gray-600 mt-1">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              3. Utilizare permisă
            </h2>
            <p className="mb-4">
              Clienții care au contractat serviciile Anca Visuals primesc o{" "}
              <strong className="text-white font-normal">licență personală, neexclusivă</strong> de
              utilizare a materialelor livrate, în scopuri personale (album, rețele sociale personale,
              tipar pentru uz propriu).
            </p>
            <p>
              Orice utilizare comercială, editorială sau în campanii publicitare necesită un acord
              separat și o licență comercială. Contactați-ne pentru detalii.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              4. Atribuire și credit
            </h2>
            <p>
              Când distribuiți fotografiile pe rețelele sociale, vă rugăm să menționați{" "}
              <strong className="text-white font-normal">@ancavisuals</strong> sau să indicați
              sursa ca <em>ancavisuals.ro</em>. Apreciem orice formă de recunoaștere a muncii noastre.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              5. Raportare încălcare
            </h2>
            <p>
              Dacă ați descoperit că materialele noastre sunt folosite fără drept, vă rugăm să ne
              contactați imediat la{" "}
              <a
                href="mailto:ancadaniel1994@gmail.com"
                className="text-white underline underline-offset-4 hover:text-gray-300 transition-colors"
              >
                ancadaniel1994@gmail.com
              </a>
              . Vom acționa prompt pentru remedierea situației.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              6. Contact
            </h2>
            <p>
              Pentru solicitări de licențiere, parteneriate sau orice întrebare legată de drepturile
              de autor, ne puteți contacta prin{" "}
              <Link
                to="/contact"
                className="text-white underline underline-offset-4 hover:text-gray-300 transition-colors"
              >
                formularul de contact
              </Link>{" "}
              sau direct la{" "}
              <a
                href="mailto:ancadaniel1994@gmail.com"
                className="text-white underline underline-offset-4 hover:text-gray-300 transition-colors"
              >
                ancadaniel1994@gmail.com
              </a>
              .
            </p>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Copyright;
