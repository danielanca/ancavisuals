import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Contacthero = () => {
  return (
    <section className="contact-section">
      <motion.h1
        initial={{ opacity: 0, y: 100, scale: 0.9, rotateX: 90 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="text-[2rem] sm:text-[5.5rem] text-[#f9e791] mt-[100px] mb-[40px] leading-[1.2]"
      >
        GREETINGS, EARTHLINGS
      </motion.h1>
      <h2 className="subhead">SEND AN INQUIRY.</h2>
      <div className="px-0 py-[15px] sm:px-[250px]">
        <p>
          Tell me what you're getting up to! I know it's not always fun to type it all out, but I read every last word
          and it helps me understand the vision you have for your nuptials. Once you smack that send button, I (a real
          person/fellow earthling) will absorb it and reply within 24 hours. Or if you want to skip the emailing,
          <a href="#">schedule a consultation call</a> for pricing and availability, and we'll chat about your vision
          face-to-screen. Can’t wait :)
        </p>
        <p className="footer-note">Godspeed to your message, and may it land safely in my inbox, amen.</p>
      </div>
    </section>
  );
};

export default Contacthero;
