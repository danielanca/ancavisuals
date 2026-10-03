import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePriceBook } from "../../hooks/useStartingPrices";
import { sendLiveEvent } from "../../utils/liveEvent";
import LocationField from "../Contact/LocationField";
import { guessCounty } from "../../data/romaniaLocations";
import {
  CONFIGURATOR_EVENTS,
  EXTRAS,
  GUEST_TIERS,
  buildQuote,
  extraPrice,
  guestTierPrice,
  hourlyRates,
  defaultService,
  eventByKey,
  servicePrice,
  servicesFor,
  giftedExtra,
  clampHours,
  type ConfiguratorEventKey,
  type ExtraKey,
  type ServiceKey,
} from "../../../shared/pricing/eventConfigurator";

export type DatePick = { day: number | null; month: number | null; year: number | null };

interface PriceConfiguratorProps {
  waLink: (text: string) => string;
  onWhatsAppClick: (position: string) => void;
  /** Free photo booth promo (weddings only, while the countdown runs). */
  photoboothFree: boolean;
  /** The page's own date picker state — one date for the configurator and the availability form. */
  dateParts: DatePick;
  onDatePart: (patch: Partial<DatePick>) => void;
  /** "YYYY-MM-DD" once day, month and year are all picked, "" before. */
  eventDate: string;
  bookedDates: string[];
  /** A complete date was picked (once per date): report the availability check. */
  onDateChecked: (eventDate: string, available: boolean, formEventType: string) => void;
  /** Keeps the availability form's event type in sync with the configurator. */
  onEventChange: (formEventType: string) => void;
  /** "Lasă-ne numărul": the page shows its phone form for the picked date. */
  onBook: () => void;
  /** Venue + county as one line ("Restaurant X, jud. Cluj") for the availability form. */
  onLocationChange: (location: string) => void;
  /** Step 5: saves the lead (email, Ads, live panel) with the configuration as its message. */
  onSubmitLead: (contact: { name: string; phone: string; message?: string }) => Promise<boolean>;
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;

const STYLES = `
  @keyframes configuratorIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .configurator-in { animation: configuratorIn 420ms cubic-bezier(.2,.8,.2,1) both; }
  @keyframes configuratorPulse { 0% { transform: scale(1); } 40% { transform: scale(1.06); } 100% { transform: scale(1); } }
  .configurator-pulse { animation: configuratorPulse 380ms ease-out; }
  /* Free photo booth: a gold border that keeps flowing + a shine sweeping across the card. */
  .configurator-glow {
    position: relative; overflow: hidden; border: 2px solid transparent !important;
    background: linear-gradient(#fff, #fff) padding-box,
      linear-gradient(110deg, #f59e0b, #fde68a, #d97706, #fde68a, #f59e0b) border-box;
    background-size: 100% 100%, 300% 100%;
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.12), 0 18px 40px -18px rgba(217, 119, 6, 0.55);
    animation: configuratorGlow 4s linear infinite;
  }
  @keyframes configuratorGlow { to { background-position: 0 0, 300% 0; } }
  .configurator-glow::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent 30%, rgba(253, 230, 138, 0.45) 50%, transparent 70%);
    transform: translateX(-120%); animation: configuratorShine 3.2s ease-in-out infinite;
  }
  @keyframes configuratorShine { 0%, 55% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
  @media (prefers-reduced-motion: reduce) {
    .configurator-in, .configurator-pulse, .configurator-glow, .configurator-glow::after { animation: none !important; }
  }
`;

const formatAmount = (n: number) => n.toLocaleString("ro-RO");

const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
}

const INPUT_CLASS =
  "w-full rounded-xl border border-neutral-950/15 bg-white px-3.5 py-3.5 text-sm text-neutral-950 outline-none transition-colors placeholder:text-neutral-500 hover:border-neutral-300 focus:border-neutral-950";

const SELECT_CLASS =
  "w-full appearance-none rounded-xl border border-neutral-950/15 bg-white bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='m1 1 4 4 4-4' stroke='%23737373' stroke-width='1.5'/%3E%3C/svg%3E\")] bg-[length:10px_6px] bg-[right_0.9rem_center] bg-no-repeat px-3.5 py-3.5 pr-8 text-sm text-neutral-950 outline-none transition-colors hover:border-neutral-300/60 focus:border-neutral-950";

/** Counts from the old total to the new one; jumps straight there with reduced motion. */
function useCountUp(target: number, ms = 450): number {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = target;
    if (from === target || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // A background tab suspends rAF — never leave the old number on screen.
    const done = window.setTimeout(() => setShown(target), ms + 50);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(done); };
  }, [target, ms]);
  return shown;
}

function WhatsAppIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.115 1.527 5.845L.057 23.455a.5.5 0 00.614.614l5.61-1.47A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.896 0-3.673-.497-5.21-1.367l-.374-.218-3.878 1.016 1.016-3.878-.218-.374A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

/** Reports a typed value once it settles (2 s without changes): one feed line per answer, not per key. */
function useSettledTrack(value: string, send: (value: string) => void) {
  const last = useRef(value);
  useEffect(() => {
    if (!value || value === last.current) return;
    const id = window.setTimeout(() => { last.current = value; send(value); }, 2000);
    return () => window.clearTimeout(id);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-3 text-lg font-normal uppercase tracking-[0.08em] sm:text-xl">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-300/60 text-[11px] font-semibold text-neutral-500">{n}</span>
      {children}
    </h3>
  );
}

/** ?eveniment=botez preselects the event (links from event-specific ads). */
function initialEvent(): ConfiguratorEventKey {
  if (typeof window === "undefined") return "nunta";
  const param = new URLSearchParams(window.location.search).get("eveniment")?.toLowerCase();
  return eventByKey(param)?.key ?? "nunta";
}

export default function PriceConfigurator({
  waLink, onWhatsAppClick, photoboothFree, dateParts, onDatePart, eventDate, bookedDates, onDateChecked, onEventChange, onBook, onLocationChange, onSubmitLead,
}: PriceConfiguratorProps) {
  const prices = usePriceBook();
  const [eventKey, setEventKey] = useState<ConfiguratorEventKey>(initialEvent);
  const event = eventByKey(eventKey) ?? CONFIGURATOR_EVENTS[0];
  const rates = hourlyRates(event, prices);
  const [service, setService] = useState<ServiceKey>(() => defaultService(event));
  const [extras, setExtras] = useState<ExtraKey[]>([]);
  const [guestTier, setGuestTier] = useState(0);
  const [albumVariant, setAlbumVariant] = useState(0);
  const [hours, setHours] = useState(() => clampHours(event, undefined));
  const [venue, setVenue] = useState("");
  const [county, setCounty] = useState("");
  // Filled from the picked place — the visitor can still change it.
  const [countyFromPlace, setCountyFromPlace] = useState(false);
  // Typed freely; "Sib" is completed to "Sibiu" on Tab/Enter or when leaving the field.
  const countyGuess = guessCounty(county);
  const acceptCountyGuess = () => { if (countyGuess && countyGuess !== county) setCounty(countyGuess); };
  const countyName = countyGuess ?? county.trim();
  const place = [venue.trim(), countyName && `jud. ${countyName}`].filter(Boolean).join(", ");
  useEffect(() => { onLocationChange(place); }, [place]); // eslint-disable-line react-hooks/exhaustive-deps

  const freeBooth = photoboothFree && eventKey === "nunta";
  const quote = useMemo(
    () => buildQuote({ event: eventKey, service, extras, guestTier, hours, albumVariant }, prices, { photoboothFree: freeBooth }),
    [eventKey, service, extras, guestTier, hours, albumVariant, prices, freeBooth],
  );
  const shownTotal = useCountUp(quote.total);
  // Restart the pulse on every new total.
  const [pulse, setPulse] = useState(0);
  const firstTotal = useRef(true);
  useEffect(() => {
    if (firstTotal.current) { firstTotal.current = false; return; }
    setPulse((n) => n + 1);
  }, [quote.total]);

  // Also on mount: ?eveniment=botez must reach the availability form too.
  useEffect(() => { onEventChange(event.formEventType); }, [event.formEventType]); // eslint-disable-line react-hooks/exhaustive-deps

  const available = eventDate ? !bookedDates.includes(eventDate) : null;
  // Report each picked date once (the page sends the Ads micro-conversion + live event).
  const reportedDate = useRef("");
  useEffect(() => {
    if (!eventDate || reportedDate.current === eventDate) return;
    reportedDate.current = eventDate;
    onDateChecked(eventDate, !bookedDates.includes(eventDate), event.formEventType);
  }, [eventDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date();
  const [todayYear, todayMonth, todayDay] = [today.getFullYear(), today.getMonth(), today.getDate()];
  const monthKnown = dateParts.year !== null && dateParts.month !== null;
  const maxDay = monthKnown ? daysInMonth(dateParts.year!, dateParts.month!) : 31;
  const minDay = monthKnown && dateParts.year === todayYear && dateParts.month === todayMonth ? todayDay : 1;

  const pickEvent = (key: ConfiguratorEventKey) => {
    if (key === eventKey) return;
    const next = eventByKey(key)!;
    setEventKey(key);
    setService(defaultService(next));
    setHours(clampHours(next, undefined));
    setExtras((current) => current.filter((x) => next.extras.includes(x)));
    // Logged in /admin/live only (no email) — shows which events visitors come for.
    sendLiveEvent("event_type_selected", { label: next.label, meta: { eventType: next.label, source: "configurator" } });
  };

  // Funnel steps for /admin/live (panel only, never emailed) — shows where visitors stop.
  const track = (name: string, label: string, meta: Record<string, unknown> = {}) =>
    sendLiveEvent(name, { label, meta: { ...meta, eventType: event.label, source: "configurator" } });

  const pickService = (key: ServiceKey) => {
    if (key === service) return;
    setService(key);
    track("configurator_service_selected", servicesFor(event).find((s) => s.key === key)?.label ?? key, { service: key });
  };

  const toggleExtra = (key: ExtraKey) => {
    const on = !extras.includes(key);
    setExtras((current) => (current.includes(key) ? current.filter((x) => x !== key) : [...current, key]));
    track("configurator_extra_toggled", EXTRAS[key].label, { extra: key, on });
  };

  // Once per page view: the configurator came into view, then the price card did.
  const sectionRef = useRef<HTMLElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef(quote.total);
  totalRef.current = quote.total;
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || seen.has(entry.target)) continue;
        seen.add(entry.target);
        observer.unobserve(entry.target);
        if (entry.target === sectionRef.current) sendLiveEvent("configurator_viewed", { label: "Configurator", meta: { source: "configurator" } });
        else sendLiveEvent("configurator_price_seen", { label: `${totalRef.current} €`, meta: { total: totalRef.current, source: "configurator" } });
      }
    }, { threshold: 0.4 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    if (priceRef.current) observer.observe(priceRef.current);
    return () => observer.disconnect();
  }, []);

  // The first keystroke, not the focus: tapping the field by accident isn't "started typing".
  const phoneStarted = useRef(false);
  const onPhoneTyped = () => {
    if (phoneStarted.current) return;
    phoneStarted.current = true;
    track("configurator_phone_started", "Date de contact", { total: quote.total });
  };

  useSettledTrack(place, (value) => track("configurator_location_entered", value, { location: value }));
  // Only hours the visitor picked with − / + (switching to Corporate sets the minimum on its own).
  const hoursTouched = useRef(false);
  useSettledTrack(rates && hoursTouched.current ? String(hours) : "", (value) => track("configurator_hours_selected", `${value} ore`, { hours: Number(value) }));

  const whatsappMessage = [
    `Bună! Mi-am făcut configurația pe site pentru ${event.label.toLocaleLowerCase("ro-RO")}${eventDate ? `, pe ${formatDate(eventDate)}` : ""}${place ? ` (locația: ${place})` : ""}:`,
    ...quote.lines.map((line) => `• ${line.label}${line.waived ? " (ofertă: gratuit)" : ` — ${formatAmount(line.amount)} €`}`),
    `Estimare: ${formatAmount(quote.total)} €.`,
    available === null
      ? "Aș dori să verificăm disponibilitatea și detaliile."
      : available
        ? "Pe site apare că data e liberă — aș vrea să o rezervăm."
        : "Pe site apare că data e ocupată — mai aveți vreo variantă?",
  ].join("\n");

  // Step 5 — phone only, GDPR consent required.
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [leadStatus, setLeadStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const phoneOk = phone.replace(/\D/g, "").length >= 9;
  const sendLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneOk || !consent || leadStatus === "sending") return;
    setLeadStatus("sending");
    const message = [
      "Configurație trimisă din configuratorul de preț:",
      ...quote.lines.map((line) => `• ${line.label}${line.waived ? " — gratuit (cadou/ofertă)" : ` — ${formatAmount(line.amount)} €`}`),
      `Estimare: ${formatAmount(quote.total)} €`,
      "Acord GDPR: da — a cerut să fie contactat",
    ].join("\n");
    setLeadStatus((await onSubmitLead({ name: "", phone: phone.trim(), message })) ? "sent" : "error");
  };

  const eventIndex = CONFIGURATOR_EVENTS.findIndex((e) => e.key === eventKey);

  return (
    <section ref={sectionRef} id="configurator" data-live-clicks="off" className="scroll-mt-6 bg-white px-6 py-20 text-neutral-950 sm:py-24">
      <style>{STYLES}</style>
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
          <p className="flex items-center justify-center gap-4 text-[11px] uppercase tracking-[0.35em] text-neutral-500">
            <span className="h-px w-10 bg-neutral-300/60" />
            Configurator
            <span className="h-px w-10 bg-neutral-300/60" />
          </p>
          <h2 className="mt-5 text-4xl font-normal uppercase leading-tight tracking-[0.05em] sm:text-5xl">
            Află prețul
            <br />
            <span className="text-2xl text-neutral-400 sm:text-3xl">[în 30 de secunde]</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-neutral-600 sm:text-base">
            Alege evenimentul, data și ce vă doriți. Verificăm calendarul și calculăm prețul pe loc — fără formular, fără număr de telefon.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-12">
          {/* Phones: "contents" lets the contact step move below the summary card (order-last); desktop keeps the two columns. */}
          <div className="contents lg:block lg:space-y-10">
            {/* 1 — Event: segmented switch with a sliding pill */}
            <div>
              <StepTitle n={1}>Ce sărbătoriți?</StepTitle>
              <div role="radiogroup" aria-label="Tipul evenimentului" className="relative mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-neutral-100 p-1 sm:grid-cols-4">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1 top-1 hidden h-[calc(100%-0.5rem)] w-[calc((100%-0.5rem-0.75rem)/4)] rounded-xl bg-white shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)] ring-1 ring-neutral-950/10 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] sm:block"
                  style={{ transform: `translateX(calc(${eventIndex} * (100% + 0.25rem)))` }}
                />
                {CONFIGURATOR_EVENTS.map((e) => {
                  const active = e.key === eventKey;
                  return (
                    <button
                      key={e.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickEvent(e.key)}
                      className={`relative z-10 flex items-center justify-center rounded-xl px-3 py-3 text-sm font-extrabold uppercase tracking-[0.06em] transition-colors duration-300 ${
                        active ? "bg-white text-neutral-950 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)] ring-1 ring-neutral-950/10 sm:bg-transparent sm:shadow-none sm:ring-0" : "text-neutral-950"
                      }`}
                    >
                      {e.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2 — Date: same picker state as the availability form below */}
            <div id="configurator-data" className="scroll-mt-6">
              <StepTitle n={2}>Când și unde are loc evenimentul?</StepTitle>
              <div className="mt-5 grid grid-cols-[84px_minmax(0,1fr)_104px] gap-2 sm:grid-cols-[100px_minmax(0,1fr)_120px]">
                <select aria-label="Ziua (configurator)" value={dateParts.day ?? ""} onChange={(e) => onDatePart({ day: e.target.value === "" ? null : Number(e.target.value) })} className={SELECT_CLASS}>
                  <option value="">Zi</option>
                  {Array.from({ length: maxDay - minDay + 1 }, (_, i) => minDay + i).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select aria-label="Luna (configurator)" value={dateParts.month ?? ""} onChange={(e) => onDatePart({ month: e.target.value === "" ? null : Number(e.target.value) })} className={SELECT_CLASS}>
                  <option value="">Luna</option>
                  {MONTHS.map((m, i) => (dateParts.year === null || dateParts.year > todayYear || i >= todayMonth) && (
                    <option key={m} value={i}>{m[0].toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
                <select aria-label="Anul (configurator)" value={dateParts.year ?? ""} onChange={(e) => onDatePart({ year: e.target.value === "" ? null : Number(e.target.value) })} className={SELECT_CLASS}>
                  <option value="">An</option>
                  {[todayYear, todayYear + 1, todayYear + 2, todayYear + 3].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div key={eventDate || "none"} className="configurator-in mt-3" aria-live="polite">
                {available === null ? (
                  <p className="text-xs text-neutral-500">Alege ziua, luna și anul — verificăm calendarul pe loc.</p>
                ) : available ? (
                  <p className="flex items-start gap-2.5 rounded-xl bg-emerald-600/10 px-4 py-3 text-sm text-emerald-800">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] text-white">✓</span>
                    <span><strong className="font-semibold">{formatDate(eventDate)} este liberă!</strong> Datele se rezervă în ordinea confirmării.</span>
                  </p>
                ) : (
                  <p className="flex items-start gap-2.5 rounded-xl bg-red-600/10 px-4 py-3 text-sm text-red-800">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] text-white">✕</span>
                    <span><strong className="font-semibold">{formatDate(eventDate)} este deja rezervată.</strong> Scrie-ne totuși — uneori avem o a doua echipă disponibilă.</span>
                  </p>
                )}
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
                <div>
                  <label htmlFor="configurator-venue" className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-neutral-500">Locația</label>
                  {MAPS_KEY ? (
                    <LocationField
                      apiKey={MAPS_KEY}
                      variant="light"
                      loadOnFocus
                      value={venue}
                      onChange={setVenue}
                      onSelect={(p) => {
                        if (p.displayName) setVenue(p.displayName);
                        if (p.county) { setCounty(p.county); setCountyFromPlace(true); }
                      }}
                      placeholder="Restaurant, sală sau localitate"
                      inputId="configurator-venue"
                      inputClassName={INPUT_CLASS}
                    />
                  ) : (
                    <input id="configurator-venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Restaurant, sală sau localitate" className={INPUT_CLASS} />
                  )}
                </div>
                <div>
                  <label htmlFor="configurator-county" className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-neutral-500">Județ</label>
<div className="relative">
                    <input
                      id="configurator-county"
                      value={county}
                      onChange={(e) => { setCounty(e.target.value); setCountyFromPlace(false); }}
                      onBlur={acceptCountyGuess}
                      onKeyDown={(e) => {
                        if ((e.key === "Tab" || e.key === "Enter") && countyGuess && countyGuess !== county) {
                          if (e.key === "Enter") e.preventDefault();
                          acceptCountyGuess();
                        }
                      }}
                      placeholder="ex. Cluj"
                      autoComplete="off"
                      className={`${INPUT_CLASS} ${countyGuess && countyGuess !== county ? "pr-24" : ""}`}
                    />
                    {countyGuess && countyGuess !== county && (
                      <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={acceptCountyGuess}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200"
                      >
                        {countyGuess} <span aria-hidden="true" className="text-neutral-400">⇥</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {countyFromPlace && county && (
                <p className="configurator-in mt-2 text-xs text-neutral-500">Județul {county} a fost completat din locație — îl poți schimba.</p>
              )}
            </div>

            {/* 3 — Service */}
            <div>
              <StepTitle n={3}>Ce vă doriți să surprindem?</StepTitle>
              <div key={eventKey} className={`configurator-in mt-5 grid gap-3 ${["", "sm:max-w-sm", "sm:grid-cols-2", "sm:grid-cols-3"][servicesFor(event).length] ?? "sm:grid-cols-3"}`}>
                {servicesFor(event).map((s) => {
                  const active = s.key === service;
                  const recommended = s.key === "foto_video";
                  return (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => pickService(s.key)}
                      className={`relative flex flex-col rounded-2xl border bg-white p-4 text-left transition-all duration-300 sm:p-5 ${
                        active
                          ? "border-neutral-950 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.6)] ring-1 ring-neutral-950"
                          : "border-neutral-950/10 hover:-translate-y-0.5 hover:border-neutral-300/60"
                      }`}
                    >
                      {recommended && (
                        <span className="absolute -top-2.5 right-4 bg-neutral-950 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-white">Cel mai ales</span>
                      )}
                      <span className="flex items-center justify-between">
                        <span className="text-lg font-medium">{s.label}</span>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${active ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-950/25"}`}>
                          {active && <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 6.2 2.3 2.3 4.7-4.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </span>
                      </span>
                      <span className="mt-1 flex-1 text-xs leading-relaxed text-neutral-600 sm:mt-2">{s.note}</span>
                      <span className="mt-2 text-xl font-normal sm:mt-4 sm:text-2xl">
                        {formatAmount(servicePrice(event, s.key, prices, hours))} <span className="text-base text-neutral-400">€</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {rates && (
                <div key={`${eventKey}-hours`} className="configurator-in mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-neutral-950/10 bg-white p-4 sm:p-5">
                  <div>
                    <p className="text-sm font-semibold">Câte ore?</p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      <strong className="font-semibold text-neutral-950">{rates.basePrice} € pentru primele {rates.includedHours} ore</strong> (minim), apoi +{rates.extraHour} € pentru fiecare oră în plus.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Mai puține ore"
                      disabled={hours <= rates.includedHours}
                      onClick={() => { hoursTouched.current = true; setHours((h) => clampHours(event, h - 1)); }}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-950/20 text-lg transition-colors hover:border-neutral-950 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="min-w-[4.5rem] text-center text-2xl font-normal tabular-nums" aria-live="polite">
                      {hours} <span className="text-sm text-neutral-500">ore</span>
                    </span>
                    <button
                      type="button"
                      aria-label="Mai multe ore"
                      disabled={hours >= rates.maxHours}
                      onClick={() => { hoursTouched.current = true; setHours((h) => clampHours(event, h + 1)); }}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-950/20 text-lg transition-colors hover:border-neutral-950 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 4 — Extras */}
            <div>
              <StepTitle n={4}>Ceva în plus?</StepTitle>
              <div key={eventKey} className="configurator-in mt-5 space-y-3">
                {event.extras.map((key) => {
                  const extra = EXTRAS[key];
                  const on = extras.includes(key);
                  // Free = the wedding promo booth, or the event's gift while it is still up for grabs.
                  const gift = giftedExtra(event, extras, { photoboothFree: freeBooth });
                  const free = (key === "fotocabina" && freeBooth) || (event.giftOneOf?.includes(key) && (!gift || gift === key));
                  return (
                    <div key={key} className={`rounded-2xl border bg-white transition-colors duration-300 ${free ? "configurator-glow" : on ? "border-neutral-950/70" : "border-neutral-950/10"}`}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        onClick={() => toggleExtra(key)}
                        className="flex w-full items-center gap-4 p-4 text-left sm:p-5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                            {extra.label}
                            {free && (
                              <span className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-950 shadow-sm shadow-amber-500/40">
                                🎁 Cadou · Gratuit
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-neutral-600">{extra.note}</span>
                          {free && (
                            <span className="mt-1 block text-xs font-semibold text-amber-700">{event.giftNote ?? "Ofertă pentru următoarele 2 nunți rezervate"}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-right text-sm">
                          {free ? (
                            <span className="flex flex-col items-end leading-tight">
                              <span className="text-xs text-neutral-400 line-through decoration-red-500/70 decoration-2">{formatAmount(extraPrice(key, prices))} €</span>
                              <span className="text-lg font-bold text-amber-600">0 €</span>
                            </span>
                          ) : extra.variants && !on ? (
                            <span className="font-semibold"><span className="font-normal text-neutral-500">de la</span> +{formatAmount(extraPrice(key, prices))} €</span>
                          ) : (
                            <span className="font-semibold">+{formatAmount(extraPrice(key, prices, albumVariant))} €</span>
                          )}
                        </span>
                        <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${on ? "bg-neutral-950" : "bg-neutral-200"}`}>
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                        </span>
                      </button>
                      {extra.variants && on && (
                        <div className="configurator-in border-t border-neutral-950/10 px-4 pb-4 pt-3 sm:px-5">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Alege varianta</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {extra.variants.map((variant, i) => (
                              <button
                                key={variant.label}
                                type="button"
                                aria-pressed={albumVariant === i}
                                onClick={() => { if (albumVariant !== i) track("configurator_option_selected", `${extra.label} · ${variant.label}`); setAlbumVariant(i); }}
                                className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                                  albumVariant === i ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-950/20 text-neutral-600 hover:border-neutral-950/50"
                                }`}
                              >
                                {variant.label} · {formatAmount(extraPrice(key, prices, i))} €
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {key === "fotocabina" && on && event.askGuests && GUEST_TIERS.length > 0 && (
                        <div className="configurator-in border-t border-neutral-950/10 px-4 pb-4 pt-3 sm:px-5">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Câți invitați?</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {GUEST_TIERS.map((tier, i) => (
                              <button
                                key={tier.label}
                                type="button"
                                aria-pressed={guestTier === i}
                                onClick={() => { if (guestTier !== i) track("configurator_option_selected", `Fotocabină · ${tier.label}`); setGuestTier(i); }}
                                className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                                  guestTier === i ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-950/20 text-neutral-600 hover:border-neutral-950/50"
                                }`}
                              >
                                {tier.label}{guestTierPrice(i, prices) ? ` · +${guestTierPrice(i, prices)} €` : ""}
                              </button>
                            ))}
                          </div>
                          <p className="mt-3 text-xs leading-relaxed text-neutral-600">
                            Suplimentul se plătește <strong className="font-semibold text-neutral-950">doar pentru materia primă</strong>: <strong className="font-semibold text-neutral-950">hârtie foto</strong> și <strong className="font-semibold text-neutral-950">echipament suplimentar</strong> pentru mai mulți invitați. Serviciul rămâne același.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5 — Optional: leave a phone number, we call back */}
            <div id="configurator-contact" className="order-last scroll-mt-6 lg:order-none">
              <StepTitle n={5}>Date de contact</StepTitle>
              <p className="mt-2 text-sm text-neutral-600">Opțional — lăsați-ne numărul și vă sunăm noi cu oferta pentru configurația de mai sus.</p>
              {leadStatus === "sent" ? (
                <div className="configurator-in mt-5 flex items-start gap-3 rounded-2xl bg-emerald-600/10 p-5 text-emerald-900">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">✓</span>
                  <div>
                    <p className="font-semibold">Mulțumim! Vă sunăm în curând.</p>
                    <p className="mt-0.5 text-sm text-emerald-800">Am primit configurația și numărul {phone.trim()}.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={sendLead} data-live-track="off" className="mt-5 rounded-2xl border border-neutral-950/10 bg-white p-4 sm:p-5">
                  <label htmlFor="configurator-phone" className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-neutral-500">Numărul de telefon</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="configurator-phone"
                      name="tel"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      value={phone}
                      onChange={(e) => { onPhoneTyped(); setPhone(e.target.value); if (leadStatus === "error") setLeadStatus("idle"); }}
                      placeholder="07xx xxx xxx"
                      className={`${INPUT_CLASS} sm:flex-1`}
                    />
                    <button
                      type="submit"
                      disabled={!phoneOk || !consent || leadStatus === "sending"}
                      className="rounded-xl bg-neutral-950 px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                    >
                      {leadStatus === "sending" ? "Se trimite…" : "Contactați-mă"}
                    </button>
                  </div>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-neutral-600">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-neutral-950"
                    />
                    <span>
                      Sunt de acord ca Anca Visuals să folosească numărul meu de telefon <strong className="font-semibold text-neutral-950">doar ca să mă contacteze</strong> în legătură cu această ofertă, conform GDPR. Am citit{" "}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-neutral-950">Termenii și condițiile</a>.
                    </span>
                  </label>
                  {leadStatus === "error" && (
                    <p className="mt-3 text-xs text-red-600">Nu am putut trimite. Încercați din nou sau scrieți-ne pe WhatsApp.</p>
                  )}
                </form>
              )}
            </div>
          </div>

          {/* Summary — a receipt that follows the visitor on desktop */}
          <aside className="lg:sticky lg:top-6">
            <div ref={priceRef} className="relative bg-neutral-950 p-2.5 text-white shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
              <div className="border border-neutral-400/30 px-5 py-8 sm:px-7">
                <p className="text-center text-[10px] uppercase tracking-[0.4em] text-neutral-400">Configurația voastră</p>
                <p className="mt-3 text-center text-3xl font-normal uppercase tracking-[0.08em]">{event.label}</p>
                <p className="mt-2 text-center text-xs text-white/60">
                  {eventDate ? (
                    <>
                      {formatDate(eventDate)} ·{" "}
                      <span className={available ? "font-semibold text-emerald-400" : "font-semibold text-red-400"}>{available ? "liberă" : "ocupată"}</span>
                    </>
                  ) : "Data încă nealeasă"}
                </p>
                {place && <p className="configurator-in mt-1 text-center text-xs text-white/60">📍 {place}</p>}

                <ul className="mt-6 border-t border-white/10 text-sm">
                  {quote.lines.map((line) => (
                    <li key={`${eventKey}-${line.label}`} className="configurator-in flex items-baseline justify-between gap-4 border-b border-white/10 py-3">
                      <span className="text-white/80">{line.label}</span>
                      {line.waived ? (
                        <span className="shrink-0 tabular-nums">
                          <span className="mr-2 text-white/40 line-through">{formatAmount(line.amount)} €</span>
                          <span className="font-semibold text-amber-400">Gratuit</span>
                        </span>
                      ) : (
                        <span className="shrink-0 tabular-nums">{formatAmount(line.amount)} €</span>
                      )}
                    </li>
                  ))}
                  {event.included.map((item) => (
                    <li key={`${eventKey}-${item}`} className="configurator-in flex items-baseline justify-between gap-4 border-b border-white/10 py-3">
                      <span className="text-white/60">{item}</span>
                      <span className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-neutral-400">Inclus</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 text-center">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">Estimare</p>
                  <p key={pulse} className={`mt-1 flex items-baseline justify-center gap-1.5 ${pulse ? "configurator-pulse" : ""}`} aria-live="polite">
                    <span className="text-6xl font-normal leading-none tabular-nums">{formatAmount(shownTotal)}</span>
                    <span className="text-2xl font-normal text-white/60">€</span>
                  </p>
                  <p className="mx-auto mt-3 max-w-[15rem] text-xs leading-relaxed text-white/50 [text-wrap:balance]">Prețul final îl confirmăm împreună, după ce discutăm detaliile.</p>
                </div>

                <a
                  href={waLink(whatsappMessage)}
                  onClick={() => onWhatsAppClick("configurator")}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-7 flex items-center justify-center gap-2.5 rounded-full [text-wrap:balance] bg-green-500 px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-green-400 sm:px-6 sm:text-xs sm:tracking-[0.18em]"
                >
                  <WhatsAppIcon />
                  Trimite pe WhatsApp
                </a>
                {available && (
                  <button
                    type="button"
                    onClick={onBook}
                    className="mt-3 w-full rounded-full [text-wrap:balance] border border-white/25 px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-white hover:text-neutral-950 sm:px-6 sm:text-xs sm:tracking-[0.18em]"
                  >
                    Lasă-ne numărul tău
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
