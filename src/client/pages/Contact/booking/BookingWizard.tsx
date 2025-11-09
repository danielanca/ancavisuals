// src/booking/BookingWizard.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./styles.css";
import "./segmented.scss";

import {
  PACKAGES,
  CUSTOM_OPTIONS,
  PACKAGES_NEW,
} from "../packages";
import { safeTrigger, BOOKING_TO } from "./utils/api";
import { normalizePackages } from "./utils/normalize";
import { formatDate } from "./utils/time";
import { PHONE_RE } from "./utils/validators";
import { Step, EventType, Errors } from "./types";

// Firebase
import { getBytes, ref } from "firebase/storage";
import { storage } from "../../../firebase";

// Steps
import Step1Date from "./steps/Step1Date";
import Step2EventType from "./steps/Step2EventType";
import Step3Contact from "./steps/Step3Contact";
import Step4Details from "./steps/Step4Details";

const MAPS_KEY = import.meta.env
  .VITE_GOOGLE_MAPS_BROWSER_KEY as string;

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

function expandBookedDates(
  data: BookedDatesFile
): string[] {
  const set = new Set<string>();
  if (!data?.dates) return [];

  for (const entry of data.dates) {
    if ("date" in entry && entry.date) {
      set.add(entry.date);
    } else if (
      "startDate" in entry &&
      "endDate" in entry &&
      entry.startDate &&
      entry.endDate
    ) {
      const start = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      if (
        !isNaN(start.getTime()) &&
        !isNaN(end.getTime())
      ) {
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

/* ------------------ Booking Wizard ------------------ */

export default function BookingWizard() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 – data
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(0); // 0-based
  const [year, setYear] = useState(2025);
  const [bookedDates, setBookedDates] = useState<string[]>(
    []
  );
  const [isAvailable, setIsAvailable] =
    useState<null | boolean>(null);

  // Step 2 – tip eveniment
  const [eventType, setEventType] =
    useState<EventType>("nunta");

  // Step 3 – contact
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Step 4 – locație + timp + pachet
  const [location, setLocation] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(
    null
  );
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const packagesNormalized = useMemo(
    () => normalizePackages(PACKAGES_NEW),
    []
  );
  const [selectedPackages, setSelectedPackages] =
    useState<string[]>([]);

  const [showCustom, setShowCustom] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [video, setVideo] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const thankYouRef =
    useRef<HTMLDivElement | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [bookingData, setBookingData] =
    useState<{
      date: string;
      totalPrice: number;
      fullName: string;
    } | null>(null);

  const selectedFormattedDate = useMemo(
    () => formatDate(day, month, year),
    [day, month, year]
  );

  /* ---------- Load bookedDates.json from Firebase ---------- */

  useEffect(() => {
    const load = async () => {
      try {
        const fileRef = ref(
          storage,
          "ancavisuals/bookedDates/bookedDates.json"
        );
        const bytes = await getBytes(fileRef);
        const text = new TextDecoder("utf-8").decode(
          bytes
        );
        const json = JSON.parse(
          text
        ) as BookedDatesFile;

        const dates = expandBookedDates(json);
        console.log("Loaded booked dates:", dates);
        setBookedDates(dates);
      } catch (err) {
        console.error(
          "Failed to load booked dates:",
          err
        );
        setBookedDates([]);
      }
    };

    load();
  }, []);

  /* ---------- Validation ---------- */

  const validateStep = (s: Step) => {
    const errs: Errors = {};

    if (s === 1 && isAvailable !== true) {
      errs.date =
        "Verifică disponibilitatea înainte să continui.";
    }

    if (s === 2 && !eventType) {
      errs.eventType =
        "Alege tipul de eveniment.";
    }

    if (s === 3) {
      if (!fullName.trim())
        errs.fullName = "Completează numele.";
      if (!phone || !PHONE_RE.test(phone))
        errs.phone =
          "Număr de telefon invalid.";
    }

    if (s === 4) {
      if (!location.trim())
        errs.location =
          "Completează locația.";
      if (!startTime)
        errs.startTime =
          "Alege ora de început.";
      if (!endTime)
        errs.endTime =
          "Alege ora de sfârșit.";
      if (
        !selectedPackages.length &&
        !showCustom
      )
        errs.package =
          "Alege cel puțin un pachet sau personalizează.";
      if (
        startTime &&
        endTime &&
        startTime === endTime
      )
        errs.endTime =
          "Start și final nu pot fi egale.";
    }

    setErrors(errs);
    return (
      Object.keys(errs).length === 0
    );
  };

  const goNext = () => {
    if (validateStep(step)) {
      setStep((s) =>
        s < 5 ? ((s + 1) as Step) : s
      );
    }
  };

  const goBack = () => {
    setStep((s) =>
      s > 1 ? ((s - 1) as Step) : s
    );
  };

  /* ---------- Total price ---------- */

  const totalPrice = useMemo(() => {
    const byId = new Map(
      packagesNormalized.map((p) => [p.id, p])
    );

    const tilesSum =
      selectedPackages.reduce(
        (sum, id) =>
          sum + (byId.get(id)?.price ?? 0),
        0
      );

    const customSum = showCustom
      ? (photo ? 1500 : 0) +
        (video ? 1300 : 0)
      : 0;

    return tilesSum + customSum;
  }, [
    packagesNormalized,
    selectedPackages,
    showCustom,
    photo,
    video,
  ]);

  /* ---------- Submit ---------- */

  const submitBooking = async () => {
    if (!validateStep(4)) {
      setStep(4);
      return;
    }

    setLoading(true);

    const subject = `Cerere ${eventType.toUpperCase()} – ${selectedFormattedDate}`;
    const payload = {
      to: BOOKING_TO,
      subject,
      html: `
        <h2>Cerere nouă</h2>
        <ul>
          <li><b>Data:</b> ${selectedFormattedDate}</li>
          <li><b>Eveniment:</b> ${eventType}</li>
          <li><b>Nume:</b> ${fullName}</li>
          <li><b>Telefon:</b> ${phone}</li>
          <li><b>Locație:</b> ${location}</li>
          <li><b>Interval:</b> ${startTime} – ${endTime}</li>
          <li><b>Preț estimativ:</b> ${totalPrice} RON</li>
        </ul>
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
        packages: selectedPackages,
        custom: showCustom
          ? { photo, video }
          : null,
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
          top:
            window.innerHeight *
            0.75,
          behavior: "smooth",
        });
      }, 150);
    } else {
      alert(
        "A apărut o problemă la trimitere."
      );
    }

    setLoading(false);
  };

  /* ---------- Render ---------- */

  return (
    <div className="booking-container">
      <h2>Booking & availability</h2>

      {/* stepper */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background:
                step >= s
                  ? "#f4d35e"
                  : "#444",
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
          {errors.date && (
            <p className="error">
              {errors.date}
            </p>
          )}
          {isAvailable === true && (
            <p className="ok">
              We are available on{" "}
              {selectedFormattedDate} 🎉
            </p>
          )}
          <div
            className="input-group"
            style={{ marginTop: 12 }}
          >
            <button
              disabled={
                isAvailable !== true
              }
              onClick={goNext}
            >
              Continuă
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <Step2EventType
            eventType={eventType}
            setEventType={
              setEventType
            }
          />
          {errors.eventType && (
            <p className="error">
              {errors.eventType}
            </p>
          )}
          <div
            className="input-group"
            style={{ marginTop: 12 }}
          >
            <button
              onClick={goBack}
            >
              Înapoi
            </button>
            <button
              onClick={goNext}
            >
              Continuă
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <Step3Contact
          fullName={fullName}
          setFullName={
            setFullName
          }
          phone={phone}
          setPhone={setPhone}
          errors={errors}
          goNext={goNext}
          goBack={goBack}
        />
      )}

      {step === 4 && (
        <Step4Details
          MAPS_KEY={MAPS_KEY}
          location={location}
          setLocation={
            setLocation
          }
          placeId={placeId}
          setPlaceId={
            setPlaceId
          }
          startTime={
            startTime
          }
          setStartTime={
            setStartTime
          }
          endTime={endTime}
          setEndTime={
            setEndTime
          }
          errors={errors}
          packagesNormalized={
            packagesNormalized
          }
          selectedPackages={
            selectedPackages
          }
          setSelectedPackages={
            setSelectedPackages
          }
          showCustom={
            showCustom
          }
          setShowCustom={
            setShowCustom
          }
          photo={photo}
          setPhoto={setPhoto}
          video={video}
          setVideo={setVideo}
          totalPrice={
            totalPrice
          }
          loading={loading}
          submitBooking={
            submitBooking
          }
          goBack={goBack}
        />
      )}

      {step === 5 &&
        submitted &&
        bookingData && (
          <div
            className="thank-you-msg"
            ref={thankYouRef}
          >
            <div className="thank-you-card">
              <div className="thank-you-icon">
                🎉
              </div>
              <h3>
                Thank you,{" "}
                {
                  bookingData.fullName
                }
                !
              </h3>
              <p>
                Your booking
                for{" "}
                <strong>
                  {
                    bookingData.date
                  }
                </strong>{" "}
                has been
                received.
              </p>
              <p>
                Total price:{" "}
                <strong>
                  {bookingData.totalPrice.toLocaleString(
                    "ro-RO"
                  )}{" "}
                  RON
                </strong>
              </p>
              <p>
                We’ll contact
                you shortly
                to confirm
                the details.
              </p>
            </div>
          </div>
        )}
    </div>
  );
}
