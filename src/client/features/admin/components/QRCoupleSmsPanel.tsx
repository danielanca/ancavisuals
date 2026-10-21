/*
 * Purpose: /admin/qr-moments → event → "📱 SMS către miri": how many photos/videos/wishes the
 * guests left since the last SMS, the ready message, and one button that texts the couple at the
 * phone of the linked event (SMSAPI). sms: links are the fallback to send from the owner's phone.
 * The upload notification email links here (`?event=<slug>#couple-sms`) as the reminder.
 */
import { useEffect, useState } from "react";
import {
  describeQrUploads,
  totalQrUploads,
  type CoupleSmsResult,
  type CoupleSmsStatus,
} from "../../../../shared/qrMoments/coupleSms";

type Props = { eventSlug: string; authHeader: Record<string, string> };

const formatSentAt = (ms: number) =>
  new Date(ms).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function QRCoupleSmsPanel({ eventSlug, authHeader }: Props) {
  const [status, setStatus] = useState<CoupleSmsStatus | null>(null);
  const [manualPhone, setManualPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CoupleSmsResult | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const base = `/api/qr-moments/admin/${encodeURIComponent(eventSlug)}/couple-sms`;

  const load = () => fetch(base, { headers: authHeader })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: CoupleSmsStatus | null) => setStatus(data))
    .catch(() => setStatus(null));

  useEffect(() => {
    setStatus(null);
    setResult(null);
    setMessage(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  // Opened from the reminder email: bring the panel into view once it has loaded.
  useEffect(() => {
    if (status && window.location.hash === "#couple-sms") {
      document.getElementById("couple-sms")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, [status]);

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(base, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(manualPhone.trim() ? { manualPhone: manualPhone.trim() } : {}),
      });
      const data = await response.json() as CoupleSmsResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "SMS-ul nu s-a putut trimite.");
      setResult(data);
      if (data.smsSent > 0) {
        setMessage({ ok: true, text: `SMS trimis la ${data.smsSent} ${data.smsSent === 1 ? "număr" : "numere"}.` });
        setManualPhone("");
        void load();
      } else {
        setMessage({ ok: false, text: data.smsSkipped
          ? "SMS-ul automat nu e configurat pe server. Trimite-l de pe telefon cu butonul de mai jos."
          : "SMS-ul nu a plecat. Trimite-l de pe telefon cu butonul de mai jos." });
      }
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "SMS-ul nu s-a putut trimite." });
    } finally {
      setBusy(false);
    }
  };

  const markSent = async () => {
    await fetch(`${base}/sent`, { method: "POST", headers: authHeader }).catch(() => {});
    setResult(null);
    setMessage({ ok: true, text: "Notat ca trimis." });
    void load();
  };

  if (!status) return null;
  const pending = totalQrUploads(status.newCounts);

  return (
    <section id="couple-sms" className="scroll-mt-6 border border-neutral-800 bg-neutral-950 p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">📱 SMS către miri</p>
        <p className="text-xs text-neutral-500">
          {status.lastSentAt ? `Ultimul SMS: ${formatSentAt(status.lastSentAt)}` : "Niciun SMS trimis încă"}
        </p>
      </div>

      {pending > 0 ? (
        <p className="text-sm text-white">
          <span className="font-semibold">Nu uita să le spui:</span> {describeQrUploads(status.newCounts)}{" "}
          {status.lastSentAt ? "de la ultimul SMS." : "lăsate de invitați."}
        </p>
      ) : (
        <p className="text-sm text-neutral-500">Nimic nou de la ultimul SMS.</p>
      )}

      <p className="whitespace-pre-wrap border border-neutral-800 bg-black px-3 py-2 text-xs leading-relaxed text-neutral-300">{status.message}</p>

      <p className="text-xs text-neutral-500">
        {status.recipients.length > 0
          ? `Către: ${status.recipients.map((recipient) => `${recipient.name || "client"} (${recipient.phone})`).join(", ")}`
          : "Evenimentul nu are telefon. Scrie numărul mai jos."}
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          type="tel"
          value={manualPhone}
          onChange={(event) => setManualPhone(event.target.value)}
          placeholder="alt număr (opțional), ex. 07…"
          aria-label="Număr de telefon manual"
          className="min-w-0 flex-1 border border-neutral-700 bg-black px-3 py-2 text-xs text-white outline-none focus:border-white"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || pending === 0 || (status.recipients.length === 0 && !manualPhone.trim())}
          className="border border-white bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-40"
        >
          {busy ? "Se trimite…" : "📩 Trimite SMS mirilor"}
        </button>
      </div>

      {result && result.smsSent === 0 && result.manual.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {result.manual.map((link) => (
            <a key={link.url} href={link.url} className="border border-neutral-600 px-3 py-1.5 text-xs text-white hover:border-white">
              💬 Trimite de pe telefon → {link.name || "client"}
            </a>
          ))}
          <button type="button" onClick={() => void markSent()} className="text-xs text-neutral-400 underline underline-offset-4 hover:text-white">
            Am trimis, notează
          </button>
        </div>
      )}

      {message && <p role="status" className={`text-xs ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
    </section>
  );
}
