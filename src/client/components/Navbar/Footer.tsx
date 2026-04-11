import React from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-black py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <nav className="mb-8">
            <div className="flex flex-wrap justify-center gap-8 text-sm tracking-[0.2em] uppercase">
              <Link to="/despre" className="hover:text-gray-400 transition-colors">
                Despre
              </Link>
              <Link to="/portofoliu" className="hover:text-gray-400 transition-colors">
                Portofoliu
              </Link>
              <Link to="/contact" className="hover:text-gray-400 transition-colors">
                SOLICITA-NE
              </Link>
            </div>
          </nav>
        </div>

        <div className="border-t border-gray-800 pt-12 text-center">
          <div className="mb-8">
            <h3 className="text-2xl font-light tracking-[0.1em] mb-4">ANCA VISUALS</h3>
            <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Creăm amintiri fără vârstă prin arta fotografiei de film. Pentru oameni care prețuiesc momentele autentice
              — cele care rămân, indiferent cât timp trece.
            </p>
          </div>

          <div className="text-xs text-gray-500 space-y-2">
            <div className="flex flex-wrap justify-center gap-4 text-[11px] uppercase tracking-[0.18em] text-gray-400">
              <Link to="/foto-video-nunta" className="hover:text-white transition-colors">
                Foto Video Nuntă
              </Link>
              <Link to="/foto-video-botez" className="hover:text-white transition-colors">
                Foto Video Botez
              </Link>
              <Link to="/foto-video-evenimente" className="hover:text-white transition-colors">
                Foto Video Evenimente
              </Link>
            </div>
            <p>© {new Date().getFullYear()} AncaVisuals Film Photography. All rights reserved.</p>
            <p>Licensed and insured professional photographer serving worldwide.</p>
            <div className="flex justify-center space-x-4 mt-4">
              <Link to="/privacy" className="hover:text-gray-400 transition-colors">
                Politică de Confidențialitate
              </Link>
              <span>•</span>
              <Link to="/terms" className="hover:text-gray-400 transition-colors">
                Termeni și Condiții
              </Link>
              <span>•</span>
              <Link to="/copyright" className="hover:text-gray-400 transition-colors">
                Copyright
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
