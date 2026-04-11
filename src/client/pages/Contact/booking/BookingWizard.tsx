// src/booking/BookingWizard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import "./segmented.scss";

import { PACKAGES_NEW } from "../packages";
import pricesData from "../../../../data/prices.json";
import { safeTrigger, BOOKING_TO } from "./utils/api";
import { normalizePackages } from "./utils/normalize";
import { formatDate } from "./utils/time";
import { PHONE_RE } from "./utils/validators";
import type { Step, EventType, Errors } from "./types";

// Firebase
import { getBytes, ref } from "firebase/storage";
import { storage } from "../../../firebase";

// Steps
import Step1Date from "./steps/Step1Date";
import Step2EventType from "./steps/Step2EventType";
import Step3Contact from "./steps/Step3Contact";
import Step4Details from "./steps/Step4Details";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string;

type ConversionWindow = Window & {
  gtag?: (eventName: string, action: string, params: Record<string, string | number>) => void;
};

/* ---------- bookedDates.json types & helpers ---------- */

type BookedDateEntry =
  | {
      date: string;
      type?: string;
      label?: string;
      price?: string;
      phone?: string;
      status?: "booked" | "unavailable";
    }
  | {
      startDate: string;
      endDate: string;
      type?: string;
      label?: string;
      price?: string;
      phone?: string;
      status?: "booked-range" | "unavailable";
    };

interface BookedDatesFile {
  updatedAt?: string;
  dates: BookedDateEntry[];
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function expandBookedDates(data: BookedDatesFile): string[] {
  const set = new Set<string>();
  if (!data?.dates) return [];

  for (const entry of data.dates) {
    if ("date" in entry && entry.date) {
      set.add(entry.date);
    } else if ("startDate" in entry && "endDate" in entry && entry.startDate && entry.endDate) {
      const start = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const cur = new Date(start);
        while (cur <= end) {
          set.add(toDateKey(cur));
          cur.setDate(cur.getDate() + 1);
        }
      }
    }
  }

  return Array.from(set);
}

/* ---------- helpers locale (durată & HTML final) ---------- */
const toMinutes = (t: string) => {
  if (!t) return null;
  const [hh, mm] = t.split(":").map(Number);
  return Number.isNaN(hh) || Number.isNaN(mm) ? null : hh * 60 + mm;
};

const getDurationInfo = (startTime: string, endTime: string) => {
  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  if (s == null || e == null) return { hours: null as number | null, overnight: false };
  const overnight = e < s;
  const mins = overnight ? 24 * 60 - s + e : e - s;
  const hours = Math.round((mins / 60) * 10) / 10;
  return { hours, overnight };
};

const buildHtmlFinal = (args: {
  selectedFormattedDate: string;
  eventType: string;
  fullName: string;
  phone: string;
  location: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
  durationHours: number | null;
  totalPrice: number;
  selectedPackages: string[];
  showCustom: boolean;
  photo: boolean;
  video: boolean;
}) => `
  <h2>Cerere nouă</h2>
  <ul>
    <li><b>Data:</b> ${args.selectedFormattedDate}</li>
    <li><b>Eveniment:</b> ${args.eventType}</li>
    <li><b>Nume:</b> ${args.fullName}</li>
    <li><b>Telefon:</b> ${args.phone}</li>
    <li><b>Locație:</b> ${args.location}</li>
    <li><b>Interval:</b> ${args.startTime} – ${args.endTime}${args.overnight ? " (peste miezul nopții)" : ""}</li>
    <li><b>Durată estimată:</b> ${args.durationHours ?? "-"} h</li>
    <li><b>Pachete selectate:</b> ${args.selectedPackages.join(", ") || "-"}</li>
    ${args.showCustom ? `<li><b>Custom:</b> foto=${args.photo ? "da" : "nu"}, video=${args.video ? "da" : "nu"}</li>` : ""}
    <li><b>Preț estimativ:</b> ${Number(args.totalPrice).toLocaleString("ro-RO")} EUR</li>
  </ul>
`;

/* ------------------ Cookie helpers ------------------ */

function readSavedEventDate(): { day: number; month: number; year: number } | null {
  if (typeof localStorage === "undefined") return null;
  const iso = localStorage.getItem("anca_event_date");
  if (!iso) return null;
  const [y, mo, d] = iso.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return { day: d, month: mo - 1, year: y }; // month 0-based
}

/* ------------------ Booking Wizard ------------------ */

export default function BookingWizard() {
  const [step, setStep] = useState<Step>(1);
  const [saveContactConsent, setSaveContactConsent] = useState(true);

  // Step 1 – data
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(0); // 0-based
  const [year, setYear] = useState(2026);

  // Pre-populează data din localStorage (setat de chatbot la verificarea disponibilității)
  useEffect(() => {
    const saved = readSavedEventDate();
    if (saved) {
      setDay(saved.day);
      setMonth(saved.month);
      setYear(saved.year);
      setIsAvailable(true); // deja verificată în chatbot
    }
  }, []);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [isAvailable, setIsAvailable] = useState<null | boolean>(null);

  // Step 2 – tip eveniment
  const [eventType, setEventType] = useState<EventType>("nunta");

  // Step 3 – contact
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Step 4 – locație + timp + pachet
  const [location, setLocation] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const packagesNormalized = useMemo(() => normalizePackages(PACKAGES_NEW), []);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);

  const [showCustom, setShowCustom] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [video, setVideo] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const thankYouRef = useRef<HTMLDivElement | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [bookingData, setBookingData] = useState<{
    date: string;
    totalPrice: number;
    fullName: string;
  } | null>(null);

  const selectedFormattedDate = useMemo(() => formatDate(day, month, year), [day, month, year]);

  /* ---------- Load bookedDates.json from Firebase Storage ---------- */
  useEffect(() => {
    const load = async () => {
      try {
        const fileRef = ref(storage, "ancavisuals/bookedDates/bookedDates.json");
        const bytes = await getBytes(fileRef);
        const text = new TextDecoder("utf-8").decode(bytes);

        const json = JSON.parse(text) as BookedDatesFile;
        const dates = expandBookedDates(json); // => ["2026-02-21", ...];

        setBookedDates(dates);
      } catch (err) {
        console.error("[BookingWizard] Failed to load booked dates:", err);
        setBookedDates([]);
      }
    };

    load();
  }, []);

  const handleContactStepNext = async () => {
    // Validare rapidă pentru pasul 3
    const errs: Errors = {};
    if (!fullName.trim()) errs.fullName = "Completează numele.";
    if (!phone || !PHONE_RE.test(phone)) errs.phone = "Număr de telefon invalid.";

    if (Object.keys(errs).length > 0) {
      setErrors(prev => ({ ...prev, ...errs }));
      return;
    }

    // Curățăm erorile legate de contact
    setErrors(prev => ({ ...prev, fullName: "", phone: "" }));

    // Trimitem lead-ul imediat, doar dacă și-a dat acordul
    if (saveContactConsent) {
      try {
        const subject = `Lead rapid – ${eventType.toUpperCase()} – ${selectedFormattedDate}`;

        const payload = {
          to: BOOKING_TO,
          subject,
          html: `
            <h2>Lead rapid din configurator</h2>
            <ul>
              <li><b>Data (selectată până acum):</b> ${selectedFormattedDate}</li>
              <li><b>Eveniment:</b> ${eventType}</li>
              <li><b>Nume:</b> ${fullName}</li>
              <li><b>Telefon:</b> ${phone}</li>
              <li><b>A acceptat salvarea datelor:</b> DA</li>
            </ul>
            <p><i>Acest lead a fost trimis la finalul pasului 3 (contact), chiar dacă utilizatorul nu a finalizat configuratorul.</i></p>
          `,
          booking: {
            date: selectedFormattedDate,
            eventType,
            fullName,
            phone,
            location,
            placeId,
            startTime,
            endTime,
            packages: selectedPackages, // array string[]
            custom: showCustom ? { photo, video } : null,
            price: totalPrice,
            partial: true,
            saveContactConsent: true,
          },
        };

        // non-blocking
        safeTrigger(payload).catch(err => {
          console.error("Partial lead send failed (non-blocking):", err);
        });
      } catch (err) {
        console.error("Error building partial lead:", err);
      }
    }

    // 🔥 Google Ads conversion – LEAD RAPID
    const conversionWindow = window as ConversionWindow;
    if (typeof window !== "undefined" && typeof conversionWindow.gtag === "function") {
      conversionWindow.gtag("event", "conversion", {
        send_to: "AW-10941123412/ww8eCM7HiakYENSWkeEo",
        value: 1.0, // sau 1.0 fix dacă vrei doar număr de conversii
        currency: "EUR",
        transaction_id: "", // poți pune un ID unic dacă ai
      });
    }
    // Oricum mergem mai departe în wizard
    setStep(4);
  };

  /* ---------- Validation ---------- */
  const validateStep = (s: Step) => {
    const errs: Errors = {};

    if (s === 1 && isAvailable !== true) {
      errs.date = "Verifică disponibilitatea înainte să continui.";
    }

    if (s === 2 && !eventType) {
      errs.eventType = "Alege tipul de eveniment.";
    }

    if (s === 3) {
      if (!fullName.trim()) errs.fullName = "Completează numele.";
      if (!phone || !PHONE_RE.test(phone)) errs.phone = "Număr de telefon invalid.";
    }

    if (s === 4) {
      if (!location.trim()) errs.location = "Completează locația.";
      if (!startTime) errs.startTime = "Alege ora de început.";
      if (!endTime) errs.endTime = "Alege ora de sfârșit.";
      if (!selectedPackages.length && !showCustom) errs.package = "Alege cel puțin un pachet sau personalizează.";
      if (startTime && endTime && startTime === endTime) errs.endTime = "Start și final nu pot fi egale.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (validateStep(step)) {
      setStep(s => (s < 5 ? ((s + 1) as Step) : s));
    }
  };

  const goBack = () => {
    setStep(s => (s > 1 ? ((s - 1) as Step) : s));
  };

  /* ---------- Total price ---------- */
  const totalPrice = useMemo(() => {
    const byId = new Map(packagesNormalized.map(p => [p.id, p]));
    const tilesSum = selectedPackages.reduce((sum, id) => sum + (byId.get(id)?.price ?? 0), 0);
    const customSum = showCustom ? (photo ? pricesData.customOption.photo : 0) + (video ? pricesData.customOption.video : 0) : 0;
    return tilesSum + customSum;
  }, [packagesNormalized, selectedPackages, showCustom, photo, video]);

  /* ---------- Submit ---------- */
  const submitBooking = async () => {
    if (!validateStep(4)) {
      setStep(4);
      return;
    }

    setLoading(true);
    try {
      const { hours, overnight } = getDurationInfo(startTime, endTime);

      const subject = `Cerere ${eventType.toUpperCase()} – ${selectedFormattedDate}`;
      const html = buildHtmlFinal({
        selectedFormattedDate,
        eventType,
        fullName,
        phone,
        location,
        startTime,
        endTime,
        overnight,
        durationHours: hours,
        totalPrice,
        selectedPackages,
        showCustom,
        photo,
        video,
      });

      const payload = {
        to: BOOKING_TO,
        subject,
        html, // HTML complet, nu "..."
        booking: {
          date: selectedFormattedDate,
          eventType,
          fullName,
          phone,
          location,
          placeId,
          startTime,
          endTime,
          packages: selectedPackages, // array string[]
          custom: showCustom ? { photo, video } : null,
          price: totalPrice,
        },
      };

      const resp = await safeTrigger(payload);
      if (resp?.ok) {
        setBookingData({
          date: selectedFormattedDate,
          totalPrice,
          fullName,
        });
        setSubmitted(true);
        setStep(5);

        setTimeout(() => {
          window.scrollTo({
            top: window.innerHeight * 0.75,
            behavior: "smooth",
          });
        }, 150);
      } else {
        alert("A apărut o problemă la trimitere.");
      }
    } catch (err) {
      console.error("Final booking send failed:", err);
      alert("Nu am putut trimite cererea (eroare de rețea/serviciu).");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Render ---------- */
  return (
    <div className="booking-container">
      <h2>VERIFICA DISPONIBILITATEA & PRET</h2>

      {/* stepper */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map(s => (
          <div
            key={s}
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: step >= s ? "#f4d35e" : "#444",
            }}
          />
        ))}
      </div>

      {step === 1 && (
        <>
          <Step1Date
            day={day}
            month={month}
            year={year}
            setDay={setDay}
            setMonth={setMonth}
            setYear={setYear}
            bookedDates={bookedDates}
            isAvailable={isAvailable}
            setIsAvailable={setIsAvailable}
            setErrors={setErrors}
          />
          {errors.date && <p className="error">{errors.date}</p>}
          {isAvailable === true && <p className="ok">Suntem disponibili pe {selectedFormattedDate} 🎉</p>}
          <div className="input-group" style={{ marginTop: 12 }}>
            <button disabled={isAvailable !== true} onClick={goNext}>
              Continuă
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <Step2EventType eventType={eventType} setEventType={setEventType} />
          {errors.eventType && <p className="error">{errors.eventType}</p>}
          <div className="input-group" style={{ marginTop: 12 }}>
            <button onClick={goBack}>Înapoi</button>
            <button onClick={goNext}>Continuă</button>
          </div>
        </>
      )}

      {step === 3 && (
        <Step3Contact
          fullName={fullName}
          setFullName={setFullName}
          phone={phone}
          setPhone={setPhone}
          errors={errors}
          goBack={goBack}
          saveConsent={saveContactConsent}
          setSaveConsent={setSaveContactConsent}
          onSubmitContact={handleContactStepNext}
        />
      )}

      {step === 4 && (
        <Step4Details
          MAPS_KEY={MAPS_KEY}
          location={location}
          setLocation={setLocation}
          placeId={placeId}
          setPlaceId={setPlaceId}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
          errors={errors}
          packagesNormalized={packagesNormalized}
          selectedPackages={selectedPackages}
          setSelectedPackages={setSelectedPackages}
          showCustom={showCustom}
          setShowCustom={setShowCustom}
          photo={photo}
          setPhoto={setPhoto}
          video={video}
          setVideo={setVideo}
          totalPrice={totalPrice}
          loading={loading}
          submitBooking={submitBooking}
          goBack={goBack}
        />
      )}

      {step === 5 && submitted && bookingData && (
        <div className="thank-you-msg" ref={thankYouRef}>
          <div className="thank-you-card">
            <div className="thank-you-icon">🎉</div>
            <h3>Mulțumim, {bookingData.fullName}!</h3>
            <p>
              Rezervarea ta pentru <strong>{bookingData.date}</strong> a fost înregistrată cu succes.
            </p>
            <p>
              Preț total: <strong>{bookingData.totalPrice.toLocaleString("ro-RO")} EUR</strong>
            </p>
            <p>Te vom contacta în curând pentru confirmarea detaliilor.</p>
          </div>
        </div>
      )}
    </div>
  );
}
