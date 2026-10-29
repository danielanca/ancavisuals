import React from "react";
import { Link } from "react-router-dom";
import LegalIdentity from "../Legal/LegalIdentity";

// `light`: for cream pages (ex. /ghidul-mirilor-pdf) — the footer has no text color of its own and
// inherits the page's, so dark text on the black footer was nearly invisible there.
const Footer = ({ light = false }: { light?: boolean }) => {
  const link = light ? "hover:text-black transition-colors" : "hover:text-gray-400 transition-colors";
  const subLink = light ? "hover:text-black transition-colors" : "hover:text-white transition-colors";
  return (
    <footer className={light ? "bg-[#efe8da] py-20 px-6 text-[#2f2a24] border-t border-[#2f2a24]/10" : "bg-black py-20 px-6"}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <nav className="mb-8">
            <div className="flex flex-wrap justify-center gap-8 text-sm tracking-[0.2em] uppercase">
              <Link to="/despre" className={link}>
                Despre
              </Link>
              <Link to="/portofoliu" className={link}>
                Portofoliu
              </Link>
              <Link to="/contact" className={link}>
                SOLICITA-NE
              </Link>
            </div>
          </nav>
        </div>

        <div className={`border-t pt-12 text-center ${light ? "border-[#2f2a24]/15" : "border-gray-800"}`}>
          <div className="mb-8">
            <h3 className="text-2xl font-light tracking-[0.1em] mb-4">ANCA VISUALS</h3>
            <p className={`max-w-2xl mx-auto leading-relaxed ${light ? "text-[#5c5348]" : "text-gray-400"}`}>
              Creăm amintiri fără vârstă prin arta fotografiei de eveniment. Pentru oameni care prețuiesc momentele autentice
              — cele care rămân, indiferent cât timp trece.
            </p>
          </div>

          <div className={`text-xs space-y-2 ${light ? "text-[#5c5348]" : "text-gray-500"}`}>
            <div className={`flex flex-wrap justify-center gap-4 text-[11px] uppercase tracking-[0.18em] ${light ? "text-[#2f2a24]/80" : "text-gray-400"}`}>
              <Link to="/foto-video-nunta" className={subLink}>
                Foto Video Nuntă
              </Link>
              <Link to="/foto-video-botez" className={subLink}>
                Foto Video Botez
              </Link>
              <Link to="/foto-video-evenimente" className={subLink}>
                Foto Video Evenimente
              </Link>
              <span>Foto Cabină</span>
              <span>Video Cabină</span>
              <span>QR Moments</span>
            </div>
            <p>© {new Date().getFullYear()} AncaVisuals Film Photography. All rights reserved.</p>
            <p>Licensed and insured professional photographer serving worldwide.</p>
            <LegalIdentity className="mt-4" light={light} />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
