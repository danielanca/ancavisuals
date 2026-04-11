import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";

const Terms = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 py-32">
        <h1 className="text-3xl md:text-4xl font-light tracking-[0.1em] uppercase mb-4">
          Termeni și Condiții
        </h1>
        <p className="text-gray-500 text-sm tracking-widest uppercase mb-16">
          Ultima actualizare: Aprilie 2026
        </p>

        <div className="space-y-12 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              1. Despre noi
            </h2>
            <p>
              <strong className="text-white font-normal">Anca Visuals</strong> oferă servicii
              profesionale de fotografie și videografie pentru nunți, botezuri și alte evenimente
              speciale pe teritoriul României. Prin utilizarea site-ului{" "}
              <strong className="text-white font-normal">ancavisuals.ro</strong> sau prin
              contractarea serviciilor noastre, ești de acord cu termenii de mai jos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              2. Rezervarea și contractul
            </h2>
            <ul className="space-y-3">
              {[
                "Rezervarea datei devine fermă doar după semnarea contractului și achitarea avansului stabilit de comun acord.",
                "Data evenimentului se blochează exclusiv în baza unui contract semnat — o simplă discuție sau cerere de ofertă nu constituie o rezervare.",
                "Contractul se încheie în scris (fizic sau electronic) și cuprinde: data, locația, serviciile incluse, prețul total, avansul și termenele de livrare.",
                "Modificarea datei evenimentului este posibilă o singură dată, cu minim 90 de zile înainte și sub rezerva disponibilității.",
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
              3. Prețuri și plată
            </h2>
            <ul className="space-y-3">
              {[
                "Prețurile afișate pe site sunt orientative; oferta finală se stabilește în urma discuției despre eveniment.",
                "Avansul (de regulă 30% din valoarea totală) se achită la semnarea contractului și este nereturnabil în caz de anulare din partea clientului.",
                "Restul sumei se achită cu cel puțin 7 zile înainte de eveniment sau conform termenelor din contract.",
                "Plata se poate face prin transfer bancar sau alte metode agreate în contract.",
                "Prețurile nu includ TVA dacă nu este specificat altfel.",
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
              4. Anulare și rambursare
            </h2>
            <ul className="space-y-3">
              {[
                { caz: "Anulare cu peste 90 de zile înainte", consecinta: "avansul se reține; nu se datorează penalități suplimentare." },
                { caz: "Anulare între 30–90 de zile", consecinta: "se rețin 50% din valoarea totală a contractului." },
                { caz: "Anulare cu mai puțin de 30 de zile", consecinta: "se reține 100% din valoarea contractului." },
                { caz: "Anulare din cauza noastră (forță majoră documentată)", consecinta: "avansul se returnează integral în 30 de zile." },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-gray-600 mt-1">—</span>
                  <span><strong className="text-white font-normal">{item.caz}:</strong> {item.consecinta}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              5. Livrarea materialelor
            </h2>
            <ul className="space-y-3">
              {[
                "Fotografiile editate se livrează în format digital, prin platforma noastră securizată de partajare.",
                "Termenul standard de livrare este de 6–10 săptămâni pentru fotografii și 8–14 săptămâni pentru filmul de nuntă, de la data evenimentului.",
                "Numărul minim de fotografii livrate este specificat în contract; nu garantăm un număr maxim.",
                "Selecția imaginilor finale este realizată de fotograf — nu livrăm fișiere RAW, fotografii neterminate sau imagini respinse din selecție.",
                "Clientul primește un link de descărcare valabil 12 luni. Este responsabilitatea clientului să descarce și să arhiveze materialele.",
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
              6. Drepturi de autor
            </h2>
            <p className="mb-4">
              Toate materialele foto/video realizate rămân proprietatea intelectuală a{" "}
              <strong className="text-white font-normal">Anca Visuals</strong>, în conformitate cu
              Legea nr. 8/1996. Clientul primește o licență personală, neexclusivă, pentru uz privat.
            </p>
            <p>
              Ne rezervăm dreptul de a folosi imaginile în portofoliu, pe rețelele sociale și în
              materiale promoționale, cu excepția cazului în care clientul solicită în scris
              confidențialitate totală (cu posibil cost suplimentar). Pentru detalii complete, vezi{" "}
              <Link
                to="/copyright"
                className="text-white underline underline-offset-4 hover:text-gray-300 transition-colors"
              >
                pagina Copyright
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              7. Responsabilitățile clientului
            </h2>
            <ul className="space-y-3">
              {[
                "Furnizarea unui program al evenimentului și a informațiilor relevante cu cel puțin 14 zile înainte.",
                "Asigurarea unui spațiu și a luminii adecvate pentru fotografie/filmare acolo unde este posibil.",
                "Obținerea acordului invitaților pentru a fi fotografiați, acolo unde este aplicabil.",
                "Notificarea în avans a oricăror restricții de fotografiere impuse de locație sau de oficiant.",
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
              8. Limitarea răspunderii
            </h2>
            <p className="mb-4">
              Deși depunem toate eforturile pentru a livra materiale de cea mai înaltă calitate,
              nu putem fi ținuți răspunzători pentru:
            </p>
            <ul className="space-y-3">
              {[
                "Pierderi cauzate de defecțiuni tehnice imprevizibile ale echipamentelor (vom depune eforturi de recuperare a oricărui material salvat).",
                "Condiții de iluminare impuse de locație sau meteorologie.",
                "Momente neacoperite din cauza restricțiilor impuse de oficiant sau locație.",
                "Calitatea redusă a imaginilor cauzată de necomunicarea restricțiilor de locație.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-gray-600 mt-1">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              Răspunderea noastră maximă nu poate depăși valoarea totală plătită de client pentru serviciile contractate.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              9. Forță majoră
            </h2>
            <p>
              Nu vom fi considerați în culpă pentru neîndeplinirea obligațiilor cauzată de
              evenimente independente de voința noastră: calamități naturale, pandemii, interdicții
              guvernamentale sau alte situații de forță majoră documentate. În astfel de cazuri,
              vom propune o reprogramare sau, dacă aceasta nu este posibilă, returnarea avansului.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              10. Legea aplicabilă
            </h2>
            <p>
              Acești termeni sunt guvernați de legislația română. Orice litigiu se va soluționa pe
              cale amiabilă în primul rând; în caz de eșec, competența revine instanțelor din
              România.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-light tracking-[0.15em] uppercase text-white mb-4">
              11. Contact
            </h2>
            <p>
              Întrebări despre acești termeni? Scrie-ne la{" "}
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

export default Terms;
