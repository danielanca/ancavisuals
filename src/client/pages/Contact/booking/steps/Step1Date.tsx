import React, { useEffect, useMemo } from "react";
import { reportAvailabilityCheck } from "../../../../utils/liveEvent";

interface Step1DateProps {
  day: number;
  month: number; // 0-based
  year: number;
  setDay: (d: number) => void;
  setMonth: (m: number) => void;
  setYear: (y: number) => void;
  bookedDates: string[]; // ["2026-02-21", ...]
  isAvailable: boolean | null;
  setIsAvailable: (v: boolean | null) => void;
  setErrors: (e: { [key: string]: string }) => void;
}

const MONTHS_RO = [
  "Ianuarie",
  "Februarie",
  "Martie",
  "Aprilie",
  "Mai",
  "Iunie",
  "Iulie",
  "August",
  "Septembrie",
  "Octombrie",
  "Noiembrie",
  "Decembrie",
];

function toKey(day: number, monthZeroBased: number, year: number): string {
  const mm = String(monthZeroBased + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

const Step1Date: React.FC<Step1DateProps> = ({
  day,
  month,
  year,
  setDay,
  setMonth,
  setYear,
  bookedDates,
  isAvailable,
  setIsAvailable,
  setErrors,
}) => {
  const today = useMemo(() => new Date(), []);
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();
  const yearOptions = useMemo(() => Array.from({ length: 7 }, (_, i) => todayYear + i), [todayYear]);

  const maxDays = useMemo(() => daysInMonth(year, month), [year, month]);
  const minMonth = year === todayYear ? todayMonth : 0;
  const minDay = year === todayYear && month === todayMonth ? todayDay : 1;

  // Past days/months are never valid — clamp forward instead of letting a stale
  // selection (or a month/year change) land on an already-passed date.
  useEffect(() => {
    if (day > maxDays) {
      setDay(maxDays);
      setIsAvailable(null);
      setErrors({});
    } else if (day < minDay) {
      setDay(minDay);
      setIsAvailable(null);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDays, minDay]);

  useEffect(() => {
    if (month < minMonth) {
      setMonth(minMonth);
      setIsAvailable(null);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minMonth]);

  const humanDate = useMemo(() => `${day} ${MONTHS_RO[month]} ${year}`, [day, month, year]);

  const handleDayChange = (value: string) => {
    const d = Number(value);
    if (!Number.isNaN(d) && d >= minDay && d <= maxDays) {
      setDay(d);
      setIsAvailable(null);
      setErrors({});
    }
  };

  const handleMonthChange = (value: string) => {
    const m = Number(value);
    if (!Number.isNaN(m) && m >= minMonth && m <= 11) {
      setMonth(m);
      setIsAvailable(null);
      setErrors({});
    }
  };

  const handleYearChange = (value: string) => {
    const y = Number(value);
    if (!Number.isNaN(y) && y >= todayYear && y <= todayYear + 6) {
      setYear(y);
      setIsAvailable(null);
      setErrors({});
    }
  };


  const handleCheckAvailability = () => {
    const key = toKey(day, month, year);
    const available = !bookedDates.includes(key);
    if (available) {
      setIsAvailable(true);
      setErrors({});
    } else {
      setIsAvailable(false);
      setErrors({ date: "Ne pare rău, această dată este deja rezervată. Te rugăm să alegi o altă zi." });
    }
    reportAvailabilityCheck(humanDate, key, available);
  };

  return (
    <>
      <p className="step-title">1) Spune-ne data evenimentului</p>

      <div className="input-group date-select-group">
        {/* Zi */}
        <select className="date-select" value={day} onChange={e => handleDayChange(e.target.value)}>
          {Array.from({ length: maxDays - minDay + 1 }).map((_, i) => {
            const d = minDay + i;
            return (
              <option key={d} value={d}>
                {d}
              </option>
            );
          })}
        </select>

        {/* Month */}
        <select className="date-select" value={month} onChange={e => handleMonthChange(e.target.value)}>
          {MONTHS_RO.map((label, index) => (
            index >= minMonth && (
              <option key={label} value={index}>
                {label}
              </option>
            )
          ))}
        </select>

        {/* An */}
        <select className="date-select" value={year} onChange={e => handleYearChange(e.target.value)}>
          {yearOptions.map(y => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {/* Check button */}
        <button type="button" className="verify-btn" onClick={handleCheckAvailability}>
          Verifică
        </button>
      </div>

      <p className="selected-date-label">
        Data selectată: <span className="selected-date-value">{humanDate}</span>
      </p>

      {isAvailable === true && <p className="ok">Suntem disponibili pe {humanDate} 🎉</p>}

      {isAvailable === false && <p className="error">Ne pare rău, {humanDate} este deja rezervată.</p>}
    </>
  );
};

export default Step1Date;
