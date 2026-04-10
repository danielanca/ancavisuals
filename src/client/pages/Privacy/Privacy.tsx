import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import "../../globals.css";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 py-32">
        <h1 className="text-3xl md:text-4xl font-light tracking-[0.1em] uppercase mb-4">
          Politică de Confidențialitate
        </h1>
        <p className="text-gray-500 text-sm tracking-widest uppercase mb-16">
          Ultima actualizare: Aprilie 2026
        </p>

        <div className="space-y-12 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              1. Cine suntem
            </h2>
            <p>
              <strong className="text-white font-normal">Anca Visuals</strong> este un serviciu
              profesional de fotografie și videografie cu sediul în România. Operăm site-ul{" "}
              <strong className="text-white font-normal">ancavisuals.ro</strong> și procesăm datele
              tale personale în conformitate cu Regulamentul (UE) 2016/679 (GDPR) și legislația
              română aplicabilă.
            </p>
            <p className="mt-4">
              Pentru orice întrebare legată de confidențialitate, ne poți contacta la:{" "}
              <a
                href="mailto:ancadaniel1994@gmail.com"
                className="text-white underline underline-offset-4 hover:text-gray-300 transition-colors"
              >
                ancadaniel1994@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              2. Ce date colectăm
            </h2>
            <p className="mb-4">Colectăm doar datele strict necesare pentru a-ți oferi serviciile noastre:</p>
            <ul className="space-y-3">
              {[
                { title: "Date de contact", desc: "Nume, adresă de email, număr de telefon — furnizate prin formularul de contact sau solicitare de ofertă." },
                { title: "Date despre eveniment", desc: "Data, locația și tipul evenimentului (nuntă, botez etc.) pentru a verifica disponibilitatea și a pregăti oferta." },
                { title: "Date de navigare", desc: "Adresă IP, tipul browserului, paginile vizitate — colectate automat prin cookie-uri și instrumente de analiză (Google Analytics, Microsoft Clarity)." },
                { title: "Conținut media", desc: "Fotografii și videoclipuri realizate în cadrul serviciilor contractate, cu acordul tău explicit." },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-gray-600 mt-1">—</span>
                  <span><strong className="text-white font-normal">{item.title}:</strong> {item.desc}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              3. De ce folosim datele tale
            </h2>
            <ul className="space-y-3">
              {[
                "Răspuns la solicitări și trimiterea de oferte personalizate",
                "Gestionarea contractelor și a programărilor",
                "Livrarea albumelor foto/video prin platforma noastră securizată",
                "Îmbunătățirea experienței pe site prin date anonimizate de analiză",
                "Respectarea obligațiilor legale (facturare, contabilitate)",
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
              4. Temeiul legal al prelucrării
            </h2>
            <ul className="space-y-3">
              {[
                { temei: "Executarea unui contract (art. 6 alin. 1 lit. b GDPR)", desc: "pentru datele necesare livrării serviciilor." },
                { temei: "Consimțământ (art. 6 alin. 1 lit. a GDPR)", desc: "pentru cookie-uri de marketing și analitice." },
                { temei: "Obligație legală (art. 6 alin. 1 lit. c GDPR)", desc: "pentru datele de facturare și arhivare fiscală." },
                { temei: "Interes legitim (art. 6 alin. 1 lit. f GDPR)", desc: "pentru securitatea site-ului și prevenirea fraudelor." },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-gray-600 mt-1">—</span>
                  <span><strong className="text-white font-normal">{item.temei}</strong> — {item.desc}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              5. Cu cine împărtășim datele
            </h2>
            <p className="mb-4">
              Nu vindem și nu închiriem datele tale nimănui. Putem share-ui informații doar cu:
            </p>
            <ul className="space-y-3">
              {[
                "Google (Analytics, Drive) — stocare și analiză, cu garanții GDPR",
                "Firebase / Google Cloud — stocare media și autentificare",
                "Furnizori de email (pentru livrarea mesajelor automate)",
                "Autorități publice — exclusiv când legea ne obligă",
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
              6. Cât timp păstrăm datele
            </h2>
            <ul className="space-y-3">
              {[
                { tip: "Date de contact (fără contract)", durata: "12 luni de la ultima interacțiune" },
                { tip: "Date contractuale și de facturare", durata: "10 ani (obligație legală fiscală)" },
                { tip: "Albume foto/video livrate", durata: "24 luni după livrare, apoi șterse sau arhivate conform acordului" },
                { tip: "Date de navigare (cookies)", durata: "Maxim 13 luni" },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-gray-600 mt-1">—</span>
                  <span><strong className="text-white font-normal">{item.tip}:</strong> {item.durata}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              7. Drepturile tale (GDPR)
            </h2>
            <p className="mb-4">În conformitate cu GDPR, ai următoarele drepturi:</p>
            <ul className="space-y-3">
              {[
                { drept: "Dreptul de acces", desc: "să știi ce date deținem despre tine" },
                { drept: "Dreptul la rectificare", desc: "corectarea datelor inexacte" },
                { drept: "Dreptul la ștergere", desc: "ștergerea datelor când nu mai există temei legal" },
                { drept: "Dreptul la restricționarea prelucrării", desc: "limitarea modului în care folosim datele tale" },
                { drept: "Dreptul la portabilitate", desc: "primirea datelor într-un format structurat, uzual" },
                { drept: "Dreptul de opoziție", desc: "refuzarea prelucrării bazate pe interes legitim" },
                { drept: "Dreptul de retragere a consimțământului", desc: "oricând, fără consecințe pentru drepturile anterioare" },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-gray-600 mt-1">—</span>
                  <span><strong className="text-white font-normal">{item.drept}:</strong> {item.desc}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6">
              Poți exercita orice drept scriindu-ne la{" "}
              <a
                href="mailto:ancadaniel1994@gmail.com"
                className="text-white underline underline-offset-4 hover:text-gray-300 transition-colors"
              >
                ancadaniel1994@gmail.com
              </a>
              . Răspundem în cel mult 30 de zile. Ai și dreptul de a depune plângere la{" "}
              <strong className="text-white font-normal">ANSPDCP</strong> (
              <a
                href="https://www.dataprotection.ro"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline underline-offset-4 hover:text-gray-300 transition-colors"
              >
                dataprotection.ro
              </a>
              ).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              8. Cookie-uri
            </h2>
            <p>
              Folosim cookie-uri tehnice (necesare pentru funcționarea site-ului) și cookie-uri
              analitice (Google Analytics, Microsoft Clarity). La prima vizită îți cerem consimțământul
              prin bannerul de cookie-uri. Poți gestiona sau retrage consimțământul oricând din
              setările browserului sau prin platforma noastră de consimțământ.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              9. Modificări ale politicii
            </h2>
            <p>
              Putem actualiza periodic această politică. Modificările semnificative vor fi comunicate
              prin email sau printr-un banner vizibil pe site. Data ultimei actualizări este afișată
              în antetul acestei pagini.
            </p>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Privacy;
