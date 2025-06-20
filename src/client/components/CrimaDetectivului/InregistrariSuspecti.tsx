import React from "react";
import images from "../../../client/media/images";

function InregistrariSuspecti() {
  return (
    <div
      style={{ backgroundImage: `url(${images.crima_detectivului.detectivHackerBg})` }}
      className="bg-cover bg-center  py-28 flex flex-col items-center justify-center w-[99vw]"
    >
      <div className="w-[80%] md:w-[60%] lg:w-[40%] xl:w-[30%] 2xl:w-[22%] flex flex-col justify-center">
        <h2 className="font-bold text-4xl mb-4 text-center">ÎNREGISTRĂRI SUSPECȚI</h2>
        <h3 className="w-[90%] lg:w-[80%] mx-auto text-center font-semibold text-xl mb-6">
          Analizează in detaliu fiecare cuvânt ce te poate duce spre{" "}
          <span className="text-[#069D4D] font-semibold border-b-2">adevăr</span>
        </h3>
        <img
          className="w-[400px] mx-auto"
          src={images.crima_detectivului.InregistrariSuspectiMusicImg}
          alt="InregistrariSuspectiMusicImg"
        />
        <span className="text-left">Detectiv</span>
        <span className="text-white w-[45%] font-light mb-4">Ploaia poate șterge urme, dar nu și adevăruri...</span>
        <span className="text-right text-[#FF4E4E] text-xl font-normal mb-4">Suspect #1</span>
        <div className="flex justify-end text-end">
          <p className="text-white font-light w-[55%] mb-10">
            Doar <span className="font-semibold">ecoul pașilor în ploaie</span> știe ce s-a întâmplat acea noapte.
          </p>
        </div>
        <hr className="w-[70%] mx-auto border-[#05B048] mb-10" />
        <h3 className="text-center font-semibold text-xl mb-6 md:w-[120%]">
          Intră în pielea unui detectiv hacker, interceptând conversații secrete pentru a descoperi adevărul ascuns
        </h3>
      </div>
    </div>
  );
}

export default InregistrariSuspecti;
