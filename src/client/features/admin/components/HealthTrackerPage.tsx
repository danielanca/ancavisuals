import React, { useEffect, useState, useCallback, useRef } from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";

// ── Theme ──────────────────────────────────────────────────────────────────────

interface HT {
  bg: string; s1: string; s2: string;
  b1: string; b2: string;
  t1: string; t2: string; t3: string; t4: string; t5: string; t6: string; t7: string;
  inp: string; inpB: string;
  greenBg: string; greenBdr: string;
  redBg: string; redBdr: string;
  yellowBg: string;
  purpleBg: string; purpleBg2: string;
}

const DARK: HT = {
  bg: "#0a0a0a", s1: "#111111", s2: "#0d0d0d",
  b1: "#1a1a1a", b2: "#2a2a2a",
  t1: "#ffffff", t2: "#eeeeee", t3: "#dddddd", t4: "#555555", t5: "#444444", t6: "#333333", t7: "#222222",
  inp: "#111111", inpB: "#2a2a2a",
  greenBg: "#0d1a0d", greenBdr: "#1a3a1a",
  redBg: "#1a0d0d", redBdr: "#3a1a1a",
  yellowBg: "#1a1200",
  purpleBg: "#1a0a3a", purpleBg2: "#0d0d1f",
};

const LIGHT: HT = {
  bg: "#f5f3ee", s1: "#ffffff", s2: "#f0ede7",
  b1: "#e8e4dc", b2: "#d4cfc5",
  t1: "#111111", t2: "#333333", t3: "#333333", t4: "#777777", t5: "#888888", t6: "#aaaaaa", t7: "#cccccc",
  inp: "#faf9f6", inpB: "#d4cfc5",
  greenBg: "#e8f5e8", greenBdr: "#86efac",
  redBg: "#fde8e8", redBdr: "#fca5a5",
  yellowBg: "#fefce8",
  purpleBg: "#ede9f8", purpleBg2: "#f0eeff",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthProfile {
  id?: string;
  name: string;
  age: number;
  sex: "male" | "female";
  height: number;
  currentWeight: number;
  startWeight?: number;
  targetWeight: number;
  dailyCalories: number;
  bodyShape: "ecto" | "meso" | "endo" | "over";
  bodyFatPercent?: number;
  waistCm?: number;
  activityLevel: "sedentary" | "lightly" | "moderately" | "very";
  stepTarget: number;
  onboardingComplete?: boolean;
}

interface WeightEntry { date: string; weight: number; }
interface MealItem { name: string; ingredients: string; calories: number; prepTime?: string; tip?: string; }
interface Recommendation {
  breakfast: MealItem; lunch: MealItem; dinner: MealItem; snack?: MealItem;
  totalCalories: number; waterLiters: number; motivationalTip: string; carbsGrams: number; date: string;
}
interface ActivityEntry { steps: number; photoUrl: string; loggedAt: string; }
interface ActivityLog { date: string; steps: number; photoUrl: string; entries?: ActivityEntry[]; }
interface StepBank {
  totalSteps: number; daysLogged: number; daysElapsed: number;
  bank: number; penaltyDays: number; penaltyAmount: number;
}
interface Penalty { id: string; month: string; daysShort: number; totalOwed: number; paid: boolean; }

interface FoodEntry {
  id: string;
  photoUrl: string | null;
  note: string | null;
  food: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "low" | "medium" | "high";
  aiNote: string;
  loggedAt: string;
}

interface FoodLog {
  date: string;
  entries: FoodEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

const USERS = [
  { id: "daniel", defaultName: "Daniel", emoji: "👨", color: "#c9a96e", email: "ancadaniel1994@gmail.com" },
  { id: "estera", defaultName: "Estera", emoji: "👩", color: "#e879f9", email: "estera.pop97@gmail.com" },
];

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2, lightly: 1.375, moderately: 1.55, very: 1.725,
};

// ── Utils ─────────────────────────────────────────────────────────────────────

function calcBMI(weight: number, height: number) {
  return weight / ((height / 100) ** 2);
}

function bmiInfo(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Subponderal", color: "#60a5fa" };
  if (bmi < 25) return { label: "Normal ✓", color: "#4ade80" };
  if (bmi < 30) return { label: "Supraponderal", color: "#fb923c" };
  return { label: "Obez", color: "#f87171" };
}

function calcBMR(profile: Pick<HealthProfile, "age" | "sex" | "height" | "currentWeight">): number {
  const base = 10 * profile.currentWeight + 6.25 * profile.height - 5 * profile.age;
  return profile.sex === "male" ? base + 5 : base - 161;
}

function calcTDEE(bmr: number, activityLevel: string): number {
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.375));
}

function calcAccuracy(
  profile: HealthProfile,
  latestWeight: number | null,
  bank: StepBank | null
): number {
  const scores: number[] = [];
  if (latestWeight !== null && profile.startWeight && profile.targetWeight < profile.startWeight) {
    const totalToLose = profile.startWeight - profile.targetWeight;
    const lost = profile.startWeight - latestWeight;
    scores.push(Math.min(100, Math.max(0, (lost / totalToLose) * 100)));
  }
  if (bank && bank.daysElapsed > 0) {
    const compliance = Math.min(100, Math.max(0, ((bank.daysElapsed - bank.penaltyDays) / bank.daysElapsed) * 100));
    scores.push(compliance);
  }
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function accuracyLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excelent", color: "#4ade80" };
  if (score >= 60) return { label: "Bun", color: "#86efac" };
  if (score >= 40) return { label: "Mediu", color: "#fb923c" };
  return { label: "Slab", color: "#f87171" };
}

// ── Evolution Charts ──────────────────────────────────────────────────────────

type EvoRange = 7 | 30 | 90 | 365;

function EvoChart({
  data, target, accentColor, t, unit, gradientId,
}: {
  data: { date: string; value: number }[];
  target?: number;
  accentColor: string;
  t: HT;
  unit: string;
  gradientId: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length < 2) return (
    <p style={{ textAlign: "center", color: t.t5, fontSize: 12, padding: "32px 0" }}>
      Adaugă cel puțin 2 înregistrări pentru grafic
    </p>
  );

  const W = 480; const H = 180;
  const pad = { top: 20, bottom: 30, left: 46, right: 16 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const values = data.map((d) => d.value);
  const allVals = target !== undefined ? [...values, target] : values;
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const minY = minV - range * 0.12;
  const maxY = maxV + range * 0.12;

  const xOf = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * iW;
  const yOf = (v: number) => pad.top + iH - ((v - minY) / (maxY - minY)) * iH;

  const linePts = data.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(" ");
  const areaPath = `M${xOf(0)},${yOf(data[0].value)} ${data.map((d, i) => `L${xOf(i)},${yOf(d.value)}`).join(" ")} L${xOf(data.length - 1)},${pad.top + iH} L${xOf(0)},${pad.top + iH} Z`;

  const yGridVals = [minY + (maxY - minY) * 0.1, minY + (maxY - minY) * 0.5, minY + (maxY - minY) * 0.9];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    let nearest = 0;
    let nearestDist = Infinity;
    data.forEach((_, i) => {
      const dist = Math.abs(xOf(i) - mx);
      if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    });
    setHoverIdx(nearest);
  };

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", overflow: "visible" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yGridVals.map((v, idx) => {
        const y = yOf(v);
        const label = unit === "kg" ? v.toFixed(1) : Math.round(v).toLocaleString();
        return (
          <g key={idx}>
            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke={t.b1} strokeWidth="1" strokeDasharray="4,3" />
            <text x={pad.left - 5} y={y + 4} fill={t.t5} fontSize="9" textAnchor="end">{label}</text>
          </g>
        );
      })}

      {/* Target line */}
      {target !== undefined && (
        <g>
          <line x1={pad.left} y1={yOf(target)} x2={W - pad.right} y2={yOf(target)} stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.5" />
          <text x={W - pad.right + 4} y={yOf(target) + 4} fill="#7c3aed" fontSize="9" opacity="0.7">țintă</text>
        </g>
      )}

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradientId})`} />

      {/* Line */}
      <polyline fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={linePts} />

      {/* Dots */}
      {data.map((d, i) => (
        <circle key={d.date} cx={xOf(i)} cy={yOf(d.value)} r={hoverIdx === i ? 5 : 3} fill={accentColor} stroke={t.bg} strokeWidth="1.5" style={{ transition: "r 0.1s" }} />
      ))}

      {/* Hover tooltip */}
      {hovered && hoverIdx !== null && (() => {
        const cx = xOf(hoverIdx);
        const cy = yOf(hovered.value);
        const label = unit === "kg" ? `${hovered.value} kg` : `${hovered.value.toLocaleString()} pași`;
        const tooltipW = 90;
        const tx = Math.min(Math.max(cx - tooltipW / 2, pad.left), W - pad.right - tooltipW);
        return (
          <g>
            <line x1={cx} y1={pad.top} x2={cx} y2={pad.top + iH} stroke={accentColor} strokeWidth="1" opacity="0.3" strokeDasharray="3,2" />
            <rect x={tx} y={cy - 34} width={tooltipW} height={28} rx="6" fill={t.s1} stroke={t.b2} strokeWidth="1" />
            <text x={tx + tooltipW / 2} y={cy - 22} fill={accentColor} fontSize="11" fontWeight="700" textAnchor="middle">{label}</text>
            <text x={tx + tooltipW / 2} y={cy - 11} fill={t.t5} fontSize="9" textAnchor="middle">{hovered.date.slice(5)}</text>
          </g>
        );
      })()}

      {/* X labels */}
      {[0, Math.floor(data.length / 2), data.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
        <text key={i} x={xOf(i)} y={H - 4} fill={t.t5} fontSize="9" textAnchor="middle">{data[i].date.slice(5)}</text>
      ))}
    </svg>
  );
}

function EvolutionSection({
  weightHistory, activityHistory, targetWeight, stepTarget, accentColor, t,
}: {
  weightHistory: WeightEntry[];
  activityHistory: ActivityLog[];
  targetWeight: number;
  stepTarget: number;
  accentColor: string;
  t: HT;
}) {
  const [tab, setTab] = useState<"weight" | "steps">("weight");
  const [range, setRange] = useState<EvoRange>(30);

  const filterByRange = <T extends { date: string }>(items: T[]): T[] => {
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    if (range === 365) return sorted;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return sorted.filter((item) => item.date >= cutoffStr);
  };

  const weightData = filterByRange(weightHistory).map((e) => ({ date: e.date, value: e.weight }));
  const stepsData = filterByRange(activityHistory).map((e) => ({ date: e.date, value: e.steps }));

  const currentWeight = weightData.length > 0 ? weightData[weightData.length - 1].value : null;
  const currentSteps = stepsData.length > 0 ? stepsData[stepsData.length - 1].value : null;

  const weightChange = weightData.length >= 2 ? weightData[weightData.length - 1].value - weightData[0].value : null;
  const avgSteps = stepsData.length > 0 ? Math.round(stepsData.reduce((sum, d) => sum + d.value, 0) / stepsData.length) : null;

  const RANGES: { value: EvoRange; label: string }[] = [
    { value: 7, label: "7Z" }, { value: 30, label: "30Z" }, { value: 90, label: "90Z" }, { value: 365, label: "Tot" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Tabs + range */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 8, padding: 2, gap: 2 }}>
          {([
            { key: "weight", label: "Greutate" },
            { key: "steps", label: "Pași" },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer",
              background: tab === key ? accentColor : "transparent",
              color: tab === key ? t.bg : t.t4,
              transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {RANGES.map(({ value, label }) => (
            <button key={value} onClick={() => setRange(value)} style={{
              padding: "4px 9px", borderRadius: 6, border: `1px solid ${range === value ? accentColor : t.b1}`, fontSize: 10, fontWeight: 600, cursor: "pointer",
              background: range === value ? `${accentColor}22` : "transparent",
              color: range === value ? accentColor : t.t5,
              transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {tab === "weight" ? (
          <>
            <div style={{ background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 10, padding: "10px 14px" }}>
              <p style={{ fontSize: 9, color: t.t5, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px" }}>Greutate curentă</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: accentColor, margin: 0 }}>{currentWeight ? `${currentWeight} kg` : "—"}</p>
            </div>
            <div style={{ background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 10, padding: "10px 14px" }}>
              <p style={{ fontSize: 9, color: t.t5, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px" }}>Schimbare ({RANGES.find((r) => r.value === range)?.label})</p>
              <p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: weightChange === null ? t.t4 : weightChange < 0 ? "#4ade80" : weightChange > 0 ? "#f87171" : t.t4 }}>
                {weightChange === null ? "—" : weightChange === 0 ? "±0 kg" : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg`}
              </p>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 10, padding: "10px 14px" }}>
              <p style={{ fontSize: 9, color: t.t5, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px" }}>Ultima zi</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: accentColor, margin: 0 }}>{currentSteps ? currentSteps.toLocaleString() : "—"}</p>
            </div>
            <div style={{ background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 10, padding: "10px 14px" }}>
              <p style={{ fontSize: 9, color: t.t5, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px" }}>Medie ({RANGES.find((r) => r.value === range)?.label})</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: avgSteps && avgSteps >= stepTarget ? "#4ade80" : "#fb923c", margin: 0 }}>
                {avgSteps ? avgSteps.toLocaleString() : "—"}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Chart */}
      <div style={{ background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 12, padding: "14px 10px 8px" }}>
        {tab === "weight" ? (
          <EvoChart data={weightData} target={targetWeight} accentColor={accentColor} t={t} unit="kg" gradientId="grad-weight" />
        ) : (
          <EvoChart data={stepsData} target={stepTarget} accentColor={accentColor} t={t} unit="pași" gradientId="grad-steps" />
        )}
      </div>
    </div>
  );
}

// ── Weight Chart (legacy, kept for compatibility) ──────────────────────────────

function WeightChart({ entries, targetWeight, accentColor, t }: { entries: WeightEntry[]; targetWeight: number; accentColor: string; t: HT }) {
  if (entries.length < 2) return (
    <p style={{ textAlign: "center", color: t.t5, fontSize: 12, padding: "24px 0" }}>
      Adaugă cel puțin 2 înregistrări pentru grafic
    </p>
  );
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  const weights = sorted.map((e) => e.weight);
  const minW = Math.min(...weights, targetWeight) - 1.5;
  const maxW = Math.max(...weights, targetWeight) + 1.5;
  const W = 340; const H = 140;
  const pad = { top: 12, bottom: 24, left: 34, right: 12 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;
  const xOf = (i: number) => pad.left + (i / Math.max(sorted.length - 1, 1)) * iW;
  const yOf = (w: number) => pad.top + iH - ((w - minW) / (maxW - minW)) * iH;
  const points = sorted.map((e, i) => `${xOf(i)},${yOf(e.weight)}`).join(" ");
  const tY = yOf(targetWeight);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
      {[0, 0.5, 1].map((frac) => {
        const w = minW + frac * (maxW - minW);
        const y = yOf(w);
        return <g key={frac}><line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke={t.b1} strokeWidth="1" /><text x={pad.left - 3} y={y + 4} fill={t.t5} fontSize="8" textAnchor="end">{w.toFixed(1)}</text></g>;
      })}
      <line x1={pad.left} y1={tY} x2={W - pad.right} y2={tY} stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.6" />
      <polyline fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinejoin="round" points={points} />
      {sorted.map((e, i) => <circle key={e.date} cx={xOf(i)} cy={yOf(e.weight)} r="3" fill={accentColor} />)}
      <text x={xOf(0)} y={H - 4} fill={t.t5} fontSize="8" textAnchor="middle">{sorted[0].date.slice(5)}</text>
      <text x={xOf(sorted.length - 1)} y={H - 4} fill={t.t5} fontSize="8" textAnchor="middle">{sorted[sorted.length - 1].date.slice(5)}</text>
    </svg>
  );
}

// ── Meal Card ─────────────────────────────────────────────────────────────────

function MealCard({ label, emoji, meal, t }: { label: string; emoji: string; meal: MealItem; t: HT }) {
  return (
    <div style={{ background: t.s2, border: `1px solid ${t.b1}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: t.t4, textTransform: "uppercase", letterSpacing: "0.1em" }}>{emoji} {label}</span>
        <span style={{ fontSize: 11, color: "#c9a96e", fontWeight: 700 }}>{meal.calories} kcal</span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: t.t2, margin: "0 0 3px" }}>{meal.name}</p>
      <p style={{ fontSize: 11, color: t.t4, margin: 0, lineHeight: 1.5 }}>{meal.ingredients}</p>
      {meal.prepTime && <p style={{ fontSize: 10, color: t.t5, marginTop: 4 }}>⏱ {meal.prepTime}</p>}
      {meal.tip && <p style={{ fontSize: 10, color: "#7c5fc0", marginTop: 4, fontStyle: "italic" }}>💡 {meal.tip}</p>}
    </div>
  );
}

// ── Section (collapsible) ─────────────────────────────────────────────────────

function Section({ title, t, children, right, defaultOpen = true }: {
  title: React.ReactNode; t: HT; children: React.ReactNode;
  right?: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: open ? 8 : 0 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
        >
          <span style={{ fontSize: 9, color: t.t6, display: "inline-block", transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s", lineHeight: 1 }}>▾</span>
          <span style={{ fontSize: 10, color: t.t5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
        </button>
        {right}
      </div>
      {open && children}
    </div>
  );
}

// ── Onboarding Wizard ─────────────────────────────────────────────────────────

const BODY_SHAPES = [
  { key: "ecto", label: "Slab / Ectomorf", desc: "Metabolism rapid, greu de pus masă", icon: "🦒" },
  { key: "meso", label: "Athletic / Mezomorf", desc: "Structură atletică, câteva depuneri", icon: "🏃" },
  { key: "endo", label: "Corpolent / Endomorf", desc: "Burtă vizibilă, acumulează ușor grăsime", icon: "🐻" },
  { key: "over", label: "Supraponderal", desc: "Greutate în exces pe mai multe zone", icon: "⚖️" },
] as const;

const ACTIVITY_LEVELS = [
  { key: "sedentary", label: "Sedentar", desc: "Birou, mașină, rar mers pe jos" },
  { key: "lightly", label: "Ușor activ", desc: "Câteva plimbări pe săptămână" },
  { key: "moderately", label: "Moderat activ", desc: "Sport de 2-3 ori/săptămână" },
  { key: "very", label: "Foarte activ", desc: "Sport zilnic sau muncă fizică" },
] as const;

interface WizardForm {
  name: string; age: string; sex: "male" | "female";
  height: string; currentWeight: string; waistCm: string; bodyFatPercent: string;
  bodyShape: "ecto" | "meso" | "endo" | "over";
  targetWeight: string; stepTarget: string; activityLevel: "sedentary" | "lightly" | "moderately" | "very";
}

function OnboardingWizard({
  userId, defaultName, accentColor, authHeaders, onComplete, t,
}: {
  userId: string; defaultName: string; accentColor: string;
  authHeaders: Record<string, string>; onComplete: () => void; t: HT;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WizardForm>({
    name: defaultName, age: "", sex: "male",
    height: "", currentWeight: "", waistCm: "", bodyFatPercent: "",
    bodyShape: "meso",
    targetWeight: "", stepTarget: "8000", activityLevel: "lightly",
  });

  const set = (key: keyof WizardForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const bmrPreview = (): number | null => {
    const age = parseInt(form.age);
    const height = parseFloat(form.height);
    const weight = parseFloat(form.currentWeight);
    if (!age || !height || !weight) return null;
    const base = 10 * weight + 6.25 * height - 5 * age;
    return Math.round(form.sex === "male" ? base + 5 : base - 161);
  };

  const tdeePreview = (): number | null => {
    const bmr = bmrPreview();
    if (!bmr) return null;
    return Math.round(bmr * (ACTIVITY_MULTIPLIERS[form.activityLevel] ?? 1.375));
  };

  const calsPreview = (): number | null => {
    const tdee = tdeePreview();
    if (!tdee) return null;
    return tdee - 500;
  };

  const canProceed = (): boolean => {
    if (step === 1) return !!form.name && !!form.age && parseInt(form.age) > 0;
    if (step === 2) return !!form.height && !!form.currentWeight;
    if (step === 3) return !!form.bodyShape;
    if (step === 4) return !!form.targetWeight && !!form.stepTarget;
    return true;
  };

  const save = async () => {
    setSaving(true);
    const cals = calsPreview();
    const jsonH = { ...authHeaders, "Content-Type": "application/json" };
    const weight = parseFloat(form.currentWeight);
    await fetch(`/api/admin/health/profiles/${userId}`, {
      method: "PUT",
      headers: jsonH,
      body: JSON.stringify({
        name: form.name,
        age: parseInt(form.age),
        sex: form.sex,
        height: parseFloat(form.height),
        currentWeight: weight,
        targetWeight: parseFloat(form.targetWeight),
        dailyCalories: cals ?? 1500,
        bodyShape: form.bodyShape,
        bodyFatPercent: form.bodyFatPercent ? parseFloat(form.bodyFatPercent) : null,
        waistCm: form.waistCm ? parseFloat(form.waistCm) : null,
        activityLevel: form.activityLevel,
        stepTarget: parseInt(form.stepTarget),
        onboardingComplete: true,
      }),
    });
    // Seed today's weight log so latestWeight shows immediately after onboarding
    await fetch(`/api/admin/health/weight/${userId}`, {
      method: "POST", headers: jsonH, body: JSON.stringify({ weight }),
    });
    onComplete();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: t.inp, border: `1px solid ${t.inpB}`, borderRadius: 8,
    padding: "10px 12px", color: t.t1, fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, color: t.t4, display: "block", marginBottom: 5 };

  return (
    <div style={{ background: t.bg, border: `1px solid ${accentColor}33`, borderRadius: 16, overflow: "hidden", flex: "1 1 340px", minWidth: 0 }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${accentColor}18, transparent)`, borderBottom: `1px solid ${accentColor}22`, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>{step === 5 ? "🎉" : "👤"}</span>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: t.t1, margin: 0 }}>
              {step === 1 && "Bun venit, " + (form.name || defaultName) + "!"}
              {step === 2 && "Măsurătorile tale"}
              {step === 3 && "Forma corpului"}
              {step === 4 && "Obiectivele tale"}
              {step === 5 && "Profilul tău e gata"}
            </p>
            <p style={{ fontSize: 11, color: t.t4, margin: 0 }}>Pasul {step} din 5</p>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ marginTop: 14, height: 3, background: t.b1, borderRadius: 2 }}>
          <div style={{ height: "100%", width: `${(step / 5) * 100}%`, background: accentColor, borderRadius: 2, transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Step 1: Basics */}
        {step === 1 && (
          <>
            <div>
              <label style={labelStyle}>Cum te cheamă?</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} placeholder="Numele tău" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Vârsta</label>
                <input type="number" value={form.age} onChange={(e) => set("age", e.target.value)} style={inputStyle} placeholder="ex: 30" min={10} max={100} />
              </div>
              <div>
                <label style={labelStyle}>Sex biologic</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["male", "female"] as const).map((sex) => (
                    <button key={sex} onClick={() => set("sex", sex)}
                      style={{ flex: 1, padding: "10px 0", background: form.sex === sex ? accentColor : t.s1, border: `1px solid ${form.sex === sex ? accentColor : t.b2}`, borderRadius: 8, color: form.sex === sex ? t.bg : t.t4, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      {sex === "male" ? "♂ Masculin" : "♀ Feminin"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Body measurements */}
        {step === 2 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Înălțime (cm)</label>
                <input type="number" value={form.height} onChange={(e) => set("height", e.target.value)} style={inputStyle} placeholder="ex: 178" />
              </div>
              <div>
                <label style={labelStyle}>Greutate acum (kg)</label>
                <input type="number" step="0.1" value={form.currentWeight} onChange={(e) => set("currentWeight", e.target.value)} style={inputStyle} placeholder="ex: 88.5" />
              </div>
              <div>
                <label style={labelStyle}>Circumferință talie (cm) <span style={{ color: t.t6 }}>opțional</span></label>
                <input type="number" value={form.waistCm} onChange={(e) => set("waistCm", e.target.value)} style={inputStyle} placeholder="ex: 95" />
              </div>
              <div>
                <label style={labelStyle}>% Grăsime corporală <span style={{ color: t.t6 }}>opțional</span></label>
                <input type="number" step="0.5" value={form.bodyFatPercent} onChange={(e) => set("bodyFatPercent", e.target.value)} style={inputStyle} placeholder="ex: 22" />
              </div>
            </div>
            <p style={{ fontSize: 11, color: t.t5, margin: 0 }}>
              💡 Nu știi % grăsime? Lasă gol — o estimăm din celelalte date.
            </p>
          </>
        )}

        {/* Step 3: Body shape */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {BODY_SHAPES.map((shape) => (
              <button key={shape.key} onClick={() => set("bodyShape", shape.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "12px 14px",
                  background: form.bodyShape === shape.key ? `${accentColor}18` : t.s1,
                  border: `1px solid ${form.bodyShape === shape.key ? accentColor : t.b1}`,
                  borderRadius: 10, cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 24 }}>{shape.icon}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: form.bodyShape === shape.key ? accentColor : t.t3, margin: 0 }}>{shape.label}</p>
                  <p style={{ fontSize: 11, color: t.t4, margin: 0 }}>{shape.desc}</p>
                </div>
                {form.bodyShape === shape.key && <span style={{ marginLeft: "auto", color: accentColor, fontSize: 16 }}>✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Step 4: Goals */}
        {step === 4 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Greutate țintă (kg)</label>
                <input type="number" step="0.5" value={form.targetWeight} onChange={(e) => set("targetWeight", e.target.value)} style={inputStyle} placeholder="ex: 75" />
              </div>
              <div>
                <label style={labelStyle}>Pași zilnici target</label>
                <input type="number" step="500" value={form.stepTarget} onChange={(e) => set("stepTarget", e.target.value)} style={inputStyle} placeholder="ex: 8000" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Nivel activitate curentă (fără plan)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ACTIVITY_LEVELS.map((level) => (
                  <button key={level.key} onClick={() => set("activityLevel", level.key)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", background: form.activityLevel === level.key ? `${accentColor}18` : t.s1,
                      border: `1px solid ${form.activityLevel === level.key ? accentColor : t.b1}`,
                      borderRadius: 8, cursor: "pointer",
                    }}
                  >
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: form.activityLevel === level.key ? accentColor : t.t3, margin: 0 }}>{level.label}</p>
                      <p style={{ fontSize: 11, color: t.t4, margin: 0 }}>{level.desc}</p>
                    </div>
                    {form.activityLevel === level.key && <span style={{ color: accentColor }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 5: Summary */}
        {step === 5 && (() => {
          const bmr = bmrPreview();
          const tdee = tdeePreview();
          const cals = calsPreview();
          const tolose = form.currentWeight && form.targetWeight
            ? (parseFloat(form.currentWeight) - parseFloat(form.targetWeight)).toFixed(1)
            : "—";
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "BMR", value: bmr ? `${bmr} kcal` : "—", desc: "Metabolism bazal" },
                  { label: "TDEE", value: tdee ? `${tdee} kcal` : "—", desc: "Necesar total/zi" },
                  { label: "Calorii recomandate", value: cals ? `${cals} kcal` : "—", desc: "Cu deficit de 500 kcal" },
                  { label: "De slăbit", value: `${tolose} kg`, desc: `Țintă: ${form.targetWeight} kg` },
                  { label: "Pași zilnici", value: form.stepTarget, desc: "Penalitate: $5/zi ratată" },
                  { label: "Penalitate", value: "$5", desc: "Asociație la final de lună" },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: t.s1, borderRadius: 10, padding: "10px 12px" }}>
                    <p style={{ fontSize: 9, color: t.t5, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px" }}>{stat.label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: accentColor, margin: "0 0 2px" }}>{stat.value}</p>
                    <p style={{ fontSize: 10, color: t.t5, margin: 0 }}>{stat.desc}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: t.t4, margin: 0, lineHeight: 1.6 }}>
                Caloriile și planul alimentar sunt generate zilnic de Claude AI bazat pe datele tale.
                Poți edita oricând din ⚙.
              </p>
            </div>
          );
        })()}

        {/* Navigation */}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          {step > 1 && (
            <button onClick={() => setStep((s) => s - 1)}
              style={{ padding: "10px 18px", background: "none", border: `1px solid ${t.b2}`, borderRadius: 8, color: t.t4, fontSize: 13, cursor: "pointer" }}
            >← Înapoi</button>
          )}
          {step < 5 && (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}
              style={{ flex: 1, padding: "10px 0", background: canProceed() ? accentColor : t.b1, border: "none", borderRadius: 8, color: canProceed() ? t.bg : t.t6, fontSize: 13, fontWeight: 700, cursor: canProceed() ? "pointer" : "default", transition: "all 0.15s" }}
            >Continuă →</button>
          )}
          {step === 5 && (
            <button onClick={save} disabled={saving}
              style={{ flex: 1, padding: "12px 0", background: accentColor, border: "none", borderRadius: 8, color: t.bg, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
            >{saving ? "Se salvează..." : "🚀 Creează profil"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared utils ─────────────────────────────────────────────────────────────

function readAndCompressImage(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas unavailable")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Step Section ──────────────────────────────────────────────────────────────

function StepSection({
  userId, stepTarget, currentWeight, height, sex, age, accentColor, authHeaders, t, readOnly = false,
}: {
  userId: string; stepTarget: number; currentWeight: number; height: number; sex: "male" | "female"; age: number; accentColor: string; authHeaders: Record<string, string>; t: HT; readOnly?: boolean;
}) {
  const [bank, setBank] = useState<StepBank | null>(null);
  const [todayLog, setTodayLog] = useState<ActivityLog | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justLogged, setJustLogged] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  const loadBank = useCallback(async () => {
    const [bankRes, actRes] = await Promise.all([
      fetch(`/api/admin/health/bank/${userId}`, { headers: authHeaders }),
      fetch(`/api/admin/health/activity/${userId}`, { headers: authHeaders }),
    ]);
    if (bankRes.ok) {
      const bankData = await bankRes.json() as StepBank;
      if (typeof bankData.bank === "number") setBank(bankData);
    }
    if (actRes.ok) {
      const actData = await actRes.json() as { entries?: ActivityLog[] };
      const todayEntry = (actData.entries ?? []).find((e) => e.date === today) ?? null;
      setTodayLog(todayEntry);
    }
  }, [userId, authHeaders, today]);

  useEffect(() => { loadBank(); }, [loadBank]);

  const handlePhoto = async (base64: string) => {
    setUploading(true);
    setError(null);
    try {
      const photoBase64 = base64;
      const res = await fetch(`/api/admin/health/activity/${userId}`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ photoBase64, date: today }),
      });
      const data = await res.json() as { ok?: boolean; steps?: number; delta?: number; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Eroare la upload.");
      } else {
        setJustLogged(data.delta ?? data.steps ?? null);
        setTimeout(() => setJustLogged(null), 3000);
        await loadBank();
      }
    } catch (err) {
      setError(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    }
    setUploading(false);
  };

  const bankColor = bank && bank.bank >= 0 ? "#4ade80" : "#f87171";
  const bankLabel = bank
    ? bank.bank >= 0
      ? `+${bank.bank.toLocaleString()} pași avans`
      : `${bank.bank.toLocaleString()} pași deficit`
    : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Upload input (hidden) */}
      {!readOnly && (
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const input = e.target;
            readAndCompressImage(file).then((base64) => {
              input.value = "";
              void handlePhoto(base64);
            }).catch(() => { input.value = ""; });
          }}
        />
      )}

      {/* Today's status */}
      {todayLog ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Max steps header */}
          <div style={{ background: t.greenBg, border: `1px solid ${t.greenBdr}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#4ade80", margin: 0 }}>{todayLog.steps.toLocaleString()} pași</p>
              <p style={{ fontSize: 10, color: t.t4, margin: 0 }}>Total azi · {today}</p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fb923c", margin: 0 }}>{stepsToKcal(todayLog.steps, currentWeight, height, sex, age).toLocaleString()} kcal</p>
              <p style={{ fontSize: 9, color: t.t5, margin: 0 }}>arși</p>
            </div>
            {todayLog.entries && todayLog.entries.length > 0 && todayLog.entries[todayLog.entries.length - 1].photoUrl && (
              <img src={todayLog.entries[todayLog.entries.length - 1].photoUrl} alt="pași"
                style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: `1px solid ${t.greenBdr}` }} />
            )}
          </div>

          {/* Entry log */}
          {todayLog.entries && todayLog.entries.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {todayLog.entries.map((entry, idx) => {
                const prevSteps = idx > 0 ? todayLog.entries![idx - 1].steps : 0;
                const delta = entry.steps - prevSteps;
                const time = entry.loggedAt ? new Date(entry.loggedAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : "—";
                return (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 8 }}>
                    {entry.photoUrl && <img src={entry.photoUrl} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />}
                    <span style={{ fontSize: 10, color: t.t5, flexShrink: 0 }}>{time}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.t2 }}>{entry.steps.toLocaleString()} pași</span>
                    {idx > 0 && delta > 0 && (
                      <span style={{ fontSize: 10, color: "#4ade80", marginLeft: "auto" }}>+{delta.toLocaleString()} față de precedenta</span>
                    )}
                    {idx > 0 && delta <= 0 && (
                      <span style={{ fontSize: 10, color: t.t5, marginLeft: "auto" }}>fără pași noi</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Update button */}
          {!readOnly && (
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              style={{ fontSize: 11, padding: "7px 0", background: "none", border: `1px dashed ${accentColor}66`, borderRadius: 8, color: accentColor, cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1 }}
            >
              {uploading ? "⏳ Claude extrage pașii..." : justLogged ? `✓ +${justLogged.toLocaleString()} pași adăugați` : "📸 Actualizează pașii"}
            </button>
          )}
          {error && <p style={{ fontSize: 11, color: "#f87171", margin: 0 }}>{error}</p>}
        </div>
      ) : readOnly ? (
        <p style={{ fontSize: 12, color: t.t6, textAlign: "center", padding: "10px 0" }}>Niciun pas logat azi</p>
      ) : (
        <div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{
              width: "100%", padding: "14px 0", background: uploading ? t.s1 : t.purpleBg2,
              border: `2px dashed ${uploading ? t.b2 : accentColor + "66"}`,
              borderRadius: 10, color: uploading ? t.t4 : accentColor, fontSize: 13, fontWeight: 600,
              cursor: uploading ? "default" : "pointer", transition: "all 0.15s",
            }}
          >
            {uploading ? "⏳ Claude extrage pașii..." : justLogged ? `✓ ${justLogged.toLocaleString()} pași logați!` : "📸 Adaugă poza cu pașii de azi"}
          </button>
          {error && <p style={{ fontSize: 11, color: "#f87171", marginTop: 6, margin: "6px 0 0" }}>{error}</p>}
          <p style={{ fontSize: 10, color: t.t6, marginTop: 6, margin: "6px 0 0" }}>
            Screenshot din Health/ceas · contorul e cumulativ de la miezul nopții
          </p>
        </div>
      )}

      {/* Step bank */}
      {bank && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ fontSize: 9, color: t.t5, textTransform: "uppercase", margin: "0 0 3px" }}>Bancă pași</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: bankColor, margin: 0 }}>{bankLabel}</p>
          </div>
          <div style={{ background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ fontSize: 9, color: t.t5, textTransform: "uppercase", margin: "0 0 3px" }}>Zile logate</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: t.t3, margin: 0 }}>{bank.daysLogged}/{bank.daysElapsed}</p>
          </div>
          <div style={{ background: bank.penaltyAmount > 0 ? t.redBg : t.s1, border: `1px solid ${bank.penaltyAmount > 0 ? t.redBdr : t.b1}`, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ fontSize: 9, color: t.t5, textTransform: "uppercase", margin: "0 0 3px" }}>Penalitate</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: bank.penaltyAmount > 0 ? "#f87171" : "#4ade80", margin: 0 }}>
              {bank.penaltyAmount > 0 ? `$${bank.penaltyAmount.toFixed(2)}` : "$0 ✓"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Penalty Section ───────────────────────────────────────────────────────────

function PenaltySection({
  userId, accentColor, authHeaders, t,
}: {
  userId: string; accentColor: string; authHeaders: Record<string, string>; t: HT;
}) {
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/health/penalties/${userId}`, { headers: authHeaders })
      .then((res) => res.json() as Promise<{ penalties: Penalty[] }>)
      .then((data) => setPenalties(data.penalties ?? []));
  }, [userId, authHeaders]);

  const markPaid = async (month: string) => {
    setPaying(month);
    await fetch(`/api/admin/health/penalties/${userId}/pay`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    setPenalties((prev) => prev.map((p) => p.month === month ? { ...p, paid: true } : p));
    setPaying(null);
  };

  const unpaid = penalties.filter((p) => !p.paid);
  if (penalties.length === 0) return null;

  return (
    <div>
      <p style={{ fontSize: 10, color: t.t5, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
        Penalități acumulate
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {penalties.map((penalty) => (
          <div key={penalty.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: penalty.paid ? t.s2 : t.redBg,
            border: `1px solid ${penalty.paid ? t.b1 : t.redBdr}`,
            borderRadius: 8, padding: "10px 12px",
          }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: penalty.paid ? t.t4 : t.t3, margin: 0 }}>{penalty.month}</p>
              <p style={{ fontSize: 11, color: t.t5, margin: 0 }}>{penalty.daysShort} zile ratate</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: penalty.paid ? t.t4 : "#f87171" }}>
                ${penalty.totalOwed}
              </span>
              {!penalty.paid && (
                <button
                  onClick={() => markPaid(penalty.month)}
                  disabled={paying === penalty.month}
                  style={{
                    padding: "4px 10px", background: accentColor, border: "none", borderRadius: 6,
                    color: t.bg, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    opacity: paying === penalty.month ? 0.6 : 1,
                  }}
                >
                  {paying === penalty.month ? "..." : "Plătit ✓"}
                </button>
              )}
              {penalty.paid && <span style={{ fontSize: 11, color: "#4ade80" }}>✓ Plătit</span>}
            </div>
          </div>
        ))}
        {unpaid.length > 0 && (
          <p style={{ fontSize: 11, color: "#f87171", margin: "4px 0 0", fontWeight: 600 }}>
            Total datorat: ${unpaid.reduce((sum, p) => sum + p.totalOwed, 0)}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Food Section ──────────────────────────────────────────────────────────────

const CONFIDENCE_ICON: Record<string, string> = { high: "✅", medium: "🟡", low: "⚠️" };

type FoodFormStep = "chat" | "confirm" | "saving";

interface ChatMessage { role: "user" | "assistant"; content: string }

interface FoodPreview {
  analysis: FoodEntry;
  currentCalories: number;
  items?: { name: string; quantity: string; calories: number }[];
}

function calorieWarning(current: number, incoming: number, target: number): { text: string; color: string; bg: string; bdr: string } | null {
  const after = current + incoming;
  const pct = Math.round((after / target) * 100);
  if (after > target) return {
    text: `⚠️ Vei depăși targetul cu ${after - target} kcal (${pct}% din ${target} kcal)`,
    color: "#f87171", bg: "redBg", bdr: "redBdr",
  };
  if (after > target * 0.85) return {
    text: `🟡 Vei ajunge la ${after} kcal — ${target - after} kcal mai ai până la target`,
    color: "#fb923c", bg: "yellowBg", bdr: "",
  };
  return null;
}

function FoodSection({
  userId, dailyCalorieTarget, accentColor, authHeaders, t, readOnly = false,
}: {
  userId: string; dailyCalorieTarget: number; accentColor: string; authHeaders: Record<string, string>; t: HT; readOnly?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [todayLog, setTodayLog] = useState<FoodLog | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState<FoodFormStep>("chat");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingPhotoBase64, setPendingPhotoBase64] = useState<string | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [foodPreview, setFoodPreview] = useState<FoodPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const INITIAL_MSG: ChatMessage = { role: "assistant", content: "Spune-mi ce ai mâncat! Descrie fiecare aliment și îți voi ajuta să estimăm caloriile cât mai precis." };

  const loadToday = useCallback(async () => {
    const res = await fetch(`/api/admin/health/food/${userId}`, { headers: authHeaders });
    if (!res.ok) return;
    const data = await res.json() as { logs?: FoodLog[] };
    const log = (data.logs ?? []).find((l) => l.date === today) ?? null;
    setTodayLog(log);
  }, [userId, authHeaders, today]);

  useEffect(() => { loadToday(); }, [loadToday]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const openForm = () => {
    setChatMessages([INITIAL_MSG]);
    setChatInput("");
    setPendingPhotoBase64(null);
    setPendingPhotoUrl(null);
    setFoodPreview(null);
    setFormStep("chat");
    setError(null);
    setShowForm(true);
  };

  const resetForm = () => {
    setChatMessages([]);
    setChatInput("");
    setPendingPhotoBase64(null);
    setPendingPhotoUrl(null);
    setFoodPreview(null);
    setFormStep("chat");
    setError(null);
    setShowForm(false);
  };

  const sendMessage = async (overrideContent?: string, isFinalize?: boolean) => {
    const content = overrideContent ?? chatInput.trim();
    if (!content && !pendingPhotoBase64) return;
    const photoToSend = pendingPhotoBase64;
    const userMsg: ChatMessage = { role: "user", content: content || "📸 [poză atașată]" };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setPendingPhotoBase64(null);
    setPendingPhotoUrl(null);
    setChatLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/health/food/${userId}/chat`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          ...(photoToSend ? { photoBase64: photoToSend } : {}),
        }),
      });
      const data = await res.json() as { reply?: string; analysis?: FoodEntry & { items?: { name: string; quantity: string; calories: number }[] }; currentCalories?: number; error?: string };
      if (!res.ok) { setError(data.error ?? "Eroare."); return; }
      const assistantMsg: ChatMessage = { role: "assistant", content: data.reply ?? "" };
      setChatMessages([...newMessages, assistantMsg]);
      if (data.analysis) {
        setFoodPreview({ analysis: data.analysis, currentCalories: data.currentCalories ?? 0, items: data.analysis.items });
        setFormStep("confirm");
      } else if (isFinalize) {
        setError("AI-ul nu a putut genera rezumatul. Încearcă din nou.");
      }
    } catch (err) {
      setError(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      setChatLoading(false);
    }
  };

  const finalize = () => sendMessage("Gata, asta a fost tot. Fă rezumatul mesei.", true);

  const confirm = async () => {
    if (!foodPreview) return;
    setFormStep("saving");
    try {
      const res = await fetch(`/api/admin/health/food/${userId}`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, analysis: JSON.stringify(foodPreview.analysis) }),
      });
      if (res.ok) {
        resetForm();
        await loadToday();
      } else {
        setFormStep("confirm");
        setError("Eroare la salvare.");
      }
    } catch (err) {
      setFormStep("confirm");
      setError(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    }
  };

  const deleteEntry = async (entryId: string) => {
    await fetch(`/api/admin/health/food/${userId}/${today}/${entryId}`, {
      method: "DELETE", headers: authHeaders,
    });
    await loadToday();
  };

  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const toggleEntry = (id: string) => setExpandedEntries((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const consumed = todayLog?.totalCalories ?? 0;
  const progress = Math.min(110, Math.round((consumed / dailyCalorieTarget) * 100));
  const progressColor = consumed > dailyCalorieTarget ? "#f87171" : consumed > dailyCalorieTarget * 0.85 ? "#fb923c" : "#4ade80";
  const warning = foodPreview ? calorieWarning(foodPreview.currentCalories, foodPreview.analysis.calories, dailyCalorieTarget) : null;
  const warningBg = warning ? (warning.bg === "redBg" ? t.redBg : t.yellowBg) : t.greenBg;
  const warningBdr = warning ? (warning.bg === "redBg" ? t.redBdr : t.b2) : t.greenBdr;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header + progress */}
      <div>
        {!readOnly && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 8 }}>
            <button onClick={() => { if (showForm) resetForm(); else openForm(); }}
              style={{ fontSize: 11, padding: "4px 12px", background: showForm ? t.b1 : accentColor, border: "none", borderRadius: 6, color: showForm ? t.t4 : t.bg, fontWeight: 700, cursor: "pointer" }}
            >
              {showForm ? "✕ Închide" : "💬 Loghează masa"}
            </button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 6, background: t.b1, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: progressColor, borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: 11, color: progressColor, fontWeight: 700, whiteSpace: "nowrap" }}>
            {consumed} / {dailyCalorieTarget} kcal
          </span>
        </div>
        {todayLog && (
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: t.t5 }}>
            <span>🥩 {todayLog.totalProtein}g</span>
            <span>🌾 {todayLog.totalCarbs}g</span>
            <span>🧈 {todayLog.totalFat}g</span>
          </div>
        )}
        {consumed > dailyCalorieTarget && (
          <p style={{ fontSize: 11, color: "#f87171", fontWeight: 600, margin: "6px 0 0", padding: "6px 10px", background: t.redBg, borderRadius: 6 }}>
            ⚠️ Ai depășit targetul cu {consumed - dailyCalorieTarget} kcal azi
          </p>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: t.s2, border: `1px solid ${t.b1}`, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* Step 1: chat */}
          {formStep === "chat" && (<>
            {/* Messages */}
            <div style={{ maxHeight: 320, overflowY: "auto", padding: "12px 12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "82%",
                    padding: "8px 12px",
                    borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                    background: msg.role === "user" ? accentColor : t.s1,
                    color: msg.role === "user" ? t.bg : t.t2,
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ padding: "8px 12px", borderRadius: "12px 12px 12px 4px", background: t.s1, color: t.t4, fontSize: 12 }}>
                    <span style={{ animation: "pulse 1s infinite" }}>●</span> <span style={{ opacity: 0.5 }}>●</span> <span style={{ opacity: 0.3 }}>●</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Photo preview */}
            {pendingPhotoUrl && (
              <div style={{ margin: "8px 12px 0", position: "relative", display: "inline-block" }}>
                <img src={pendingPhotoUrl} alt="pending" style={{ height: 60, borderRadius: 8, display: "block" }} />
                <button onClick={() => { setPendingPhotoBase64(null); setPendingPhotoUrl(null); }}
                  style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            )}

            {/* Input row */}
            <div style={{ padding: 10, display: "flex", gap: 6, alignItems: "flex-end" }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const input = e.target;
                  readAndCompressImage(file).then((base64) => {
                    input.value = "";
                    setPendingPhotoBase64(base64);
                    setPendingPhotoUrl(`data:image/jpeg;base64,${base64}`);
                  }).catch((err: unknown) => {
                    input.value = "";
                    setError(err instanceof Error ? err.message : String(err));
                  });
                }}
              />
              <button onClick={() => fileRef.current?.click()}
                style={{ padding: "7px 8px", background: t.s1, border: `1px solid ${t.b2}`, borderRadius: 8, color: t.t4, fontSize: 14, cursor: "pointer", flexShrink: 0 }}>
                📸
              </button>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!chatLoading) sendMessage(); } }}
                placeholder="Descrie ce ai mâncat..."
                rows={1}
                style={{ flex: 1, background: t.inp, border: `1px solid ${t.inpB}`, borderRadius: 8, padding: "8px 10px", color: t.t1, fontSize: 12, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.4 }}
              />
              <button onClick={() => sendMessage()} disabled={chatLoading || (!chatInput.trim() && !pendingPhotoBase64)}
                style={{ padding: "7px 10px", background: (chatLoading || (!chatInput.trim() && !pendingPhotoBase64)) ? t.b1 : accentColor, border: "none", borderRadius: 8, color: (chatLoading || (!chatInput.trim() && !pendingPhotoBase64)) ? t.t6 : t.bg, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                →
              </button>
            </div>

            {error && <p style={{ fontSize: 11, color: "#f87171", margin: "0 12px 8px" }}>{error}</p>}

            {/* Finalize button */}
            {chatMessages.length > 1 && (
              <div style={{ padding: "0 10px 10px" }}>
                <button onClick={finalize} disabled={chatLoading}
                  style={{ width: "100%", padding: "9px 0", background: chatLoading ? t.b1 : "#7c3aed", border: "none", borderRadius: 8, color: chatLoading ? t.t6 : "#fff", fontSize: 12, fontWeight: 700, cursor: chatLoading ? "default" : "pointer" }}>
                  {chatLoading ? "⏳ Analizează..." : "✅ Finalizează și calculează"}
                </button>
              </div>
            )}
          </>)}

          {/* Step 2: confirm */}
          {(formStep === "confirm" || formStep === "saving") && foodPreview && (
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: t.t2, margin: "0 0 2px" }}>
                  {CONFIDENCE_ICON[foodPreview.analysis.confidence]} {foodPreview.analysis.food}
                </p>
                <p style={{ fontSize: 11, color: t.t4, margin: "0 0 6px" }}>{foodPreview.analysis.quantity}</p>
                <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                  <span style={{ color: accentColor, fontWeight: 700 }}>{foodPreview.analysis.calories} kcal</span>
                  <span style={{ color: t.t4 }}>P: {foodPreview.analysis.protein}g</span>
                  <span style={{ color: t.t4 }}>C: {foodPreview.analysis.carbs}g</span>
                  <span style={{ color: t.t4 }}>G: {foodPreview.analysis.fat}g</span>
                </div>
                {foodPreview.analysis.aiNote && (
                  <p style={{ fontSize: 10, color: "#7c5fc0", margin: "4px 0 0" }}>💡 {foodPreview.analysis.aiNote}</p>
                )}
              </div>

              {/* Individual items breakdown */}
              {foodPreview.items && foodPreview.items.length > 1 && (
                <div style={{ background: t.s1, borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                  {foodPreview.items.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                      <span style={{ color: t.t3 }}>{item.name} <span style={{ color: t.t5, fontSize: 10 }}>({item.quantity})</span></span>
                      <span style={{ color: t.t4, fontWeight: 600 }}>{item.calories} kcal</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Calorie impact warning */}
              <div style={{ padding: "10px 12px", background: warningBg, border: `1px solid ${warningBdr}`, borderRadius: 8 }}>
                {warning ? (
                  <>
                    <p style={{ fontSize: 12, color: warning.color, fontWeight: 600, margin: 0 }}>{warning.text}</p>
                    <p style={{ fontSize: 11, color: t.t4, margin: "4px 0 0" }}>
                      {foodPreview.currentCalories} kcal acum + {foodPreview.analysis.calories} kcal = {foodPreview.currentCalories + foodPreview.analysis.calories} kcal din {dailyCalorieTarget} kcal target
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: "#4ade80", fontWeight: 600, margin: 0 }}>
                    ✅ În regulă — vei ajunge la {foodPreview.currentCalories + foodPreview.analysis.calories} / {dailyCalorieTarget} kcal
                  </p>
                )}
              </div>

              {error && <p style={{ fontSize: 11, color: "#f87171", margin: 0 }}>{error}</p>}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setFormStep("chat"); setFoodPreview(null); setError(null); }}
                  style={{ flex: 1, padding: "9px 0", background: "none", border: `1px solid ${t.b2}`, borderRadius: 8, color: t.t4, fontSize: 12, cursor: "pointer" }}>
                  ← Înapoi
                </button>
                <button onClick={confirm} disabled={formStep === "saving"}
                  style={{ flex: 2, padding: "9px 0", background: warning ? t.redBg : accentColor, border: warning ? `1px solid ${t.redBdr}` : "none", borderRadius: 8, color: warning ? "#ef4444" : t.bg, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: formStep === "saving" ? 0.7 : 1 }}>
                  {formStep === "saving" ? "Se salvează..." : warning ? "Adaugă totuși" : "Confirmă și adaugă"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Today's entries */}
      {todayLog && todayLog.entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto", paddingRight: 2 }}>
          {todayLog.entries.map((entry) => {
            const expanded = expandedEntries.has(entry.id);
            return (
              <div key={entry.id} style={{ background: t.s2, border: `1px solid ${t.b1}`, borderRadius: 10, overflow: "hidden" }}>
                {/* Always-visible header row */}
                <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px" }}>
                  {!readOnly && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id); }}
                      style={{ fontSize: 10, color: t.t6, background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
                    >✕</button>
                  )}
                  <div
                    onClick={() => toggleEntry(entry.id)}
                    style={{ display: "flex", flex: 1, gap: 10, alignItems: "center", cursor: "pointer", minWidth: 0 }}
                  >
                    {entry.photoUrl
                      ? <img src={entry.photoUrl} alt={entry.food} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                      : <div style={{ width: 36, height: 36, background: t.s1, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🍽</div>
                    }
                    <p style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.t2, margin: 0, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {CONFIDENCE_ICON[entry.confidence]} {entry.food}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>{entry.calories} kcal</span>
                      <span style={{ fontSize: 10, color: t.t6, display: "inline-block", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s", lineHeight: 1 }}>▾</span>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded && (
                  <div style={{ padding: "0 12px 10px 58px", display: "flex", flexDirection: "column", gap: 2 }}>
                    <p style={{ fontSize: 11, color: t.t4, margin: 0 }}>{entry.quantity}</p>
                    {entry.note && <p style={{ fontSize: 10, color: t.t5, margin: "2px 0 0", fontStyle: "italic" }}>"{entry.note}"</p>}
                    {entry.aiNote && <p style={{ fontSize: 10, color: "#7c5fc0", margin: "2px 0 0" }}>💡 {entry.aiNote}</p>}
                    <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 10, color: t.t5 }}>
                      <span>P: {entry.protein}g</span><span>C: {entry.carbs}g</span><span>G: {entry.fat}g</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!todayLog?.entries?.length && !showForm && (
        <p style={{ fontSize: 12, color: t.t7, textAlign: "center", padding: "12px 0" }}>🍽 Niciun aliment logat azi</p>
      )}
    </div>
  );
}

// ── Info Tooltip ──────────────────────────────────────────────────────────────

function InfoTooltip({ text, t }: { text: string; t: HT }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const show = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <button
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        style={{
          width: 13, height: 13, borderRadius: "50%",
          background: t.b2, border: "none",
          color: t.t5, fontSize: 8, fontWeight: 700,
          cursor: "default", display: "inline-flex", alignItems: "center",
          justifyContent: "center", padding: 0, lineHeight: 1, flexShrink: 0,
        }}
      >i</button>
      {pos && (
        <span style={{
          position: "fixed", bottom: `calc(100vh - ${pos.top}px)`, left: pos.left,
          transform: "translateX(-50%)",
          background: t.b1, border: `1px solid ${t.b2}`,
          borderRadius: 8, padding: "8px 10px",
          fontSize: 11, color: t.t3, lineHeight: 1.5,
          zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          pointerEvents: "none", width: 220,
          whiteSpace: "normal", textTransform: "none", letterSpacing: 0,
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ── Profile Panel ─────────────────────────────────────────────────────────────

function ProfilePanel({
  userId, defaultName, emoji, accentColor, authHeaders, t, readOnly = false,
}: {
  userId: string; defaultName: string; emoji: string; accentColor: string;
  authHeaders: Record<string, string>; t: HT; readOnly?: boolean;
}) {
  const jsonHeaders = { ...authHeaders, "Content-Type": "application/json" };
  const [profile, setProfile] = useState<HealthProfile | null | undefined>(undefined);
  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [activityHistory, setActivityHistory] = useState<ActivityLog[]>([]);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [weightInput, setWeightInput] = useState("");
  const [loggingWeight, setLoggingWeight] = useState(false);
  const [generatingRec, setGeneratingRec] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<HealthProfile>>({});
  const [weightSaved, setWeightSaved] = useState(false);

  const load = useCallback(async () => {
    const [profRes, wRes, rRes, actRes] = await Promise.all([
      fetch("/api/admin/health/profiles", { headers: authHeaders }),
      fetch(`/api/admin/health/weight/${userId}`, { headers: authHeaders }),
      fetch(`/api/admin/health/recommend/${userId}`, { headers: authHeaders }),
      fetch(`/api/admin/health/activity/${userId}`, { headers: authHeaders }),
    ]);
    const profData = profRes.ok ? await profRes.json() as { profiles: Record<string, HealthProfile> } : { profiles: {} };
    const wData = wRes.ok ? await wRes.json() as { entries?: WeightEntry[] } : { entries: [] };
    const rData = rRes.ok ? await rRes.json() as { recommendation: Recommendation | null } : { recommendation: null };
    const actData = actRes.ok ? await actRes.json() as { entries?: ActivityLog[] } : { entries: [] };
    setProfile(profData.profiles?.[userId] ?? null);
    setHistory(wData.entries ?? []);
    setActivityHistory(actData.entries ?? []);
    setRec(rData.recommendation);
    setLoading(false);
  }, [userId, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const logWeight = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 20 || w > 300) return;
    setLoggingWeight(true);
    await fetch(`/api/admin/health/weight/${userId}`, {
      method: "POST", headers: jsonHeaders, body: JSON.stringify({ weight: w }),
    });
    setWeightInput("");
    setWeightSaved(true);
    setTimeout(() => setWeightSaved(false), 2500);
    await load();
    setLoggingWeight(false);
  };

  const generateRec = async () => {
    setGeneratingRec(true);
    const res = await fetch(`/api/admin/health/recommend/${userId}`, { method: "POST", headers: jsonHeaders });
    const data = await res.json() as { recommendation: Recommendation };
    setRec(data.recommendation);
    setGeneratingRec(false);
  };

  const saveProfile = async () => {
    await fetch(`/api/admin/health/profiles/${userId}`, {
      method: "PUT", headers: jsonHeaders, body: JSON.stringify({ ...profile, ...profileForm }),
    });
    await load();
    setShowProfileEdit(false);
  };

  if (loading || profile === undefined) {
    return (
      <div style={{ background: t.bg, border: `1px solid ${accentColor}22`, borderRadius: 16, flex: "1 1 340px", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
        <span style={{ color: t.t6, fontSize: 13 }}>Se încarcă...</span>
      </div>
    );
  }

  if (!profile || !profile.onboardingComplete) {
    if (readOnly) {
      return (
        <div style={{ background: t.bg, border: `1px solid ${accentColor}22`, borderRadius: 16, flex: "1 1 340px", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
          <span style={{ color: t.t6, fontSize: 13 }}>Profil necompletat</span>
        </div>
      );
    }
    return (
      <OnboardingWizard
        userId={userId}
        defaultName={defaultName}
        accentColor={accentColor}
        authHeaders={authHeaders}
        onComplete={load}
        t={t}
      />
    );
  }

  const latestWeight = history.length > 0 ? history[0].weight : null;
  const bmi = latestWeight && profile.height ? calcBMI(latestWeight, profile.height) : null;
  const bmiData = bmi ? bmiInfo(bmi) : null;
  const tolose = latestWeight && profile.targetWeight ? latestWeight - profile.targetWeight : null;
  const bmr = calcBMR({ age: profile.age, sex: profile.sex, height: profile.height, currentWeight: latestWeight ?? profile.currentWeight });
  const tdee = calcTDEE(bmr, profile.activityLevel);

  return (
    <div style={{ background: t.bg, border: `1px solid ${accentColor}22`, borderRadius: 16, overflow: "hidden", flex: "1 1 340px", minWidth: 0 }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${accentColor}18, transparent)`, borderBottom: `1px solid ${accentColor}22`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>{emoji}</span>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: t.t1, margin: 0 }}>{profile.name}</p>
            <p style={{ fontSize: 11, color: t.t4, margin: 0 }}>{profile.age} ani · {profile.height} cm</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(() => {
            const delta = latestWeight && profile.startWeight ? latestWeight - profile.startWeight : null;
            const remaining = latestWeight && profile.targetWeight ? latestWeight - profile.targetWeight : null;
            return (
              <div style={{ textAlign: "right" }}>
                {delta !== null && (
                  <p style={{ fontSize: 16, fontWeight: 800, color: delta <= 0 ? "#4ade80" : "#f87171", margin: 0 }}>
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)} kg
                  </p>
                )}
                <p style={{ fontSize: 9, color: t.t5, margin: 0, textTransform: "uppercase" }}>
                  {remaining !== null ? `${remaining.toFixed(1)} kg până la țintă` : "față de start"}
                </p>
              </div>
            );
          })()}
          {!readOnly && (
            <button
              onClick={() => { setShowProfileEdit((v) => !v); setProfileForm({ ...profile }); }}
              style={{ fontSize: 11, color: t.t4, background: "none", border: `1px solid ${t.b2}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
            >⚙</button>
          )}
        </div>
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Profile edit */}
        {showProfileEdit && (
          <div style={{ background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {([
                { key: "name", label: "Nume", type: "text" },
                { key: "age", label: "Vârstă", type: "number" },
                { key: "height", label: "Înălțime (cm)", type: "number" },
                { key: "startWeight", label: "Greutate start (kg)", type: "number" },
                { key: "currentWeight", label: "Greutate curentă (kg)", type: "number" },
                { key: "targetWeight", label: "Țintă (kg)", type: "number" },
                { key: "dailyCalories", label: "Calorii/zi", type: "number" },
                { key: "stepTarget", label: "Pași target", type: "number" },
                { key: "waistCm", label: "Talie (cm)", type: "number" },
                { key: "bodyFatPercent", label: "% Grăsime", type: "number" },
              ] as const).map((field) => (
                <div key={field.key}>
                  <label style={{ fontSize: 10, color: t.t4, display: "block", marginBottom: 3 }}>{field.label}</label>
                  <input
                    type={field.type}
                    value={(profileForm[field.key] as string | number) ?? ""}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value }))}
                    style={{ width: "100%", background: t.inp, border: `1px solid ${t.inpB}`, borderRadius: 6, padding: "6px 10px", color: t.t1, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveProfile}
                style={{ flex: 1, padding: "7px 0", background: accentColor, border: "none", borderRadius: 7, color: t.bg, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >Salvează</button>
              <button onClick={() => setShowProfileEdit(false)}
                style={{ padding: "7px 14px", background: "none", border: `1px solid ${t.b2}`, borderRadius: 7, color: t.t4, fontSize: 12, cursor: "pointer" }}
              >✕</button>
            </div>
          </div>
        )}

        {/* Stats */}
        <Section title="Statistici" t={t}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {([
              { label: "Greutate", value: latestWeight ? `${latestWeight} kg` : "—", color: t.t2 },
              { label: "Țintă", value: profile.targetWeight ? `${profile.targetWeight} kg` : "—", color: accentColor },
              { label: "De slăbit", value: tolose !== null ? (tolose > 0 ? `${tolose.toFixed(1)} kg` : "✓ Atins!") : "—", color: tolose !== null && tolose <= 0 ? "#4ade80" : "#fb923c" },
              { label: "BMI", value: bmi && bmiData ? `${bmi.toFixed(1)} — ${bmiData.label}` : "—", color: bmiData?.color ?? t.t4 },
              { label: "BMR", value: `${bmr} kcal`, color: t.t4, info: "Rata Metabolică Bazală — caloriile arse de corp în repaus complet (respirat, inimă etc.), fără nicio activitate fizică." },
              { label: "TDEE", value: `${tdee} kcal`, color: t.t4, info: "Necesarul Total de Energie Zilnică — BMR înmulțit cu factorul tău de activitate. Sub TDEE slăbești, peste TDEE te îngrași." },
            ] as Array<{ label: string; value: string; color: string; info?: string }>).map((stat) => (
              <div key={stat.label} style={{ background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ fontSize: 9, color: t.t5, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}>
                  {stat.label}
                  {stat.info && <InfoTooltip text={stat.info} t={t} />}
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, color: stat.color, margin: 0 }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Log weight */}
        {!readOnly && (
          <Section title="Greutate azi" t={t}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number" step="0.1" value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") logWeight(); }}
                placeholder="ex: 82.5 kg"
                style={{ flex: 1, background: t.inp, border: `1px solid ${weightSaved ? "#4ade80" : t.inpB}`, borderRadius: 8, padding: "8px 12px", color: t.t1, fontSize: 14, outline: "none", transition: "border-color 0.3s" }}
              />
              <button onClick={logWeight} disabled={loggingWeight || !weightInput}
                style={{ padding: "8px 14px", background: weightInput ? accentColor : t.s1, border: `1px solid ${weightInput ? accentColor : t.b1}`, borderRadius: 8, color: weightInput ? t.bg : t.t5, fontSize: 13, fontWeight: 700, cursor: weightInput ? "pointer" : "default", transition: "all 0.15s" }}
              >
                {loggingWeight ? "..." : weightSaved ? "✓" : "↵"}
              </button>
            </div>
          </Section>
        )}

        {/* Steps */}
        <Section title={`Pași zilnici · target ${(profile.stepTarget ?? 8000).toLocaleString()}`} t={t}>
          <StepSection
            userId={userId}
            stepTarget={profile.stepTarget ?? 8000}
            currentWeight={profile.currentWeight ?? 70}
            height={profile.height ?? 170}
            sex={profile.sex ?? "male"}
            age={profile.age ?? 30}
            accentColor={accentColor}
            authHeaders={authHeaders}
            t={t}
            readOnly={readOnly}
          />
        </Section>

        {/* Food log */}
        <Section title="Jurnal alimentar · azi" t={t}>
          <FoodSection
            userId={userId}
            dailyCalorieTarget={profile.dailyCalories ?? 1600}
            accentColor={accentColor}
            authHeaders={authHeaders}
            t={t}
            readOnly={readOnly}
          />
        </Section>

        {/* Penalties */}
        <PenaltySection userId={userId} accentColor={accentColor} authHeaders={authHeaders} t={t} />

        {/* Evolution charts */}
        {(history.length > 0 || activityHistory.length > 0) && (
          <Section title="Evoluție" t={t}>
            <EvolutionSection
              weightHistory={history}
              activityHistory={activityHistory}
              targetWeight={profile.targetWeight ?? 70}
              stepTarget={profile.stepTarget ?? 8000}
              accentColor={accentColor}
              t={t}
            />
          </Section>
        )}

        {/* Daily Forecast */}
        <Section title="Analizează ziua de azi" t={t} defaultOpen={false}>
          <DailyForecastSection
            userId={userId}
            accentColor={accentColor}
            authHeaders={authHeaders}
            t={t}
          />
        </Section>

        {/* Health Chat */}
        <Section title="💬 Antrenor AI personal" t={t} defaultOpen={false}>
          <HealthChatSection
            userId={userId}
            accentColor={accentColor}
            authHeaders={authHeaders}
            t={t}
          />
        </Section>

        {/* AI Pattern Analysis */}
        <Section
          title="Analiză AI — ce funcționează pentru tine"
          t={t}
          defaultOpen={false}
        >
          <PatternInsightsSection
            userId={userId}
            accentColor={accentColor}
            authHeaders={authHeaders}
            t={t}
            currentWeight={history.length > 0 ? history[history.length - 1].weight : (profile?.currentWeight ?? 80)}
            height={profile?.height ?? 170}
            sex={profile?.sex ?? "male"}
            age={profile?.age ?? 30}
          />
        </Section>

        {/* AI Meal Plan */}
        <Section
          title={`Plan alimentar${rec?.date ? ` — ${rec.date}` : " — azi"}`}
          t={t}
          defaultOpen={false}
          right={!readOnly ? (
            <button onClick={generateRec} disabled={generatingRec}
              style={{ fontSize: 10, padding: "4px 10px", background: t.purpleBg, border: `1px solid ${accentColor}44`, borderRadius: 6, color: accentColor, cursor: "pointer", opacity: generatingRec ? 0.6 : 1 }}
            >
              {generatingRec ? "⏳ Claude..." : rec ? "🔄" : "✨ Generează"}
            </button>
          ) : undefined}
        >
          {!rec && !generatingRec && (
            <div style={{ textAlign: "center", padding: "20px 0", color: t.t7, fontSize: 13 }}>
              🍽 Apasă ✨ pentru planul de azi
            </div>
          )}
          {generatingRec && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ color: "#7c3aed", fontSize: 12 }}>🤖 Claude creează planul perfect...</p>
            </div>
          )}
          {rec && !generatingRec && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: t.t4, marginBottom: 4, flexWrap: "wrap" }}>
                <span>🔥 {rec.totalCalories} kcal</span>
                <span>💧 {rec.waterLiters}L</span>
                <span>🌾 {rec.carbsGrams}g carbs</span>
              </div>
              <MealCard label="Mic dejun" emoji="🌅" meal={rec.breakfast} t={t} />
              <MealCard label="Prânz" emoji="☀️" meal={rec.lunch} t={t} />
              <MealCard label="Cină" emoji="🌙" meal={rec.dinner} t={t} />
              {rec.snack && <MealCard label="Gustare" emoji="🍎" meal={rec.snack} t={t} />}
              {rec.motivationalTip && (
                <p style={{ fontSize: 11, color: "#7c5fc0", fontStyle: "italic", margin: "4px 0 0", padding: "10px 12px", background: t.purpleBg2, borderRadius: 8, lineHeight: 1.6 }}>
                  💜 {rec.motivationalTip}
                </p>
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ── Daily Forecast ────────────────────────────────────────────────────────────

interface ForecastMeal { when: string; suggestion: string; calories: number; tip: string; }
interface DailyForecast {
  summary: string;
  stepsLeft: number;
  caloriesLeft: number;
  caloriesBurned: number;
  movement: { activity: string; duration: string; why: string; };
  meals: ForecastMeal[];
  warning: string | null;
  motivation: string;
}

function DailyForecastSection({
  userId, accentColor, authHeaders, t,
}: { userId: string; accentColor: string; authHeaders: Record<string, string>; t: HT; }) {
  const [forecast, setForecast] = useState<DailyForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/health/forecast/${userId}`, { method: "POST", headers: authHeaders });
      const data = await res.json() as { forecast?: DailyForecast; error?: string };
      if (!res.ok || !data.forecast) { setError(data.error ?? "Eroare la analiză"); }
      else setForecast(data.forecast);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {!forecast && !loading && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <p style={{ color: t.t4, fontSize: 13, marginBottom: 14 }}>
            Analizez ultimele 14 zile și îți spun exact ce să faci azi pentru a slăbi cât mai eficient.
          </p>
          <button onClick={analyze}
            style={{ padding: "12px 28px", background: accentColor, border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em" }}
          >
            🔍 Analizează
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "28px 0" }}>
          <p style={{ color: accentColor, fontSize: 13 }}>🧠 Analizez istoricul și calculez planul optim pentru azi...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 12px", background: t.redBg, border: `1px solid ${t.redBdr}`, borderRadius: 8, fontSize: 12, color: "#f87171" }}>
          {error}
        </div>
      )}

      {forecast && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Summary */}
          <div style={{ padding: "12px 14px", background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 10 }}>
            <p style={{ fontSize: 13, color: t.t2, margin: 0, lineHeight: 1.6 }}>{forecast.summary}</p>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[
              { label: "Pași rămași", value: (forecast.stepsLeft ?? 0).toLocaleString(), unit: "pași", color: "#3b82f6" },
              { label: "Calorii rămase", value: forecast.caloriesLeft ?? 0, unit: "kcal", color: "#10b981" },
              { label: "Arși până acum", value: forecast.caloriesBurned ?? 0, unit: "kcal", color: accentColor },
            ].map((s) => (
              <div key={s.label} style={{ padding: "10px", background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: t.t4, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: t.t5 }}>{s.unit}</div>
              </div>
            ))}
          </div>

          {/* Movement */}
          <div style={{ padding: "10px 12px", background: t.greenBg, border: `1px solid ${t.greenBdr}`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#4ade80", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Mișcare recomandată azi</div>
            <div style={{ fontSize: 13, color: t.t1, fontWeight: 600 }}>{forecast.movement.activity} · {forecast.movement.duration}</div>
            <div style={{ fontSize: 11, color: t.t3, marginTop: 3 }}>{forecast.movement.why}</div>
          </div>

          {/* Meals */}
          {forecast.meals.length > 0 && (
            <div style={{ padding: "10px 12px", background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.t4, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ce să mănânci azi</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {forecast.meals.map((meal, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 10, color: accentColor, fontWeight: 600, minWidth: 48, marginTop: 2 }}>{meal.when}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: t.t2, fontWeight: 500 }}>{meal.suggestion}</div>
                      {meal.tip && <div style={{ fontSize: 11, color: t.t4, marginTop: 2 }}>{meal.tip}</div>}
                    </div>
                    <div style={{ fontSize: 11, color: t.t4, whiteSpace: "nowrap" }}>{meal.calories} kcal</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          {forecast.warning && (
            <div style={{ padding: "10px 12px", background: t.yellowBg, border: `1px solid #78350f44`, borderRadius: 10, fontSize: 12, color: "#fbbf24" }}>
              ⚠️ {forecast.warning}
            </div>
          )}

          {/* Motivation */}
          <div style={{ padding: "10px 12px", background: t.purpleBg2, border: `1px solid ${accentColor}22`, borderRadius: 10, fontSize: 12, color: t.t3, fontStyle: "italic", lineHeight: 1.6 }}>
            💜 {forecast.motivation}
          </div>

          <button onClick={analyze} disabled={loading}
            style={{ alignSelf: "flex-end", fontSize: 10, padding: "5px 12px", background: "transparent", border: `1px solid ${t.b2}`, borderRadius: 6, color: t.t4, cursor: "pointer" }}
          >
            🔄 Reanalizeaz&#259;
          </button>
        </div>
      )}
    </div>
  );
}

// ── Health Chat ────────────────────────────────────────────────────────────────

interface HealthChatMsg { role: "user" | "assistant"; content: string; }

function HealthChatSection({
  userId, accentColor, authHeaders, t,
}: { userId: string; accentColor: string; authHeaders: Record<string, string>; t: HT; }) {
  const [messages, setMessages] = useState<HealthChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const userMsg: HealthChatMsg = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setSending(true);
    try {
      const res = await fetch(`/api/admin/health/chat/${userId}`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      if (data.reply) setMessages((prev) => [...prev, { role: "assistant", content: data.reply! }]);
      else setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${data.error ?? "Eroare"}` }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${err instanceof Error ? err.message : String(err)}` }]);
    }
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const SUGGESTIONS = [
    "Ce ar trebui să mănânc azi ca să slăbesc?",
    "Câte calorii ard dacă merg 10.000 de pași?",
    "De ce staghez? Ce fac greșit?",
    "Ce exerciții să fac dacă am 30 min liber?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, border: `1px solid ${t.b1}`, borderRadius: 12, overflow: "hidden" }}>
      {/* Messages */}
      <div style={{ minHeight: 200, maxHeight: 380, overflowY: "auto", padding: "14px 14px 10px", display: "flex", flexDirection: "column", gap: 10, background: t.bg }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 12, color: t.t4, textAlign: "center", margin: "20px 0 12px" }}>
              🏋️ Antrenor personal AI — bazat pe datele tale reale
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                  style={{ padding: "8px 12px", background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 8, color: t.t3, fontSize: 12, cursor: "pointer", textAlign: "left", transition: "border-color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = accentColor + "88")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.b1)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%", padding: "9px 12px", borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
              background: msg.role === "user" ? accentColor : t.s1,
              border: msg.role === "assistant" ? `1px solid ${t.b1}` : "none",
              fontSize: 13, color: msg.role === "user" ? "#fff" : t.t2, lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div style={{ padding: "9px 14px", background: t.s1, border: `1px solid ${t.b1}`, borderRadius: "12px 12px 12px 3px", fontSize: 13, color: t.t4 }}>
              <span style={{ display: "inline-flex", gap: 3 }}>
                {[0, 1, 2].map((j) => (
                  <span key={j} style={{ width: 5, height: 5, borderRadius: "50%", background: t.t4, display: "inline-block", animation: `pulse 1.2s ${j * 0.2}s infinite` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${t.b1}`, background: t.s1 }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Întreabă ceva despre nutriție, sport, greutate..."
          rows={2}
          style={{
            flex: 1, padding: "10px 12px", background: "transparent", border: "none", outline: "none",
            color: t.t1, fontSize: 13, resize: "none", lineHeight: 1.5, fontFamily: "inherit",
          }}
        />
        <button
          onClick={() => void send()}
          disabled={!input.trim() || sending}
          style={{
            padding: "0 16px", background: input.trim() && !sending ? accentColor : t.b1,
            border: "none", color: input.trim() && !sending ? "#fff" : t.t5,
            fontSize: 18, cursor: input.trim() && !sending ? "pointer" : "default",
            transition: "background 0.15s, color 0.15s", flexShrink: 0,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ── Pattern Insights ──────────────────────────────────────────────────────────

interface PatternItem { pattern: string; impact: string; emoji: string; }
interface PatternInsights {
  weeklyChange: number;
  monthlyChange: number;
  direction: "losing" | "stalling" | "gaining";
  positivePatterns: PatternItem[];
  negativePatterns: PatternItem[];
  todayRecommendation: string;
  keyInsight: string;
  dataPoints: number;
}

function stepsToKcal(steps: number, weightKg: number, heightCm: number, sex: "male" | "female", age: number): number {
  // Step length: validated gender factors (Tudor-Locke & Bassett), shortened after 60
  const genderFactor = sex === "male" ? 0.415 : 0.413;
  const ageFactor = age > 60 ? Math.max(0.88, 1 - (age - 60) * 0.005) : 1.0;
  const stepLengthM = (heightCm / 100) * genderFactor * ageFactor;

  // Estimated speed: 100 steps/min cadence × step length
  const speedKmH = stepLengthM * 100 * 0.06;

  // MET from Ainsworth Compendium 2011 (walking, flat terrain)
  const met = speedKmH < 4.0 ? 2.8 : speedKmH < 5.0 ? 3.5 : speedKmH < 6.0 ? 4.3 : 5.0;

  // Gross kcal = MET × weight(kg) × time(h), assuming 100 steps/min
  return Math.round(met * weightKg * (steps / 6000));
}

function PatternInsightsSection({
  userId, accentColor, authHeaders, t, currentWeight, height, sex, age,
}: {
  userId: string; accentColor: string; authHeaders: Record<string, string>; t: HT; currentWeight: number; height: number; sex: "male" | "female"; age: number;
}) {
  const [patterns, setPatterns] = useState<PatternInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchPatterns = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (!force) {
        const cacheRes = await fetch(`/api/admin/health/patterns/${userId}`, { headers: authHeaders });
        if (cacheRes.ok) {
          const cacheData = await cacheRes.json() as { patterns: PatternInsights | null; stale?: boolean };
          if (cacheData.patterns && !cacheData.stale) {
            setPatterns(cacheData.patterns);
            setStale(false);
            setLoaded(true);
            setLoading(false);
            return;
          }
          if (cacheData.patterns) setPatterns(cacheData.patterns);
          if (cacheData.stale) setStale(true);
        }
      }
      const res = await fetch(`/api/admin/health/patterns/${userId}`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json() as { patterns?: PatternInsights; error?: string };
      if (!res.ok || !data.patterns) { setError(data.error ?? "Eroare la analiză"); setLoading(false); return; }
      setPatterns(data.patterns);
      setStale(false);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  }, [userId, authHeaders]);

  useEffect(() => {
    fetch(`/api/admin/health/patterns/${userId}`, { headers: authHeaders })
      .then((r) => r.json() as Promise<{ patterns: PatternInsights | null; stale?: boolean }>)
      .then((data) => {
        if (data.patterns) { setPatterns(data.patterns); setStale(!!data.stale); setLoaded(true); }
      }).catch(() => {});
  }, [userId, authHeaders]);

  const directionColor = patterns?.direction === "losing" ? "#4ade80"
    : patterns?.direction === "gaining" ? "#f87171" : "#fbbf24";
  const directionLabel = patterns?.direction === "losing" ? "Scazi în greutate 🎯"
    : patterns?.direction === "gaining" ? "Câștigi în greutate ⚠️" : "Stagnare — ajustare necesară ⚡";

  const kcalPer1000 = stepsToKcal(1000, currentWeight, height, sex, age);
  const kcalPer8000 = stepsToKcal(8000, currentWeight, height, sex, age);
  const grPer8000 = (kcalPer8000 / 7700 * 1000).toFixed(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Steps calorie info */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { label: "1.000 pași", kcal: kcalPer1000 },
          { label: "8.000 pași", kcal: kcalPer8000 },
          { label: "8.000 pași/zi = grăsime", value: `~${grPer8000}g/zi` },
        ].map((item) => (
          <div key={item.label} style={{ flex: "1 1 100px", padding: "8px 10px", background: t.s1, border: `1px solid ${t.b1}`, borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: t.t4, marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: accentColor }}>
              {"value" in item ? item.value : `~${item.kcal} kcal`}
            </div>
          </div>
        ))}
      </div>

      {/* Analysis section */}
      {!loaded && !loading && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <p style={{ color: t.t4, fontSize: 13, marginBottom: 12 }}>
            🤖 Analizez pattern-urile din datele tale pentru a găsi ce funcționează cel mai bine.
          </p>
          <button onClick={() => fetchPatterns(false)}
            style={{ padding: "10px 24px", background: accentColor, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            ✨ Analizează acum
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <p style={{ color: accentColor, fontSize: 13 }}>🧠 Claude analizează {patterns?.dataPoints ?? "..."} zile de date...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 12px", background: t.redBg, border: `1px solid ${t.redBdr}`, borderRadius: 8, fontSize: 12, color: "#f87171" }}>
          {error}
        </div>
      )}

      {patterns && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Trend */}
          <div style={{ padding: "12px 14px", background: t.s1, border: `1px solid ${directionColor}33`, borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: directionColor }}>{directionLabel}</span>
              <span style={{ fontSize: 10, color: t.t4 }}>{patterns.dataPoints} zile analizate</span>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "7 zile", val: patterns.weeklyChange },
                { label: "30 zile", val: patterns.monthlyChange },
              ].map(({ label, val }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: t.t4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: val < 0 ? "#4ade80" : val > 0 ? "#f87171" : "#fbbf24" }}>
                    {val > 0 ? "+" : ""}{typeof val === "number" ? val.toFixed(2) : val} kg
                  </div>
                </div>
              ))}
            </div>
            {patterns.keyInsight && (
              <p style={{ fontSize: 11, color: t.t3, fontStyle: "italic", margin: "8px 0 0", lineHeight: 1.5 }}>
                💡 {patterns.keyInsight}
              </p>
            )}
          </div>

          {/* Positive patterns */}
          {patterns.positivePatterns.length > 0 && (
            <div style={{ padding: "10px 12px", background: t.greenBg, border: `1px solid ${t.greenBdr}`, borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#4ade80", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Ce funcționează ✓
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {patterns.positivePatterns.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{p.emoji}</span>
                    <div>
                      <div style={{ fontSize: 12, color: t.t2, fontWeight: 500 }}>{p.pattern}</div>
                      <div style={{ fontSize: 11, color: "#4ade80" }}>{p.impact}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Negative patterns */}
          {patterns.negativePatterns.length > 0 && (
            <div style={{ padding: "10px 12px", background: t.redBg, border: `1px solid ${t.redBdr}`, borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#f87171", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Ce frânează progresul ✗
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {patterns.negativePatterns.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{p.emoji}</span>
                    <div>
                      <div style={{ fontSize: 12, color: t.t2, fontWeight: 500 }}>{p.pattern}</div>
                      <div style={{ fontSize: 11, color: "#f87171" }}>{p.impact}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today recommendation */}
          {patterns.todayRecommendation && (
            <div style={{ padding: "10px 12px", background: t.purpleBg2, border: `1px solid ${accentColor}33`, borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: accentColor, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Recomandare pentru mâine
              </div>
              <p style={{ fontSize: 12, color: t.t2, margin: 0, lineHeight: 1.6 }}>{patterns.todayRecommendation}</p>
            </div>
          )}

          <button onClick={() => fetchPatterns(true)} disabled={loading}
            style={{ alignSelf: "flex-end", fontSize: 10, padding: "5px 12px", background: "transparent", border: `1px solid ${t.b2}`, borderRadius: 6, color: t.t4, cursor: "pointer" }}
          >
            {stale ? "⚠ Date vechi — " : ""}🔄 Reanalizeaz&#259;
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HealthTrackerPage() {
  const { auth } = useAuth();
  const visibleUsers = USERS;
  const authHeaders: Record<string, string> = auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {};

  const [isLight, setIsLight] = useState<boolean>(() => {
    try { return localStorage.getItem("health-theme") === "light"; } catch { return false; }
  });

  const toggleTheme = () => {
    setIsLight((v) => {
      const next = !v;
      try { localStorage.setItem("health-theme", next ? "light" : "dark"); } catch { /* noop */ }
      return next;
    });
  };

  const t = isLight ? LIGHT : DARK;

  if (auth.loading) return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: t.t4, fontSize: 14 }}>Se încarcă...</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.t1, padding: "20px 24px 80px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <Breadcrumb />
        <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: isLight ? "#fde8e8" : "#1a0808", border: `1px solid ${isLight ? "#fca5a5" : "#3a0f0f"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: t.t1 }}>Health Tracker</h1>
            <p style={{ fontSize: 12, color: t.t4, marginTop: 2, margin: 0 }}>
              Greutate · BMI · Pași · Jurnal alimentar AI — fără gluten · low carb
            </p>
          </div>
          <button
            onClick={toggleTheme}
            title={isLight ? "Comută la dark" : "Comută la light"}
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: t.s1, border: `1px solid ${t.b2}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 18, flexShrink: 0,
              transition: "background 0.2s",
            }}
          >
            {isLight ? "🌙" : "☀️"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          {visibleUsers.map((user) => (
            <ProfilePanel
              key={user.id}
              userId={user.id}
              defaultName={user.defaultName}
              emoji={user.emoji}
              accentColor={user.color}
              authHeaders={authHeaders}
              t={t}
              readOnly={auth.user?.email !== user.email}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
