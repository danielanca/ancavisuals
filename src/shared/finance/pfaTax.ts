// Calcul taxe PFA în sistem real (impozit, CASS, CAS) — estimare orientativă pentru
// tab-ul Taxe din Financiar și pentru contextul asistentului AI.

// Salariul minim în vigoare la 1 ianuarie 2026 (HG 1/2026). Creșterea la 4.325 RON din
// 1 iulie 2026 (HG 146/2026) NU schimbă baza CAS/CASS pentru veniturile din 2026.
export const SMIN_2026 = 4_050;

export function calcPfaTax(taxableBase: number): {
  impozit: number;
  incomeTaxBase: number;
  cassBase: number;
  cass: number;
  casBase: number;
  cas: number;
  total: number;
} {
  const base = Math.max(0, taxableBase);

  // CASS (sănătate) — 10% din venitul net real, cu bază minimă 6 și maximă 72 salarii
  // minime. Minimul se datorează și sub prag (inclusiv la profit zero), dacă nu ești
  // asigurat din altă sursă (salariu, pensie) — nu poți scăpa de el făcând cheltuieli.
  const cassBase = Math.min(Math.max(base, 6 * SMIN_2026), 72 * SMIN_2026);
  const cass = Math.round(cassBase * 0.1 * 100) / 100;

  // CAS (pensie) — 25%, datorat doar dacă venitul net atinge 12 salarii minime;
  // baza este 12 sau 24 de salarii minime (salt, nu creștere graduală). Sub prag = 0.
  let casBase = 0;
  if (base >= 24 * SMIN_2026) casBase = 24 * SMIN_2026;
  else if (base >= 12 * SMIN_2026) casBase = 12 * SMIN_2026;
  const cas = Math.round(casBase * 0.25 * 100) / 100;

  // Impozit pe venit — 10% din venitul net după deducerea CAS și CASS datorate.
  const incomeTaxBase = Math.max(0, base - cas - cass);
  const impozit = Math.round(incomeTaxBase * 0.1 * 100) / 100;

  const total = Math.round((impozit + cass + cas) * 100) / 100;
  return { impozit, incomeTaxBase, cassBase, cass, casBase, cas, total };
}

// Cât să pui deoparte din fiecare plată nouă. Cu proiecție: taxele în plus până la 31 dec
// împărțite la încasările estimate rămase (prinde și saltul CAS dacă proiecția trece pragul).
// Fără proiecție: cota marginală pe următorii 1.000 RON încasați, la marja de profit de acum.
// `alreadyOwed` = taxele aferente profitului de până acum, care ar trebui să fie deja deoparte.
export function calcSetAside(
  currentBase: number,
  totalIncome: number,
  projection: { finalBase: number; finalIncome: number } | null,
) {
  const alreadyOwed = calcPfaTax(currentBase).total;
  const remainingIncome = projection ? projection.finalIncome - totalIncome : 0;
  if (projection && remainingIncome > 1) {
    const extraTax = Math.max(0, calcPfaTax(projection.finalBase).total - alreadyOwed);
    return { rate: extraTax / remainingIncome, alreadyOwed, basedOnProjection: true };
  }
  const profitMargin = totalIncome > 0 ? currentBase / totalIncome : 1;
  const marginalPerProfit = (calcPfaTax(currentBase + 1000).total - alreadyOwed) / 1000;
  return { rate: marginalPerProfit * profitMargin, alreadyOwed, basedOnProjection: false };
}
