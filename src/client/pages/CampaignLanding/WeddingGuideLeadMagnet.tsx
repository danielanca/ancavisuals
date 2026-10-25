import React, { useState } from "react";
import { sendLiveEvent } from "../../utils/liveEvent";
import { measureOaiq } from "../../utils/oaiq";

// Ghidul Mirilor as a lead magnet (owner, 2026-10-25): the PDF opens only after the visitor leaves
// an email or a phone number, or asks for it on WhatsApp. Shown at the END of the page — before
// the price it was one more "free gift" that diluted the offer and delayed "cât costă?".
export const WEDDING_GUIDE_URL = "https://ancavisuals.b-cdn.net/offers-assets/pdfs/Ghidul-Mirilor.pdf";
const WEDDING_GUIDE_HIGHLIGHTS = [
  "În ce ordine rezervați furnizorii",
  "Actele pentru cununia civilă și religioasă",
  "Calendarul organizării, lună cu lună",
  "Desfășurătorul zilei nunții",
  "Sfaturi pentru poze și film frumoase",
  "Trusa de urgență pentru ziua nunții",
];
const DEFAULT_WHATSAPP_NUMBER = "40745469907";
const WHATSAPP_TEXT = "Bună! Aș vrea să primesc Ghidul Mirilor (PDF).";

/** "ana@x.ro" → email, "0712 345 678" → phone, anything else → null. */
export function parseGuideContact(value: string): { email: string } | { phone: string } | null {
  const trimmed = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { email: trimmed.toLowerCase() };
  const digits = trimmed.replace(/[^\d]/g, "");
  if (/^[+\d][\d\s().-]*$/.test(trimmed) && digits.length >= 9 && digits.length <= 15) return { phone: trimmed };
  return null;
}

export default function WeddingGuideLeadMagnet({
  book,
  pagePath,
  whatsappNumber = DEFAULT_WHATSAPP_NUMBER,
}: {
  /** The 3D book cover — the landing passes its lazy-loaded copy. */
  book: React.ReactNode;
  /** Where the visitor is, for the lead and the analytics (ex. "/oferta/olx", "/"). */
  pagePath: string;
  whatsappNumber?: string;
}) {
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "unlocked" | "error">("idle");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const unlock = (channel: "email" | "phone" | "whatsapp") => {
    setState("unlocked");
    sendLiveEvent("guide_downloaded", { label: "Ghidul Mirilor", meta: { file: "Ghidul-Mirilor.pdf", channel, page: pagePath } });
    measureOaiq("guide_downloaded", { page_path: pagePath, channel });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseGuideContact(contact);
    if (!parsed) {
      setFieldError("Scrieți un email sau un număr de telefon valid.");
      return;
    }
    setFieldError(null);
    setState("sending");
    try {
      const res = await fetch("/api/campaign/guide-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed, page: pagePath }),
      });
      if (!res.ok) throw new Error(String(res.status));
      unlock("email" in parsed ? "email" : "phone");
    } catch {
      setState("error");
    }
  };

  const whatsappHref = `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(WHATSAPP_TEXT)}`;

  return (
    <section data-track-section="ghidul mirilor" className="bg-[#f6f2ea] px-6 py-16 text-[#2f2a24] sm:py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
        {book}

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d3b]">PDF · 15 pagini</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">Ghidul Mirilor</h2>
          <p className="mt-4 text-base leading-relaxed text-[#5c5348]">
            Tot ce ne-ar fi plăcut să știe toți mirii de la început, adunat din zecile de nunți la care am fost alături de cupluri.
          </p>
          <ul className="mt-6 grid gap-2.5 text-sm sm:grid-cols-2">
            {WEDDING_GUIDE_HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2f2a24] text-[11px] text-[#f6f2ea]">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {state === "unlocked" ? (
            <div className="mt-8" aria-live="polite">
              <p className="text-sm font-semibold">Gata! Ghidul e al vostru.</p>
              <a
                href={WEDDING_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#2f2a24] px-6 py-4 text-sm font-semibold text-[#f6f2ea] transition-colors hover:bg-black sm:w-auto"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                Deschide Ghidul Mirilor
              </a>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8" noValidate>
              <label htmlFor="guide-contact" className="text-sm font-semibold">Unde vă trimitem ghidul?</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="guide-contact"
                  value={contact}
                  onChange={(event) => { setContact(event.target.value); setFieldError(null); }}
                  placeholder="Email sau telefon"
                  autoComplete="email"
                  aria-invalid={fieldError ? true : undefined}
                  className="min-w-0 flex-1 rounded-xl border border-[#2f2a24]/20 bg-white px-4 py-3.5 text-base text-[#2f2a24] placeholder-[#5c5348]/60 focus:border-[#2f2a24] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="rounded-xl bg-[#2f2a24] px-6 py-3.5 text-sm font-semibold text-[#f6f2ea] transition-colors hover:bg-black disabled:opacity-60"
                >
                  {state === "sending" ? "Se trimite…" : "Primește ghidul"}
                </button>
              </div>
              {fieldError && <p role="alert" className="mt-2 text-sm text-red-700">{fieldError}</p>}
              {state === "error" && <p role="alert" className="mt-2 text-sm text-red-700">Nu am putut trimite acum. Încercați din nou sau cereți-l pe WhatsApp.</p>}
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => unlock("whatsapp")}
                data-ads-contact="off"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2f2a24] underline underline-offset-4 hover:text-black"
              >
                sau cereți-l pe WhatsApp
              </a>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
