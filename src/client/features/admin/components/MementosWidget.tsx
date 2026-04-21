import React, { useEffect, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Memento {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  category: "ancavisuals" | "personal";
  completed: boolean;
  recurring: "none" | "weekly" | "monthly" | "yearly";
}

type Action =
  | { type: "SET"; mementos: Memento[] }
  | { type: "TOGGLE"; id: string };

function reducer(state: Memento[], action: Action): Memento[] {
  switch (action.type) {
    case "SET": return action.mementos;
    case "TOGGLE": return state.map((m) => m.id === action.id ? { ...m, completed: !m.completed } : m);
  }
}

export default function MementosWidget() {
  const navigate = useNavigate();
  const [mementos, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/mementos")
      .then((r) => r.json())
      .then((d) => dispatch({ type: "SET", mementos: d.mementos ?? [] }))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (m: Memento) => {
    dispatch({ type: "TOGGLE", id: m.id });
    await fetch(`/api/admin/mementos/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !m.completed }),
    });
  };

  const now = new Date();
  const pending = mementos.filter((m) => !m.completed);
  const overdue = pending.filter((m) => new Date(m.dueDate) < now);
  const upcoming = pending.filter((m) => new Date(m.dueDate) >= now);

  if (loading) return null;
  if (pending.length === 0) return null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium">Mementouri active</span>
          {overdue.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500 text-white">
              {overdue.length} depășite
            </span>
          )}
        </div>
        <button
          onClick={() => navigate("/admin/mementos")}
          className="text-xs text-neutral-500 hover:text-white transition-colors"
        >
          Vezi toate →
        </button>
      </div>

      <div className="divide-y divide-neutral-800/60">
        {[...overdue, ...upcoming].slice(0, 6).map((m) => {
          const isOverdue = new Date(m.dueDate) < now;
          const dueStr = new Date(m.dueDate).toLocaleString("ro-RO", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
          });

          return (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3">
              <button
                onClick={() => toggle(m)}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  m.completed
                    ? "bg-violet-500 border-violet-500"
                    : "border-neutral-600 hover:border-violet-400"
                }`}
              >
                {m.completed && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${m.completed ? "line-through text-neutral-500" : "text-white"}`}>
                  {m.title}
                </p>
                <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-400" : "text-neutral-600"}`}>
                  {isOverdue ? "⚠ " : ""}{dueStr}
                </p>
              </div>

              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                m.category === "ancavisuals"
                  ? "bg-violet-500/20 text-violet-300"
                  : "bg-blue-500/20 text-blue-300"
              }`}>
                {m.category === "ancavisuals" ? "AncaVisuals" : "Personal"}
              </span>
            </div>
          );
        })}
      </div>

      {pending.length > 6 && (
        <div className="px-5 py-3 border-t border-neutral-800">
          <button
            onClick={() => navigate("/admin/mementos")}
            className="text-xs text-neutral-500 hover:text-white transition-colors"
          >
            + {pending.length - 6} mementouri în plus
          </button>
        </div>
      )}
    </div>
  );
}
