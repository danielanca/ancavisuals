import React, { useEffect, useState, useCallback } from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthProfile {
  id?: string;
  name: string;
  height: number;
  targetWeight: number;
  dailyCalories: number;
}

interface WeightEntry {
  date: string;
  weight: number;
}

interface MealItem {
  name: string;
  ingredients: string;
  calories: number;
  prepTime?: string;
  tip?: string;
}

interface Recommendation {
  breakfast: MealItem;
  lunch: MealItem;
  dinner: MealItem;
  snack?: MealItem;
  totalCalories: number;
  waterLiters: number;
  motivationalTip: string;
  carbsGrams: number;
  date: string;
}

const USERS = [
  { id: "daniel", defaultName: "Daniel", emoji: "👨", color: "#c9a96e" },
  { id: "estera", defaultName: "Estera", emoji: "👩", color: "#e879f9" },
];

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

// ── Weight Chart ──────────────────────────────────────────────────────────────

function WeightChart({ entries, targetWeight, accentColor }: { entries: WeightEntry[]; targetWeight: number; accentColor: string }) {
  if (entries.length < 2) return (
    <p style={{ textAlign: "center", color: "#333", fontSize: 12, padding: "24px 0" }}>
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
      {[0, 0.5, 1].map((t) => {
        const w = minW + t * (maxW - minW);
        const y = yOf(w);
        return <g key={t}><line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#1a1a1a" strokeWidth="1" /><text x={pad.left - 3} y={y + 4} fill="#444" fontSize="8" textAnchor="end">{w.toFixed(1)}</text></g>;
      })}
      <line x1={pad.left} y1={tY} x2={W - pad.right} y2={tY} stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.6" />
      <polyline fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinejoin="round" points={points} />
      {sorted.map((e, i) => <circle key={e.date} cx={xOf(i)} cy={yOf(e.weight)} r="3" fill={accentColor} />)}
      <text x={xOf(0)} y={H - 4} fill="#444" fontSize="8" textAnchor="middle">{sorted[0].date.slice(5)}</text>
      <text x={xOf(sorted.length - 1)} y={H - 4} fill="#444" fontSize="8" textAnchor="middle">{sorted[sorted.length - 1].date.slice(5)}</text>
    </svg>
  );
}

// ── Meal Card ─────────────────────────────────────────────────────────────────

function MealCard({ label, emoji, meal }: { label: string; emoji: string; meal: MealItem }) {
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em" }}>{emoji} {label}</span>
        <span style={{ fontSize: 11, color: "#c9a96e", fontWeight: 700 }}>{meal.calories} kcal</span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#eee", margin: "0 0 3px" }}>{meal.name}</p>
      <p style={{ fontSize: 11, color: "#555", margin: 0, lineHeight: 1.5 }}>{meal.ingredients}</p>
      {meal.prepTime && <p style={{ fontSize: 10, color: "#444", marginTop: 4 }}>⏱ {meal.prepTime}</p>}
      {meal.tip && <p style={{ fontSize: 10, color: "#7c5fc0", marginTop: 4, fontStyle: "italic" }}>💡 {meal.tip}</p>}
    </div>
  );
}

// ── Profile Panel ─────────────────────────────────────────────────────────────

function ProfilePanel({
  userId, defaultName, emoji, accentColor, authHeaders,
}: {
  userId: string; defaultName: string; emoji: string; accentColor: string;
  authHeaders: Record<string, string>;
}) {
  const jsonHeaders = { ...authHeaders, "Content-Type": "application/json" };
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [weightInput, setWeightInput] = useState("");
  const [loggingWeight, setLoggingWeight] = useState(false);
  const [generatingRec, setGeneratingRec] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<HealthProfile>>({});
  const [weightSaved, setWeightSaved] = useState(false);

  const load = useCallback(async () => {
    const [profRes, wRes, rRes] = await Promise.all([
      fetch("/api/admin/health/profiles", { headers: authHeaders }),
      fetch(`/api/admin/health/weight/${userId}`, { headers: authHeaders }),
      fetch(`/api/admin/health/recommend/${userId}`, { headers: authHeaders }),
    ]);
    const profData = await profRes.json() as { profiles: Record<string, HealthProfile> };
    const wData = await wRes.json() as { entries: WeightEntry[] };
    const rData = await rRes.json() as { recommendation: Recommendation | null };
    setProfile(profData.profiles?.[userId] ?? null);
    setHistory(wData.entries ?? []);
    setRec(rData.recommendation);
    setLoading(false);
  }, [userId, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const logWeight = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 20 || w > 300) return;
    setLoggingWeight(true);
    await fetch(`/api/admin/health/weight/${userId}`, {
      method: "POST", headers: jsonHeaders,
      body: JSON.stringify({ weight: w }),
    });
    setWeightInput("");
    setWeightSaved(true);
    setTimeout(() => setWeightSaved(false), 2500);
    await load();
    setLoggingWeight(false);
  };

  const generateRec = async () => {
    setGeneratingRec(true);
    const res = await fetch(`/api/admin/health/recommend/${userId}`, {
      method: "POST", headers: jsonHeaders,
    });
    const data = await res.json() as { recommendation: Recommendation };
    setRec(data.recommendation);
    setGeneratingRec(false);
  };

  const saveProfile = async () => {
    await fetch(`/api/admin/health/profiles/${userId}`, {
      method: "PUT", headers: jsonHeaders,
      body: JSON.stringify({ name: profileForm.name ?? defaultName, ...profileForm }),
    });
    await load();
    setShowProfileEdit(false);
  };

  const latestWeight = history.length > 0 ? history[0].weight : null;
  const bmi = latestWeight && profile?.height ? calcBMI(latestWeight, profile.height) : null;
  const bmi_ = bmi ? bmiInfo(bmi) : null;
  const tolose = latestWeight && profile?.targetWeight ? latestWeight - profile.targetWeight : null;
  const name = profile?.name ?? defaultName;

  return (
    <div style={{ background: "#0a0a0a", border: `1px solid ${accentColor}22`, borderRadius: 16, overflow: "hidden", flex: "1 1 340px", minWidth: 0 }}>
      {/* Profile header */}
      <div style={{ background: `linear-gradient(135deg, ${accentColor}18, transparent)`, borderBottom: `1px solid ${accentColor}22`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>{emoji}</span>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>{name}</p>
            {profile?.height && <p style={{ fontSize: 11, color: "#555", margin: 0 }}>{profile.height} cm</p>}
          </div>
        </div>
        <button onClick={() => { setShowProfileEdit((v) => !v); setProfileForm({ name, height: profile?.height, targetWeight: profile?.targetWeight, dailyCalories: profile?.dailyCalories ?? 1600 }); }}
          style={{ fontSize: 11, color: "#555", background: "none", border: "1px solid #222", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
        >
          ⚙
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#333", fontSize: 13 }}>Se încarcă...</div>
      ) : (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Profile edit */}
          {showProfileEdit && (
            <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {([
                  { key: "name", label: "Nume", type: "text" },
                  { key: "height", label: "Înălțime (cm)", type: "number" },
                  { key: "targetWeight", label: "Țintă (kg)", type: "number" },
                  { key: "dailyCalories", label: "Calorii/zi", type: "number" },
                ] as const).map((f) => (
                  <div key={f.key}>
                    <label style={{ fontSize: 10, color: "#555", display: "block", marginBottom: 3 }}>{f.label}</label>
                    <input type={f.type} value={(profileForm[f.key] as string | number) ?? ""}
                      onChange={(e) => setProfileForm((p) => ({ ...p, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                      style={{ width: "100%", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 6, padding: "6px 10px", color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveProfile}
                  style={{ flex: 1, padding: "7px 0", background: accentColor, border: "none", borderRadius: 7, color: "#0a0a0a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >Salvează</button>
                <button onClick={() => setShowProfileEdit(false)}
                  style={{ padding: "7px 14px", background: "none", border: "1px solid #222", borderRadius: 7, color: "#666", fontSize: 12, cursor: "pointer" }}
                >✕</button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Greutate", value: latestWeight ? `${latestWeight} kg` : "—", color: "#f0f0f0" },
              { label: "Țintă", value: profile?.targetWeight ? `${profile.targetWeight} kg` : "—", color: accentColor },
              { label: "De slăbit", value: tolose !== null ? (tolose > 0 ? `${tolose.toFixed(1)} kg` : "✓ Atins!") : "—", color: tolose !== null && tolose <= 0 ? "#4ade80" : "#fb923c" },
              { label: "BMI", value: bmi && bmi_ ? `${bmi.toFixed(1)} — ${bmi_.label}` : "—", color: bmi_?.color ?? "#888" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#111", borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>{s.label}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Log weight */}
          <div>
            <p style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Greutate azi</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" step="0.1" value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") logWeight(); }}
                placeholder="ex: 82.5 kg"
                style={{ flex: 1, background: "#111", border: `1px solid ${weightSaved ? "#4ade80" : "#222"}`, borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 14, outline: "none", transition: "border-color 0.3s" }}
              />
              <button onClick={logWeight} disabled={loggingWeight || !weightInput}
                style={{ padding: "8px 14px", background: weightInput ? accentColor : "#111", border: "none", borderRadius: 8, color: weightInput ? "#0a0a0a" : "#444", fontSize: 13, fontWeight: 700, cursor: weightInput ? "pointer" : "default", transition: "all 0.15s" }}
              >
                {loggingWeight ? "..." : weightSaved ? "✓" : "↵"}
              </button>
            </div>
          </div>

          {/* Chart */}
          {history.length > 0 && (
            <div>
              <p style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Evoluție</p>
              <WeightChart entries={history} targetWeight={profile?.targetWeight ?? 70} accentColor={accentColor} />
            </div>
          )}

          {/* AI Recommendation */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                Plan alimentar {rec?.date ? `— ${rec.date}` : "— azi"}
              </p>
              <button onClick={generateRec} disabled={generatingRec}
                style={{ fontSize: 10, padding: "4px 10px", background: "#1a0a3a", border: `1px solid ${accentColor}44`, borderRadius: 6, color: accentColor, cursor: "pointer", opacity: generatingRec ? 0.6 : 1 }}
              >
                {generatingRec ? "⏳ Claude..." : rec ? "🔄" : "✨ Generează"}
              </button>
            </div>

            {!rec && !generatingRec && (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#2a2a2a", fontSize: 13 }}>
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
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#555", marginBottom: 4, flexWrap: "wrap" }}>
                  <span>🔥 {rec.totalCalories} kcal</span>
                  <span>💧 {rec.waterLiters}L</span>
                  <span>🌾 {rec.carbsGrams}g carbs</span>
                </div>
                <MealCard label="Mic dejun" emoji="🌅" meal={rec.breakfast} />
                <MealCard label="Prânz" emoji="☀️" meal={rec.lunch} />
                <MealCard label="Cină" emoji="🌙" meal={rec.dinner} />
                {rec.snack && <MealCard label="Gustare" emoji="🍎" meal={rec.snack} />}
                {rec.motivationalTip && (
                  <p style={{ fontSize: 11, color: "#7c5fc0", fontStyle: "italic", margin: "4px 0 0", padding: "10px 12px", background: "#0d0d1f", borderRadius: 8, lineHeight: 1.6 }}>
                    💜 {rec.motivationalTip}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HealthTrackerPage() {
  const { auth } = useAuth();
  const authHeaders: Record<string, string> = auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {};

  if (auth.loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#555", fontSize: 14 }}>Se încarcă...</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px 24px 80px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Breadcrumb />
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Health Tracker</h1>
          <p style={{ fontSize: 12, color: "#555", marginTop: 3 }}>Greutate · BMI · Plan alimentar AI — fără gluten · low carb · românesc</p>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          {USERS.map((u) => (
            <ProfilePanel
              key={u.id}
              userId={u.id}
              defaultName={u.defaultName}
              emoji={u.emoji}
              accentColor={u.color}
              authHeaders={authHeaders}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
