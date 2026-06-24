import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

const Approach = () => {
  return (
    <section className="py-32 px-6 bg-black">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl">
          <div className="space-y-8">
            <h3 className="text-3xl md:text-4xl font-light tracking-[0.05em] leading-tight">
              CAPTĂM SUFLETE,
              <br />
              NU DOAR ZÂMBETE
            </h3>
            <div className="space-y-6 text-gray-300 leading-relaxed">
              <p className="text-lg">
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
            <div className="pt-6">
              {/* <Link
                to='/despre'
                className='inline-block text-sm tracking-[0.2em] uppercase border-b border-white pb-1 hover:border-gray-400 transition-colors'
              >
                Learn More About My Approach →
              </Link> */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Approach;
