import React from "react";
import images from "../../../client/media/images";

function CrimaHero() {
  return (
    <>
      <div
        style={{ backgroundImage: `url(${images.crima_detectivului.crimaDetecBg})` }}
        className="w-[99vw] h-[70vh] sm:h-[80vh] bg-cover bg-center flex flex-col justify-center"
      >
        <div className="flex justify-center">
          <div className="w-[45%] flex items-center justify-end">
            <img
              className="h-[50%] object-contain "
              src={images.crima_detectivului.CRIMA_HEADLINE}
              alt="CRIMA_HEADLINE"
            />
          </div>
          <div className="w-[45%] flex items-center justify-start">
            <img
              className="h-[60%] object-contain"
              src={images.crima_detectivului.Polaroid_GROUP}
              alt="Polaroid_GROUP"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap justify-center mb-0 sm:mb-40">
          <div className="text-2xl font-bold px-4 py-2 text-center cursor-pointer bg-[#00000054] hover:bg-[#4c4c4c54]">
            COLECTEAZĂ
          </div>
          <div className="text-2xl font-bold px-8 py-2 text-center cursor-pointer text-[#151515] bg-[#FCDB07] hover:bg-[#dcca56]">
            DOVEZILE
          </div>
        </div>
      </div>
    </>
  );
}

export default CrimaHero;
