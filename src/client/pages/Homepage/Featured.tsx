import React from "react";
import PortfolioGallery from "../Portfolio/PortfolioGallery";

const Featured = () => {
  return (
    <section className="py-12 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 md:mb-20">
          <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-4 md:mb-6 uppercase">ULTIMELE EVENIMENTE</h2>
          <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Fiecare cadru spune o poveste despre iubire, conexiune și frumoasa imperfecțiune de a fi om.
          </p>
        </div>
      </div>

      {/* Full gallery from Firebase */}
      <PortfolioGallery />
    </section>
  );
};

export default Featured;
