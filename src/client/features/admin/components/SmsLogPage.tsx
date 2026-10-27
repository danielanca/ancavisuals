/*
 * Purpose: /admin/sms-log — every SMS the site sent to clients (or failed to send): when, to which
 * number, for which event, from which feature and the exact text. Data: GET /api/admin/sms-log,
 * written by sendSms (src/server/services/smsLog.service.ts). SMS sent before 2026-10-27 aren't here.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";

export type SmsLogRow = {
  id: string;
  to: string;
  text: string;
  status: "sent" | "failed";
  source: string;
  event: string | null;
  recipientName: string | null;
  error: string | null;
  createdAt: string;
};

export const SMS_SOURCE_LABELS: Record<string, string> = {
  "album-update": "Noutăți album",
  "print-selection-reminder": "Reminder poze album tipărit",
  "qr-couple-sms": "QR Moments → miri",
  "handover-sms": "Proces verbal",
  "handover-reminder": "Reminder semnare PV",
  "proposal-link-reminder": "Reminder alegere poze",
  photobooth: "Fotocabină",
  "wedding-hub-broadcast": "Wedding Hub → invitați",
};

// Sources whose `event` is an album slug, so it can link to /media/<slug>.
const ALBUM_SOURCES = new Set(["album-update", "print-selection-reminder", "proposal-link-reminder", "photobooth"]);

const input = "border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white";
const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("ro-RO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function SmsLogPage() {
  const { auth } = useAuth();
  const [rows, setRows] = useState<SmsLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyFailed, setOnlyFailed] = useState(false);

  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/admin/sms-log", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then(async (res) => {
        const data = (await res.json()) as { sms?: SmsLogRow[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? `Eroare ${res.status}`);
        setRows(data.sms ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Nu am putut încărca SMS-urile."));
  }, [auth.accessToken]);

  const visible = useMemo(() => {
    const q = fold(query.trim());
    const digits = query.replace(/\D/g, "");
    return (rows ?? []).filter((row) => {
      if (onlyFailed && row.status !== "failed") return false;
      if (!q) return true;
      if (digits.length >= 3 && row.to.replace(/\D/g, "").includes(digits.replace(/^0/, ""))) return true;
      return fold(`${row.recipientName ?? ""} ${row.event ?? ""} ${row.text} ${SMS_SOURCE_LABELS[row.source] ?? row.source}`).includes(q);
    });
  }, [rows, query, onlyFailed]);

  const failedCount = (rows ?? []).filter((row) => row.status === "failed").length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Breadcrumb />
      <div>
        <h1 className="text-2xl font-light tracking-tight text-white">SMS-uri trimise</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Toate SMS-urile plecate de la site spre clienți: ora, numărul, evenimentul și textul exact. Cele trimise înainte de 27 oct. 2026 nu apar aici.{" "}
          <Link to="/admin/album-updates" className="underline hover:text-white">← Noutăți în masă</Link>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${input} min-w-[200px] flex-1`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Caută telefon, client, eveniment sau text…"
          aria-label="Caută în SMS-uri"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} />
          Doar eșuate ({failedCount})
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {!rows && !error && <p className="text-sm text-neutral-500">Se încarcă SMS-urile…</p>}
      {rows && visible.length === 0 && (
        <p className="text-sm text-neutral-500">{rows.length === 0 ? "Niciun SMS trimis încă." : "Niciun SMS pentru căutarea asta."}</p>
      )}
      {rows && rows.length > 0 && <p className="text-xs text-neutral-500">{visible.length} din {rows.length} SMS-uri</p>}

      <ul className="space-y-2" aria-label="SMS-uri trimise">
        {visible.map((row) => (
          <li key={row.id} className={`border bg-neutral-950 p-3 ${row.status === "failed" ? "border-red-900" : "border-neutral-800"}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold text-white">{formatWhen(row.createdAt)}</span>
              <a href={`tel:${row.to}`} className="font-mono text-neutral-200 underline-offset-2 hover:underline">{row.to}</a>
              {row.recipientName && <span className="text-neutral-300">{row.recipientName}</span>}
              <span className={`ml-auto text-xs font-bold uppercase tracking-wider ${row.status === "failed" ? "text-red-400" : "text-neutral-400"}`}>
                {row.status === "failed" ? "✕ Eșuat" : "✓ Trimis"}
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {SMS_SOURCE_LABELS[row.source] ?? row.source}
              {row.event && (
                <>
                  {" · "}
                  {ALBUM_SOURCES.has(row.source) ? (
                    <a href={`/media/${encodeURIComponent(row.event)}`} target="_blank" rel="noreferrer" className="underline hover:text-white">{row.event} ↗</a>
                  ) : row.event}
                </>
              )}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-200">{row.text}</p>
            {row.error && <p className="mt-1 break-words text-xs text-red-400">{row.error}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
