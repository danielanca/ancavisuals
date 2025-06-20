import React from "react";
import images from "../../../client/media/images";

function Criminali() {
  return (
    <div style={{ backgroundImage: `url(${images.crima_detectivului.criminaliBg})` }} className="bg-cover bg-center ">
      <div className="w-[100%] md:w-[80%] mx-auto flex flex-wrap justify-center items-center py-10 lg:py-32">
        <div className="w-[80%] md:w-[30%] flex flex-col items-center md:items-start py-20 px-10 xl:border-l-2">
          <h2 className="font-bold text-3xl xl:text-4xl mb-2 whitespace-nowrap">BAZA DE DATE CU CRIMINALI</h2>
          <h3 className="font-bold text-xl lg:text-2xl mb-4">Aplicatie</h3>
          <p className="text-center md:text-left mb-10">
            Intră în pielea unui detectiv hacker, interceptând conversații secrete pentru a descoperi adevărul ascuns
          </p>
          <div className="text-2xl font-bold px-8 py-2 text-center cursor-pointer text-[#151515] bg-[#FCDB07] hover:bg-[#dcca56] mb-10">
            PE TELEFON / DESKTOP
          </div>
          <p className="text-center md:text-left mb-10">
            Vei avea access la panoul de control de detectiv, unde vei primi email si parola de detectiv.
          </p>
          {/* <div className='text-2xl font-bold px-8 py-2 text-center cursor-pointer text-white bg-[#009D2C] hover:bg-[#36b058] mb-10'>DETECTEAZA</div> */}
        </div>

        {/* Right Side */}
        <div className="w-[80%] md:w-[40%] flex flex-col items-center justify-center">
          <img className="w-72" src={images.crima_detectivului.criminaliSmartphone} alt="detectivSmartPhone}" />
          {/* <h2 className='font-bold text-xl mt-6'>INTERCEPTEAZĂ ACUM</h2> */}
        </div>
      </div>
    </div>
  );
}

export default Criminali;
