import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 p-4 md:p-8 bg-black/20 backdrop-blur-sm text-white">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        {/* Left Navigation - Hidden on mobile, visible on tablet+ */}
        <div className="hidden lg:flex space-x-6 xl:space-x-8">
          <Link
            to="/despre"
            className="text-xs md:text-sm font-light tracking-[0.2em] uppercase hover:text-gray-300 transition-colors"
          >
            Despre
          </Link>
          {/* <Link
                        to="/pricing"
                        className="text-xs md:text-sm font-light tracking-[0.2em] uppercase hover:text-gray-300 transition-colors"
                    >
                        Pricing
                    </Link>  */}
          <Link
            to="/portofoliu"
            className="text-xs md:text-sm font-light tracking-[0.2em] uppercase hover:text-gray-300 transition-colors"
          >
            PORTOFOLIU
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="lg:hidden relative w-10 h-10 flex items-center justify-center group z-50"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <div className="relative w-6 h-6 flex flex-col justify-center items-center">
            <span
              className={`block absolute h-0.5 w-6 bg-white transform transition duration-300 ease-in-out ${
                isMobileMenuOpen ? "rotate-45" : "-translate-y-1.5"
              }`}
            ></span>
            <span
              className={`block absolute h-0.5 w-6 bg-white transform transition duration-300 ease-in-out ${
                isMobileMenuOpen ? "opacity-0" : ""
              }`}
            ></span>
            <span
              className={`block absolute h-0.5 w-6 bg-white transform transition duration-300 ease-in-out ${
                isMobileMenuOpen ? "-rotate-45" : "translate-y-1.5"
              }`}
            ></span>
          </div>
        </button>

        {/* Center Logo */}
        <Link to="/" className="text-center absolute left-1/2 transform -translate-x-1/2">
          <div className="text-lg md:text-xl lg:text-2xl tracking-[0.2em] md:tracking-[0.3em] uppercase mb-1">
            <span className="font-bold text-white">Anca</span>
            <span className="font-light text-gray-300">Visuals</span>
          </div>
          <p className="text-xs md:text-base tracking-widest uppercase text-gray-400 italic">
            You feel it. We frame it.
          </p>
        </Link>

        {/* Right Side - Social & Inquire */}
        <div className="flex items-center space-x-3 md:space-x-4 lg:space-x-6">
          <div className="hidden sm:flex space-x-3 md:space-x-4">
            <a href="https://instagram.com/ancavisuals" className="hover:text-gray-300 transition-colors">
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
          </div>
          <Link
            to="/contact"
            className="text-xs md:text-sm font-light tracking-[0.15em] md:tracking-[0.2em] uppercase border-b border-white pb-1 hover:border-gray-300 transition-colors"
          >
            SOLICITA
          </Link>
        </div>
      </div>

      {/* Mobile Menu Overlay - Full Screen Background */}
      <div
        className={`lg:hidden fixed top-0 left-0 right-0 bottom-0 w-screen h-screen z-40 transition-all duration-500 ease-in-out ${
          isMobileMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{
          backgroundColor: isMobileMenuOpen ? "#1a202c" : "transparent",
          opacity: isMobileMenuOpen ? 1 : 0,
        }}
      >
        {/* Menu Content */}
        <div
          className={`relative h-full flex flex-col justify-between p-6 transform transition-all duration-500 ease-in-out ${
            isMobileMenuOpen ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-center mt-1">
            <div className="text-center">
              <h1 className="text-base tracking-[0.3em] uppercase mb-1">
                <span className="font-bold text-white">Anca</span>
                <span className="font-light text-gray-300">Visuals</span>
              </h1>
              <p className="text-xs tracking-widest uppercase text-gray-400 italic">Look. Feel. Save.</p>
            </div>
          </div>

          {/* Navigation Links - Centered */}
          <nav className="flex-1 flex flex-col justify-center items-center space-y-8">
            <Link
              to="/despre"
              className="flex items-center justify-between text-3xl font-light tracking-[0.2em] uppercase text-white hover:text-gray-300 transition-colors group"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>DESPRE</span>
              <svg
                className="h-6 w-6 ml-4 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              to="/portofoliu"
              className="flex items-center justify-between text-3xl font-light tracking-[0.2em] uppercase text-white hover:text-gray-300 transition-colors group"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>PORTOFOLIU</span>
              <svg
                className="h-6 w-6 ml-4 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </nav>

          {/* Bottom Section */}
          <div className="space-y-8">
            {/* Social Icons */}
            <div className="flex justify-center space-x-8">
              <a
                href="https://instagram.com/ancavisuals"
                className="text-white hover:text-gray-300 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="https://tiktok.com/@ancavisuals"
                className="text-white hover:text-gray-300 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </a>
            </div>

            {/* Inquire Button */}
            <div className="text-center">
              <Link
                to="/contact"
                className="inline-block text-lg font-light tracking-[0.3em] uppercase text-white border-b border-white pb-2 hover:text-gray-300 hover:border-gray-300 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                SOLICITA-NE
              </Link>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-400 tracking-wider">www.ancavisuals.ro</p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
