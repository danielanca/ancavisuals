import React, { useReducer, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import AncaLoader from "../../../components/UI/AncaLoader";

interface Memento {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  category: "ancavisuals" | "personal";
  completed: boolean;
  emailSent: boolean;
  reminderMinutesBefore: number;
  recurring: "none" | "weekly" | "monthly" | "yearly";
}

const RECURRING_LABELS: Record<string, string> = {
  none: "Niciodată", weekly: "Săptămânal", monthly: "Lunar", yearly: "Anual",
};

const REMINDER_OPTIONS = [
  { value: 0,     label: "La scadență" },
  { value: 30,    label: "30 minute înainte" },
  { value: 60,    label: "1 oră înainte" },
  { value: 120,   label: "2 ore înainte" },
  { value: 180,   label: "3 ore înainte" },
  { value: 360,   label: "6 ore înainte" },
  { value: 720,   label: "12 ore înainte" },
  { value: 1440,  label: "1 zi înainte" },
  { value: 2880,  label: "2 zile înainte" },
  { value: 4320,  label: "3 zile înainte" },
  { value: 10080, label: "1 săptămână înainte" },
];

function reminderLabel(minutes: number): string {
  const opt = REMINDER_OPTIONS.find((o) => o.value === minutes);
  if (opt) return opt.label;
  if (minutes < 60) return `-${minutes}min`;
  if (minutes < 1440) return `-${Math.round(minutes / 60)}h`;
  return `-${Math.round(minutes / 1440)}z`;
}

const CATEGORY_LABELS: Record<string, string> = {
  ancavisuals: "AncaVisuals",
  personal: "Personal",
};

const CATEGORY_COLORS: Record<string, string> = {
  ancavisuals: "bg-violet-500/20 text-violet-300",
  personal: "bg-blue-500/20 text-blue-300",
};

// ─── Reducer ─────────────────────────────────────────────────────────────────

type MementoAction =
  | { type: "SET"; mementos: Memento[] }
  | { type: "ADD"; memento: Memento }
  | { type: "TOGGLE"; id: string }
  | { type: "DELETE"; id: string };

function mementosReducer(state: Memento[], action: MementoAction): Memento[] {
  switch (action.type) {
    case "SET":
      return action.mementos;
    case "ADD":
      return [...state, action.memento].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
    case "TOGGLE":
      return state.map((m) => m.id === action.id ? { ...m, completed: !m.completed } : m);
    case "DELETE":
      return state.filter((m) => m.id !== action.id);
  }
}

// ─── Custom hook ─────────────────────────────────────────────────────────────

function useMementos() {
  const [mementos, dispatch] = useReducer(mementosReducer, []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/mementos")
      .then((r) => r.json())
      .then((d) => dispatch({ type: "SET", mementos: d.mementos ?? [] }))
      .finally(() => setLoading(false));
  }, []);

  const toggleComplete = async (memento: Memento) => {
    dispatch({ type: "TOGGLE", id: memento.id });
    await fetch(`/api/admin/mementos/${memento.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !memento.completed }),
    });
  };

  const deleteMemento = async (id: string) => {
    dispatch({ type: "DELETE", id });
    await fetch(`/api/admin/mementos/${id}`, { method: "DELETE" });
  };

  const addMemento = (memento: Memento) => dispatch({ type: "ADD", memento });

  const reload = () =>
    fetch("/api/admin/mementos")
      .then((r) => r.json())
      .then((d) => dispatch({ type: "SET", mementos: d.mementos ?? [] }));

  return { mementos, loading, toggleComplete, deleteMemento, addMemento, reload };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MementosPage() {
  const navigate = useNavigate();
  const { mementos, loading, toggleComplete, deleteMemento, addMemento, reload } = useMementos();

  const [filter, setFilter] = useState<"all" | "ancavisuals" | "personal">("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  useBodyScrollLock(showAdd || confirmDeleteId !== null);

  const now = useMemo(() => new Date(), []);

  const urgentCount = useMemo(
    () => mementos.filter((m) => {
      if (m.completed) return false;
      return new Date(m.dueDate) <= new Date(Date.now() + 48 * 60 * 60 * 1000);
    }).length,
    [mementos]
  );

  const { overdue, upcoming, completed, filtered } = useMemo(() => {
    const f = mementos.filter((m) => {
      if (!showCompleted && m.completed) return false;
      if (filter !== "all" && m.category !== filter) return false;
      return true;
    });
    return {
      filtered: f,
      overdue: f.filter((m) => !m.completed && new Date(m.dueDate) < now),
      upcoming: f.filter((m) => !m.completed && new Date(m.dueDate) >= now),
      completed: f.filter((m) => m.completed),
    };
  }, [mementos, filter, showCompleted, now]);

  const handleTestEmail = async () => {
    setTestStatus("loading");
    const res = await fetch("/api/admin/mementos/send-test-email", { method: "POST" });
    setTestStatus(res.ok ? "ok" : "err");
    setTimeout(() => setTestStatus("idle"), 4000);
  };

  if (loading) return <AncaLoader />;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">

        <Breadcrumb />

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white text-2xl font-light tracking-tight">Mementouri</h1>
              {urgentCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500 text-white">{urgentCount}</span>
              )}
            </div>
            <p className="text-neutral-500 text-sm mt-1">{mementos.filter((m) => !m.completed).length} active</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestEmail}
              disabled={testStatus === "loading"}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${
                testStatus === "ok" ? "border-emerald-500 text-emerald-400" :
                testStatus === "err" ? "border-red-500 text-red-400" :
                "border-neutral-700 text-neutral-500 hover:text-white hover:border-neutral-500"
              }`}
            >
              {testStatus === "loading" ? "Se trimite..." : testStatus === "ok" ? "Email trimis!" : testStatus === "err" ? "Eroare!" : "Test email"}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Adaugă
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {(["all", "ancavisuals", "personal"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              {f === "all" ? "Toate" : CATEGORY_LABELS[f]}
            </button>
          ))}
          <button
            onClick={() => setShowCompleted((p) => !p)}
            className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showCompleted ? "bg-neutral-700 text-white" : "bg-neutral-800 text-neutral-500 hover:text-white"
            }`}
          >
            {showCompleted ? "Ascunde rezolvate" : "Arată rezolvate"}
          </button>
        </div>

        {overdue.length > 0 && (
          <Section title="Depășite" accent="text-red-400">
            {overdue.map((m) => <MementoCard key={m.id} memento={m} onToggle={toggleComplete} onDelete={setConfirmDeleteId} />)}
          </Section>
        )}

        {upcoming.length > 0 && (
          <Section title="Urmează">
            {upcoming.map((m) => <MementoCard key={m.id} memento={m} onToggle={toggleComplete} onDelete={setConfirmDeleteId} />)}
          </Section>
        )}

        {showCompleted && completed.length > 0 && (
          <Section title="Rezolvate" accent="text-neutral-600">
            {completed.map((m) => <MementoCard key={m.id} memento={m} onToggle={toggleComplete} onDelete={setConfirmDeleteId} />)}
          </Section>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-neutral-500 text-sm">Niciun memento. Adaugă primul!</p>
          </div>
        )}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-xs space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white text-base font-semibold">Ștergi mementoul?</h3>
            <p className="text-neutral-500 text-sm">Această acțiune este ireversibilă.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={() => { deleteMemento(confirmDeleteId); setConfirmDeleteId(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-colors"
              >
                Șterge
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <AddMementoModal
          onClose={() => setShowAdd(false)}
          onAdded={(m) => { addMemento(m); setShowAdd(false); }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, accent = "text-neutral-400", children }: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className={`text-xs uppercase tracking-wide font-medium ${accent}`}>{title}</p>
      {children}
    </div>
  );
}

function MementoCard({ memento, onToggle, onDelete }: {
  memento: Memento;
  onToggle: (m: Memento) => void;
  onDelete: (id: string) => void;
}) {
  const dueDate = new Date(memento.dueDate);
  const isOverdue = !memento.completed && dueDate < new Date();
  const formattedDate = dueDate.toLocaleString("ro-RO", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
      memento.completed
        ? "bg-neutral-900/40 border-neutral-800/50 opacity-50"
        : isOverdue
          ? "bg-red-950/20 border-red-800/30"
          : "bg-neutral-900 border-neutral-800"
    }`}>
      <button
        onClick={() => onToggle(memento)}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
          memento.completed ? "bg-violet-500 border-violet-500" : "border-neutral-600 hover:border-violet-400"
        }`}
      >
        {memento.completed && (
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full p-0.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${memento.completed ? "line-through text-neutral-500" : "text-white"}`}>
            {memento.title}
          </p>
          <span className={`px-2 py-0.5 rounded-full text-xs ${CATEGORY_COLORS[memento.category]}`}>
            {CATEGORY_LABELS[memento.category]}
          </span>
          {memento.recurring !== "none" && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300">
              🔁 {RECURRING_LABELS[memento.recurring]}
            </span>
          )}
          {memento.reminderMinutesBefore > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-neutral-800 text-neutral-500">
              {reminderLabel(memento.reminderMinutesBefore)}
            </span>
          )}
          {memento.emailSent && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-neutral-800 text-neutral-500">email trimis</span>
          )}
        </div>
        {memento.description && (
          <p className="text-neutral-500 text-xs mt-1">{memento.description}</p>
        )}
        <p className={`text-xs mt-1.5 ${isOverdue ? "text-red-400" : "text-neutral-600"}`}>
          {isOverdue ? "⚠ " : ""}{formattedDate}
        </p>
      </div>

      <button
        onClick={() => onDelete(memento.id)}
        className="text-neutral-700 hover:text-red-400 transition-colors text-lg leading-none"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Add modal ────────────────────────────────────────────────────────────────

type AddForm = {
  title: string;
  description: string;
  dueDate: string;
  category: "ancavisuals" | "personal";
  reminderMinutesBefore: number;
  recurring: "none" | "weekly" | "monthly" | "yearly";
};

const MEMENTO_DRAFT_STORAGE_KEY = "admin:mementos:add-draft";

function createDefaultAddForm(): AddForm {
  return {
    title: "",
    description: "",
    dueDate: defaultDueDate(),
    category: "ancavisuals",
    reminderMinutesBefore: 0,
    recurring: "none",
  };
}

function isValidDraft(value: unknown): value is AddForm {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<AddForm>;
  return (
    typeof draft.title === "string" &&
    typeof draft.description === "string" &&
    typeof draft.dueDate === "string" &&
    (draft.category === "ancavisuals" || draft.category === "personal") &&
    typeof draft.reminderMinutesBefore === "number" &&
    (draft.recurring === "none" || draft.recurring === "weekly" || draft.recurring === "monthly" || draft.recurring === "yearly")
  );
}

function defaultDueDate(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function AddMementoModal({ onClose, onAdded }: {
  onClose: () => void;
  onAdded: (m: Memento) => void;
}) {
  useBodyScrollLock(true);
  const [form, setForm] = useState<AddForm>(createDefaultAddForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [serverTime, setServerTime] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/mementos/server-time")
      .then((r) => r.json())
      .then((d) => setServerTime(d.serverTime));
  }, []);

  useEffect(() => {
    try {
      const rawDraft = localStorage.getItem(MEMENTO_DRAFT_STORAGE_KEY);
      if (!rawDraft) return;
      const parsed = JSON.parse(rawDraft);
      if (isValidDraft(parsed)) {
        setForm(parsed);
      }
    } catch {
      localStorage.removeItem(MEMENTO_DRAFT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(MEMENTO_DRAFT_STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const set = <K extends keyof AddForm>(key: K) => (value: AddForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.dueDate) { setError("Completează titlul și data."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/mementos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, title: form.title.trim(), description: form.description.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Eroare."); setSaving(false); return; }
    localStorage.removeItem(MEMENTO_DRAFT_STORAGE_KEY);
    onAdded({
      id: data.id,
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      completed: false,
      emailSent: false,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white text-base font-semibold">Memento nou</h2>
            <p className="text-neutral-600 text-xs mt-1">Draft salvat automat local până la salvare.</p>
            {serverTime && <MidnightWarning serverTime={serverTime} />}
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-lg">✕</button>
        </div>

        <div className="space-y-3">
          <input
            className="w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2.5 outline-none focus:border-violet-500 transition-colors placeholder-neutral-600"
            placeholder="Titlu *"
            value={form.title}
            onChange={(e) => set("title")(e.target.value)}
          />
          <textarea
            className="w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 transition-colors resize-none placeholder-neutral-600"
            rows={2}
            placeholder="Descriere (opțional)"
            value={form.description}
            onChange={(e) => set("description")(e.target.value)}
          />
          <input
            type="datetime-local"
            className="w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2.5 outline-none focus:border-violet-500 transition-colors"
            value={form.dueDate}
            onChange={(e) => set("dueDate")(e.target.value)}
          />
          <div className="flex gap-2">
            {(["ancavisuals", "personal"] as const).map((c) => (
              <button
                key={c}
                onClick={() => set("category")(c)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  form.category === c ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          <div>
            <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1.5">Reamintire email</p>
            <select
              value={form.reminderMinutesBefore}
              onChange={(e) => set("reminderMinutesBefore")(Number(e.target.value))}
              className="w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2.5 outline-none focus:border-violet-500 transition-colors"
            >
              {REMINDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1.5">Recurență</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(["none", "weekly", "monthly", "yearly"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => set("recurring")(r)}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                    form.recurring === r ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  {RECURRING_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 transition-colors">
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {saving ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MidnightWarning({ serverTime }: { serverTime: string }) {
  const st = new Date(serverTime);
  const h = st.getHours();
  const dateStr = st.toLocaleString("ro-RO", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <>
      <p className="text-neutral-600 text-xs mt-0.5">Ora server: {dateStr}</p>
      {(h >= 23 || h < 4) && (
        <div className="mt-2 flex items-start gap-2 bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2">
          <span className="text-amber-400 text-base leading-none mt-0.5">🌙</span>
          <div>
            <p className="text-amber-300 text-xs font-semibold">Atenție — ești în jurul miezului nopții</p>
            <p className="text-amber-400/80 text-xs mt-0.5">
              {h >= 23
                ? `E ${st.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })} seara. Dacă vrei să setezi ceva pentru mâine, alege data de ${new Date(st.getTime() + 86400000).toLocaleDateString("ro-RO", { day: "numeric", month: "long" })}.`
                : `E deja ${st.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}. Ziua de ieri a fost ${new Date(st.getTime() - 86400000).toLocaleDateString("ro-RO", { day: "numeric", month: "long" })}.`}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
