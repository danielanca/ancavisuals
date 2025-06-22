import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-black py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <nav className="mb-8">
            <div className="flex flex-wrap justify-center gap-8 text-sm tracking-[0.2em] uppercase">
              <Link to="/about" className="hover:text-gray-400 transition-colors">
                About
              </Link>
              <Link to="/portfolio" className="hover:text-gray-400 transition-colors">
                Portfolio
              </Link>
              {/* <Link to="/pricing" className="hover:text-gray-400 transition-colors">
                                Pricing
                            </Link> */}
              <Link to="/contact" className="hover:text-gray-400 transition-colors">
                Inquire
              </Link>
            </div>
          </nav>
        </div>

        <div className="border-t border-gray-800 pt-12 text-center">
          <div className="mb-8">
            <h3 className="text-2xl font-light tracking-[0.1em] mb-4">ANCA VISUALS</h3>
            <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Crafting timeless memories through the art of film photography. For humans craving authentic moments that
              stand the test of time.
            </p>
          </div>

          <div className="text-xs text-gray-500 space-y-2">
            <p> 2025 Ancavisuals Film Photography. All rights reserved.</p>
            <p>Licensed and insured professional photographer serving worldwide.</p>
            <div className="flex justify-center space-x-4 mt-4">
              <Link to="/privacy" className="hover:text-gray-400 transition-colors">
                Privacy Policy
              </Link>
              <span>•</span>
              <Link to="/terms" className="hover:text-gray-400 transition-colors">
                Terms of Service
              </Link>
              <span>•</span>
              <Link to="/copyright" className="hover:text-gray-400 transition-colors">
                Copyright Info
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
