// src/booking/utils/time.ts
export const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
export const formatDate = (d: number, mi: number, y: number) => `${pad2(d)}/${pad2(mi + 1)}/${y}`;

export const parseTimeToMinutes = (t: string) => {
  if (!t) return null;
  const [hh, mm] = t.split(":").map(Number);
  return Number.isNaN(hh) || Number.isNaN(mm) ? null : hh * 60 + mm;
};
