/*
 * Purpose: /admin/calendar-familie — "Calendar familie": Estera's requests for family time
 * (approve / decline, she gets an email), the invite email to ancavisuals.ro/zile-ocupate (she
 * signs in with her email + a one-time code), the Monday "plan of the week" email, signing her out
 * everywhere and a new secret link for the phone-calendar feed. Also Salomeea (the helper): her
 * email and the events she's assigned to, which she sees on the same page without prices. Phones for
 * both: SMS login codes, Salomeea's "you're assigned" notice and the reminders a week and a day before.
 * Server: /api/admin/family-calendar + /api/admin/family-time (adminCalendar.routes.ts).
 */
import { useEffect, useState } from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import {
  eventEmoji, eventTitle, FAMILY_TIME_STATUS_LABEL, type FamilyCalendarEvent, type FamilyTimeRequest,
} from "../../../../shared/familyCalendar";

export type FamilyCalendarState = {
  pageUrl: string;
  icsUrl: string;
  recipientEmail: string;
  weeklyEmail: boolean;
  lastEmailAt: string | null;
  helperEmail: string;
  helperEventIds: string[];
  helperIcsUrl: string;
  recipientPhone: string;
  helperPhone: string;
  reminders: boolean;
  smsConfigured: boolean;
  /** Confirmed events, to tick the helper's (not `events`: the send-email replies use that for a count). */
  calendarEvents: FamilyCalendarEvent[];
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("ro-RO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });
const formatDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const formatRange = (start: string, end: string) => (start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`);
const formatEventDays = (dates: readonly string[]) =>
  dates.length > 1 ? `${formatDay(dates[0])} – ${formatDay(dates[dates.length - 1])}` : formatDay(dates[0]);
const todayLocal = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
const dayCount = (start: string, end: string) => Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1;

function RequestCard({ request, busy, onDecide, onDelete }: {
  request: FamilyTimeRequest; busy: boolean;
  onDecide: (status: "approved" | "rejected", reply: string) => void; onDelete: () => void;
}) {
  const [reply, setReply] = useState("");
  const days = dayCount(request.startDate, request.endDate);
  const tone = request.status === "pending" ? "border-amber-500 bg-amber-500/10" : request.status === "approved" ? "border-emerald-600 bg-emerald-500/10" : "border-neutral-700 bg-neutral-900";
  return (
    <li aria-label={formatRange(request.startDate, request.endDate)} className={`space-y-2 border border-l-4 p-3 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold capitalize text-white">{formatRange(request.startDate, request.endDate)}</p>
          <p className="text-xs text-neutral-400">{days === 1 ? "1 zi" : `${days} zile`} · cerută pe {formatWhen(request.createdAt)}</p>
        </div>
        <span className="text-xs font-semibold text-neutral-200">{FAMILY_TIME_STATUS_LABEL[request.status]}</span>
      </div>
      {request.note && <p className="text-sm text-neutral-200">„{request.note}”</p>}
      {request.reply && <p className="text-xs text-neutral-400">Răspunsul tău: {request.reply}</p>}
      {request.status === "pending" ? (
        <div className="space-y-2">
          <input
            aria-label="Mesaj pentru Estera (opțional)"
            placeholder="Mesaj pentru Estera (opțional)"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="w-full border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => onDecide("approved", reply)} className="border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">✓ Aprobă</button>
            <button type="button" disabled={busy} onClick={() => onDecide("rejected", reply)} className="border border-neutral-600 px-3 py-1.5 text-sm font-semibold text-neutral-200 hover:border-white disabled:opacity-50">✕ Refuză</button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={onDelete} className="text-xs text-neutral-500 underline hover:text-white disabled:opacity-50">Șterge</button>
      )}
    </li>
  );
}

function MessageSection({ state, busy, send }: {
  state: FamilyCalendarState; busy: boolean;
  send: (body: { to: string[]; text: string; email: boolean; sms: boolean }) => Promise<boolean>;
}) {
  const [to, setTo] = useState<string[]>(["family", "helper"]);
  const [text, setText] = useState("");
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const toggle = (target: string, on: boolean) => setTo((current) => (on ? [...current, target] : current.filter((item) => item !== target)));
  const missingPhone = sms && to.some((target) => !(target === "family" ? state.recipientPhone : state.helperPhone));
  return (
    <section aria-label="Trimite un mesaj" className="space-y-3 border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">✉️ Trimite un mesaj</h2>
      <div className="flex flex-wrap gap-4 text-sm text-neutral-200">
        <label className="flex items-center gap-2"><input type="checkbox" checked={to.includes("family")} onChange={(e) => toggle("family", e.target.checked)} className="h-4 w-4 accent-white" />Estera</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={to.includes("helper")} onChange={(e) => toggle("helper", e.target.checked)} className="h-4 w-4 accent-white" />Salomeea</label>
        <span className="text-neutral-600">|</span>
        <label className="flex items-center gap-2"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="h-4 w-4 accent-white" />Email</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={sms} disabled={!state.smsConfigured} onChange={(e) => setSms(e.target.checked)} className="h-4 w-4 accent-white" />SMS</label>
      </div>
      <textarea
        aria-label="Mesajul"
        rows={3}
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="ex. Sâmbătă plecăm la 9 din Cluj, ia și bateriile de rezervă."
        className="w-full border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
      />
      {missingPhone && <p className="text-xs text-amber-300">Cine nu are telefon salvat primește doar pe email (dacă e bifat).</p>}
      <button
        type="button"
        disabled={busy || !text.trim() || to.length === 0 || (!email && !sms)}
        onClick={() => void send({ to, text, email, sms }).then((ok) => { if (ok) setText(""); })}
        className="border border-white bg-white px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
      >
        Trimite
      </button>
    </section>
  );
}

function PhoneField({ id, label, value, onChange, onSave }: { id: string; label: string; value: string; onChange: (value: string) => void; onSave: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-neutral-400" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="tel"
        autoComplete="off"
        placeholder="07xx xxx xxx"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onSave(e.target.value)}
        className="w-full max-w-xs border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
      />
    </div>
  );
}

export default function FamilyCalendarAdminPage() {
  const { auth } = useAuth();
  const [state, setState] = useState<FamilyCalendarState | null>(null);
  const [requests, setRequests] = useState<FamilyTimeRequest[] | null>(null);
  const [email, setEmail] = useState("");
  const [helperEmail, setHelperEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [helperPhone, setHelperPhone] = useState("");
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const request = async <T,>(key: string, path: string, init?: RequestInit): Promise<T | null> => {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Eroare ${res.status}`);
      return data as T;
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Ceva n-a mers." });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const call = async (key: string, path: string, init?: RequestInit) => {
    const data = await request<FamilyCalendarState & { to?: string; events?: number }>(key, `/family-calendar${path}`, init);
    if (data) {
      setState(data);
      setEmail(data.recipientEmail);
      setHelperEmail(data.helperEmail);
      setRecipientPhone(data.recipientPhone);
      setHelperPhone(data.helperPhone);
    }
    return data;
  };

  const loadRequests = async () => {
    const data = await request<{ requests: FamilyTimeRequest[] }>("requests", "/family-time");
    if (data) setRequests(data.requests);
  };

  useEffect(() => {
    void call("load", "").then(loadRequests);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (id: string, status: "approved" | "rejected", reply: string) => {
    const data = await request<{ request: FamilyTimeRequest }>(`decide-${id}`, `/family-time/${encodeURIComponent(id)}/decision`, { method: "POST", body: JSON.stringify({ status, reply }) });
    if (!data) return;
    setRequests((current) => current?.map((item) => (item.id === id ? data.request : item)) ?? null);
    setMessage({ ok: true, text: status === "approved" ? "Aprobat. Zilele apar ocupate pe site și Estera a primit email." : "Refuzat. Estera a primit email." });
  };

  const remove = async (id: string) => {
    if (!(await request(`delete-${id}`, `/family-time/${encodeURIComponent(id)}`, { method: "DELETE" }))) return;
    setRequests((current) => current?.filter((item) => item.id !== id) ?? null);
  };

  const saveEmailIfChanged = async () => {
    if (!state || email.trim() === state.recipientEmail) return true;
    return Boolean(await call("email", "", { method: "PATCH", body: JSON.stringify({ recipientEmail: email.trim() }) }));
  };

  const sendEmail = async () => {
    if (!(await saveEmailIfChanged())) return;
    const sent = await call("send", "/send-email", { method: "POST" });
    if (sent) setMessage({ ok: true, text: `Email trimis la ${sent.to}, cu ${sent.events === 1 ? "1 eveniment" : `${sent.events} evenimente`} în calendar.` });
  };

  const toggleWeekly = async (weeklyEmail: boolean) => {
    const saved = await call("weekly", "", { method: "PATCH", body: JSON.stringify({ weeklyEmail }) });
    if (saved) setMessage({ ok: true, text: weeklyEmail ? "Primește planul săptămânii în fiecare luni la 8:00." : "Emailul de luni e oprit." });
  };

  const toggleHelperEvent = async (event: FamilyCalendarEvent, assigned: boolean) => {
    if (!state) return;
    const helperEventIds = assigned ? [...state.helperEventIds, event.id] : state.helperEventIds.filter((id) => id !== event.id);
    const saved = await request<FamilyCalendarState & { notified?: { email: boolean; sms: boolean; events: number } }>(
      `assign-${event.id}`, "/family-calendar", { method: "PATCH", body: JSON.stringify({ helperEventIds }) },
    );
    if (!saved) return;
    setState(saved);
    const told = saved.notified?.events ? [saved.notified.email && "email", saved.notified.sms && "SMS"].filter(Boolean).join(" și ") : "";
    setMessage({ ok: true, text: assigned
      ? `Salomeea vede acum: ${eventTitle(event)}.${told ? ` I-am trimis ${told}.` : ""}`
      : `Scos de la Salomeea: ${eventTitle(event)}.` });
  };

  const savePhone = async (field: "recipientPhone" | "helperPhone", value: string) => {
    if (!state || value.trim() === state[field]) return;
    const saved = await call(field, "", { method: "PATCH", body: JSON.stringify({ [field]: value.trim() }) });
    if (saved) setMessage({ ok: true, text: saved[field] ? `Telefon salvat: ${saved[field]}.` : "Telefonul a fost șters." });
  };

  const toggleReminders = async (reminders: boolean) => {
    const saved = await call("reminders", "", { method: "PATCH", body: JSON.stringify({ reminders }) });
    if (saved) setMessage({ ok: true, text: reminders ? "Reminderele sunt pornite." : "Reminderele sunt oprite." });
  };

  const saveHelperEmailIfChanged = async () => {
    if (!state || helperEmail.trim() === state.helperEmail) return true;
    return Boolean(await call("helper-email", "", { method: "PATCH", body: JSON.stringify({ helperEmail: helperEmail.trim() }) }));
  };

  const sendHelperEmail = async () => {
    if (!(await saveHelperEmailIfChanged())) return;
    const sent = await call("send-helper", "/send-helper-email", { method: "POST" });
    if (sent) setMessage({ ok: true, text: `Email trimis la ${sent.to}, cu ${sent.events === 1 ? "1 eveniment" : `${sent.events} evenimente`} de-ale ei.` });
  };

  const rotateHelper = async () => {
    if (!window.confirm("Calendarul Salomeei din telefon nu se va mai actualiza. Îl adaugă din nou din pagina ei. Continui?")) return;
    const saved = await call("rotate-helper", "/rotate", { method: "POST", body: JSON.stringify({ viewer: "helper" }) });
    if (saved) setMessage({ ok: true, text: "Link nou pentru calendarul din telefonul Salomeei." });
  };

  const sendMessage = async (body: { to: string[]; text: string; email: boolean; sms: boolean }) => {
    const data = await request<{ results: { name: string; email: boolean; sms: boolean }[] }>("message", "/family-calendar/message", { method: "POST", body: JSON.stringify(body) });
    if (!data) return false;
    const parts = data.results.map(({ name, email: byEmail, sms: bySms }) => {
      const how = [byEmail && "email", bySms && "SMS"].filter(Boolean).join(" + ");
      return how ? `${name}: ${how}` : `${name}: nimic trimis`;
    });
    const ok = data.results.some((item) => item.email || item.sms);
    setMessage({ ok, text: `${ok ? "Mesaj trimis" : "Mesajul n-a plecat"}. ${parts.join(", ")}.` });
    return ok;
  };

  const signOutAll = async () => {
    if (!window.confirm("Estera și Salomeea vor trebui să intre din nou cu un cod pe email, pe toate dispozitivele. Continui?")) return;
    const data = await request<{ signedOut: number }>("signout", "/family-calendar/sign-out-all", { method: "POST" });
    if (data) setMessage({ ok: true, text: data.signedOut ? `Deconectat ${data.signedOut === 1 ? "1 dispozitiv" : `${data.signedOut} dispozitive`}.` : "Nu era nimeni conectat." });
  };

  const rotate = async () => {
    if (!window.confirm("Calendarul adăugat în telefon (Google / iPhone) nu se va mai actualiza. Estera îl adaugă din nou din pagina ei. Continui?")) return;
    const saved = await call("rotate", "/rotate", { method: "POST" });
    if (saved) setMessage({ ok: true, text: "Link nou pentru calendarul din telefon. Estera îl găsește la „+ Google Calendar” / „+ iPhone” pe pagina ei." });
  };

  const copy = async () => {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(state.pageUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ ok: false, text: "Nu am putut copia. Selectează linkul și copiază-l manual." });
    }
  };

  const button = "border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50";
  const plain = `${button} border-neutral-700 text-neutral-200 hover:border-white hover:text-white`;
  const pending = requests?.filter((item) => item.status === "pending") ?? [];
  const decided = requests?.filter((item) => item.status !== "pending") ?? [];
  const today = todayLocal();
  const assignable = state?.calendarEvents.filter((event) => showPastEvents || event.dates[event.dates.length - 1] >= today || state.helperEventIds.includes(event.id)) ?? [];
  const assignedCount = state ? state.calendarEvents.filter((event) => state.helperEventIds.includes(event.id)).length : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Breadcrumb />
      <div>
        <h1 className="text-2xl font-light tracking-tight text-white">Calendar familie</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Pe ancavisuals.ro/zile-ocupate Estera intră cu emailul sau telefonul ei și un cod. Vede evenimentele confirmate
          (calendar sau listă, cu data și prețul) și îți poate cere zile libere pentru familie. Salomeea vede doar evenimentele ei, fără prețuri.
        </p>
      </div>

      {message && <p role={message.ok ? "status" : "alert"} className={`border px-3 py-2 text-sm ${message.ok ? "border-emerald-700 text-emerald-300" : "border-red-700 text-red-300"}`}>{message.text}</p>}
      {!state && busy === "load" && <p className="text-sm text-neutral-500">Se încarcă…</p>}

      <section aria-label="Cereri de timp pentru familie" className="space-y-3 border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">🏡 Cereri de timp pentru familie{pending.length ? ` · ${pending.length} noi` : ""}</h2>
        {requests && requests.length === 0 && <p className="text-sm text-neutral-500">Nicio cerere încă. Când Estera cere o zi sau o perioadă, primești email și o vezi aici.</p>}
        {requests && requests.length > 0 && (
          <ul className="space-y-2">
            {[...pending, ...decided].map((item) => (
              <RequestCard key={item.id} request={item} busy={busy !== null} onDecide={(status, reply) => void decide(item.id, status, reply)} onDelete={() => void remove(item.id)} />
            ))}
          </ul>
        )}
        <p className="text-xs text-neutral-500">Zilele aprobate apar ocupate în verificarea de disponibilitate de pe site și la chatbot, fără motiv.</p>
      </section>

      {state && (
        <>
          <section className="space-y-3 border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">📧 Invitația pe email</h2>
            <label className="block text-xs text-neutral-400" htmlFor="family-calendar-email">Emailul Esterei (doar el poate intra)</label>
            <div className="flex flex-wrap gap-2">
              <input
                id="family-calendar-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-[220px] flex-1 border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
              />
              <button type="button" onClick={() => void sendEmail()} disabled={busy !== null} className={`${button} border-white bg-white text-neutral-950 hover:bg-neutral-200`}>
                {busy === "send" ? "Se trimite…" : "Trimite emailul"}
              </button>
            </div>
            <PhoneField id="family-calendar-phone" label="Telefonul Esterei (opțional)" value={recipientPhone} onChange={setRecipientPhone} onSave={(value) => void savePhone("recipientPhone", value)} />
            <p className="text-xs text-neutral-500">
              Primește linkul spre ancavisuals.ro/zile-ocupate, cum intră (email + cod) și lista cu ce urmează.
              {state.lastEmailAt ? ` Ultimul email: ${formatWhen(state.lastEmailAt)}.` : " Nu i-a fost trimis încă."}
            </p>
            <label className="flex items-center gap-2 pt-1 text-sm text-neutral-200">
              <input type="checkbox" checked={state.weeklyEmail} disabled={busy !== null} onChange={(e) => void toggleWeekly(e.target.checked)} className="h-4 w-4 accent-white" />
              Trimite-i în fiecare luni la 8:00 planul săptămânii
            </label>
          </section>

          <section aria-label="Salomeea" className="space-y-3 border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">👤 Salomeea · {assignedCount === 1 ? "1 eveniment" : `${assignedCount} evenimente`}</h2>
            <p className="text-xs text-neutral-500">
              Intră pe aceeași pagină cu emailul ei și un cod. Vede doar evenimentele bifate aici, fără prețuri și fără cererile pentru familie.
            </p>
            <label className="block text-xs text-neutral-400" htmlFor="family-calendar-helper-email">Emailul Salomeei</label>
            <div className="flex flex-wrap gap-2">
              <input
                id="family-calendar-helper-email"
                type="email"
                value={helperEmail}
                onChange={(e) => setHelperEmail(e.target.value)}
                onBlur={() => void saveHelperEmailIfChanged()}
                className="min-w-[220px] flex-1 border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
              />
              <button type="button" onClick={() => void sendHelperEmail()} disabled={busy !== null} className={plain}>
                {busy === "send-helper" ? "Se trimite…" : "Trimite-i invitația"}
              </button>
            </div>
            <PhoneField id="family-calendar-helper-phone" label="Telefonul Salomeei (opțional)" value={helperPhone} onChange={setHelperPhone} onSave={(value) => void savePhone("helperPhone", value)} />
            <p className="text-xs text-neutral-500">Când o bifezi la un eveniment care urmează, primește imediat email{state.helperPhone ? " și SMS" : ""} cu data și locul.</p>
            <div className="flex items-center justify-between gap-2 pt-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">La ce evenimente e asignată</h3>
              <label className="flex items-center gap-2 text-xs text-neutral-400">
                <input type="checkbox" checked={showPastEvents} onChange={(e) => setShowPastEvents(e.target.checked)} className="h-3.5 w-3.5 accent-white" />
                Arată și trecute
              </label>
            </div>
            {assignable.length === 0 ? (
              <p className="text-sm text-neutral-500">Niciun eveniment confirmat care urmează.</p>
            ) : (
              <ul className="divide-y divide-neutral-800 border border-neutral-800">
                {assignable.map((event) => {
                  const assigned = state.helperEventIds.includes(event.id);
                  return (
                    <li key={event.id}>
                      <label className={`flex cursor-pointer items-start gap-3 px-3 py-2 ${assigned ? "bg-neutral-800" : "hover:bg-neutral-950"}`}>
                        <input
                          type="checkbox"
                          checked={assigned}
                          disabled={busy !== null}
                          onChange={(e) => void toggleHelperEvent(event, e.target.checked)}
                          aria-label={`Salomeea la ${eventTitle(event)}`}
                          className="mt-1 h-4 w-4 accent-white"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold capitalize text-white">{formatEventDays(event.dates)}</span>
                          <span className="block text-sm text-neutral-300">{eventEmoji(event.type)} {eventTitle(event)}</span>
                          {event.location && <span className="block text-xs text-neutral-500">{event.location}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <button type="button" onClick={() => void rotateHelper()} disabled={busy !== null} className="text-xs text-neutral-500 underline hover:text-white disabled:opacity-50">
              Link nou pentru calendarul din telefonul ei
            </button>
          </section>

          <MessageSection state={state} busy={busy !== null} send={sendMessage} />

          <section aria-label="Remindere" className="space-y-2 border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">⏰ Remindere</h2>
            <label className="flex items-center gap-2 text-sm text-neutral-200">
              <input type="checkbox" checked={state.reminders} disabled={busy !== null} onChange={(e) => void toggleReminders(e.target.checked)} className="h-4 w-4 accent-white" />
              Cu o săptămână și cu o zi înainte de fiecare eveniment, la 9:00
            </label>
            <p className="text-xs text-neutral-500">
              Estera primește pentru toate evenimentele, Salomeea doar pentru ale ei. Pe email mereu, prin SMS doar cine are telefon salvat. Prețul apare doar în emailul Esterei.
            </p>
            {!state.smsConfigured && <p className="text-xs text-amber-300">SMS-ul nu e configurat pe server: pleacă doar emailurile.</p>}
          </section>

          <section className="space-y-3 border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">🔒 Acces</h2>
            <p className="break-all border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-200">{state.pageUrl}</p>
            <div className="flex flex-wrap gap-2">
              <a href={state.pageUrl} target="_blank" rel="noreferrer" className={plain}>Vezi ce vede Estera ↗</a>
              <button type="button" onClick={() => void copy()} className={plain}>{copied ? "✓ Copiat" : "Copiază linkul"}</button>
              <button type="button" onClick={() => void signOutAll()} disabled={busy !== null} className={plain}>Deconectează pe toată lumea</button>
            </div>
            <p className="text-xs text-neutral-500">
              Fără parolă: la fiecare intrare primește un cod de 6 cifre (valabil 10 minute) pe email sau, dacă scrie numărul de telefon salvat aici, prin SMS. Apoi rămâne conectată 90 de zile pe acel telefon.
              Tu, conectat în admin, vezi pagina direct.
            </p>
            <div className="border-t border-neutral-800 pt-3">
              <p className="text-xs text-neutral-500">
                Calendarul din telefon (Google / iPhone) folosește un link secret separat, pentru că aplicațiile de calendar nu se pot loga. Dacă a ajuns la altcineva, fă unul nou.
              </p>
              <button type="button" onClick={() => void rotate()} disabled={busy !== null} className={`${button} mt-2 border-red-800 text-red-300 hover:border-red-500`}>
                {busy === "rotate" ? "Se face…" : "Link nou pentru calendarul din telefon"}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
