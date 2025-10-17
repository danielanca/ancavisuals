// src/booking/steps/Step1Date.tsx
import React from 'react';
import { pad2, formatDate } from '../utils/time';

export default function Step1Date({
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
  goNext,
}: any) {
  const selectedFormattedDate = formatDate(day, month, year);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    'Ianuarie',
    'Februarie',
    'Martie',
    'Aprilie',
    'Mai',
    'Iunie',
    'Iulie',
    'August',
    'Septembrie',
    'Octombrie',
    'Noiembrie',
    'Decembrie',
  ];
  const years = [2025, 2026, 2027];

  const checkAvailability = () => {
    const ok = !bookedDates.includes(selectedFormattedDate);
    setIsAvailable(ok);
    setErrors(ok ? {} : { date: 'Ne pare rău, suntem deja ocupați în acea zi.' });
  };

  return (
    <>
      <h3>1) Choose date</h3>
      <div className='input-group'>
        <select value={day} onChange={e => setDay(parseInt(e.target.value))}>
          {days.map(d => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {months.map((m, i) => (
            <option key={i} value={i}>
              {m}
            </option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {years.map(y => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button onClick={checkAvailability}>Verifică</button>
      </div>
      <p style={{ fontSize: 12, color: '#888' }}>Data selectată: {selectedFormattedDate}</p>
    </>
  );
}
