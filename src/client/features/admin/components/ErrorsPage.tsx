import React, { useEffect, useReducer, useMemo, useState } from "react";
import AncaLoader from "../../../components/UI/AncaLoader";

interface ServerError {
  id: string;
  message: string;
  stack: string;
  source: "server" | "client";
  severity: "error" | "warn";
  page: string;
  seen: boolean;
  capturedAt: string | null;
}

type Filter = "all" | "error" | "warn" | "server" | "client" | "unseen";

interface State {
  errors: ServerError[];
  loading: boolean;
  marking: boolean;
  filter: Filter;
  expandedId: string | null;
}

type Action =
  | { type: "loaded"; errors: ServerError[] }
  | { type: "mark_done" }
  | { type: "set_filter"; filter: Filter }
  | { type: "toggle_expand"; id: string }
  | { type: "set_marking"; value: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loaded":
      return { ...state, loading: false, errors: action.errors };
    case "mark_done":
      return { ...state, marking: false, errors: state.errors.map((e) => ({ ...e, seen: true })) };
    case "set_filter":
      return { ...state, filter: action.filter, expandedId: null };
    case "toggle_expand":
      return { ...state, expandedId: state.expandedId === action.id ? null : action.id };
    case "set_marking":
      return { ...state, marking: action.value };
    default:
      return state;
  }
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Toate" },
  { value: "unseen", label: "Nevăzute" },
  { value: "error", label: "Errors" },
  { value: "warn", label: "Warnings" },
  { value: "server", label: "Server" },
  { value: "client", label: "Client" },
];

export default function ErrorsPage() {
  const [state, dispatch] = useReducer(reducer, {
    errors: [],
    loading: true,
    marking: false,
    filter: "unseen",
    expandedId: null,
  });

  useEffect(() => {
    fetch("/api/admin/monitoring/errors")
      .then((r) => r.json())
      .then((data: { errors: ServerError[] }) => dispatch({ type: "loaded", errors: data.errors ?? [] }))
      .catch(() => dispatch({ type: "loaded", errors: [] }));
  }, []);

  const filtered = useMemo(() => {
    return state.errors.filter((error) => {
      if (state.filter === "unseen") return !error.seen;
      if (state.filter === "error") return error.severity === "error";
      if (state.filter === "warn") return error.severity === "warn";
      if (state.filter === "server") return error.source === "server";
      if (state.filter === "client") return error.source === "client";
      return true;
    });
  }, [state.errors, state.filter]);

  const unseenCount = useMemo(() => state.errors.filter((e) => !e.seen).length, [state.errors]);

  const handleMarkSeen = async () => {
    dispatch({ type: "set_marking", value: true });
    try {
      await fetch("/api/admin/monitoring/errors/mark-seen", { method: "PATCH" });
      dispatch({ type: "mark_done" });
    } catch {
      dispatch({ type: "set_marking", value: false });
    }
  };

  if (state.loading) return <AncaLoader />;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Erori server</h1>
            <p className="text-neutral-500 text-sm mt-1">
              {unseenCount > 0
                ? `${unseenCount} erori nevăzute din ${state.errors.length} total`
                : `${state.errors.length} erori total — toate văzute`}
            </p>
          </div>
          {unseenCount > 0 && (
            <button
              onClick={handleMarkSeen}
              disabled={state.marking}
              className="px-4 py-2 text-sm bg-neutral-800 text-neutral-300 rounded-lg hover:bg-neutral-700 hover:text-white transition-colors disabled:opacity-50"
            >
              {state.marking ? "Se marchează..." : `Marchează toate ca văzute (${unseenCount})`}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filterOption) => (
            <button
              key={filterOption.value}
              onClick={() => dispatch({ type: "set_filter", filter: filterOption.value })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                state.filter === filterOption.value
                  ? "bg-violet-600 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-neutral-600 text-sm">
            Nicio eroare în această categorie.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((error) => (
              <ErrorRow
                key={error.id}
                error={error}
                expanded={state.expandedId === error.id}
                onToggle={() => dispatch({ type: "toggle_expand", id: error.id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorRow({ error, expanded, onToggle }: { error: ServerError; expanded: boolean; onToggle: () => void }) {
  const severityColor = error.severity === "error" ? "text-red-400" : "text-amber-400";
  const severityBg = error.severity === "error" ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20";
  const sourceColor = error.source === "client" ? "text-blue-400" : "text-violet-400";

  const time = error.capturedAt
    ? new Date(error.capturedAt).toLocaleString("ro-RO", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "-";

  const shortMessage = (error.message ?? "").split("\n")[0].slice(0, 100);

  return (
    <div
      className={`rounded-xl border transition-all ${
        error.seen ? "border-neutral-800 bg-neutral-900/50" : `${severityBg} border`
      }`}
    >
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {!error.seen && (
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          )}
          <span className={`text-xs font-bold uppercase ${severityColor}`}>{error.severity}</span>
          <span className={`text-xs uppercase ${sourceColor}`}>{error.source}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-neutral-200 text-sm font-mono truncate">{shortMessage}</p>
          {error.page && (
            <p className="text-neutral-500 text-xs mt-0.5 truncate">{error.page}</p>
          )}
        </div>
        <span className="text-neutral-600 text-xs shrink-0 mt-0.5">{time}</span>
        <span className="text-neutral-600 text-xs shrink-0 mt-0.5">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-neutral-800">
          <pre className="mt-3 text-xs text-neutral-400 font-mono whitespace-pre-wrap break-words leading-relaxed bg-neutral-950 rounded-lg p-3 overflow-auto max-h-64">
            {[error.message, error.stack].filter(Boolean).join("\n\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
