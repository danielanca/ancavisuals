import React from "react";

const PageLoader: React.FC = () => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "#000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}
  >
    <style>{`
      @keyframes ancaPulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.12; }
      }
      .anca-loader-text {
        animation: ancaPulse 0.85s ease-in-out infinite;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: clamp(1rem, 5vw, 1.5rem);
        font-weight: 300;
        letter-spacing: 0.35em;
        text-transform: uppercase;
        color: #ffffff;
        user-select: none;
      }
      .anca-loader-bold {
        font-weight: 700;
      }
    `}</style>
    <p className="anca-loader-text">
      <span className="anca-loader-bold">Anca</span>Visuals
    </p>
  </div>
);

export default PageLoader;
