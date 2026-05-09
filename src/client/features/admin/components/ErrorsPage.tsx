import React, { useEffect, useReducer, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import AncaLoader from "../../../components/UI/AncaLoader";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";

interface ServerError {
  id: string;
  message: string;
  stack: string;
  source: "server" | "client";
  severity: "error" | "warn";
  page: string;
  seen: boolean;
  ip: string | null;
  geo: { city?: string; region?: string; country?: string } | null;
  capturedAt: string | null;
}

type CompactErrorRow = [0 | 1, number, number, number, number];

type Filter = "all" | "error" | "warn" | "server" | "client" | "unseen";
type ExtendedFilter = Filter | "qr";

interface State {
  errors: ServerError[];
  loading: boolean;
  marking: boolean;
  filter: ExtendedFilter;
  expandedId: string | null;
}

type Action =
  | { type: "loaded"; errors: ServerError[] }
  | { type: "mark_done" }
  | { type: "set_filter"; filter: ExtendedFilter }
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

const FILTERS: { value: ExtendedFilter; label: string }[] = [
  { value: "all", label: "Toate" },
  { value: "unseen", label: "Nevăzute" },
  { value: "qr", label: "QR Moments" },
  { value: "error", label: "Errors" },
  { value: "warn", label: "Warnings" },
  { value: "server", label: "Server" },
  { value: "client", label: "Client" },
];

function isQrError(error: ServerError): boolean {
  return error.message.includes("[QR DEBUG]") || error.page.startsWith("/qr-moments/");
}

function getOrInsertRef<T>(list: T[], value: T, equals?: (a: T, b: T) => boolean): number {
  const index = list.findIndex(item => equals ? equals(item, value) : item === value);
  if (index >= 0) return index;
  list.push(value);
  return list.length - 1;
}

function stripAnsi(value: string): string {
  const esc = String.fromCharCode(27);
  return value.replace(new RegExp(`${esc}\\[[0-9;]*m`, "g"), "");
}

function formatCronMiss(value: string): string | null {
  const match = value.match(/missed execution at ([A-Za-z]{3} [A-Za-z]{3} \d{2} \d{4} \d{2}:\d{2}:\d{2}) GMT/i);
  if (!match) return null;

  const parts = match[1].split(" ");
  if (parts.length !== 5) return null;

  const [, monthLabel, day, year, time] = parts;
  const monthMap: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  const month = monthMap[monthLabel];
  if (!month) return null;

  return `NC miss ${year}-${month}-${day} ${time.slice(0, 5)}`;
}

function compactDebugText(value: string): string {
  const clean = stripAnsi(value).replace(/\s+/g, " ").trim();
  if (!clean) return "";

  const cronMiss = formatCronMiss(clean);
  if (cronMiss) return cronMiss;

  return clean
    .replace(/\[PID:\s*\d+\]/g, "")
    .replace(/\[NODE-CRON\]/g, "NC")
    .replace(/Possible blocking IO or high CPU user at the same process used by node-cron\.?/gi, "blockIO/highCPU")
    .replace(/\s+/g, " ")
    .trim();
}

function toHourBucket(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:00`;
}

function buildCompactErrorsPayload(errors: ServerError[]) {
  const h: string[] = [];
  const m: string[] = [];
  const s: string[] = [];
  const p: string[] = [];

  const e: CompactErrorRow[] = errors.map(error => [
    error.severity === "error" ? 1 : 0,
    getOrInsertRef(h, toHourBucket(error.capturedAt)),
    getOrInsertRef(m, compactDebugText(error.message ?? "")),
    getOrInsertRef(s, compactDebugText(error.stack ?? "")),
    getOrInsertRef(p, compactDebugText(error.page ?? "")),
  ]);

  return {
    v: 2,
    c: errors.length,
    k: ["sev", "h", "m", "s", "p"],
    sev: ["warn", "error"],
    h,
    m,
    s,
    p,
    e,
  };
}

export default function ErrorsPage() {
  const location = useLocation();
  const { auth } = useAuth();
  const [state, dispatch] = useReducer(reducer, {
    errors: [],
    loading: true,
    marking: false,
    filter: ((location.state as { filter?: ExtendedFilter } | null)?.filter ?? "unseen"),
    expandedId: null,
  });

  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/admin/monitoring/errors", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((r) => r.json())
      .then((data: { errors: ServerError[] }) => dispatch({ type: "loaded", errors: data.errors ?? [] }))
      .catch(() => dispatch({ type: "loaded", errors: [] }));
  }, [auth.accessToken]);

  const filtered = useMemo(() => {
    return state.errors.filter((error) => {
      if (state.filter === "unseen") return !error.seen;
      if (state.filter === "qr") return isQrError(error);
      if (state.filter === "error") return error.severity === "error";
      if (state.filter === "warn") return error.severity === "warn";
      if (state.filter === "server") return error.source === "server";
      if (state.filter === "client") return error.source === "client";
      return true;
    });
  }, [state.errors, state.filter]);

  const unseenCount = useMemo(() => state.errors.filter((e) => !e.seen).length, [state.errors]);
  const qrCount = useMemo(() => state.errors.filter((error) => isQrError(error)).length, [state.errors]);
  const unseenErrors = useMemo(() => state.errors.filter((error) => !error.seen), [state.errors]);
  const unseenErrorsCompact = useMemo(() => buildCompactErrorsPayload(unseenErrors), [unseenErrors]);
  const unseenErrorsJson = useMemo(
    () => JSON.stringify({
      exportedAt: new Date().toISOString(),
      unseenCount: unseenErrors.length,
      errors: unseenErrors,
    }, null, 2),
    [unseenErrors],
  );
  const unseenErrorsCompactJson = useMemo(
    () => JSON.stringify(unseenErrorsCompact, null, 1),
    [unseenErrorsCompact],
  );
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  const [jsonMode, setJsonMode] = useState<"compact" | "full">("compact");

  const handleMarkSeen = async () => {
    dispatch({ type: "set_marking", value: true });
    try {
      await fetch("/api/admin/monitoring/errors/mark-seen", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      dispatch({ type: "mark_done" });
    } catch {
      dispatch({ type: "set_marking", value: false });
    }
  };

  const handleCopyJson = async () => {
    const valueToCopy = jsonMode === "compact" ? unseenErrorsCompactJson : unseenErrorsJson;
    try {
      await navigator.clipboard.writeText(valueToCopy);
      setCopyState("done");
    } catch {
      setCopyState("error");
    }

    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  if (state.loading) return <AncaLoader />;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <Breadcrumb />

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Erori server</h1>
            <p className="text-neutral-500 text-sm mt-1">
              {unseenCount > 0
                ? `${unseenCount} erori nevăzute din ${state.errors.length} total`
                : `${state.errors.length} erori total — toate văzute`}
            </p>
            <p className="text-neutral-600 text-xs mt-1">
              Aici sunt centralizate erorile de server, client și QR Moments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {unseenCount > 0 && (
              <button
                onClick={() => {
                  setJsonMode("compact");
                  setJsonOpen(true);
                }}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
              >
                Vezi JSON compact ({unseenCount})
              </button>
            )}
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
              {filterOption.value === "qr" && qrCount > 0 && (
                <span className="ml-1.5 text-amber-300">{qrCount}</span>
              )}
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

      {jsonOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={() => setJsonOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-neutral-800 px-5 py-4">
              <div>
                <h2 className="text-white text-lg font-medium">JSON erori nevăzute</h2>
                <p className="text-xs text-neutral-500 mt-1">
                  Varianta compactă păstrează doar severitatea, ora bucket, mesajul, stack-ul și pagina.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-neutral-700 p-1">
                  <button
                    onClick={() => setJsonMode("compact")}
                    className={`rounded-md px-3 py-1.5 text-xs transition-colors ${jsonMode === "compact" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"}`}
                  >
                    Compact
                  </button>
                  <button
                    onClick={() => setJsonMode("full")}
                    className={`rounded-md px-3 py-1.5 text-xs transition-colors ${jsonMode === "full" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"}`}
                  >
                    Full
                  </button>
                </div>
                <button
                  onClick={handleCopyJson}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
                >
                  {copyState === "done" ? "Copiat" : copyState === "error" ? "Copy failed" : "Copy to clipboard"}
                </button>
                <button
                  onClick={() => setJsonOpen(false)}
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
                >
                  Închide
                </button>
              </div>
            </div>
            <div className="overflow-auto p-5">
              <pre className="min-h-[320px] rounded-xl bg-neutral-950 p-4 text-xs leading-relaxed text-neutral-300">
                {jsonMode === "compact" ? unseenErrorsCompactJson : unseenErrorsJson}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorRow({ error, expanded, onToggle }: { error: ServerError; expanded: boolean; onToggle: () => void }) {
  const severityColor = error.severity === "error" ? "text-red-400" : "text-amber-400";
  const severityBg = error.severity === "error" ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20";
  const sourceColor = error.source === "client" ? "text-blue-400" : "text-violet-400";
  const qrError = isQrError(error);

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
          {qrError && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">QR</span>}
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
          {error.source === "client" && (error.ip || error.geo) && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {error.ip && (
                <span className="bg-neutral-800 text-neutral-300 px-2 py-1 rounded font-mono">
                  IP: {error.ip}
                </span>
              )}
              {error.geo && (
                <span className="bg-neutral-800 text-neutral-300 px-2 py-1 rounded">
                  📍 {[error.geo.city, error.geo.region, error.geo.country].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          )}
          <pre className="mt-3 text-xs text-neutral-400 font-mono whitespace-pre-wrap break-words leading-relaxed bg-neutral-950 rounded-lg p-3 overflow-auto max-h-64">
            {[error.message, error.stack].filter(Boolean).join("\n\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
