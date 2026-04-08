import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

const Letter = () => {
  return (
    <section className="py-32 px-6 bg-amber-50 text-black">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <h3 className="text-3xl md:text-4xl font-light tracking-[0.05em]">Scrisoare de la Daniel & Estera</h3>
          <div className="space-y-6 text-base md:text-lg leading-relaxed">
            <p>
              <strong className="font-semibold">Dragă om frumos</strong> care citești aceste rânduri,
            </p>

            <p>
              Vrem să îți spunem ceva despre{" "}
              <strong className="font-semibold">magia care se întâmplă atunci când încetinim</strong> puțin și privim cu
              adevărat. Într-o lume grăbită, mereu conectată, uităm uneori cât de prețios este să fim{" "}
              <strong className="font-semibold">prezenți — cu totul</strong>.
            </p>

            <p>
              Fotografia și videografia noastră nu sunt despre <strong className="font-semibold">perfecțiune</strong>{" "}
              sau <strong className="font-semibold">decor</strong>. Sunt despre{" "}
              <strong className="font-semibold">emoții reale</strong>,
              <strong className="font-semibold">priviri sincere</strong> și{" "}
              <strong className="font-semibold">momente care nu se mai repetă</strong>. Despre acea îmbrățișare
              neașteptată, acel râs sincer, acea lacrimă care scapă fără să știe că e privită.
            </p>

            <p>
              Am învățat, cu timpul, să <strong className="font-semibold">anticipăm clipele</strong>, să{" "}
              <strong className="font-semibold">citim lumina</strong>, să{" "}
              <strong className="font-semibold">devenim invizibili</strong> — pentru ca{" "}
              <strong className="font-semibold">tu să fii cu adevărat tu</strong>. Fiecare cadru este{" "}
              <strong className="font-semibold">gândit cu grijă</strong>, pentru că unele trăiri merită păstrate exact
              așa cum au fost simțite.
            </p>

            <p>
              Lucrăm digital, dar <strong className="font-semibold">livrăm mai mult decât fișiere</strong>. Oferim{" "}
              <strong className="font-semibold">povești vizuale</strong> pe care le poți retrăi, oricând. Și pentru cei
              dragi care poate nu stau cu telefonul în mână,
              <strong className="font-semibold">trimitem cu drag, gratuit, poze printate pe hârtie foto</strong>
              pentru <strong className="font-semibold">părinți și bunici</strong>.
              <strong className="font-semibold">Să le poată ține în mână, nu doar în suflet.</strong>
            </p>

            <p>
              <strong className="font-semibold">Asta nu e doar fotografie. Nu e doar video.</strong>
              <strong className="font-semibold">Este o formă de a opri timpul</strong>, de a{" "}
              <strong className="font-semibold">păstra viața așa cum e</strong>: frumoasă, imperfectă, sinceră.
            </p>

            <p className="italic pt-4">
              Cu <strong className="font-semibold">recunoștință</strong>,{" "}
              <strong className="font-semibold">emoție</strong> și <strong className="font-semibold">lumină</strong>,
              <br />
              <span className="text-2xl font-light">echipa Anca Visuals</span>
            </p>
          </div>
        </div>
        <div className="relative">
          <div className="aspect-[4/5] relative">
            <img
              src="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FRimini-94.jpg?alt=media&token=42067803-f0cb-42f7-8b1b-4c262fcd7281"
              alt="Portrait of Alma, film photographer"
              width="500"
              height="600"
              className="w-full h-full object-cover rounded-sm shadow-2xl"
            />
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white rounded-sm shadow-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-light">3+ ani</div>
                <div className="text-xs tracking-wider uppercase">experienta</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Letter;
