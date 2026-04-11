import React from "react";
import { TypeAnimation } from "react-type-animation";
import { motion } from "framer-motion";
const phrases = [
  "Lumină care spune povești.",
  2500,
  "Clipe care rămân vii.",
  2500,
  "Viziunea noastră, amintirile tale.",
  2500,
];

const PortfolioHero = () => {
  return (
    <section className="relative flex items-center justify-center w-full min-h-[80vh] px-6 py-24 md:py-32 bg-neutral-950 overflow-hidden">
      {/* Background image + overlay */}
      <div className="absolute inset-0 -z-0">
        <img
          src="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FHeroContact%2FRuxandra-55.jpg?alt=media&token=0314ef83-3d83-4994-b9e3-4249f4ec4c71"
          alt="Portofoliu Anca Visuals"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Text + animation */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center"
      >
        <h1 className="font-display font-semibold leading-tight tracking-tight text-[1.4rem] sm:text-[2rem] md:text-6xl text-white inline-block relative max-w-[90vw]">
          <TypeAnimation
            sequence={phrases}
            wrapper="span"
            cursor={true}
            speed={70}
            repeat={Infinity}
            className="whitespace-nowrap"
          />
        </h1>

        <p className="mt-6 text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto">
          Povestea ta merită mai mult decât o fotografie. Merită o emoție capturată în lumină.
        </p>

        <motion.div
          key="underline"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.9, duration: 0.8, ease: "easeOut" }}
          className="h-[2px] bg-yellow-200 origin-left mt-6 w-24 mx-auto"
        />
      </motion.div>
    </section>
  );
};

export default PortfolioHero;
