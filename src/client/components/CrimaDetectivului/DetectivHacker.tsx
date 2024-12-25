import React from 'react';
import images from '../../../client/media/images';

function DetectivHacker() {
  return (
    <div
      style={{ backgroundImage: `url(${images.crima_detectivului.detectivHackerBg})` }}
      className='bg-cover bg-center '
    >
      <div className='w-[100%] md:w-[80%] mx-auto flex flex-wrap justify-center items-center py-10 lg:py-32 max-w-[1200px]"'>
        <div className='w-[80%] md:w-[40%] flex flex-col items-center justify-center'>
          <img className='w-72' src={images.crima_detectivului.detectivSmartPhone} alt='detectivSmartPhone}' />
          <h2 className='font-bold text-xl mt-6'>INTERCEPTEAZĂ ACUM</h2>
        </div>

        <div className='w-[80%] md:w-[30%] flex flex-col items-center md:items-end py-20 px-10 xl:border-r-2'>
          <h2 className='font-bold text-3xl xl:text-4xl 2xl:text-5xl mb-2'>Detectiv Hacker</h2>
          <h3 className='font-bold text-xl mb-4'>Interceptează conversatii</h3>
          <p className='text-center md:text-right mb-10'>
            Intră în pielea unui detectiv hacker, interceptând conversații secrete pentru a descoperi adevărul ascuns
          </p>
          <div className='text-2xl font-bold px-8 py-2 text-center cursor-pointer text-[#151515] bg-[#FCDB07] hover:bg-[#dcca56] mb-10'>
            PE TELEFON / DESKTOP
          </div>
          <p className='text-center md:text-right mb-10'>
            Vei avea access la panoul de control de detectiv, unde vei primi email si parola de detectiv.
          </p>
          <div className='text-2xl font-bold px-8 py-2 text-center cursor-pointer text-white bg-[#009D2C] hover:bg-[#36b058] mb-10'>
            DETECTEAZA
          </div>
        </div>
        <div className='md:w-[10%]'></div>
      </div>
    </div>
  );
}

export default DetectivHacker;
