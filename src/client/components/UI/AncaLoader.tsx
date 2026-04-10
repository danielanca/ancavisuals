import React from "react";

interface Props {
  variant?: "full" | "inline";
}

const STYLES = `
  @keyframes ancaGlow {
    0%, 100% { opacity: 0.15; }
    50%       { opacity: 1;   }
  }
  @keyframes ancaDot {
    0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
    40%           { opacity: 1;   transform: scale(1.2); }
  }
  .anca-loader-wrap    { animation: ancaGlow 2.4s ease-in-out infinite; user-select: none; }
  .anca-loader-title   { letter-spacing: 0.25em; text-transform: uppercase; line-height: 1; }
  .anca-loader-sub     { letter-spacing: 0.35em; text-transform: uppercase; color: #9ca3af; font-style: italic; margin-top: 6px; }
  .anca-loader-dots    { display: flex; justify-content: center; gap: 8px; margin-top: 20px; }
  .anca-loader-dots span {
    border-radius: 50%; background: #ffffff;
    animation: ancaDot 1.4s ease-in-out infinite;
  }
  .anca-loader-dots span:nth-child(2) { animation-delay: 0.2s; }
  .anca-loader-dots span:nth-child(3) { animation-delay: 0.4s; }
`;

export default function AncaLoader({ variant = "full" }: Props) {
  const isFull = variant === "full";

  const titleSize  = isFull ? "clamp(1.6rem, 5vw, 2.4rem)" : "1rem";
  const subSize    = isFull ? "clamp(0.55rem, 1.5vw, 0.7rem)" : "0.55rem";
  const dotSize    = isFull ? "6px" : "4px";

  const inner = (
    <div style={{ textAlign: "center" }}>
      <style>{STYLES}</style>
      <div className="anca-loader-wrap">
        <div className="anca-loader-title" style={{ fontSize: titleSize }}>
          <span style={{ fontWeight: 700, color: "#ffffff" }}>Anca</span>
          <span style={{ fontWeight: 300, color: "#d1d5db" }}>Visuals</span>
        </div>
        {isFull && <div className="anca-loader-sub" style={{ fontSize: subSize }}>You feel it. We frame it.</div>}
      </div>
      <div className="anca-loader-dots">
        <span style={{ width: dotSize, height: dotSize }} />
        <span style={{ width: dotSize, height: dotSize }} />
        <span style={{ width: dotSize, height: dotSize }} />
      </div>
    </div>
  );

  if (isFull) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "#111111",
      }}>
        {inner}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 0" }}>
      {inner}
    </div>
  );
}
