import React, { useEffect } from "react";

const SLOW_LOAD_THRESHOLD_MS = 8000;

interface Props {
  variant?: "full" | "inline";
  subtitle?: string;
  reportSlowLoad?: boolean;
}

const STYLES = `
  @keyframes ancaDot {
    0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
    40%           { opacity: 1;   transform: scale(1.2); }
  }
  .anca-loader-wrap    { user-select: none; }
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

export default function AncaLoader({ variant = "full", subtitle, reportSlowLoad = false }: Props) {
  useEffect(() => {
    if (!reportSlowLoad) return;
    const timer = setTimeout(() => {
      const page = typeof window !== "undefined" ? window.location.pathname : "/";
      fetch("/api/monitoring/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `[SLOW LOAD] Loading spinner active for 8+ seconds on ${page}`,
          stack: `navigator.userAgent: ${navigator.userAgent}`,
          page,
        }),
      }).catch(() => {});
    }, SLOW_LOAD_THRESHOLD_MS);
    return () => clearTimeout(timer);
  }, [reportSlowLoad]);
  const isFull = variant === "full";

  const titleSize  = isFull ? "clamp(1.6rem, 5vw, 2.4rem)" : "1rem";
  const subSize    = isFull ? "clamp(0.55rem, 1.5vw, 0.7rem)" : "0.55rem";
  const dotSize    = isFull ? "6px" : "4px";

  const inner = (
    <div style={{ textAlign: "center", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <style>{STYLES}</style>
      <div className="anca-loader-wrap">
        <div className="anca-loader-title" style={{ fontSize: titleSize }}>
          <span style={{ fontWeight: 700, color: "#ffffff" }}>Anca</span>
          <span style={{ fontWeight: 300, color: "#d1d5db" }}>Visuals</span>
        </div>
        {isFull && (
          <div className="anca-loader-sub" style={{ fontSize: subSize }}>
            {subtitle ?? "You feel it. We frame it."}
          </div>
        )}
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
        minHeight: "100vh", width: "100%", background: "#111111",
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
