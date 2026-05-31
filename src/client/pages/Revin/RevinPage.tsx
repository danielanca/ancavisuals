import React, { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "av:revin";

interface RevinState {
  message: string;
  minutes: number;
  endsAt: number | null; // timestamp ms
}

function loadState(): RevinState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as RevinState;
  } catch { /* ignore */ }
  return { message: "Nu atingeți fotocabina — poate să curenteze! 😅⚡ Operatorul revine imediat, promitem!", minutes: 5, endsAt: null };
}

function saveState(s: RevinState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function fmtTime(secs: number): string {
  if (secs <= 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function RevinPage() {
  const [state, setState] = useState<RevinState>(loadState);
  const [mode, setMode] = useState<"edit" | "display">(() => {
    const s = loadState();
    return s.endsAt && s.endsAt > Date.now() ? "display" : "edit";
  });
  const [remaining, setRemaining] = useState(0);
  const [draftMessage, setDraftMessage] = useState(loadState().message);
  const [draftMinutes, setDraftMinutes] = useState(String(loadState().minutes));
  const [done, setDone] = useState(false);

  // Long-press to exit display mode
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressProgress, setPressProgress] = useState(0);
  const pressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown tick
  useEffect(() => {
    if (mode !== "display") return;
    const tick = () => {
      const secs = Math.max(0, Math.round(((state.endsAt ?? 0) - Date.now()) / 1000));
      setRemaining(secs);
      if (secs === 0) setDone(true);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [mode, state.endsAt]);

  // Block scroll + keep screen on (wake lock)
  useEffect(() => {
    if (mode !== "display") return;
    document.body.style.overflow = "hidden";
    let wakeLock: WakeLockSentinel | null = null;
    if ("wakeLock" in navigator) {
      (navigator.wakeLock as WakeLock).request("screen").then((wl) => { wakeLock = wl; }).catch(() => {});
    }
    return () => {
      document.body.style.overflow = "";
      wakeLock?.release().catch(() => {});
    };
  }, [mode]);

  const startDisplay = () => {
    const mins = Math.max(1, Math.min(60, Number(draftMinutes) || 5));
    const endsAt = Date.now() + mins * 60 * 1000;
    const next: RevinState = { message: draftMessage.trim() || "Revenim în curând!", minutes: mins, endsAt };
    setState(next);
    saveState(next);
    setDone(false);
    setMode("display");
  };

  const stopDisplay = useCallback(() => {
    const next: RevinState = { ...state, endsAt: null };
    setState(next);
    saveState(next);
    setDraftMessage(next.message);
    setDraftMinutes(String(next.minutes));
    setMode("edit");
    setPressProgress(0);
  }, [state]);

  const handlePointerDown = () => {
    let progress = 0;
    pressInterval.current = setInterval(() => {
      progress += 100 / 30; // 3 secunde = 30 ticks × 100ms
      setPressProgress(Math.min(100, progress));
      if (progress >= 100) {
        clearInterval(pressInterval.current!);
        stopDisplay();
      }
    }, 100);
    pressTimer.current = setTimeout(() => {}, 3000);
  };

  const handlePointerUp = () => {
    if (pressInterval.current) clearInterval(pressInterval.current);
    if (pressTimer.current) clearTimeout(pressTimer.current);
    setPressProgress(0);
  };

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (mode === "edit") {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <p className="text-4xl mb-3">📸</p>
            <h1 className="text-white text-2xl font-light tracking-tight">Pauză fotocabină</h1>
            <p className="text-neutral-500 text-sm mt-1">Configurează mesajul afișat pe ecran</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-neutral-400 text-xs font-medium uppercase tracking-wide mb-1.5">
                Mesaj afișat
              </label>
              <textarea
                className="w-full bg-neutral-900 text-white text-sm border border-neutral-700 rounded-xl px-4 py-3 outline-none focus:border-violet-500 transition-colors resize-none placeholder-neutral-600"
                rows={3}
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder="Ne-am dus după o cafea..."
              />
            </div>

            <div>
              <label className="block text-neutral-400 text-xs font-medium uppercase tracking-wide mb-1.5">
                Timp de pauză (minute)
              </label>
              <div className="flex items-center gap-3">
                {[3, 5, 10, 15, 20].map((m) => (
                  <button
                    key={m}
                    onClick={() => setDraftMinutes(String(m))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      draftMinutes === String(m)
                        ? "bg-violet-600 text-white"
                        : "bg-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="w-24 bg-neutral-900 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-violet-500 transition-colors"
                  value={draftMinutes}
                  onChange={(e) => setDraftMinutes(e.target.value)}
                />
                <span className="text-neutral-500 text-sm">minute personalizat</span>
              </div>
            </div>

            <button
              onClick={startDisplay}
              className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-base font-semibold transition-colors"
            >
              Pornește ecranul de pauză
            </button>
          </div>

          <p className="text-center text-neutral-700 text-xs">
            Pentru a ieși din ecranul de pauză, ține apăsat pe ecran 3 secunde.
          </p>
        </div>
      </div>
    );
  }

  // ── Display mode ───────────────────────────────────────────────────────────
  const pct = state.endsAt
    ? Math.max(0, (((state.endsAt ?? 0) - Date.now()) / ((state.minutes ?? 5) * 60 * 1000)) * 100)
    : 0;

  return (
    <div
      className="min-h-screen bg-neutral-950 flex flex-col items-center justify-between pt-6 pb-8 px-4 select-none cursor-default"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => { if (e.button !== 2) e.preventDefault(); }}
    >
      {/* Top spacer */}
      <div />

      {/* Center: ring + message */}
      <div className="flex flex-col items-center gap-8">
        {/* Progress ring */}
        <div className="relative">
          <svg width="200" height="200" className="-rotate-90">
            <circle cx="100" cy="100" r="88" fill="none" stroke="#262626" strokeWidth="8" />
            <circle
              cx="100" cy="100" r="88" fill="none"
              stroke={done ? "#22c55e" : "#7c3aed"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 88}`}
              strokeDashoffset={`${2 * Math.PI * 88 * (done ? 0 : (1 - pct / 100))}`}
              style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.5s" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {done ? (
              <span className="text-5xl">✅</span>
            ) : (
              <>
                <span className="text-5xl font-light tabular-nums text-white tracking-tight">
                  {fmtTime(remaining)}
                </span>
                <span className="text-neutral-500 text-xs mt-1 uppercase tracking-widest">rămase</span>
              </>
            )}
          </div>
        </div>

        {/* Icon + message */}
        <div className="text-center max-w-sm space-y-3">
          {done ? (
            <div className="space-y-4 text-center max-w-xs">
              <p className="text-5xl">😅</p>
              <p className="text-white text-xl font-semibold leading-snug">
                Operatorul e un pic cam nesimțit și întârzie...
              </p>
              <div className="rounded-2xl px-5 py-4 space-y-2" style={{background: "linear-gradient(135deg, #1e0a3c, #2d1060)", border: "1px solid rgba(139,92,246,0.3)"}}>
                <p className="text-violet-300 text-xs font-semibold uppercase tracking-widest">💡 Curiozitate foto</p>
                <p className="text-neutral-200 text-sm leading-relaxed">
                  Prima fotografie din lume a fost făcută în <span className="text-violet-300 font-semibold">1826</span> și a necesitat o expunere de <span className="text-violet-300 font-semibold">8 ore</span>.
                </p>
                <p className="text-neutral-500 text-xs">Noi livrăm în 30 de zile — mult mai rapizi! 📷</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-5xl">☕</p>
              <p className="text-white text-4xl font-light leading-snug">{state.message}</p>
            </>
          )}
        </div>
      </div>

      {/* Bottom: promo card */}
      <div className="w-full max-w-md">
        <div className="rounded-3xl overflow-hidden" style={{background: "linear-gradient(135deg, #1e0a3c 0%, #2d1060 50%, #1a0a2e 100%)", border: "1px solid rgba(139,92,246,0.35)"}}>
          <div className="px-6 py-5 text-center space-y-3">
            <div className="flex justify-center gap-3 text-2xl">
              <span>📸</span><span>🎬</span><span>🪄</span>
            </div>
            <p className="text-white text-lg font-semibold leading-snug">
              Vrei amintiri ca la carte<br/>
              <span style={{background: "linear-gradient(90deg, #a78bfa, #e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"}}>
                la evenimentul tău?
              </span>
            </p>
            <p className="text-neutral-300 text-sm leading-relaxed">
              Foto · Video · Fotocabină · VideoBooth 360°
            </p>
            <p className="text-violet-300 text-sm font-medium">
              Întreabă operatorul când se întoarce 😊
            </p>
            <p className="text-neutral-400 text-xs">
              sau intră pe{" "}
              <span className="text-violet-300 font-medium">instagram.com/<strong>anca</strong>visuals</span>
            </p>
            <p className="text-neutral-600 text-xs tracking-widest uppercase">Anca Visuals</p>
          </div>
        </div>
      </div>

      {/* Long-press indicator */}
      {pressProgress > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <div className="h-1 w-32 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-500 rounded-full transition-none"
              style={{ width: `${pressProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
