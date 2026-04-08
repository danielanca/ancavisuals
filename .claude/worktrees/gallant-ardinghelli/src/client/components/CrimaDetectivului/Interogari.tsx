import React from "react";
import images from "../../../client/media/images";

function Interogari() {
  return (
    <div
      style={{ backgroundImage: `url(${images.crima_detectivului.InterogariBg})` }}
      className="bg-cover bg-center py-28 flex flex-col items-center justify-center w-[99vw]"
    >
      <div className="w-[100%] flex justify-center mb-10">
        <div className="w-[20%] flex flex-col justify-end">
          <div className=" text-[#63D151] font-normal text-xl">Detectiv Exp. Matei Adrian</div>
          <p className="font-normal">Pare să știe mult mai multe, decât vrea să ne arate</p>
        </div>
        <div className="w-[40%] flex items-end justify-center">
          <img className="" src={images.crima_detectivului.InterogariImg} alt="InterogariImg" />
        </div>
        <div className="w-[20%] flex flex-col justify-center">
          <div className=" text-[#FF4E4E] text-end font-normal text-xl mb-2">Suspect #1</div>
          <div className="font-normal text-end text-lg">
            Doar <span className="font-semibold">ecoul pașilor în ploaie</span> știe ce s-a întâmplat acea noapte.
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <h2 className="text-4xl font-bold text-center mb-2">INTEROGĂRI CU ACTORI REALI</h2>
        <p className="font-normal text-center w-[70%] mb-10">
          Urmaresti interogarile lorem ipsum lorem ipsum lorem ipsumlorem ipsumlorem ipsum
        </p>
        <img src={images.crima_detectivului.InterogariEmailIcon} alt="InterogariEmail" />
      </div>
      <div className="mt-8">
        <img src={images.crima_detectivului.InterogariArrows} alt="InterogariArrows" />
        <img
          className="mx-auto -mt-4 sm:-mt-10 md:-mt-20"
          src={images.crima_detectivului.InterogariEmail}
          alt="InterogariEmail"
        />
      </div>
    </div>
  );
}

export default Interogari;
