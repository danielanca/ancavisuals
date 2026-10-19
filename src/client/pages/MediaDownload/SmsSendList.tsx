/*
 * Purpose: send the anonymous share link by SMS to several guests, each as a separate message
 * from the client's own phone (free, from someone they know, no group chat where everyone sees
 * each other). Recipients come from the phone's address book where the browser allows it
 * (Contact Picker API: Android Chrome; iPhone Safari doesn't) or are typed / pasted. Each
 * "Trimite" opens the messaging app with that number and the text filled in; the row is ticked.
 * The list is kept per link in localStorage, so coming back from the SMS app never loses it.
 */
import { useEffect, useRef, useState } from "react";
import { smsShareUrlTo } from "./whatsappShare";

export type SmsRecipient = { phone: string; name: string; sent: boolean };

type ContactInfo = { name?: string[]; tel?: string[] };
type ContactsManager = { select: (props: string[], options: { multiple: boolean }) => Promise<ContactInfo[]> };

const storageKey = (shareUrl: string) => `av-sms-list:${shareUrl}`;

/** Keeps digits and a leading "+"; accepts 07…, +407…, 00407…. Returns null if it can't be a phone number. */
export function cleanPhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return digits;
}

/** "0722 111 222, Mama 0733 444 555" or one per line → recipients (name = the non-digit text before the number). */
export function parseRecipients(text: string): { phone: string; name: string }[] {
  return text
    .split(/[\n,;]+/)
    .map((chunk) => {
      const match = /(\+?[\d\s().-]{8,})/.exec(chunk);
      if (!match) return null;
      const phone = cleanPhone(match[1]);
      if (!phone) return null;
      const name = chunk.replace(match[1], "").replace(/[-:–]+/g, " ").trim();
      return { phone, name };
    })
    .filter((r): r is { phone: string; name: string } => r !== null);
}

function contactsApi(): ContactsManager | null {
  if (typeof navigator === "undefined") return null;
  const api = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
  return api && typeof api.select === "function" ? api : null;
}

function readSaved(shareUrl: string): SmsRecipient[] {
  try {
    const raw = window.localStorage.getItem(storageKey(shareUrl));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type Props = { shareUrl: string; onClose: () => void };

export default function SmsSendList({ shareUrl, onClose }: Props) {
  const [recipients, setRecipients] = useState<SmsRecipient[]>(() => readSaved(shareUrl));
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const contacts = contactsApi();

  useEffect(() => {
    try { window.localStorage.setItem(storageKey(shareUrl), JSON.stringify(recipients)); } catch { /* optional */ }
  }, [recipients, shareUrl]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const addMany = (items: { phone: string; name: string }[]) => {
    setRecipients((current) => {
      const known = new Set(current.map((r) => r.phone));
      const fresh = items.filter((r) => !known.has(r.phone) && known.add(r.phone));
      return [...current, ...fresh.map((r) => ({ ...r, sent: false }))];
    });
  };

  const addTyped = () => {
    const parsed = parseRecipients(input);
    if (parsed.length === 0) {
      setError("Scrie un număr de telefon valid, de ex. 0722 123 456.");
      return;
    }
    setError(null);
    addMany(parsed);
    setInput("");
  };

  const pickContacts = async () => {
    if (!contacts) return;
    try {
      const picked = await contacts.select(["name", "tel"], { multiple: true });
      const items = picked.flatMap((c) => {
        const phone = c.tel?.map(cleanPhone).find(Boolean);
        return phone ? [{ phone, name: c.name?.[0] ?? "" }] : [];
      });
      if (items.length === 0) setError("Contactele alese nu au număr de telefon.");
      else { setError(null); addMany(items); }
    } catch {
      /* the person closed the picker */
    }
  };

  const send = (phone: string) => {
    setRecipients((current) => current.map((r) => (r.phone === phone ? { ...r, sent: true } : r)));
    window.location.href = smsShareUrlTo(phone, shareUrl);
  };

  const sentCount = recipients.filter((r) => r.sent).length;

  return (
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-black/85 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sms-list-title"
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full flex-col border-[#22c55e] bg-[#06150c] sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:border"
      >
        <header className="flex items-start gap-3 border-b border-[#166534] px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id="sms-list-title" className="text-base font-bold text-[#4ade80] sm:text-lg">💬 Trimite prin SMS</h2>
            <p className="mt-0.5 text-xs text-[#bbf7d0]">
              Alege oamenii, apoi apasă „Trimite” la fiecare: se deschide aplicația de mesaje cu textul gata scris, tu apeși Trimite și revii aici.
              <span className="block text-[#86efac]">Fiecare primește un SMS separat, de la tine. Nimeni nu vede cui l-ai mai trimis.</span>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#166534] text-xl leading-none text-[#bbf7d0] hover:bg-[#166534]"
          >
            ×
          </button>
        </header>

        <div className="border-b border-[#166534] px-4 py-3 sm:px-5">
          {contacts && (
            <button
              type="button"
              onClick={() => void pickContacts()}
              className="mb-3 w-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:from-[#4ade80]"
            >
              📇 Alege din agendă
            </button>
          )}
          <label htmlFor="sms-recipient-input" className="text-xs text-[#bbf7d0]">
            {contacts ? "Sau scrie numărul" : "Scrie numărul"} (poți lipi mai multe, separate prin virgulă sau pe rânduri noi)
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="sms-recipient-input"
              type="tel"
              inputMode="tel"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTyped(); } }}
              placeholder="Mama 0722 123 456"
              className="min-w-0 flex-1 border border-[#166534] bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-[#4ade80]"
            />
            <button type="button" onClick={addTyped} className="shrink-0 border border-[#4ade80] px-4 text-sm font-bold text-[#4ade80] hover:bg-[#166534]">
              ＋ Adaugă
            </button>
          </div>
          {error && <p role="alert" className="mt-1.5 text-xs text-red-400">{error}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
          {recipients.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#86efac]">Încă nu ai adăugat pe nimeni.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-[#86efac]">{sentCount} din {recipients.length} trimise</p>
              <ul className="space-y-2" aria-label="Destinatari SMS">
                {recipients.map((r) => (
                  <li key={r.phone} className={`flex items-center gap-2 border px-3 py-2 ${r.sent ? "border-[#166534] bg-[#0f2a18]" : "border-[#1f3d2a] bg-black"}`}>
                    <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center border text-xs ${r.sent ? "border-[#4ade80] bg-[#166534] text-[#4ade80]" : "border-[#166534]"}`}>
                      {r.sent ? "✓" : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{r.name || r.phone}</span>
                      {r.name && <span className="block text-xs text-[#86efac]">{r.phone}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => send(r.phone)}
                      aria-label={`Trimite SMS către ${r.name || r.phone}`}
                      className={`shrink-0 px-3 py-2 text-xs font-bold uppercase tracking-wide ${
                        r.sent ? "border border-[#166534] text-[#86efac] hover:bg-[#166534]" : "bg-[#22c55e] text-white hover:bg-[#4ade80]"
                      }`}
                    >
                      {r.sent ? "Din nou" : "💬 Trimite"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipients((current) => current.filter((x) => x.phone !== r.phone))}
                      aria-label={`Scoate ${r.name || r.phone} din listă`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-xl leading-none text-white/70 hover:bg-red-600 hover:text-white"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <footer className="border-t border-[#166534] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <button type="button" onClick={onClose} className="w-full border border-[#166534] px-4 py-2.5 text-sm font-semibold text-[#bbf7d0] hover:bg-[#0f2a18]">
            Gata
          </button>
        </footer>
      </div>
    </div>
  );
}
