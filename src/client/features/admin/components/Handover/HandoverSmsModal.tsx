import React, { useState } from "react";
import { useBodyScrollLock } from "../../../../hooks/useBodyScrollLock";

export interface HandoverSmsResult {
  to: string;
  smsSentAt: string;
  smsSentCount: number;
  status: "draft" | "sent" | "signed" | "expired";
  sentAt?: string;
}

interface HandoverSmsModalProps {
  handoverId: string;
  phone: string;
  /** Pre-filled text, already containing the PV link (with `?s=sms`). */
  initialMessage: string;
  /** Path the message must keep (`/proces-verbal/<token>`), checked here and on the server. */
  requiredLink: string;
  accessToken?: string;
  onSent: (result: HandoverSmsResult) => void;
  onClose: () => void;
}

// The server strips diacritics and emoji before sending, so the text stays plain GSM: 160 chars, 153 per part when longer.
function smsParts(text: string): number {
  return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
}

const HandoverSmsModal: React.FC<HandoverSmsModalProps> = ({ handoverId, phone, initialMessage, requiredLink, accessToken, onSent, onClose }) => {
  useBodyScrollLock(true);
  const [message, setMessage] = useState(initialMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<HandoverSmsResult | null>(null);

  const text = message.trim();
  const hasLink = text.includes(requiredLink);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/handover/${encodeURIComponent(handoverId)}/sms`, {
        method: "POST",
        headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "SMS-ul nu a putut fi trimis.");
      setSent(data as HandoverSmsResult);
      onSent(data as HandoverSmsResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "SMS-ul nu a putut fi trimis.");
    } finally {
      setSending(false);
    }
  };

  const sentTime = sent ? new Date(sent.smsSentAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] px-4" onClick={sending ? undefined : onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="handover-sms-title"
        className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="handover-sms-title" className="text-white text-base font-semibold mb-1">Trimite procesul verbal prin SMS</h2>
        <p className="text-neutral-400 text-sm mb-4">Către: <span className="text-neutral-200">{phone}</span></p>

        {sent ? (
          <>
            <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300 text-sm">
              ✅ SMS trimis la {sent.to} la ora {sentTime}. Primești email când clientul deschide linkul.
            </p>
            <button type="button" onClick={onClose}
              className="mt-5 w-full px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-sm font-semibold transition-colors">
              Închide
            </button>
          </>
        ) : (
          <>
            <label htmlFor="handover-sms-text" className="block text-neutral-400 text-xs mb-1.5">Mesaj</label>
            <textarea id="handover-sms-text" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} disabled={sending}
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm p-3 leading-relaxed focus:outline-none focus:border-neutral-500" />
            <p className="mt-1.5 text-neutral-500 text-xs">
              {text.length} caractere · ≈ {smsParts(text)} SMS · diacriticele se scot automat
            </p>
            {!hasLink && <p className="mt-2 text-amber-400 text-xs">Mesajul trebuie să conțină linkul spre procesul verbal.</p>}
            {error && <p role="alert" className="mt-2 text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={onClose} disabled={sending}
                className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 hover:text-white disabled:opacity-50 transition-colors">
                Anulează
              </button>
              <button type="button" onClick={() => void send()} disabled={sending || !hasLink}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-sm font-semibold disabled:opacity-50 transition-colors">
                {sending ? "Se trimite…" : "Trimite SMS"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HandoverSmsModal;
