/*
 * Purpose: /admin/email-log — every email the site sent and every reply it received (the mailbox
 * is read every 10 minutes, see services/emailInbox.service.ts), searchable, grouped by category
 * (lead, contract, album, QR Moments…) and by event type. The HTML exactly as the person got it
 * stays behind "Vezi preview complet", in a sandboxed frame.
 */
import { useEffect, useMemo, useState } from "react";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";
import {
  EMAIL_CATEGORIES,
  categorizeEmail,
  eventTypeOfEmail,
  foldForSearch,
  type EmailCategory,
  type EmailDirection,
} from "../../../../shared/emailCategories";

type Status = "pending" | "sent" | "failed" | "skipped" | "received";

export interface EmailLogRow {
  id: string;
  to: string;
  from?: string;
  subject: string;
  status: Status;
  severity?: "ok" | "info" | "error";
  source?: string;
  reason?: string;
  error?: string;
  createdAt: string;
  direction?: EmailDirection;
  attachments?: string[];
  inReplyToLogId?: string | null;
}

type EmailDetail = EmailLogRow & { html?: string; text?: string };
type SyncState = { lastSyncAt?: string; lastError?: string | null };

const PAGE = 100;

const STATUS: Record<Status, { label: string; className: string }> = {
  sent: { label: "Trimis", className: "border-green-500/40 text-green-400" },
  received: { label: "Primit", className: "border-sky-500/40 text-sky-300" },
  failed: { label: "Eșuat", className: "border-red-500/40 text-red-400" },
  skipped: { label: "Netrimis", className: "border-amber-500/40 text-amber-300" },
  pending: { label: "În curs", className: "border-neutral-600 text-neutral-400" },
};

const formatTime = (iso: string) => new Date(iso).toLocaleString("ro-RO", {
  timeZone: "Europe/Bucharest", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

const isError = (row: EmailLogRow) => row.severity === "error" || row.status === "failed";

/** Readable text of an HTML email, without rendering it. */
function textOfHtml(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("style,script,head").forEach((node) => node.remove());
  return (doc.body?.textContent ?? "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

export type EmailFilters = {
  query: string;
  direction: "all" | EmailDirection;
  category: "all" | EmailCategory;
  eventType: string;
  onlyErrors: boolean;
};

/** Search (to, from, subject, source; without diacritics) + the filters, newest first. */
export function filterEmails(rows: EmailLogRow[], filters: EmailFilters): EmailLogRow[] {
  const query = foldForSearch(filters.query.trim());
  return rows.filter((row) => {
    const direction = row.direction ?? "out";
    if (filters.direction !== "all" && direction !== filters.direction) return false;
    if (filters.category !== "all" && categorizeEmail(row) !== filters.category) return false;
    if (filters.eventType !== "all") {
      const type = eventTypeOfEmail(row.subject);
      if (filters.eventType === "none" ? type !== null : type !== filters.eventType) return false;
    }
    if (filters.onlyErrors && !isError(row)) return false;
    if (!query) return true;
    return foldForSearch(`${row.subject} ${row.to} ${row.from ?? ""} ${row.source ?? ""}`).includes(query);
  });
}

export default function EmailLogPage() {
  const { auth } = useAuth();
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<EmailFilters>({ query: "", direction: "all", category: "all", eventType: "all", onlyErrors: false });
  const [visible, setVisible] = useState(PAGE);
  const [open, setOpen] = useState<EmailDetail | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sync, setSync] = useState<SyncState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${auth.accessToken}` }), [auth.accessToken]);

  const load = () => {
    if (!auth.accessToken) return;
    setLoading(true);
    Promise.all([
      fetch("/api/admin/email-log?all=1", { headers }).then((response) => response.json()),
      fetch("/api/admin/email-inbox-sync", { headers }).then((response) => response.json()).catch(() => ({})),
    ])
      .then(([log, syncData]) => {
        if (log.error) setError(log.error);
        setRows(log.emails ?? []);
        setSync(syncData.state ?? null);
      })
      .catch(() => setError("Nu s-a putut încărca jurnalul de emailuri."))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [auth.accessToken]);

  const syncNow = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const response = await fetch("/api/admin/email-inbox-sync", { method: "POST", headers });
      const data = await response.json() as { result?: { checked: number; saved: number }; error?: string };
      if (!response.ok || !data.result) throw new Error(data.error ?? "Căsuța nu a putut fi citită.");
      setSyncMessage(data.result.saved > 0 ? `${data.result.saved} răspunsuri noi.` : "Niciun răspuns nou.");
      load();
    } catch (syncError) {
      setSyncMessage(syncError instanceof Error ? syncError.message : "Căsuța nu a putut fi citită.");
    } finally {
      setSyncing(false);
    }
  };

  const openEmail = (row: EmailLogRow) => {
    setOpen(row);
    setShowPreview(false);
    fetch(`/api/admin/email-log/${row.id}`, { headers })
      .then((response) => response.json())
      .then((data: { email?: EmailDetail }) => { if (data.email) setOpen({ ...row, ...data.email }); })
      .catch(() => {});
  };

  const setFilter = <K extends keyof EmailFilters>(key: K, value: EmailFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setVisible(PAGE);
  };

  const filtered = useMemo(() => filterEmails(rows, filters), [rows, filters]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<EmailCategory, number>();
    filterEmails(rows, { ...filters, category: "all" }).forEach((row) => {
      const category = categorizeEmail(row);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return counts;
  }, [rows, filters]);
  const eventTypes = useMemo(
    () => Array.from(new Set(rows.map((row) => eventTypeOfEmail(row.subject)).filter((type): type is string => !!type))).sort(),
    [rows],
  );
  const received = rows.filter((row) => row.direction === "in").length;
  const repliedTo = open?.inReplyToLogId ? rows.find((row) => row.id === open.inReplyToLogId) : null;
  const bodyText = open ? (open.direction === "in" && open.text ? open.text : open.html ? textOfHtml(open.html) : "") : "";

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <Breadcrumb />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-light text-white">Email log</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {rows.length - received} trimise de site · {received} răspunsuri primite
            </p>
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={syncing}
              className="border border-white bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-40"
            >
              {syncing ? "Se verifică…" : "📥 Verifică răspunsurile acum"}
            </button>
            <p className="mt-1 text-[11px] text-neutral-500">
              {syncMessage ?? (sync?.lastSyncAt ? `Ultima verificare: ${formatTime(sync.lastSyncAt)} (automat la 10 min)` : "Căsuța nu a fost verificată încă")}
            </p>
            {sync?.lastError && !syncMessage && <p className="text-[11px] text-red-400">Ultima eroare: {sync.lastError}</p>}
          </div>
        </div>

        <div className="space-y-3 border border-neutral-800 bg-neutral-900 p-3">
          <input
            type="search"
            value={filters.query}
            onChange={(event) => setFilter("query", event.target.value)}
            placeholder="Caută după email, subiect, sursă… (ex. nunta, contract, maria@)"
            aria-label="Caută în emailuri"
            className="w-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
          />
          <div className="flex flex-wrap items-center gap-2">
            {([["all", "Toate"], ["out", "↗ Trimise"], ["in", "↙ Primite"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter("direction", value)}
                className={`border px-3 py-1.5 text-xs ${filters.direction === value ? "border-white bg-white text-black" : "border-neutral-700 text-neutral-300 hover:border-neutral-500"}`}
              >
                {label}
              </button>
            ))}
            <select
              value={filters.eventType}
              onChange={(event) => setFilter("eventType", event.target.value)}
              aria-label="Tip eveniment"
              className="border border-neutral-700 bg-black px-2 py-1.5 text-xs text-white"
            >
              <option value="all">Toate evenimentele</option>
              {eventTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              <option value="none">Fără tip de eveniment</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-neutral-400">
              <input type="checkbox" checked={filters.onlyErrors} onChange={(event) => setFilter("onlyErrors", event.target.checked)} />
              Doar erori
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilter("category", "all")}
              className={`border px-2.5 py-1 text-[11px] ${filters.category === "all" ? "border-white text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"}`}
            >
              Toate categoriile
            </button>
            {EMAIL_CATEGORIES.filter((category) => categoryCounts.get(category.id)).map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setFilter("category", category.id)}
                className={`border px-2.5 py-1 text-[11px] ${filters.category === category.id ? "border-white text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"}`}
              >
                {category.icon} {category.label} ({categoryCounts.get(category.id)})
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {loading ? (
          <p className="py-16 text-center text-sm text-neutral-500">Se încarcă…</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-neutral-500">Niciun email pentru filtrele alese.</p>
        ) : (
          <>
            <p className="text-xs text-neutral-500">{filtered.length} emailuri</p>
            <ul className="space-y-1.5">
              {filtered.slice(0, visible).map((row) => {
                const category = EMAIL_CATEGORIES.find((item) => item.id === categorizeEmail(row))!;
                const eventType = eventTypeOfEmail(row.subject);
                const incoming = row.direction === "in";
                const style = STATUS[row.status] ?? STATUS.pending;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openEmail(row)}
                      className={`w-full border bg-neutral-900 p-3 text-left transition-colors hover:border-neutral-500 ${isError(row) ? "border-red-500/40" : "border-neutral-800"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate text-sm text-white">
                          <span className="mr-1.5 text-neutral-500">{incoming ? "↙" : "↗"}</span>
                          {row.subject || "(fără subiect)"}
                        </p>
                        <span className="flex-shrink-0 text-xs text-neutral-500">{formatTime(row.createdAt)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`border px-1.5 py-0.5 text-[11px] ${style.className}`} title={row.reason ?? row.error}>{style.label}</span>
                        <span className="text-neutral-400">{category.icon} {category.label}</span>
                        {eventType && <span className="border border-neutral-700 px-1.5 py-0.5 text-[11px] text-neutral-300">{eventType}</span>}
                        <span className="truncate text-neutral-500">{incoming ? `de la ${row.from}` : `către ${row.to || "—"}`}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            {visible < filtered.length && (
              <button
                type="button"
                onClick={() => setVisible((count) => count + PAGE)}
                className="w-full border border-neutral-700 py-2 text-xs text-neutral-300 hover:border-neutral-500"
              >
                Arată încă {Math.min(PAGE, filtered.length - visible)}
              </button>
            )}
          </>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(null)}>
          <div
            role="dialog"
            aria-label={open.subject}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col border border-neutral-700 bg-neutral-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 p-4">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-white">{open.subject}</p>
                <p className="text-xs text-neutral-400">
                  {formatTime(open.createdAt)} · {open.direction === "in" ? `de la ${open.from} către ${open.to}` : `către ${open.to}`}
                </p>
                <p className="text-xs text-neutral-500">
                  {(STATUS[open.status] ?? STATUS.pending).label}
                  {open.source ? ` · sursa: ${open.source}` : ""}
                  {open.reason || open.error ? ` · ${open.reason ?? open.error}` : ""}
                </p>
                {repliedTo && (
                  <button type="button" onClick={() => openEmail(repliedTo)} className="text-xs text-sky-300 underline underline-offset-2">
                    Răspuns la: {repliedTo.subject}
                  </button>
                )}
                {open.attachments && open.attachments.length > 0 && (
                  <p className="text-xs text-neutral-400">📎 {open.attachments.join(", ")}</p>
                )}
              </div>
              <button type="button" onClick={() => setOpen(null)} className="text-sm text-neutral-500 hover:text-white">Închide</button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {showPreview ? (
                // Sandboxed: the HTML may contain visitor-typed text or a stranger's reply.
                <iframe
                  title="Preview complet email"
                  sandbox=""
                  srcDoc={open.html || "<p style='font-family:sans-serif;color:#888'>Fără HTML salvat.</p>"}
                  className="h-[65vh] w-full bg-white"
                />
              ) : (
                <p className="whitespace-pre-wrap break-words p-4 text-sm leading-relaxed text-neutral-300">
                  {bodyText || "Se încarcă conținutul…"}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-800 p-3">
              <button
                type="button"
                onClick={() => setShowPreview((value) => !value)}
                disabled={!open.html}
                className="border border-white px-4 py-2 text-xs font-bold text-white hover:bg-white hover:text-black disabled:opacity-40"
              >
                {showPreview ? "← Înapoi la text" : "👁 Vezi preview complet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
