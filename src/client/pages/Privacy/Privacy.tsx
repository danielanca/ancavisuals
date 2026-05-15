import React, { useEffect } from "react";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";

const Privacy = () => {
  useEffect(() => {
    const existing = document.getElementById("usercentrics-ppg");
    if (existing) return;

    const script = document.createElement("script");
    script.id = "usercentrics-ppg";
    script.setAttribute("privacy-policy-id", "7cf1a186-6d81-4d53-a320-e52ae7afd219");
    script.setAttribute("data-language", "ro");
    script.src = "https://policygenerator.usercentrics.eu/api/privacy-policy";
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 py-32">
        <h1 className="text-3xl md:text-4xl font-light tracking-[0.1em] uppercase mb-4">
          Politică de Confidențialitate
        </h1>
        <p className="text-gray-500 text-sm tracking-widest uppercase mb-16">
          Ultima actualizare: Mai 2026
        </p>

        <div className="text-gray-300 leading-relaxed">
          <div className="uc-privacy-policy" />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Privacy;
