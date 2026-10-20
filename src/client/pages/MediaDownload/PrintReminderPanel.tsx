/*
 * Purpose: admin-only panel on /media/:slug — how many album photos the client picked and a
 * button that reminds the client (email + SMS automatically, WhatsApp as one-click links).
 */
import { useEffect, useState } from "react";
import {
  PRINT_SELECTION_TARGET,
  type PrintReminderResult,
  type PrintReminderStatus,
} from "../../../shared/printSelectionReminder";

type Props = { slug: string; accessToken: string | null };

const formatWhen = (ms: number) =>
  new Date(ms).toLocaleString("ro-RO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function PrintReminderPanel({ slug, accessToken }: Props) {
  const [status, setStatus] = useState<PrintReminderStatus | null>(null);
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<PrintReminderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/album/${encodeURIComponent(slug)}/print-reminder`;
  const headers = { Authorization: `Bearer ${accessToken ?? ""}` };

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetch(url, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PrintReminderStatus | null) => { if (!cancelled) setStatus(data); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, accessToken]);

  if (!status) return null;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ email, sms }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 429) {
        setStatus((s) => s && { ...s, lastSentAt: data.lastSentAt ?? s.lastSentAt, nextAllowedAt: data.nextAllowedAt ?? null });
        setError("Ai trimis deja o reamintire recent.");
      } else if (!response.ok) {
        setError(data.error === "no_recipients" ? "Evenimentul nu are email sau telefon de client." : "Nu s-a putut trimite. Încearcă din nou.");
      } else {
        setResult(data as PrintReminderResult);
        setStatus((s) => s && { ...s, lastSentAt: data.lastSentAt, nextAllowedAt: data.nextAllowedAt });
      }
    } catch {
      setError("Nu s-a putut trimite. Verifică conexiunea.");
    } finally {
      setSending(false);
    }
  };

  const { selectedCount, recipients, lastSentAt, nextAllowedAt } = status;
  const blocked = nextAllowedAt !== null && nextAllowedAt > Date.now();
  const nothingChosen = !email && !sms;

  return (
    <section className="my-4 border border-neutral-700 bg-neutral-950 p-4 text-sm text-neutral-200" aria-label="Reamintire alegere poze">
      <p className="text-xs uppercase tracking-wide text-neutral-500">🛠 Admin · poze pentru album</p>
      <p className="mt-1 font-semibold text-white">
        {selectedCount === 0
          ? "Clientul nu a ales încă nicio poză pentru album."
          : `Clientul a ales ${selectedCount} din ${PRINT_SELECTION_TARGET} de poze.`}
      </p>
      <p className="mt-1 text-xs text-neutral-400">
        {recipients.length === 0
          ? "Niciun eveniment cu email/telefon nu e legat de acest album."
          : `Către: ${recipients.map((r) => [r.name || "client", r.email, r.phone].filter(Boolean).join(" · ")).join("; ")}`}
      </p>
      {lastSentAt && <p className="mt-1 text-xs text-neutral-400">Ultima reamintire: {formatWhen(lastSentAt)}</p>}

      {recipients.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} /> SMS</label>
          <button
            type="button"
            onClick={send}
            disabled={sending || blocked || nothingChosen}
            className="border border-white bg-white px-4 py-2 font-bold text-black disabled:opacity-40"
          >
            {sending ? "Se trimite..." : "📩 Trimite reamintire: alege pozele"}
          </button>
        </div>
      )}
      {blocked && nextAllowedAt && <p className="mt-2 text-xs text-neutral-400">Poți trimite din nou după {formatWhen(nextAllowedAt)}.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}

      {result && (
        <div className="mt-3 border-t border-neutral-800 pt-3 text-xs" role="status">
          <p>
            Trimis: {result.emailed} email{result.smsSent || result.smsFailed ? `, ${result.smsSent} SMS` : ""}
            {result.smsFailed > 0 && ` (${result.smsFailed} SMS eșuate — vezi logul serverului)`}
            {result.smsSkipped && " · SMS-ul nu e configurat pe server"}
          </p>
          {result.whatsapp.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {result.whatsapp.map((w) => (
                <a key={w.url} href={w.url} target="_blank" rel="noopener noreferrer" className="border border-neutral-600 px-3 py-1.5 text-neutral-200 hover:border-white">
                  Trimite și pe WhatsApp → {w.name || "client"}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
