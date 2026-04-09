import React, { useEffect, useMemo } from "react";

interface AdminStepDateProps {
  day: number;
  month: number; // 0-based
  year: number;
  setDay: (d: number) => void;
  setMonth: (m: number) => void;
  setYear: (y: number) => void;
  bookedDates: string[];
  isAvailable: boolean | null;
  setIsAvailable: (v: boolean | null) => void;
  setErrors: (e: Record<string, string>) => void;
}

const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_RANGE = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR + i);

function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

const selectClass = "bg-neutral-800 text-white text-sm border border-neutral-700 rounded-xl px-3 py-3 outline-none focus:border-neutral-500 transition-colors cursor-pointer";

const AdminStepDate: React.FC<AdminStepDateProps> = ({
  day, month, year,
  setDay, setMonth, setYear,
  bookedDates, isAvailable,
  setIsAvailable, setErrors,
}) => {
  const maxDays = useMemo(() => daysInMonth(year, month), [year, month]);

  useEffect(() => {
    if (day > maxDays) {
      setDay(maxDays);
      setIsAvailable(null);
      setErrors({});
    }
  }, [maxDays]);

  const reset = () => { setIsAvailable(null); setErrors({}); };

  const handleDay = (value: string) => {
    const d = Number(value);
    if (!Number.isNaN(d) && d >= 1 && d <= maxDays) { setDay(d); reset(); }
  };

  const handleMonth = (value: string) => {
    const m = Number(value);
    if (!Number.isNaN(m) && m >= 0 && m <= 11) { setMonth(m); reset(); }
  };

  const handleYear = (value: string) => {
    const y = Number(value);
    if (!Number.isNaN(y)) { setYear(y); reset(); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {/* Zi */}
        <select className={selectClass} value={day} onChange={e => handleDay(e.target.value)}>
          {Array.from({ length: maxDays }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Lună */}
        <select className={selectClass} value={month} onChange={e => handleMonth(e.target.value)}>
          {MONTHS_RO.map((label, index) => (
            <option key={label} value={index}>{label}</option>
          ))}
        </select>

        {/* An */}
        <select className={selectClass} value={year} onChange={e => handleYear(e.target.value)}>
          {YEAR_RANGE.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Status disponibilitate */}
      {isAvailable !== null && (
        <p className={`text-xs font-medium ${isAvailable ? "text-emerald-400" : "text-red-400"}`}>
          {isAvailable ? "✓ Data este disponibilă" : "✗ Data este rezervată — alege altă zi"}
        </p>
      )}
    </div>
  );
};

export default AdminStepDate;
