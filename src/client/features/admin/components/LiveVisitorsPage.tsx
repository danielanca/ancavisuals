import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";
import { visitDay, visitDayBounds, visitStatus, observedDuration, visitSource, isAlbumVisit, type VisitSource } from "../../../../shared/liveVisits";
import "./LiveVisitorsPage.css";

// ── Types (mirror server serializeSession) ───────────────────────────────────

type Priority = "low" | "normal" | "high" | "critical";
type Source = VisitSource;

interface LiveEvent {
  id: string;
  name: string;
  at: number;
  page: string;
  label?: string;
  priority: Priority;
  meta?: Record<string, unknown>;
}

interface LiveSession {
  sessionId: string;
  visitorNumber: number;
  visitorId?: string;
  visibility?: "visible" | "hidden";
  isNew: boolean;
  firstSeenAt: number;
  lastSeenAt: number;
  lastEventAt: number;
  endedAt: number | null;
  endReason: string | null;
  durationSeconds: number;
  currentPage: string;
  currentPageTitle: string;
  pageCount: number;
  path: { page: string; at: number }[];
  events: LiveEvent[];
  scrollByPage: Record<string, number>;
  attribution: Record<string, string | undefined>;
  isGoogleAds: boolean;
  source: Source;
  city: string;
  country: string;
  deviceType: "mobile" | "tablet" | "desktop";
  idle: boolean;
  archived?: boolean;
  audience?: "client" | "prospect";
  hasContactIntent?: boolean;
  hasConfirmedLead?: boolean;
}

// ── Formatting ──────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<Priority, number> = { low: 0, normal: 1, high: 2, critical: 3 };

const SOURCE_BADGE: Record<Source, { label: string; cls: string }> = {
  google_ads: { label: "Google Ads", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  organic: { label: "Organic · Google & altele", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
  instagram: { label: "Instagram", cls: "text-pink-300" },
  facebook: { label: "Facebook", cls: "text-blue-300" },
  tiktok: { label: "TikTok", cls: "text-cyan-300" },
  ai: { label: "AI / LLM", cls: "bg-violet-500/15 text-violet-300 border-violet-500/25" },
  referral: { label: "Referral", cls: "bg-sky-500/15 text-sky-300 border-sky-500/25" },
  direct: { label: "Direct / necunoscut", cls: "bg-neutral-700/40 text-neutral-300 border-neutral-600/40" },
};

function pageName(path: string): string {
  const p = (path || "/").replace(/\?.*$/, "").replace(/\/+$/, "") || "/";
  const map: Record<string, string> = {
    "/": "Acasă", "/oferta": "Ofertă", "/pricing": "Prețuri", "/preturi": "Prețuri",
    "/portfolio": "Portofoliu", "/videos": "Video", "/contact": "Contact", "/about": "Despre",
    "/blog": "Blog", "/fotocabina": "Fotocabină", "/recenzii": "Recenzii",
  };
  if (map[p]) return map[p];
  if (p.startsWith("/oferta/")) return "Ofertă";
  if (p.startsWith("/blog/")) return "Articol blog";
  if (p.startsWith("/media/")) return "Galerie client";
  if (/^\/(fotograf|videograf|foto-video|foto|video)-/.test(p)) return "Pagină SEO";
  return p;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} ${r === 1 ? "secundă" : "secunde"}`;
  const mm = `${m} ${m === 1 ? "minut" : "minute"}`;
  if (r === 0) return mm;
  return `${mm} și ${r} ${r === 1 ? "secundă" : "secunde"}`;
}

/** Romanian sentence for one event. Reused by the Phase-2 voice queue. */
export function formatEvent(ev: LiveEvent, s: LiveSession): string {
  const where = pageName(ev.page);
  const src = s.isGoogleAds ? " din Google Ads" : "";
  switch (ev.name) {
    case "session_started":
      return `Un vizitator${src} a intrat pe site${where !== "Acasă" ? ` — pe ${where}` : ""}.`;
    case "page_view":
      return `A trecut pe pagina ${where}.`;
    case "scroll_depth": {
      const d = ev.meta?.depth;
      return d ? `A dat scroll ${d}% pe ${where}.` : `Derulează pagina ${where}.`;
    }
    case "pricing_viewed":
      return `Vizitatorul a ajuns la prețuri (${where}).`;
    case "gallery_viewed":
      return `Vizitatorul s-a uitat la galeria de poze.`;
    case "gallery_load_more": {
      const n = ev.meta?.newCount;
      return `A apăsat pe „MAI MULTE POZE"${n ? ` — vede ${n} poze` : ""}.`;
    }
    case "element_clicked":
      return `A apăsat pe „${ev.meta?.text || ev.label || "un buton"}" (${where}).`;
    case "lightbox_opened":
      return `A deschis o poză pe tot ecranul.`;
    case "section_dwell":
      return `Se uită la secțiunea ${ev.label || "pagină"}.`;
    case "reviews_viewed":
      return `Vizitatorul citește recenziile.`;
    case "contact_clicked":
      return `⚡ Vizitatorul a apăsat pe „${ev.meta?.text || "Contactează-ne"}".`;
    case "whatsapp_clicked":
      return `⚡ Vizitatorul a apăsat pe WhatsApp („${ev.meta?.text || "WhatsApp"}").`;
    case "phone_revealed":
      return `⚡ Vizitatorul a afișat / apăsat numărul de telefon.`;
    case "availability_checked": {
      const d = ev.meta?.date;
      const free = ev.meta?.available;
      return `📅 A verificat disponibilitatea pentru ${d || "o dată"}${free === false ? " — ocupată" : free === true ? " — liberă" : ""}.`;
    }
    case "form_started": {
      const kind = ev.meta?.kind;
      if (kind === "delivery") return `Completează adresa de livrare…`;
      if (kind === "subscribe") return `Se abonează la album…`;
      if (kind === "contact") return `A început formularul de contact.`;
      return `A început să completeze un formular.`;
    }
    case "form_submit_attempted":
      return "A încercat să trimită formularul (rezultatul nu este confirmat).";
    case "form_submitted": {
      const kind = ev.meta?.kind;
      if (ev.meta?.confirmed !== true && !ev.meta?.phone) return "Trimitere formular raportată (înregistrare veche, rezultat neconfirmat).";
      if (kind === "delivery") return `📦 A completat adresa de livrare — vrea albumul fizic.`;
      if (kind === "subscribe") return `📧 S-a abonat — vrea notificare când sunt gata pozele.`;
      if (kind === "contact") {
        const who = [ev.meta?.name, ev.meta?.phone].filter(Boolean).join(" · ");
        return who
          ? `🎯 Un client a trimis formularul de contact — sună-l: ${who}`
          : `🎯 Un client a trimis formularul de contact — vrea să-l suni!`;
      }
      return `✅ A trimis un formular.`;
    }
    case "visitor_idle":
      return `Vizitatorul este inactiv.`;
    case "session_ended": {
      const d = Number(ev.meta?.durationSeconds ?? s.durationSeconds);
      return `Sesiunea s-a încheiat după ${formatDuration(d)}${ev.meta?.reason === "timeout" ? " — fără semnal recent" : ""}.`;
    }
    default:
      return ev.label || ev.name;
  }
}

function shortTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Bucharest" });
}

const STATUS_LABEL = { active: "Activ", idle: "Fără interacțiuni", hidden: "Tab în fundal", ended: "Încheiat" };
const CONTACT_EVENTS = new Set(["whatsapp_clicked", "phone_revealed", "contact_clicked", "availability_checked"]);
const isLead = (s: LiveSession) => s.hasConfirmedLead || s.events.some((e) => e.name === "form_submitted" && e.meta?.kind === "contact" && (e.meta?.confirmed === true || Boolean(e.meta?.name && e.meta?.phone)));
const hasIntent = (s: LiveSession) => s.hasContactIntent || s.events.some((e) => CONTACT_EVENTS.has(e.name));
const visitorIdentity = (s: LiveSession) => s.visitorId ? `visitor:${s.visitorId}` : `session:${s.sessionId}`;
const shiftDay = (day: string, offset: number) => new Date(Date.parse(`${day}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const channelOf = (s: LiveSession) => isAlbumVisit(s) ? "clients" : visitSource(s.attribution, s.isGoogleAds);
const CHANNELS = [
  { id: "all", label: "Tot traficul" }, { id: "google_ads", label: "Google Ads" },
  { id: "organic", label: "Organic" }, { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" }, { id: "tiktok", label: "TikTok" },
  { id: "ai", label: "AI / LLM" }, { id: "referral", label: "Alte surse" },
  { id: "direct", label: "Direct / necunoscut" }, { id: "clients", label: "Clienți · Albume" },
];

export default function LiveVisitorsPage() {
  const { auth } = useAuth();
  const [day, setDay] = useState(() => visitDay());
  const [history, setHistory] = useState<LiveSession[]>([]);
  const [dailyVisitorNumbers, setDailyVisitorNumbers] = useState<Record<string, number>>({});
  const [sessions, setSessions] = useState(new Map<string, LiveSession>());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [channel, setChannel] = useState("all");
  const [search, setSearch] = useState("");
  const [device, setDevice] = useState("all");
  const [status, setStatus] = useState("all");
  const [archived, setArchived] = useState(false);
  const [priority, setPriority] = useState<Priority>("low");
  const [follow, setFollow] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [archiving, setArchiving] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const today = visitDay(now);

  const loadHistory = useCallback(async (after?: string) => {
    if (!auth.accessToken) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    if (!after) { setHistory([]); setCursor(null); }
    try {
      const params = new URLSearchParams({ date: day, limit: "200", archived: archived ? "1" : "0" });
      if (after) params.set("cursor", after);
      const res = await fetch(`/api/admin/analytics/live/history?${params}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` }, signal: controller.signal,
      });
      if (!res.ok) throw new Error(res.status === 401 ? "Sesiunea de autentificare a expirat. Reautentifică-te." : "Istoricul nu a putut fi încărcat. Încearcă din nou.");
      const data = await res.json() as { sessions: LiveSession[]; visitorNumbers?: Record<string, number>; nextCursor?: string | null };
      if (controller.signal.aborted) return;
      if (data.visitorNumbers) setDailyVisitorNumbers(data.visitorNumbers);
      setHistory((prev) => Array.from(new Map([...(after ? prev : []), ...data.sessions].map((s) => [s.sessionId, s])).values()));
      setCursor(data.nextCursor ?? null);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Eroare de conexiune.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [auth.accessToken, day, archived]);

  useEffect(() => { setSelectedId(null); void loadHistory(); return () => requestRef.current?.abort(); }, [loadHistory]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    if (!auth.accessToken) return;
    let stopped = false;
    let retry = 0;
    let timer: number | undefined;
    let controller: AbortController;
    const connect = async () => {
      if (stopped) return;
      controller = new AbortController();
      try {
        const res = await fetch("/api/admin/analytics/live/stream", {
          headers: { Authorization: `Bearer ${auth.accessToken}` }, signal: controller.signal,
        });
        if (!res.ok || !res.body || !res.headers.get("content-type")?.includes("text/event-stream")) throw new Error("stream unavailable");
        retry = 0;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = JSON.parse(line.slice(6)) as { type: string; sessions?: LiveSession[]; session?: LiveSession };
            if (data.type === "snapshot") {
              setConnected(true);
              setSessions((prev) => new Map([...prev, ...(data.sessions ?? []).map((s): [string, LiveSession] => [s.sessionId, s])]));
            } else if (data.session) {
              const session = data.session;
              setSessions((prev) => new Map(prev).set(session.sessionId, session));
              if (data.type === "archived") setHistory((prev) => prev.map((s) => s.sessionId === session.sessionId ? session : s));
            }
            // Retain ended sessions for the current day's list until the next snapshot.
          }
        }
      } catch { /* reconnect below, with explicit stale state */ }
      if (stopped) return;
      setConnected(false);
      retry = Math.min(retry + 1, 6);
      timer = window.setTimeout(connect, retry * 1500);
    };
    void connect();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); setConnected(false); };
  }, [auth.accessToken]);

  const all = useMemo(() => {
    const bounds = visitDayBounds(day);
    const map = new Map(history.filter((s) => Boolean(s.archived) === archived).map((s) => [s.sessionId, s]));
    if (day === visitDay() && !archived) {
      sessions.forEach((s) => {
        if (s.firstSeenAt >= bounds.start && s.firstSeenAt < bounds.end && !s.archived && !map.get(s.sessionId)?.archived) map.set(s.sessionId, s);
      });
    }
    return [...map.values()].sort((a, b) => b.firstSeenAt - a.firstSeenAt);
  }, [history, sessions, day, archived]);
  const dailyNumbers = useMemo(() => {
    const result = { ...dailyVisitorNumbers };
    let next = Math.max(0, ...Object.values(result));
    const orderedHistory = [...all].sort((a, b) => a.firstSeenAt - b.firstSeenAt || a.sessionId.localeCompare(b.sessionId));
    for (const s of orderedHistory) {
      const identity = visitorIdentity(s);
      if (!result[identity]) result[identity] = ++next;
      result[`session:${s.sessionId}`] = result[identity];
    }
    const orderedLive = day === today && !archived
      ? [...sessions.values()].filter((s) => s.firstSeenAt >= visitDayBounds(day).start && s.firstSeenAt < visitDayBounds(day).end).sort((a, b) => a.firstSeenAt - b.firstSeenAt || a.sessionId.localeCompare(b.sessionId))
      : [];
    for (const s of orderedLive) {
      const identity = visitorIdentity(s);
      if (!result[identity]) result[identity] = ++next;
      result[`session:${s.sessionId}`] = result[identity];
    }
    return result;
  }, [dailyVisitorNumbers, sessions, day, today, archived]);
  const counts = useMemo(() => all.reduce<Record<string, number>>((acc, s) => {
    const key = channelOf(s); acc[key] = (acc[key] ?? 0) + 1; return acc;
  }, {}), [all]);
  const channelSessions = all.filter((s) => channel === "all" || channelOf(s) === channel);
  const numberFor = (s: LiveSession) => dailyNumbers[visitorIdentity(s)] ?? dailyNumbers[`session:${s.sessionId}`] ?? s.visitorNumber;
  const visitorLabel = (s: LiveSession) => `#${numberFor(s)}`;
  const list = channelSessions.filter((s) => {
    const haystack = [visitorLabel(s), s.currentPage, s.city, s.country, ...s.path.map((p) => p.page), ...Object.values(s.attribution)].join(" ").toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (device === "all" || s.deviceType === device)
      && (status === "all" || visitStatus(s, now) === status);
  });
  const selected = list.find((s) => s.sessionId === selectedId) ?? list[0] ?? null;
  const selectedStatus = selected ? visitStatus(selected, now) : "ended";
  const visibleEvents = selected?.events.filter((e, i, events) =>
    !(e.name === "visitor_idle" && events[i - 1]?.name === "visitor_idle") && PRIORITY_RANK[e.priority] >= PRIORITY_RANK[priority]) ?? [];
  const unavailable = (loading || Boolean(error)) && !history.length;
  const prospects = channelSessions.filter((s) => !isAlbumVisit(s));
  const active = channelSessions.filter((s) => visitStatus(s, now) === "active").length;
  const unique = new Set(channelSessions.map((s) => s.visitorId || s.sessionId)).size;
  const median = channelSessions.map(observedDuration).sort((a, b) => a - b);
  const medianSeconds = median.length ? median[Math.floor(median.length / 2)] : 0;

  useEffect(() => {
    if (follow && feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [selected?.sessionId, visibleEvents.length, follow]);

  const archiveSession = async () => {
    if (!selected || archiving) return;
    setArchiving(true); setError("");
    const id = selected.sessionId;
    try {
      const res = await fetch(`/api/admin/analytics/live/${encodeURIComponent(id)}/archive`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ archived: !archived }),
      });
      if (!res.ok) throw new Error("Arhivarea nu a reușit. Sesiunea a fost păstrată în listă.");
      setHistory((prev) => prev.filter((s) => s.sessionId !== id));
      setSessions((prev) => { const next = new Map(prev); const s = next.get(id); if (s) next.set(id, { ...s, archived: !archived }); return next; });
      setSelectedId(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Arhivarea nu a reușit."); }
    finally { setArchiving(false); }
  };

  return (
    <div className="live-visits">
      <Breadcrumb />
      <header className="lv-header">
        <div><p className="lv-eyebrow">AUDIENȚĂ & COMPORTAMENT</p><h1>Vizitatori <span>live</span></h1><p className="lv-subtitle">De unde vin, ce îi interesează și unde ajung.</p></div>
        <div className={`lv-connection ${connected ? "is-connected" : ""}`} role="status"><i />{connected ? "Actualizare live conectată" : "Reconectare · datele pot fi vechi"}</div>
      </header>
      <section className="lv-datebar" aria-label="Selectează ziua">
        <div className="lv-date-controls">
          <button aria-label="Ziua precedentă" onClick={() => setDay(shiftDay(day, -1))}>‹</button>
          <input aria-label="Data vizitelor" type="date" value={day} max={today} onChange={(e) => { if (e.target.value && e.target.value <= today) setDay(e.target.value); }} />
          <button aria-label="Ziua următoare" disabled={day >= today} onClick={() => setDay(shiftDay(day, 1))}>›</button>
        </div>
        <button className={day === today ? "is-selected" : ""} onClick={() => setDay(today)}>Astăzi</button>
        <button className={day === shiftDay(today, -1) ? "is-selected" : ""} onClick={() => setDay(shiftDay(today, -1))}>Ieri</button>
        <span className="lv-timezone">Ora României · {day === today ? "în curs" : "00:00–23:59"}</span>
        <button className="lv-refresh" disabled={loading} onClick={() => void loadHistory()}>{loading ? "Se încarcă…" : "↻ Actualizează"}</button>
      </section>
      {error && <div className="lv-error" role="alert">{error} <button onClick={() => void loadHistory()}>Reîncearcă</button></div>}
      <div className="lv-metrics">
        <Metric label="Sesiuni" value={unavailable ? "—" : channelSessions.length} hint={unavailable ? "În așteptarea datelor" : `${unique} ${unique === 1 ? "vizitator identificat" : "vizitatori identificați"}`} />
        <Metric label="Activi acum" value={day === today && connected ? active : "—"} hint={day === today ? "Interacțiune în ultimele 60 secunde" : "Zi din istoric"} accent />
        <Metric label="Interes de contact" value={unavailable ? "—" : prospects.filter(hasIntent).length} hint="Click contact, telefon, WhatsApp sau dată" />
        <Metric label="Formulare confirmate" value={unavailable ? "—" : prospects.filter(isLead).length} hint="Confirmare explicită după trimitere reușită" />
        <Metric label="Durată mediană" value={unavailable ? "—" : compactDuration(medianSeconds)} hint="Timp observat · nu timp de atenție" />
      </div>
      <nav className="lv-channels" aria-label="Surse de trafic">
        {CHANNELS.map((c) => <button key={c.id} aria-pressed={channel === c.id} className={channel === c.id ? "is-selected" : ""} onClick={() => { setChannel(c.id); setSelectedId(null); }}>
          {c.label}<span>{unavailable ? "—" : c.id === "all" ? all.length : counts[c.id] ?? 0}</span>
        </button>)}
      </nav>
      <div className="lv-scope">
        <span>{loading ? "Se încarcă sesiunile…" : unavailable ? "Istoric indisponibil" : `${all.length} sesiuni începute în ziua aleasă`}{cursor ? " · listă parțială, mai sunt sesiuni de încărcat" : ""}</span>
        <span>{channel === "clients" ? "Vizite la /media · excluse din indicatorii de contact" : "Sursa se bazează pe UTM / referrer. Blogul singur nu confirmă SEO."}</span>
      </div>
      <div className="lv-toolbar">
        <input aria-label="Caută sesiuni" type="search" placeholder="Caută pagină, oraș, campanie sau vizitator…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Dispozitiv" value={device} onChange={(e) => setDevice(e.target.value)}><option value="all">Toate dispozitivele</option><option value="mobile">Mobil</option><option value="desktop">Desktop</option><option value="tablet">Tabletă</option></select>
        <select aria-label="Starea sesiunii" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Toate stările</option>{Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <label><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Arhivate</label>
      </div>
      <div className="lv-workspace">
        <section className="lv-list-panel" aria-label="Lista sesiunilor">
          <div className="lv-panel-title"><h2>Sesiuni</h2><span>{list.length} rezultate</span></div>
          <div className="lv-session-list">
            {!list.length && <div className="lv-empty"><span>◎</span><h3>{loading ? "Încărcăm vizitele" : error ? "Date indisponibile" : "Nicio sesiune pentru selecția ta"}</h3><p>{loading ? "Pregătim istoricul zilei." : "Schimbă ziua sau filtrele. Vizitele apar după prima interacțiune cu site-ul."}</p></div>}
            {list.map((s) => {
              const state = visitStatus(s, now);
              const source = visitSource(s.attribution, s.isGoogleAds);
              return <button key={s.sessionId} className={`lv-session ${selected?.sessionId === s.sessionId ? "is-selected" : ""}`} aria-pressed={selected?.sessionId === s.sessionId} onClick={() => setSelectedId(s.sessionId)}>
                <div className="lv-session-top"><strong>Vizitator {visitorLabel(s)}</strong><time>{shortTime(s.firstSeenAt).slice(0, 5)}</time></div>
                <div className="lv-session-tags"><span className={`lv-source source-${source}`}>{SOURCE_BADGE[source].label}</span>{isAlbumVisit(s) && <span className="lv-client">Client · Album</span>}{!isAlbumVisit(s) && s.path.some((p) => /^\/blog(?:\/|$)/.test(p.page)) && <span className="lv-client">{source === "direct" ? "Blog · sursă necunoscută" : "Blog"}</span>}<span className={`lv-status state-${state}`}>{STATUS_LABEL[state]}</span></div>
                <p className="lv-session-page" title={s.currentPage}>{s.currentPage}</p>
                <div className="lv-session-bottom"><span>{s.city || s.country || "Locație necunoscută"} · {s.deviceType === "mobile" ? "Mobil" : s.deviceType === "tablet" ? "Tabletă" : "Desktop"}</span><span>{s.pageCount} pag. · {compactDuration(observedDuration(s))}</span></div>
                {(isLead(s) || hasIntent(s)) && !isAlbumVisit(s) && <span className="lv-intent">{isLead(s) ? "✓ Formular de contact" : "↗ Interes de contact"}</span>}
              </button>;
            })}
          </div>
          {cursor && <button className="lv-load-more" disabled={loading} onClick={() => void loadHistory(cursor)}>{loading ? "Se încarcă…" : "Încarcă mai multe sesiuni din această zi"}</button>}
        </section>
        <section className="lv-details" aria-label="Detaliile sesiunii">
          {!selected ? <div className="lv-empty lv-empty-detail"><span>↗</span><h3>Fiecare vizită are un traseu</h3><p>Selectează o sesiune pentru a vedea sursa, paginile și acțiunile vizitatorului.</p></div> : <>
            <div className="lv-detail-heading"><div><p className="lv-eyebrow">DETALII SESIUNE</p><h2>Vizitator {visitorLabel(selected)}</h2><span className={`lv-status state-${selectedStatus}`}>{STATUS_LABEL[selectedStatus]}</span></div><button disabled={archiving} onClick={() => void archiveSession()}>{archiving ? "Se salvează…" : archived ? "Restaurează" : "Arhivează"}</button></div>
            <dl className="lv-facts">
              <Fact label="Sursă identificată" value={SOURCE_BADGE[visitSource(selected.attribution, selected.isGoogleAds)].label} />
              <Fact label="Origine / serviciu" value={originLabel(selected)} />
              <Fact label="Campanie" value={selected.attribution.utmCampaign || "Nespecificată"} />
              <Fact label="Locație aproximativă" value={[selected.city, selected.country].filter(Boolean).join(", ") || "Necunoscută"} />
              <Fact label="Prima interacțiune" value={shortTime(selected.firstSeenAt)} />
              <Fact label="Ultimul semnal" value={shortTime(selected.lastSeenAt)} />
              <Fact label="Durată observată" value={compactDuration(observedDuration(selected))} />
              <Fact label="Pagina de intrare" value={selected.attribution.landingPath || selected.path[0]?.page || selected.currentPage} />
            </dl>
            {selected.path.some((p) => /^\/blog(?:\/|$)/.test(p.page)) && <p className="lv-note">Articol de blog vizitat{visitSource(selected.attribution, selected.isGoogleAds) === "direct" ? " · sursa intrării nu poate fi confirmată." : " · sursa afișată provine din atribuirea vizitei."}</p>}
            {isAlbumVisit(selected) && <p className="lv-note">Client / vizitator de album. Sesiunea este separată de traficul de achiziție; sursa originală rămâne vizibilă.</p>}
            <div className="lv-journey"><h3>Traseul pe site <span>{selected.pageCount} pagini</span></h3><ol>{selected.path.map((p, i) => <li key={`${p.at}-${i}`}><time>{shortTime(p.at).slice(0, 5)}</time><span title={p.page}>{p.page}</span></li>)}</ol></div>
            <div className="lv-feed-heading"><h3>Activitate <span>{visibleEvents.length}</span></h3><select aria-label="Prioritatea evenimentelor" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}><option value="low">Toate acțiunile</option><option value="high">Acțiuni importante</option><option value="critical">Doar critice</option></select><label><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Urmărește</label></div>
            <div ref={feedRef} className="lv-feed">{visibleEvents.map((ev) => <div key={ev.id} className={`lv-event priority-${ev.priority}`}><time>{shortTime(ev.at)}</time><i /><div><p>{formatEvent(ev, selected)}</p><span>{ev.page}</span></div></div>)}{!visibleEvents.length && <p className="lv-note">Nicio acțiune la prioritatea aleasă.</p>}</div>
            <p className="lv-footnote">Ultimele 200 de acțiuni și 60 de pagini sunt păstrate per sesiune. Lipsa unui semnal înseamnă încheiere estimată, nu o plecare observată direct.</p>
          </>}
        </section>
      </div>
      <p className="lv-footnote">O sesiune reprezintă o filă de browser. Vizitatorii sunt identificați prin cookie, nu ca persoane certe. Clickurile de contact nu confirmă o conversație sau o rezervare.</p>
    </div>
  );
}

function compactDuration(seconds: number): string {
  const value = Math.max(0, Math.round(seconds));
  if (value >= 3600) return `${Math.floor(value / 3600)}h ${Math.floor(value % 3600 / 60)}m`;
  if (value >= 60) return `${Math.floor(value / 60)}m ${value % 60}s`;
  return `${value}s`;
}
function originLabel(s: LiveSession): string {
  if (s.attribution.utmSource) return s.attribution.utmSource;
  try { return new URL(s.attribution.referrer || "").hostname; } catch { return visitSource(s.attribution, s.isGoogleAds) === "google_ads" ? "Identificator Google Ads" : "Fără referrer / UTM"; }
}
function Metric({ label, value, hint, accent = false }: { label: string; value: React.ReactNode; hint: string; accent?: boolean }) {
  return <div className={`lv-metric ${accent ? "lv-metric-accent" : ""}`}><p>{label}</p><strong>{value}</strong><span>{hint}</span></div>;
}
function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd title={value}>{value}</dd></div>;
}
