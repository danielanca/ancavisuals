import React from 'react';
import { useState } from "react"
import img1 from './img1.jpg';

const Allimages = () => {
  return (
    <section className="myport max-w-screen-xl mx-auto px-4 py-12 space-y-6">
      <div className="flex flex-wrap gap-4">
        <img className="w-full sm:w-[49%]" src={img1} alt="" />
        <img className="w-full sm:w-[49%]" src={img1} alt="" />
      </div>
      <div className="flex flex-wrap gap-4">
        <img className="w-full sm:w-[49%]" src={img1} alt="" />
        <img className="w-full sm:w-[29%]" src={img1} alt="" />
        <img className="w-full sm:w-[19%]" src={img1} alt="" />
      </div>
      <div className="flex flex-wrap gap-4">
        <img className="w-full sm:w-[19%]" src={img1} alt="" />
        <img className="w-full sm:w-[29%]" src={img1} alt="" />
        <img className="w-full sm:w-[49%]" src={img1} alt="" />
      </div>
      <div className="flex flex-wrap gap-4">
        <img className="w-full sm:w-[29%]" src={img1} alt="" />
        <img className="w-full sm:w-[19%]" src={img1} alt="" />
        <img className="w-full sm:w-[49%]" src={img1} alt="" />
      </div>
      <div className="flex flex-wrap gap-4">
        <img className="w-full sm:w-[59%]" src={img1} alt="" />
        <img className="w-full sm:w-[39%]" src={img1} alt="" />
      </div>
      <div className="flex flex-wrap gap-4">
        <img className="w-full sm:w-[39%]" src={img1} alt="" />
        <img className="w-full sm:w-[39%]" src={img1} alt="" />
        <img className="w-full sm:w-[19%]" src={img1} alt="" />
      </div>
    </section>
  );
};

export default Allimages;