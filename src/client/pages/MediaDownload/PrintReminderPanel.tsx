/*
 * Purpose: admin-only panel on /media/:slug — how many album photos the client picked and a
 * button that reminds the client (email + SMS automatically, WhatsApp as one-click links).
 * Once all PRINT_SELECTION_TARGET photos are picked the reminder is gone: the panel turns yellow
 * and offers the ZIP of the chosen originals instead.
 */
import { useEffect, useState } from "react";
import { isValidEmail } from "../../../shared/albumUpdates";
import {
  PRINT_SELECTION_TARGET,
  isPrintSelectionComplete,
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
  // A contact typed by hand, for this send only (the event's client data stays as it is).
  const [manualOpen, setManualOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const url = `/api/album/${encodeURIComponent(slug)}/print-reminder`;
  const headers = { Authorization: `Bearer ${accessToken ?? ""}` };

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetch(url, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PrintReminderStatus | null) => {
        if (cancelled) return;
        setStatus(data);
        // Only offer a channel the client can actually be reached on.
        setEmail(Boolean(data?.recipients.some((r) => r.email)));
        setSms(Boolean(data?.recipients.some((r) => r.phone)));
      })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, accessToken]);

  if (!status) return null;

  const send = async (force = false) => {
    setSending(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email && hasEmail,
          sms: sms && hasPhone,
          force,
          ...(manualEmailOk ? { manualEmail: manualEmail.trim() } : {}),
          ...(manualPhoneOk ? { manualPhone: manualPhone.trim() } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && data.error === "selection_complete") {
        setStatus((s) => s && { ...s, selectedCount: data.selectedCount ?? PRINT_SELECTION_TARGET });
      } else if (response.status === 429) {
        setStatus((s) => s && { ...s, lastSentAt: data.lastSentAt ?? s.lastSentAt, nextAllowedAt: data.nextAllowedAt ?? null });
        setError(force ? "Ai trimis chiar acum o reamintire — așteaptă un minut." : "Ai trimis deja o reamintire recent.");
      } else if (!response.ok) {
        setError(
          data.error === "no_recipients" ? "Evenimentul nu are email sau telefon de client."
            : data.error === "invalid_manual_email" ? "Emailul scris manual nu e valid."
              : data.error === "invalid_manual_phone" ? "Telefonul scris manual nu e valid."
                : "Nu s-a putut trimite. Încearcă din nou.",
        );
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
  const manualEmailOk = isValidEmail(manualEmail);
  // Same rule as the server: at least 7 digits (local 07… or international +…).
  const manualPhoneOk = manualPhone.replace(/\D/g, "").length >= 7;
  const hasEmail = recipients.some((r) => r.email) || manualEmailOk;
  const hasPhone = recipients.some((r) => r.phone) || manualPhoneOk;
  const nothingChosen = !(email && hasEmail) && !(sms && hasPhone);
  const complete = isPrintSelectionComplete(selectedCount);

  // Same ZIP as the page's own print download (POST → attachment, originals from photos/).
  const downloadSelection = () => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/api/album/${encodeURIComponent(slug)}/download-print-dynamic`;
    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  return (
    <section
      className={`my-4 border p-4 text-sm text-neutral-200 ${complete ? "border-yellow-400 bg-yellow-400/10" : "border-neutral-700 bg-neutral-950"}`}
      aria-label="Reamintire alegere poze"
    >
      <p className={`text-xs uppercase tracking-wide ${complete ? "text-yellow-300" : "text-neutral-500"}`}>🛠 Admin · poze pentru album</p>
      <p className="mt-1 font-semibold text-white">
        {complete
          ? `✅ Clientul a ales toate cele ${PRINT_SELECTION_TARGET} de poze.`
          : selectedCount === 0
            ? "Clientul nu a ales încă nicio poză pentru album."
            : `Clientul a ales ${selectedCount} din ${PRINT_SELECTION_TARGET} de poze.`}
      </p>
      {complete && (
        <>
          <p className="mt-1 text-xs text-yellow-100/80">Selecția e completă — nu mai e nevoie de reamintire. Poți descărca pozele pentru album.</p>
          <button
            type="button"
            onClick={downloadSelection}
            className="mt-3 border border-yellow-400 bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-300"
          >
            ⬇ Descarcă cele {selectedCount} poze alese (ZIP)
          </button>
        </>
      )}
      <p className="mt-1 text-xs text-neutral-400">
        {recipients.length === 0
          ? "Niciun eveniment cu email/telefon nu e legat de acest album."
          : `Către: ${recipients.map((r) => [r.name || "client", r.email, r.phone].filter(Boolean).join(" · ")).join("; ")}`}
      </p>
      {lastSentAt && <p className="mt-1 text-xs text-neutral-400">Ultima reamintire: {formatWhen(lastSentAt)}</p>}

      {!complete && (
        <div className="mt-3">
          {manualOpen ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => { setManualEmail(e.target.value); if (isValidEmail(e.target.value)) setEmail(true); }}
                placeholder="email manual"
                aria-label="Email manual"
                className="min-w-0 flex-1 border border-neutral-700 bg-black px-3 py-1.5 text-xs text-white outline-none focus:border-white"
              />
              <input
                type="tel"
                value={manualPhone}
                onChange={(e) => { setManualPhone(e.target.value); if (e.target.value.replace(/\D/g, "").length >= 7) setSms(true); }}
                placeholder="telefon manual (07… sau +…)"
                aria-label="Telefon manual"
                className="min-w-0 flex-1 border border-neutral-700 bg-black px-3 py-1.5 text-xs text-white outline-none focus:border-white"
              />
              <button
                type="button"
                onClick={() => { setManualOpen(false); setManualEmail(""); setManualPhone(""); }}
                className="text-xs text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setManualOpen(true)} className="text-xs text-neutral-400 underline underline-offset-4 hover:text-white">
              + Adaugă email / telefon manual
            </button>
          )}
          {manualOpen && <p className="mt-1 text-[11px] text-neutral-500">Folosit doar pentru această reamintire, nu se salvează la eveniment.</p>}
        </div>
      )}

      {(recipients.length > 0 || manualEmailOk || manualPhoneOk) && !complete && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className={`flex items-center gap-2 ${hasEmail ? "" : "text-neutral-600"}`}>
            <input type="checkbox" checked={email && hasEmail} disabled={!hasEmail} onChange={(e) => setEmail(e.target.checked)} />
            Email{!hasEmail && <span className="text-xs"> (fără email)</span>}
          </label>
          <label className={`flex items-center gap-2 ${hasPhone ? "" : "text-neutral-600"}`}>
            <input type="checkbox" checked={sms && hasPhone} disabled={!hasPhone} onChange={(e) => setSms(e.target.checked)} />
            SMS{!hasPhone && <span className="text-xs"> (fără telefon)</span>}
          </label>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || blocked || nothingChosen}
            className="border border-white bg-white px-4 py-2 font-bold text-black disabled:opacity-40"
          >
            {sending ? "Se trimite..." : "📩 Trimite reamintire: alege pozele"}
          </button>
        </div>
      )}
      {blocked && nextAllowedAt && !complete && (recipients.length > 0 || manualEmailOk || manualPhoneOk) && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
          <span>Pauză recomandată până la {formatWhen(nextAllowedAt)}.</span>
          <button
            type="button"
            onClick={() => void send(true)}
            disabled={sending || nothingChosen}
            className="border border-neutral-500 px-3 py-1.5 font-semibold text-white hover:border-white disabled:opacity-40"
          >
            {sending ? "Se trimite..." : "Trimite din nou oricum"}
          </button>
        </div>
      )}
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
