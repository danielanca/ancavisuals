import React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const Approach = () => {
  return (
    <section className='py-32 px-6 bg-black'>
      <div className='max-w-7xl mx-auto'>
        <div className='grid lg:grid-cols-2 gap-20 items-center'>
          <div className='space-y-8'>
            <h3 className='text-3xl md:text-4xl font-light tracking-[0.05em] leading-tight'>
              CAPTĂM SUFLETE,
              <br />
              NU DOAR ZÂMBETE
            </h3>
            <div className='space-y-6 text-gray-300 leading-relaxed'>
              <p className='text-lg'>
                Într-o lume obsedată de perfecțiune, noi credem în frumusețea autentică a imperfecțiunii. În liniile
                zâmbetelor care spun o poveste, în lacrimile care vorbesc despre iubire, în tăcerile dintre gesturi –
                acolo e magia.
              </p>
              <p>
                Fotografia pe film ne învață să încetinim, să fim cu adevărat prezenți. Fiecare cadru contează. De
                aceea, alegem să surprindem viața așa cum este ea: sinceră, vie, emoționantă.
              </p>
              <p>
                Abordarea noastră e documentară, dar cu suflet. Nu doar imortalizăm evenimente – ci păstrăm esența
                voastră, energia dintre voi, iubirea care nu se vede cu ochiul liber, dar se simte. Acestea nu sunt
                simple fotografii. Sunt amintiri vii, moșteniri pentru inimile care vor veni.
              </p>
            </div>
            <div className='pt-6'>
              {/* <Link
                to='/despre'
                className='inline-block text-sm tracking-[0.2em] uppercase border-b border-white pb-1 hover:border-gray-400 transition-colors'
              >
                Learn More About My Approach →
              </Link> */}
            </div>
          </div>
          <div className='grid grid-cols-2 gap-6'>
            <div className='space-y-6'>
              <div className='aspect-[3/4] group cursor-pointer'>
                <img
                  src='https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2FGermania%2FBiserica-434.jpg?alt=media&token=8f5a963e-84fe-4796-bd01-3d7879e5eae7'
                  alt='Behind the scenes film photography'
                  width='400'
                  height='500'
                  className='w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105'
                />
              </div>
              <div className='aspect-[4/3] group cursor-pointer'>
                <img
                  src='https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2FGermania%2FBiserica-0860.jpg?alt=media&token=56ef1e2f-ce6d-42c8-ac65-297341ee3e26'
                  alt='Vintage film camera collection'
                  width='400'
                  height='400'
                  className='w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105'
                />
              </div>
              <div className='aspect-[2/4] group cursor-pointer'>
                <img
                  src='https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2FGermania%2FPoza1-1997.jpg?alt=media&token=34dbef53-4ce9-49b5-927b-0bee2b553a60'
                  alt='Vintage film camera collection'
                  width='400'
                  height='400'
                  className='w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105'
                />
              </div>
            </div>
            <div className='space-y-6 pt-12'>
              <div className='aspect-square group cursor-pointer'>
                <img
                  src='https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2FGermania%2FBiserica-473.jpg?alt=media&token=17e4056a-2e8c-4b8c-9a17-167d0223ed89'
                  alt='Film development process'
                  width='400'
                  height='400'
                  className='w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105'
                />
              </div>
              <div className='aspect-[4/3] group cursor-pointer'>
                <img
                  src='https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2FGermania%2FBiserica-1093.jpg?alt=media&token=dc102677-6eee-40c0-a797-1d7855093e05'
                  alt='Artistic film photography setup'
                  width='400'
                  height='300'
                  className='w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105'
                />
              </div>
              <div className='col-span-2 aspect-[4/7] group cursor-pointer'>
                <img
                  src='https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2FGermania%2FPoza1-2006.jpg?alt=media&token=48e679db-c6fc-4160-8b61-392c7b33d4f7'
                  alt='Artistic film photography setup'
                  width='400'
                  height='300'
                  className='w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105'
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Approach;
