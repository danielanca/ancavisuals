import React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const Bio = () => {
  return (
    <section className='py-24 lg:py-32 px-6 bg-amber-50 text-black'>
      <div className='max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center'>
        <div className='space-y-8'>
          <h2 className='text-4xl md:text-5xl lg:text-6xl font-extralight tracking-[0.05em] mb-8 text-gray-900'>
            Salutare
          </h2>
          <div className='space-y-6 text-base md:text-lg leading-relaxed text-gray-800'>
            <p>
              Bună! Noi suntem echipa Anca Visuals – un duo simpatic (speram noi), organizat și ușor de iubit (zic
              clienții noștri). Ne-am cunoscut la volei, într-o sală cu lumină cam proastă, dar cu priviri bune. Dani
              făcea poze. Estera dădea pase. De-atunci, am tot dat pase unul altuia prin viață și prin evenimente.
            </p>

            <p>
              El e omul din spatele camerei video, ea e cu fotografia. Dar când ziua o cere, schimbăm rolurile fără
              dramă – știm exact ce trebuie surprins și când să ne dăm din cadru. Scopul nostru? Să prindem momentele
              alea reale și neașteptate: lacrimi care vin fără să fie chemate, râsete care sparg liniștea, priviri care
              spun tot.
            </p>

            <p>
              Ne plac oamenii sinceri, poveștile imperfecte și nunțile unde lumea dansează până dimineața. Suntem
              atenți, calmi și discreți, ca niște prieteni buni care se întâmplă să vină cu camere după ei. Clienții ne
              spun că se simt în siguranță cu noi, că le-am scos o grijă mare din cap – și e adevărat: ne ocupăm de tot
              ce ține de imagine, iar voi vă ocupați să trăiți ziua.
            </p>

            <p>
              Nu lucrăm pe repede-înainte. Preferăm să facem lucrurile bine, clar și fără neînțelegeri. De asta semnăm
              un contract prietenos în care scriem negru pe alb ce facem pentru voi – și facem exact ce promitem.
            </p>

            <p>
              Când nu filmăm sau edităm, stăm cu Nor, pisicul nostru negru și domn al casei. Ne place liniștea, cafeaua
              bună și să fugim uneori în locuri care ne inspiră. Dar în inima noastră rămân momentele în care părinții
              își țin copiii în brațe la botez sau îi privesc emoționați în rochie de mireasă. Acolo simțim că munca
              noastră contează cu adevărat.
            </p>

            <p>
              Dacă și tu cauți mai mult decât niște cadre frumoase – dacă vrei o echipă pe care te poți baza, care o
              să-ți spună: „Lasă grija asta la noi” – atunci s-ar putea să fim oamenii tăi. Suntem aici. Pregătiți. Cu
              camerele încărcate și inimile deschise.
            </p>
          </div>
        </div>
        <div className='relative'>
          <div className='aspect-[4/5] relative'>
            <img
              src='https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FDespreNoi%2FPoze-218.jpg?alt=media&token=c515b80e-3026-420b-bf4f-d05e850548ed'
              alt='Alexa in her element, camera in hand, natural light'
              className='w-full h-full object-cover rounded-sm shadow-2xl'
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Bio;
