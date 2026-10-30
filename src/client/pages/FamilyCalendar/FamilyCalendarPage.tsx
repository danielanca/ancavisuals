/*
 * Purpose: /zile-ocupate — the family calendar for Estera. She signs in with her email and a
 * 6-digit code sent by email (or the email's "Intră în calendar" button, ?intra=…), then sees the
 * confirmed events as a month calendar or a list with each event's date and price, can subscribe
 * in Google Calendar / iPhone, and asks for days kept free for the family (the owner approves).
 * Salomeea (viewer "helper") signs in the same way and only sees her events: no prices, no family time.
 * Server: /api/family-calendar (familyCalendar.routes.ts), shared: src/shared/familyCalendar.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  addDays, eventEmoji, eventsBetween, eventTitle, FAMILY_TIME_STATUS_LABEL, formatEur, googleCalendarSubscribeUrl, mondayOf,
  type FamilyCalendarData, type FamilyCalendarEvent, type FamilyTimeRequest,
} from "../../../shared/familyCalendar";

type View = "calendar" | "list";
const VIEW_KEY = "familyCalendar:view";
const EMAIL_KEY = "familyCalendar:email";

const MONTHS = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
const WEEKDAYS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];

const todayLocal = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
const formatDay = (day: string, withYear = false) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
const formatRange = (start: string, end: string) => (start === end ? formatDay(start, true) : `${formatDay(start)} – ${formatDay(end, true)}`);
const formatEventDays = (event: FamilyCalendarEvent) =>
  event.dates.length > 1 ? `${formatDay(event.dates[0])} – ${formatDay(event.dates[event.dates.length - 1])}` : formatDay(event.dates[0]);

function readStored(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStored(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode: just not remembered */ }
}

async function postJson(path: string, body?: unknown, method = "POST") {
  const res = await fetch(`/api/family-calendar${path}`, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Ceva n-a mers. Încearcă din nou.");
  return data;
}

// --- Login: email → 6-digit code ---

function LoginForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState(() => readStored(EMAIL_KEY) ?? "");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const requestCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const { channel } = await postJson("/login/request", { email: email.trim() });
      writeStored(EMAIL_KEY, email.trim());
      setStep("code");
      setCode("");
      setInfo(channel === "sms"
        ? `Ți-am trimis prin SMS un cod de 6 cifre la ${email.trim()}. E valabil 10 minute.`
        : email.includes("@")
          ? `Ți-am trimis un cod de 6 cifre pe ${email.trim()}. E valabil 10 minute.`
          : "Ți-am trimis un cod de 6 cifre pe email. E valabil 10 minute.");
      window.setTimeout(() => codeRef.current?.focus(), 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Codul nu a putut fi trimis.");
    } finally {
      setBusy(false);
    }
  };

  const verify = useCallback(async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      await postJson("/login/verify", { email: email.trim(), code: value });
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Codul nu e corect.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }, [email, onSignedIn]);

  const changeCode = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !busy) void verify(digits);
  };

  const pasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.match(/\d{6}/)?.[0];
      if (!digits) {
        setError("În clipboard nu e un cod de 6 cifre. Copiază codul primit și apasă din nou.");
        return;
      }
      changeCode(digits);
    } catch {
      setError("Browserul nu m-a lăsat să citesc clipboard-ul. Ține apăsat în căsuță și alege „Lipește”.");
    }
  };

  const input = "w-full border border-neutral-300 bg-white px-3 py-3 text-base focus:border-neutral-900 focus:outline-none";
  const primary = "w-full bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50";

  return (
    <section aria-label="Intră în calendar" className="mx-auto max-w-sm space-y-4 border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Intră în calendar</h2>
      {step === "email" ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void requestCode(); }}>
          <label htmlFor="family-login-email" className="block text-sm text-neutral-700">Emailul sau telefonul tău</label>
          <input id="family-login-email" type="text" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          <button type="submit" disabled={busy || !email.trim()} className={primary}>{busy ? "Se trimite…" : "Trimite-mi codul"}</button>
          <p className="text-xs text-neutral-500">Nu ai nevoie de parolă: primești pe email sau prin SMS un cod pe care îl folosești o singură dată.</p>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) void verify(code); }}>
          {info && <p role="status" className="text-sm text-neutral-700">{info}</p>}
          <label htmlFor="family-login-code" className="block text-sm text-neutral-700">Codul primit</label>
          <div className="flex gap-2">
            <input
              id="family-login-code"
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => changeCode(e.target.value)}
              className={`${input} text-center font-mono text-2xl tracking-[0.4em]`}
              placeholder="000000"
            />
            <button type="button" onClick={() => void pasteCode()} disabled={busy} className="shrink-0 border border-neutral-900 px-3 text-sm font-semibold hover:bg-neutral-100 disabled:opacity-50">
              📋 Lipește
            </button>
          </div>
          <button type="submit" disabled={busy || code.length !== 6} className={primary}>{busy ? "Se verifică…" : "Intră"}</button>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={() => void requestCode()} disabled={busy} className="underline disabled:opacity-50">Trimite alt cod</button>
            <button type="button" onClick={() => { setStep("email"); setInfo(null); setError(null); }} className="underline">Alt email sau telefon</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}

// --- Calendar pieces ---

function EventRow({ event, today, withPrice }: { event: FamilyCalendarEvent; today: string; withPrice: boolean }) {
  const past = event.dates[event.dates.length - 1] < today;
  return (
    <li className={`flex items-start gap-3 border border-neutral-200 bg-white px-4 py-3 ${past ? "opacity-50" : ""}`}>
      <span className="text-2xl leading-none" aria-hidden="true">{eventEmoji(event.type)}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold capitalize text-neutral-900">{formatEventDays(event)}</p>
        <p className="text-sm text-neutral-800">{eventTitle(event)}</p>
        {event.location && <p className="text-xs text-neutral-500">{event.location}</p>}
      </div>
      {withPrice && <p className="shrink-0 text-sm font-semibold text-neutral-900">{event.total !== null ? formatEur(event.total) : "—"}</p>}
    </li>
  );
}

const inRange = (day: string, request: FamilyTimeRequest) => day >= request.startDate && day <= request.endDate;

function MonthGrid({ year, month, byDay, familyTime, today, selected, onSelect }: {
  year: number; month: number; byDay: Map<string, FamilyCalendarEvent[]>; familyTime: readonly FamilyTimeRequest[];
  today: string; selected: string | null; onSelect: (day: string) => void;
}) {
  const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const start = mondayOf(first);
  const cells = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const rows = cells[35].slice(0, 7) === first.slice(0, 7) ? 6 : 5;
  return (
    <div className="grid grid-cols-7 border-l border-t border-neutral-200 bg-white">
      {WEEKDAYS.map((day) => (
        <div key={day} className="border-b border-r border-neutral-200 py-1.5 text-center text-[11px] font-semibold uppercase text-neutral-500">{day}</div>
      ))}
      {cells.slice(0, rows * 7).map((day) => {
        const inMonth = day.slice(0, 7) === first.slice(0, 7);
        const events = byDay.get(day) ?? [];
        const family = familyTime.filter((request) => request.status !== "rejected" && inRange(day, request));
        const label = [...events.map(eventTitle), ...family.map((request) => (request.status === "approved" ? "timp pentru familie" : "cerere pentru familie"))];
        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            aria-label={`${formatDay(day, true)}${label.length ? `: ${label.join(", ")}` : ""}`}
            aria-pressed={selected === day}
            className={`flex min-h-16 flex-col items-stretch gap-0.5 border-b border-r border-neutral-200 p-1 text-left align-top transition-colors sm:min-h-20 ${
              selected === day ? "bg-neutral-100 outline outline-2 -outline-offset-2 outline-neutral-900" : "hover:bg-neutral-50"
            } ${inMonth ? "" : "bg-neutral-50 text-neutral-300"}`}
          >
            <span className={`text-xs ${day === today ? "inline-flex h-5 w-5 items-center justify-center self-start bg-neutral-900 font-bold text-white" : inMonth ? "text-neutral-700" : ""}`}>
              {Number(day.slice(8))}
            </span>
            {events.map((event) => (
              <span key={event.id} className="truncate bg-neutral-900 px-1 py-0.5 text-[10px] font-semibold leading-tight text-white sm:text-[11px]">
                {eventEmoji(event.type)} {event.clientName || event.type}
              </span>
            ))}
            {family.map((request) => (
              <span key={request.id} className={`truncate border px-1 py-0.5 text-[10px] font-semibold leading-tight sm:text-[11px] ${request.status === "approved" ? "border-neutral-900 text-neutral-900" : "border-dashed border-neutral-400 text-neutral-500"}`}>
                🏡 {request.status === "approved" ? "Familie" : "Cerut"}
              </span>
            ))}
          </button>
        );
      })}
    </div>
  );
}

// --- "Timp pentru familie" ---

function FamilyTimeSection({ events, requests, prefill, today, onChanged }: {
  events: readonly FamilyCalendarEvent[]; requests: readonly FamilyTimeRequest[]; prefill: string | null; today: string; onChanged: () => void;
}) {
  const [start, setStart] = useState(prefill ?? "");
  const [end, setEnd] = useState(prefill ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!prefill) return;
    setStart(prefill);
    setEnd(prefill);
  }, [prefill]);

  const last = end && end >= start ? end : start;
  const clashes = start ? eventsBetween(events, start, last) : [];

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await postJson("/family-time", { startDate: start, endDate: last, note });
      setMessage({ ok: true, text: `Cererea pentru ${formatRange(start, last)} a fost trimisă. Primești email când e aprobată.` });
      setNote("");
      onChanged();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Cererea nu a putut fi trimisă." });
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: string) => {
    setBusy(true);
    try {
      await postJson(`/family-time/${encodeURIComponent(id)}`, undefined, "DELETE");
      onChanged();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Cererea nu a putut fi retrasă." });
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none";
  return (
    <section id="timp-familie" aria-label="Timp pentru familie" className="space-y-4 border border-neutral-900 bg-white p-4">
      <div>
        <h2 className="text-base font-semibold">🏡 Cere timp pentru familie</h2>
        <p className="text-sm text-neutral-600">Alege o zi sau o perioadă pe care să o păstrăm liberă pentru noi (concediu, evenimente în familie). Daniel primește un email și o aprobă.</p>
      </div>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-neutral-700">
            <span className="block">Prima zi</span>
            <input type="date" required min={today} value={start} onChange={(e) => { setStart(e.target.value); if (!end || end < e.target.value) setEnd(e.target.value); }} className={input} />
          </label>
          <label className="space-y-1 text-sm text-neutral-700">
            <span className="block">Ultima zi <span className="text-neutral-400">(aceeași pentru o singură zi)</span></span>
            <input type="date" min={start || today} value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
          </label>
        </div>
        <label className="block space-y-1 text-sm text-neutral-700">
          <span className="block">Pentru ce? <span className="text-neutral-400">(opțional)</span></span>
          <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. Concediu la mare, ziua mamei…" className={input} />
        </label>
        {clashes.length > 0 && (
          <p className="border-l-4 border-neutral-900 bg-neutral-100 px-3 py-2 text-sm">
            În perioada asta ai deja: {clashes.map((event) => `${eventTitle(event)} (${formatEventDays(event)})`).join("; ")}.
          </p>
        )}
        <button type="submit" disabled={busy || !start} className="bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50">
          {busy ? "Se trimite…" : start ? `Cere ${start === last ? "ziua" : "perioada"}: ${formatRange(start, last)}` : "Cere perioada"}
        </button>
      </form>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-neutral-900" : "text-red-700"}`}>{message.text}</p>}

      {requests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Cererile tale</h3>
          <ul className="space-y-2">
            {requests.map((request) => (
              <li key={request.id} className={`flex flex-wrap items-start justify-between gap-2 border px-3 py-2 text-sm ${request.status === "approved" ? "border-neutral-900" : "border-neutral-200"}`}>
                <div className="min-w-0">
                  <p className="font-semibold capitalize">{formatRange(request.startDate, request.endDate)}</p>
                  {request.note && <p className="text-neutral-600">{request.note}</p>}
                  {request.reply && <p className="text-neutral-600">Daniel: „{request.reply}”</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{FAMILY_TIME_STATUS_LABEL[request.status]}</span>
                  {request.status === "pending" && (
                    <button type="button" onClick={() => void withdraw(request.id)} disabled={busy} className="text-xs underline disabled:opacity-50">Retrage</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// --- Page ---

export default function FamilyCalendarPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<FamilyCalendarData | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => (readStored(VIEW_KEY) === "list" ? "list" : "calendar"));
  const [showPast, setShowPast] = useState(false);
  const today = todayLocal();
  const [cursor, setCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState<string | null>(today);
  const [prefill, setPrefill] = useState<string | null>(null);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    document.title = "Zile ocupate";
    return () => { document.head.removeChild(meta); };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/family-calendar/events", { credentials: "same-origin" });
    if (res.status === 401) {
      setNeedsLogin(true);
      setData(null);
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Calendarul nu a putut fi încărcat.");
    setNeedsLogin(false);
    setData(body as FamilyCalendarData);
  }, []);

  // The email's "Intră în calendar" button: ?intra=<one-time link> signs in, then leaves the URL clean.
  useEffect(() => {
    const magic = new URLSearchParams(location.search).get("intra");
    const start = magic
      ? postJson("/login/verify", { magic }).catch((e: unknown) => setError(e instanceof Error ? `${e.message} Cere un cod mai jos.` : null)).finally(() => navigate(location.pathname, { replace: true }))
      : Promise.resolve();
    start.then(load).catch((e: unknown) => setError(e instanceof Error ? e.message : "Calendarul nu a putut fi încărcat."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseView = (next: View) => {
    setView(next);
    writeStored(VIEW_KEY, next);
  };

  const logout = async () => {
    await postJson("/logout").catch(() => undefined);
    setData(null);
    setNeedsLogin(true);
  };

  const events = useMemo(() => data?.events ?? [], [data]);
  const familyTime = useMemo(() => data?.familyTime ?? [], [data]);
  const byDay = useMemo(() => {
    const map = new Map<string, FamilyCalendarEvent[]>();
    for (const event of events) for (const day of event.dates) map.set(day, [...(map.get(day) ?? []), event]);
    return map;
  }, [events]);

  const weekStart = mondayOf(today);
  const thisWeek = eventsBetween(events, weekStart, addDays(weekStart, 6));
  const next = events.find((event) => event.dates[event.dates.length - 1] >= today);
  const listed = useMemo(() => (showPast ? events : events.filter((event) => event.dates[event.dates.length - 1] >= today)), [events, showPast, today]);
  const byMonth = useMemo(() => {
    const groups: { month: string; events: FamilyCalendarEvent[] }[] = [];
    for (const event of listed) {
      const month = event.dates[0].slice(0, 7);
      if (groups[groups.length - 1]?.month !== month) groups.push({ month, events: [] });
      groups[groups.length - 1].events.push(event);
    }
    return groups;
  }, [listed]);

  const moveMonth = (delta: number) => setCursor(({ year, month }) => {
    const index = year * 12 + month + delta;
    return { year: Math.floor(index / 12), month: index % 12 };
  });

  const askForDay = (day: string) => {
    setPrefill(day);
    document.getElementById("timp-familie")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  const family = data?.viewer !== "helper";
  const selectedFamily = selected ? familyTime.filter((request) => request.status !== "rejected" && inRange(selected, request)) : [];

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">Anca Visuals</p>
            <h1 className="text-2xl font-light">Zile ocupate</h1>
            <p className="text-sm text-neutral-600">
              {!data ? "Evenimentele confirmate din calendarul Anca Visuals." : family ? "Nunțile și celelalte evenimente confirmate, cu data și prețul fiecăruia." : "Evenimentele la care lucrezi cu noi."}
            </p>
          </div>
          {data && <button type="button" onClick={() => void logout()} className="shrink-0 text-xs underline">Ieși</button>}
        </header>

        {error && <p role="alert" className="border border-neutral-300 bg-white p-3 text-sm text-red-700">{error}</p>}
        {needsLogin && <LoginForm onSignedIn={() => { setError(null); void load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Calendarul nu a putut fi încărcat.")); }} />}
        {!data && !needsLogin && !error && <p className="text-sm text-neutral-500">Se încarcă…</p>}

        {data && (
          <>
            <section className="grid gap-3 sm:grid-cols-2" aria-label="Pe scurt">
              <div className="border border-neutral-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Săptămâna aceasta</p>
                {thisWeek.length === 0 ? (
                  <p className="mt-1 text-sm">Niciun eveniment.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {thisWeek.map((event) => (
                      <li key={event.id}><span className="font-semibold capitalize">{formatDay(event.dates[0])}</span> · {eventTitle(event)}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border border-neutral-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Următorul eveniment</p>
                <p className="mt-1 text-sm">
                  {next ? <><span className="font-semibold capitalize">{formatDay(next.dates[0], true)}</span> · {eventTitle(next)}</> : "Nimic programat."}
                </p>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div role="tablist" aria-label="Mod de afișare" className="flex border border-neutral-900">
                {(["calendar", "list"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={view === option}
                    onClick={() => chooseView(option)}
                    className={`px-4 py-2 text-sm font-semibold ${view === option ? "bg-neutral-900 text-white" : "bg-white text-neutral-900 hover:bg-neutral-100"}`}
                  >
                    {option === "calendar" ? "📅 Calendar" : "📋 Listă"}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <a href={googleCalendarSubscribeUrl(data.icsUrl)} target="_blank" rel="noreferrer" className="border border-neutral-900 bg-white px-3 py-2 hover:bg-neutral-900 hover:text-white">
                  + Google Calendar
                </a>
                <a href={data.icsUrl.replace(/^https?:\/\//, "webcal://")} className="border border-neutral-900 bg-white px-3 py-2 hover:bg-neutral-900 hover:text-white">
                  + iPhone
                </a>
              </div>
            </div>

            {view === "calendar" ? (
              <section aria-label="Calendar" className="space-y-3">
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => moveMonth(-1)} aria-label="Luna anterioară" className="border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:border-neutral-900">←</button>
                  <h2 className="text-base font-semibold">{MONTHS[cursor.month]} {cursor.year}</h2>
                  <button type="button" onClick={() => moveMonth(1)} aria-label="Luna următoare" className="border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:border-neutral-900">→</button>
                </div>
                <MonthGrid year={cursor.year} month={cursor.month} byDay={byDay} familyTime={familyTime} today={today} selected={selected} onSelect={setSelected} />
                {selected && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold capitalize">{formatDay(selected, true)}</p>
                    {(byDay.get(selected) ?? []).length === 0 && selectedFamily.length === 0 && <p className="text-sm text-neutral-500">Liber, niciun eveniment.</p>}
                    {(byDay.get(selected) ?? []).length > 0 && (
                      <ul className="space-y-2">{byDay.get(selected)!.map((event) => <EventRow key={event.id} event={event} today={today} withPrice={family} />)}</ul>
                    )}
                    {selectedFamily.map((request) => (
                      <p key={request.id} className="border border-neutral-900 bg-white px-4 py-3 text-sm">
                        🏡 {request.status === "approved" ? "Timp pentru familie" : "Ai cerut ziua asta (așteaptă răspuns)"}{request.note ? ` · ${request.note}` : ""}
                      </p>
                    ))}
                    {family && selected >= today && selectedFamily.length === 0 && (
                      <button type="button" onClick={() => askForDay(selected)} className="border border-neutral-900 bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-900 hover:text-white">
                        🏡 Cere ziua asta pentru familie
                      </button>
                    )}
                  </div>
                )}
              </section>
            ) : (
              <section aria-label="Listă" className="space-y-5">
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} className="h-4 w-4 accent-neutral-900" />
                  Arată și evenimentele trecute
                </label>
                {byMonth.length === 0 && <p className="text-sm text-neutral-500">{family ? "Niciun eveniment programat." : "Nu ești programată la niciun eveniment încă."}</p>}
                {byMonth.map(({ month, events: monthEvents }) => {
                  const total = monthEvents.reduce((sum, event) => sum + (event.total ?? 0), 0);
                  return (
                    <div key={month} className="space-y-2">
                      <h2 className="flex items-baseline justify-between border-b border-neutral-900 pb-1 text-sm font-semibold uppercase tracking-wider">
                        <span>{MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</span>
                        <span className="text-xs font-normal normal-case tracking-normal text-neutral-600">
                          {monthEvents.length === 1 ? "1 eveniment" : `${monthEvents.length} evenimente`}{total > 0 ? ` · ${formatEur(total)}` : ""}
                        </span>
                      </h2>
                      <ul className="space-y-2">{monthEvents.map((event) => <EventRow key={event.id} event={event} today={today} withPrice={family} />)}</ul>
                    </div>
                  );
                })}
              </section>
            )}

            {family && <FamilyTimeSection events={events} requests={familyTime} prefill={prefill} today={today} onChanged={() => void load().catch(() => undefined)} />}

            <p className="text-xs leading-relaxed text-neutral-500">
              Cu „+ Google Calendar” sau „+ iPhone” evenimentele apar în calendarul din telefon și se actualizează singure.
              Pe iPhone primești reminder cu o săptămână și cu o zi înainte. În Google Calendar, alege notificările din setările calendarului „Evenimente AncaVisuals”.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
