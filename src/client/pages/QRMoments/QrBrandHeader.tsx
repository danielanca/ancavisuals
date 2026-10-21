/*
 * Purpose: top of the QR Moments guest page — "ANCA VISUALS" and our services, one after the
 * other turning bold, so the guests scanning the code see who made the photos and what else we do.
 * With reduced motion the row stays still.
 */
import { useEffect, useState } from "react";

export const QR_BRAND_SERVICES = ["Foto", "Video", "Fotocabină", "Video booth 360", "QR Moments", "Album", "Fotocarte"];
export const QR_BRAND_STEP_MS = 1400;

export default function QrBrandHeader() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % QR_BRAND_SERVICES.length), QR_BRAND_STEP_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="border-b border-neutral-950 pb-4 text-center">
      <a href="/" className="text-neutral-950 no-underline">
        {/* Letter spacing also trails the last letter; the matching left padding keeps the logo centred. */}
        <span className="block pl-[0.34em] text-2xl font-light uppercase tracking-[0.34em]">Anca Visuals</span>
      </a>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[11px] uppercase tracking-[0.1em]" aria-label={QR_BRAND_SERVICES.join(", ")}>
        {QR_BRAND_SERVICES.map((service, index) => (
          <span key={service} aria-hidden="true" className="flex items-center gap-1.5">
            {index > 0 && <span className="text-neutral-300">·</span>}
            {/* The invisible bold copy keeps the width fixed, so the row does not jump. */}
            <span className="inline-grid">
              <span className="invisible col-start-1 row-start-1 font-bold">{service}</span>
              <span
                data-active={index === active || undefined}
                className={`col-start-1 row-start-1 transition-colors duration-500 ${index === active ? "font-bold text-neutral-950" : "font-normal text-neutral-400"}`}
              >
                {service}
              </span>
            </span>
          </span>
        ))}
      </p>
    </header>
  );
}
