import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

const News = () => {
  return (
    <section className="py-20 px-6 bg-white text-black">
      <div className="max-w-4xl mx-auto text-center">
        <h3 className="text-2xl font-light mb-12 uppercase">As Featured In</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
          <div className="text-center space-y-2">
            <div className="text-lg font-light tracking-wider">MAGNOLIA ROUGE</div>
            <div className="text-xs text-gray-500">Editorial Feature, 2024</div>
          </div>
          <div className="text-center space-y-2">
            <div className="text-lg font-light tracking-wider">GREEN WEDDING SHOES</div>
            <div className="text-xs text-gray-500">Real Wedding Feature</div>
          </div>
          <div className="text-center space-y-2">
            <div className="text-lg font-light tracking-wider">STYLE ME PRETTY</div>
            <div className="text-xs text-gray-500">Vendor Spotlight</div>
          </div>
          <div className="text-center space-y-2">
            <div className="text-lg font-light tracking-wider">THE KNOT</div>
            <div className="text-xs text-gray-500">Pro Photographer</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default News;
