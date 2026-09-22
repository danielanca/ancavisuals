import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import PhoneNumberReveal from "../../components/PhoneReveal/PhoneNumberReveal";
import { reportAvailabilityCheck } from "../../utils/liveEvent";
import { destination } from "../../utils/address";
import { PHONE_RE } from "../Contact/booking/utils/validators";

const PHONE = "0745469907";
const PHONE_DISPLAY = "0745 469 907";
const WHATSAPP_MESSAGE = "Bună! În legătură cu un eveniment vă contactez.";
const WHATSAPP_LINK = `https://wa.me/40${PHONE.slice(1)}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

const MONTHS_RO = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const MONTHS_RO_CAP = MONTHS_RO.map((m) => m[0].toUpperCase() + m.slice(1));

function formatDateRo(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS_RO[Number(m[2]) - 1]} ${m[1]}`;
}
const daysInMonth = (year: number, monthZeroBased: number) => new Date(year, monthZeroBased + 1, 0).getDate();
const toIso = (day: number, monthZeroBased: number, year: number) =>
  `${year}-${String(monthZeroBased + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

interface BioLink {
  label: string;
  sublabel: string;
  href: string;
  icon: React.ReactNode;
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2.83 12.83a2 2 0 0 1-.59-1.42V4a1 1 0 0 1 1-1h7.41a2 2 0 0 1 1.42.59l7.76 7.76a2 2 0 0 1 0 2.83z" />
      <circle cx="6.5" cy="6.5" r="1.5" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 10.5V21h14V10.5" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.115 1.527 5.845L.057 23.455a.5.5 0 00.614.614l5.61-1.47A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.896 0-3.673-.497-5.21-1.367l-.374-.218-3.878 1.016 1.016-3.878-.218-.374A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

function CallbackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      <path d="M18 2v5" />
      <path d="M15.5 4.5h5" />
    </svg>
  );
}

const LINKS: BioLink[] = [
  { label: "Portofoliu", sublabel: "Vezi ultimele nunți & evenimente", href: "/portofoliu", icon: <CameraIcon /> },
  { label: "Oferte", sublabel: "Pachete și prețuri", href: "/oferta", icon: <TagIcon /> },
  { label: "Acasă", sublabel: "Site-ul complet Anca Visuals", href: "/", icon: <HomeIcon /> },
];

// Fiecare link primește un accent de culoare diferit (ciclic), ca să nu mai pară
// 4 carduri identice cu doar textul schimbat — la fel ca la cardurile de pachete.
const LINK_ACCENTS = [
  { badge: "bg-amber-400/15 text-amber-300", border: "hover:border-amber-400/40" },
  { badge: "bg-sky-400/15 text-sky-300", border: "hover:border-sky-400/40" },
  { badge: "bg-emerald-400/15 text-emerald-300", border: "hover:border-emerald-400/40" },
  { badge: "bg-violet-400/15 text-violet-300", border: "hover:border-violet-400/40" },
];

const BioPage: React.FC = () => {
  const defaultDate = (() => {
    const now = new Date();
    let month = now.getMonth() + 1; // luna următoare
    let year = now.getFullYear();
    if (month > 11) { month = 0; year += 1; }
    return { day: 1, month, year };
  })();

  const todayForDate = new Date();
  const todayYear = todayForDate.getFullYear();
  const todayMonth = todayForDate.getMonth();
  const todayDay = todayForDate.getDate();

  const [dateParts, setDateParts] = useState(defaultDate);
  const [eventType, setEventType] = useState("Nuntă");
  const [eventDate, setEventDate] = useState(toIso(defaultDate.day, defaultDate.month, defaultDate.year));
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [availStatus, setAvailStatus] = useState<"idle" | "checking" | "available" | "unavailable">("idle");

  const [showCallbackForm, setShowCallbackForm] = useState(false);
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackError, setCallbackError] = useState("");
  const [callbackStatus, setCallbackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [featuredPdf, setFeaturedPdf] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    fetch("/api/booked-dates")
      .then((r) => r.json())
      .then((d: { dates?: string[] }) => setBookedDates(d.dates ?? []))
      .catch(() => setBookedDates([]));
  }, []);

  useEffect(() => {
    fetch("/api/pdf-resources/featured")
      .then((r) => r.json())
      .then((d: { resource?: { title: string; url: string } | null }) => setFeaturedPdf(d.resource ?? null))
      .catch(() => setFeaturedPdf(null));
  }, []);

  const setDatePart = (patch: Partial<typeof dateParts>) => {
    setDateParts((prev) => {
      const next = { ...prev, ...patch };
      if (next.year < todayYear) { next.year = todayYear; next.month = todayMonth; }
      if (next.year === todayYear && next.month < todayMonth) next.month = todayMonth;
      const maxDay = daysInMonth(next.year, next.month);
      const minDay = next.year === todayYear && next.month === todayMonth ? todayDay : 1;
      if (next.day > maxDay) next.day = maxDay;
      if (next.day < minDay) next.day = minDay;
      setEventDate(toIso(next.day, next.month, next.year));
      return next;
    });
    setAvailStatus("idle");
  };

  const checkAvailability = (e: React.FormEvent) => {
    e.preventDefault();
    setAvailStatus("checking");
    const available = !bookedDates.includes(eventDate);
    window.setTimeout(() => setAvailStatus(available ? "available" : "unavailable"), 350);
    reportAvailabilityCheck(formatDateRo(eventDate), eventDate, available, eventType);
  };

  const requestCallback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PHONE_RE.test(callbackPhone)) {
      setCallbackError("Număr de telefon invalid.");
      return;
    }
    setCallbackError("");
    setCallbackStatus("sending");
    try {
      const res = await fetch(`${destination}/triggerEvent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeEvent: "Vreau să fiu contactat — Bio",
          url: "/bio",
          browserVersion: navigator.userAgent,
          subject: `Vreau să fiu contactat — ${callbackPhone}`,
          html: `
            <h2>Cerere de apel din /bio</h2>
            <ul>
              <li><b>Telefon:</b> ${callbackPhone}</li>
            </ul>
            <p><i>Persoana a cerut să fie sunată, din pagina /bio.</i></p>
          `,
          booking: { phone: callbackPhone },
        }),
      });
      setCallbackStatus(res.ok || res.status === 204 ? "sent" : "error");
    } catch {
      setCallbackStatus("error");
    }
  };

  return (
    <>
      <SeoPageHead
        title="Anca Visuals — Fotograf & Videograf Nuntă"
        description="Fotografie & videografie pentru nunți, botezuri și evenimente. Portofoliu, oferte și contact — totul într-un singur loc."
        canonicalPath="/bio"
      />

      <div className="min-h-screen bg-neutral-950 text-white px-5 py-14 flex flex-col items-center">
        <div className="w-full max-w-sm flex flex-col items-center">

          {/* Brand — același logo ca pe homepage */}
          <Link to="/" className="text-center">
            <div className="text-lg md:text-xl lg:text-2xl tracking-[0.2em] md:tracking-[0.3em] uppercase mb-1">
              <span className="font-bold text-white">Anca</span>
              <span className="font-light text-gray-300">Visuals</span>
            </div>
            <p className="text-xs md:text-base tracking-widest uppercase text-gray-400 italic">
              You feel it. We frame it.
            </p>
          </Link>

          <p className="mt-4 text-neutral-400 text-sm text-center leading-relaxed">
            Fotografie &amp; videografie pentru nunți, botezuri și evenimente.
          </p>

          {/* Verificare disponibilitate — direct pe pagină */}
          <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-5 mt-8">
            <p className="text-amber-200 text-xs uppercase tracking-[0.2em] mb-3">Verifică disponibilitatea</p>
            <form onSubmit={checkAvailability} className="space-y-2.5">
              <select
                value={eventType}
                onChange={(e) => { setEventType(e.target.value); setAvailStatus("idle"); }}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3.5 py-3 text-sm text-white outline-none focus:border-amber-500"
              >
                <option>Nuntă</option>
                <option>Botez</option>
                <option>Majorat</option>
                <option>Cununie civilă</option>
                <option>Alt eveniment</option>
              </select>
              <div className="grid grid-cols-[64px_1fr_84px] gap-2">
                <select
                  aria-label="Ziua"
                  value={dateParts.day}
                  onChange={(e) => setDatePart({ day: Number(e.target.value) })}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-2 py-3 text-sm text-white outline-none focus:border-amber-500"
                >
                  {(() => {
                    const maxDay = daysInMonth(dateParts.year, dateParts.month);
                    const minDay = dateParts.year === todayYear && dateParts.month === todayMonth ? todayDay : 1;
                    return Array.from({ length: maxDay - minDay + 1 }, (_, i) => minDay + i).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ));
                  })()}
                </select>
                <select
                  aria-label="Luna"
                  value={dateParts.month}
                  onChange={(e) => setDatePart({ month: Number(e.target.value) })}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-2 py-3 text-sm text-white outline-none focus:border-amber-500"
                >
                  {MONTHS_RO_CAP.map((label, index) => (
                    (dateParts.year > todayYear || index >= todayMonth) && (
                      <option key={label} value={index}>{label}</option>
                    )
                  ))}
                </select>
                <select
                  aria-label="Anul"
                  value={dateParts.year}
                  onChange={(e) => setDatePart({ year: Number(e.target.value) })}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-2 py-3 text-sm text-white outline-none focus:border-amber-500"
                >
                  {Array.from({ length: 4 }, (_, i) => todayYear + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={availStatus === "checking"}
                className="w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:bg-neutral-700"
              >
                {availStatus === "checking" ? "Se verifică…" : "Verifică disponibilitatea"}
              </button>
            </form>

            {availStatus === "available" && (
              <div className="mt-3 rounded-xl border border-green-700/40 bg-green-900/25 p-3.5">
                <p className="text-sm font-medium text-green-300">🎉 Suntem disponibili pe {formatDateRo(eventDate)}!</p>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 hover:bg-green-400 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  <WhatsAppIcon /> Scrie-ne pe WhatsApp
                </a>
              </div>
            )}

            {availStatus === "unavailable" && (
              <div className="mt-3 rounded-xl border border-amber-700/40 bg-amber-900/20 p-3.5">
                <p className="text-sm font-medium text-amber-200">Data {formatDateRo(eventDate)} pare deja rezervată.</p>
                <p className="mt-1 text-xs text-neutral-400">Uneori se eliberează sau găsim o soluție — scrie-ne.</p>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 hover:bg-green-400 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  <WhatsAppIcon /> Scrie-ne pe WhatsApp
                </a>
              </div>
            )}
          </div>

          {/* Link special — PDF fixat din admin */}
          {featuredPdf && (
            <a
              href={featuredPdf.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3.5 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-amber-400/5 to-transparent hover:from-amber-500/25 transition-colors px-4 py-3.5 mt-6"
            >
              <span className="shrink-0 w-10 h-10 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-amber-200 text-sm font-semibold">{featuredPdf.title}</span>
                <span className="block text-amber-200/60 text-xs mt-0.5">Descarcă gratuit — PDF</span>
              </span>
            </a>
          )}

          {/* Links */}
          <div className="w-full flex flex-col gap-3 mt-6">
            {LINKS.map((link, index) => {
              const accent = LINK_ACCENTS[index % LINK_ACCENTS.length];
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3.5 w-full rounded-2xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 transition-colors px-4 py-3.5 ${accent.border}`}
                >
                  <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${accent.badge}`}>
                    {link.icon}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-white text-sm font-medium">{link.label}</span>
                    <span className="block text-neutral-500 text-xs mt-0.5 truncate">{link.sublabel}</span>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-600">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </a>
              );
            })}
          </div>

          {/* Contact row */}
          <div className="w-full flex flex-col sm:flex-row gap-2.5 mt-8">
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[#25d366]/40 text-[#25d366] text-sm font-medium px-4 py-2.5 hover:bg-[#25d366]/10 transition-colors"
            >
              <WhatsAppIcon />
              WhatsApp
            </a>
            <PhoneNumberReveal
              phone={PHONE}
              display={PHONE_DISPLAY}
              context="Bio"
              icon={<PhoneIcon />}
              buttonLabel="Sună"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-neutral-700 text-neutral-300 text-sm font-medium px-4 py-2.5 hover:border-amber-200/40 hover:text-amber-200 transition-colors"
            />
          </div>

          {/* Vreau să fiu contactat — cere numărul, fără să părăsești pagina */}
          <div className="w-full mt-2.5">
            {callbackStatus === "sent" ? (
              <div className="w-full rounded-xl border border-emerald-600/40 bg-emerald-900/20 px-4 py-2.5 text-center text-sm text-emerald-300">
                ✓ Mulțumim! Te sunăm noi în curând.
              </div>
            ) : !showCallbackForm ? (
              <button
                type="button"
                onClick={() => setShowCallbackForm(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-neutral-700 text-neutral-300 text-sm font-medium px-4 py-2.5 hover:border-amber-200/40 hover:text-amber-200 transition-colors"
              >
                <CallbackIcon />
                Vreau să fiu contactat
              </button>
            ) : (
              <form onSubmit={requestCallback} className="w-full rounded-xl border border-neutral-800 bg-neutral-900 p-3.5 space-y-2.5">
                <p className="text-neutral-400 text-xs">Lasă-ne numărul tău — te sunăm noi.</p>
                <input
                  type="tel"
                  value={callbackPhone}
                  onChange={(e) => { setCallbackPhone(e.target.value); setCallbackError(""); }}
                  placeholder="07xx xxx xxx"
                  autoFocus
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3.5 py-3 text-sm text-white outline-none focus:border-amber-500"
                />
                {callbackError && <p className="text-red-400 text-xs">{callbackError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={callbackStatus === "sending"}
                    className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:bg-neutral-700"
                  >
                    {callbackStatus === "sending" ? "Se trimite…" : "OK"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCallbackForm(false); setCallbackError(""); }}
                    className="px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-400 text-sm hover:border-neutral-500 transition-colors"
                  >
                    Anulează
                  </button>
                </div>
                {callbackStatus === "error" && <p className="text-red-400 text-xs">Ceva nu a mers — încearcă din nou sau scrie-ne pe WhatsApp.</p>}
              </form>
            )}
          </div>

          <p className="mt-10 text-neutral-700 text-xs text-center">© {new Date().getFullYear()} Anca Visuals</p>
        </div>
      </div>
    </>
  );
};

export default BioPage;
