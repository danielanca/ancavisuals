import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AdminStepDate from "./steps/AdminStepDate";
import Breadcrumb from "../../../features/admin/components/Breadcrumb";
import { convertToEur, parseAmount } from "../../../utils/currency";

const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

function getMonthLabel(dateStr: string): string {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTHS_RO[m - 1]}`;
}

function buildGoogleCalendarLink(
  date: string,
  title: string,
  description: string,
  phone: string,
  price: string,
  advance: string,
): string {
  if (!date || !title) return "#";
  const [y, m, d] = date.split("-");
  const start = `${y}${m}${d}`;
  const end = `${y}${m}${d}T235959Z`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    details: `Telefon: ${phone}\nPreț: ${price} EUR${advance ? `\nAvans: ${advance} EUR` : ""}${description ? `\nNote: ${description}` : ""}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const inputClass = "w-full bg-neutral-800 text-white text-sm placeholder-neutral-600 border border-neutral-700 rounded-xl px-4 py-3 outline-none focus:border-neutral-500 transition-colors";
const labelClass = "block text-neutral-400 text-xs font-medium mb-2 tracking-wide uppercase";

export default function AdminBook() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledDate = (location.state as { date?: string } | null)?.date;

  const initialDate = prefilledDate ? new Date(prefilledDate) : new Date();

  const [date, setDate] = useState(prefilledDate ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [price, setPrice] = useState("");
  const [advance, setAdvance] = useState("");
  const [currency, setCurrency] = useState<"EUR" | "RON">("EUR");
  const [exchangeRate, setExchangeRate] = useState("5.0");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(data => { if (data.exchangeRate) setExchangeRate(String(data.exchangeRate)); })
      .catch(() => {});
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [day, setDay] = useState(initialDate.getDate());
  const [month, setMonth] = useState(initialDate.getMonth());
  const [year, setYear] = useState(initialDate.getFullYear());
  const [bookedDates, setBookedDates] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/booked-dates")
      .then(r => r.json())
      .then(data => setBookedDates(data.dates ?? []))
      .catch(() => setBookedDates([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (day >= 1 && month >= 0 && year >= 2024) {
        const newDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        setDate(newDate);
        checkAvailability(newDate);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [day, month, year]);

  const checkAvailability = async (checkDate: string) => {
    try {
      const res = await fetch("/api/event/date-available", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: checkDate, dbStore: getMonthLabel(checkDate) }),
      });
      const data = await res.json();
      if (res.ok && data.available !== undefined) {
        setIsAvailable(!!data.available);
        if (!data.available) {
          setFieldErrors(prev => ({ ...prev, date: data.message || "Această dată este deja rezervată." }));
        } else {
          setFieldErrors(prev => { const { date: _, ...rest } = prev; return rest; });
        }
      } else {
        setIsAvailable(null);
      }
    } catch {
      setIsAvailable(null);
    }
  };

  // Convert entered price to EUR
  const priceEur = useMemo(
    () => convertToEur(parseAmount(price), currency, parseAmount(exchangeRate)),
    [price, currency, exchangeRate],
  );

  const advanceEur = useMemo(
    () => convertToEur(parseAmount(advance), currency, parseAmount(exchangeRate)),
    [advance, currency, exchangeRate],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date || isAvailable !== true) {
      setError("Verifică disponibilitatea datei — trebuie să fie liberă.");
      return;
    }
    if (!title.trim() || !phone.trim() || !price.trim()) {
      setError("Completează titlul, telefonul și prețul.");
      return;
    }
    if (priceEur === null) {
      setError("Prețul introdus nu este valid.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/event/register-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          title,
          phone,
          price: String(priceEur),
          advance: advanceEur !== null ? String(advanceEur) : "",
          desc: description,
          dbStore: getMonthLabel(date),
        }),
      });
      const result = await res.json();
      if (res.ok) {
        setShowSuccessModal(true);
      } else {
        setError(result.error || "Eroare la înregistrare.");
      }
    } catch {
      setError("Eroare de conexiune. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">

        <Breadcrumb />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Eveniment nou</h1>
            <p className="text-neutral-400 text-sm mt-1">Înregistrează o dată și adaug-o în calendar</p>
          </div>
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-800 text-neutral-400 text-xs hover:border-neutral-600 hover:text-white transition-colors"
          >
            ← Înapoi
          </button>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">

          {/* Data */}
          <div>
            <label className={labelClass}>Data evenimentului *</label>
            <AdminStepDate
              day={day}
              month={month}
              year={year}
              setDay={setDay}
              setMonth={setMonth}
              setYear={setYear}
              bookedDates={bookedDates}
              isAvailable={isAvailable}
              setIsAvailable={setIsAvailable}
              setErrors={setFieldErrors}
            />
            {fieldErrors.date && (
              <p className="mt-1.5 text-red-400 text-xs">{fieldErrors.date}</p>
            )}
          </div>

          {/* Titlu */}
          <div>
            <label className={labelClass}>Titlu / Nume eveniment *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="ex. Nuntă – Ana & Mihai"
              className={inputClass}
            />
          </div>

          {/* Telefon */}
          <div>
            <label className={labelClass}>Telefon *</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+40 745 000 000"
              className={inputClass}
            />
          </div>

          {/* Valuta */}
          <div>
            <label className={labelClass}>Valută</label>
            <div className="flex gap-2">
              {(["EUR", "RON"] as const).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    currency === c
                      ? "bg-white text-black border-white"
                      : "bg-transparent text-neutral-400 border-neutral-700 hover:border-neutral-500"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Exchange rate (RON only) */}
          {currency === "RON" && (
            <div>
              <label className={labelClass}>Curs de schimb (1 EUR = ? RON)</label>
              <input
                type="text"
                value={exchangeRate}
                onChange={e => setExchangeRate(e.target.value)}
                placeholder="ex. 5.1"
                className={inputClass}
              />
            </div>
          )}

          {/* Pret */}
          <div>
            <label className={labelClass}>Preț * ({currency})</label>
            <input
              type="text"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder={currency === "EUR" ? "ex. 1500" : "ex. 7650"}
              className={inputClass}
            />
            {currency === "RON" && priceEur !== null && (
              <p className="mt-1.5 text-emerald-400 text-xs font-medium">
                ≈ {priceEur.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} EUR
              </p>
            )}
          </div>

          {/* Avans */}
          <div>
            <label className={labelClass}>Avans încasat — opțional ({currency})</label>
            <input
              type="text"
              value={advance}
              onChange={e => setAdvance(e.target.value)}
              placeholder={currency === "EUR" ? "ex. 500" : "ex. 2550"}
              className={inputClass}
            />
            {currency === "RON" && advanceEur !== null && (
              <p className="mt-1.5 text-emerald-400 text-xs font-medium">
                ≈ {advanceEur.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} EUR
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label className={labelClass}>Note (opțional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalii suplimentare..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || isAvailable !== true}
            className="w-full bg-white text-black text-sm font-semibold rounded-xl py-3 hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Se salvează..." : "Salvează Evenimentul"}
          </button>
        </form>
      </div>

      {/* Modal succes */}
      {showSuccessModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
          onClick={() => setShowSuccessModal(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-sm w-full text-center space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-3xl">🎉</p>
            <h2 className="text-white text-lg font-medium">Eveniment salvat!</h2>
            <p className="text-neutral-400 text-sm">
              „{title}" a fost înregistrat pentru <strong className="text-white">{getMonthLabel(date)}</strong>.
            </p>
            {priceEur !== null && (
              <p className="text-emerald-400 text-sm font-semibold">
                {priceEur.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} EUR
              </p>
            )}

            <a
              href={buildGoogleCalendarLink(date, title, description, phone, String(priceEur ?? ""), String(advanceEur ?? ""))}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-neutral-700 text-white text-sm hover:border-neutral-500 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Adaugă în Google Calendar
            </a>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowSuccessModal(false); navigate("/admin"); }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-colors"
              >
                ← Dashboard
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setTitle(""); setPhone(""); setPrice(""); setAdvance("");
                  setDescription(""); setIsAvailable(null); setCurrency("EUR");
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 transition-colors"
              >
                Adaugă altul
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
