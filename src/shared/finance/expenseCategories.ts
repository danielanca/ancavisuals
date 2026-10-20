// Categoriile de cheltuieli, comune pentru client (formulare, statistici) și
// server (scanarea AI a bonurilor, asistentul financiar). Valorile (`value`)
// sunt salvate în Firestore — nu le redenumi; adaugă categorii noi la final
// sau înainte de „altele”.

export interface ExpenseCategory {
  value: string;
  label: string;
  emoji: string;
  /** Clase Tailwind pentru badge (fundal, text, chenar). */
  color: string;
  /** Clasa Tailwind pentru bara din statistici. */
  bar: string;
  defaultDeductibility: number;
  /** Indiciu pentru AI-ul care categorisește bonurile scanate. */
  hint: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { value: "combustibil", label: "Combustibil",               emoji: "⛽", color: "bg-orange-500/15 text-orange-400 border-orange-500/30",   bar: "bg-orange-500",  defaultDeductibility: 50,  hint: "benzină, motorină, GPL, încărcare mașină electrică" },
  { value: "transport",   label: "Transport",                 emoji: "🚗", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",         bar: "bg-cyan-500",    defaultDeductibility: 100, hint: "taxi, tren, avion, rovinietă, taxe de drum, parcare, service auto" },
  { value: "cazare",      label: "Cazare",                    emoji: "🏨", color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",   bar: "bg-indigo-500",  defaultDeductibility: 100, hint: "hotel, pensiune, Booking, Airbnb" },
  { value: "echipament",  label: "Echipament foto/video",     emoji: "📷", color: "bg-blue-500/15 text-blue-400 border-blue-500/30",         bar: "bg-blue-500",    defaultDeductibility: 100, hint: "aparate foto, obiective, drone, lumini, trepiede, carduri de memorie" },
  { value: "electronice", label: "Electronice / IT",          emoji: "🖥️", color: "bg-sky-500/15 text-sky-400 border-sky-500/30",            bar: "bg-sky-500",     defaultDeductibility: 100, hint: "laptop, monitor, telefon, hard disk/SSD, cabluri, accesorii IT" },
  { value: "software",    label: "Software / Abonamente",     emoji: "💻", color: "bg-violet-500/15 text-violet-400 border-violet-500/30",   bar: "bg-violet-500",  defaultDeductibility: 100, hint: "Adobe, licențe, hosting, domenii, stocare cloud, abonamente lunare/anuale (fără AI)" },
  { value: "ai",          label: "AI",                        emoji: "🤖", color: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30", bar: "bg-fuchsia-500", defaultDeductibility: 100, hint: "Anthropic/Claude, OpenAI/ChatGPT, Midjourney, alte servicii și API-uri AI" },
  { value: "telefonie",   label: "Telefon & internet",        emoji: "📱", color: "bg-teal-500/15 text-teal-400 border-teal-500/30",         bar: "bg-teal-500",    defaultDeductibility: 100, hint: "abonament mobil, internet fix, Orange, Vodafone, Digi" },
  { value: "marketing",   label: "Marketing",                 emoji: "📣", color: "bg-pink-500/15 text-pink-400 border-pink-500/30",         bar: "bg-pink-500",    defaultDeductibility: 100, hint: "reclame Meta/Google, tipărituri, promovare" },
  { value: "cursuri",     label: "Cursuri & formare",         emoji: "🎓", color: "bg-lime-500/15 text-lime-400 border-lime-500/30",         bar: "bg-lime-500",    defaultDeductibility: 100, hint: "cursuri, workshop-uri, cărți, conferințe" },
  { value: "comisioane",  label: "Comisioane bancare & taxe", emoji: "🏦", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",   bar: "bg-yellow-500",  defaultDeductibility: 100, hint: "comisioane bancă/POS, taxe ONRC, contabilitate" },
  { value: "alimentatie", label: "Alimentație",               emoji: "🍽️", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", bar: "bg-emerald-500", defaultDeductibility: 50,  hint: "mâncare, restaurant, protocol" },
  { value: "altele",      label: "Alte cheltuieli",           emoji: "📦", color: "bg-neutral-700/50 text-neutral-400 border-neutral-600/30", bar: "bg-neutral-500", defaultDeductibility: 50,  hint: "orice nu se potrivește mai sus" },
];

export const EXPENSE_CATEGORY_VALUES = EXPENSE_CATEGORIES.map((c) => c.value);

export function findExpenseCategory(value: string | null | undefined): ExpenseCategory | undefined {
  return EXPENSE_CATEGORIES.find((c) => c.value === value);
}

export interface CategoryExpenseInput {
  category: string;
  amount: number;
  deductibleAmount: number;
  currency: string;
  date: string;
}

export interface CategoryStat {
  value: string;
  label: string;
  emoji: string;
  color: string;
  bar: string;
  count: number;
  /** Totaluri în RON. */
  total: number;
  deductible: number;
  /** Partea din totalul tuturor cheltuielilor, 0–1. */
  share: number;
}

/**
 * Totaluri pe categorii, în RON, sortate descrescător după sumă. Categoriile
 * necunoscute (date vechi) apar cu valoarea brută ca etichetă, nu se pierd.
 */
export function summarizeExpensesByCategory(
  expenses: CategoryExpenseInput[],
  toRON: (amount: number, currency: string, dateIso: string) => number,
): { rows: CategoryStat[]; total: number; deductible: number } {
  const byCategory = new Map<string, CategoryStat>();
  let total = 0;
  let deductible = 0;

  for (const exp of expenses) {
    const amountRon = toRON(exp.amount, exp.currency, exp.date);
    const deductibleRon = toRON(exp.deductibleAmount ?? 0, exp.currency, exp.date);
    total += amountRon;
    deductible += deductibleRon;

    let row = byCategory.get(exp.category);
    if (!row) {
      const cat = findExpenseCategory(exp.category);
      row = {
        value: exp.category,
        label: cat?.label ?? exp.category,
        emoji: cat?.emoji ?? "❔",
        color: cat?.color ?? "bg-neutral-800 text-neutral-400 border-neutral-700",
        bar: cat?.bar ?? "bg-neutral-500",
        count: 0,
        total: 0,
        deductible: 0,
        share: 0,
      };
      byCategory.set(exp.category, row);
    }
    row.count += 1;
    row.total += amountRon;
    row.deductible += deductibleRon;
  }

  const rows = [...byCategory.values()]
    .map((row) => ({ ...row, share: total > 0 ? row.total / total : 0 }))
    .sort((a, b) => b.total - a.total);
  return { rows, total, deductible };
}
