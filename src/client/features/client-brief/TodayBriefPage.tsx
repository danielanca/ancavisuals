import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import type { ClientBrief, TodayBriefResponse } from "../../../shared/clientBrief/clientBrief";
import useAuth from "../admin/auth/useAuth";
import CreateClientBriefLink from "./CreateClientBriefLink";

const coverageLabels = { full: "Integral, cu sunet", highlights: "Doar momentele principale", discuss: "De discutat cu clientul" };
function Answer({ title, value }: { title: string; value: string | undefined }) {
  return <section className="space-y-2"><h3 className="text-sm font-medium text-neutral-400">{title}</h3>
    <p className={value?.trim() ? "whitespace-pre-wrap break-words text-white" : "text-neutral-500 text-sm"}>{value?.trim() || "Nespecificat de client"}</p>
  </section>;
}
function BriefSummary({ brief }: { brief: ClientBrief }) {
  const answers = brief.answers;
  return <div className="space-y-6">
    <p className={brief.status === "completed" ? "text-emerald-300 text-sm" : "text-amber-200 text-sm"}>
      {brief.status === "completed" ? "Brief trimis de client" : brief.revision > 0 ? "Brief în curs de completare — răspunsuri salvate până acum" : "Clientul nu a completat încă brief-ul"}
    </p>
    <Answer title="Prioritățile clientului" value={answers.priorities} />
    <section className="rounded-xl border border-amber-200/20 bg-amber-200/5 p-4 space-y-4">
      <Answer title="Persoane de fotografiat și filmat mai des" value={answers.importantPeople} />
      <p className="text-sm text-amber-200">De făcut dimineață: reamintește-le mirilor să îți arate personal persoanele de interes, ca să le recunoști.</p>
    </section>
    <Answer title="Poze de grup cu invitații" value={answers.groupPhotos} />
    <Answer title="Programul și locațiile" value={answers.schedule} />
    <Answer title="Persoana de contact în ziua evenimentului" value={answers.contact} />
    <h3 className="text-lg">Ce ai de surprins</h3>
    <div className="space-y-3">
      {brief.moments.map(moment => {
        const answer = answers.moments[moment.id];
        const absent = answer?.presence === "no";
        return <section key={moment.id} className="rounded-xl border border-neutral-800 p-4 space-y-2">
          <h4 className="font-medium">{moment.label}</h4>
          <p className={absent ? "text-neutral-500 text-sm" : "text-neutral-300 text-sm"}>
            {absent ? "Nu are loc" : answer?.presence === "yes" ? "Are loc" : answer?.presence === "unknown" ? "Încă nehotărât — de clarificat" : "Existența momentului nu este confirmată"}
          </p>
          {!absent && moment.integral && <p className="text-amber-200 text-sm">
            {answer?.coverage ? `Filmare: ${coverageLabels[answer.coverage]}` : "Durata filmării: de clarificat cu clientul"}
          </p>}
          {answer?.details && <p className="whitespace-pre-wrap break-words text-sm text-neutral-300">{answer.details}</p>}
        </section>;
      })}
    </div>
    <Answer title="Ce să evităm / situații de abordat cu grijă" value={answers.avoid} />
    <Answer title="Surprize și alte dorințe" value={answers.notes} />
  </div>;
}
export default function TodayBriefPage() {
  const { auth } = useAuth();
  const [data, setData] = useState<TodayBriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch("/api/client-briefs/admin/today", { headers: { Authorization: `Bearer ${auth.accessToken}` }, signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Nu s-au putut încărca evenimentele de azi.");
        if (!controller.signal.aborted) setData(result);
      }).catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Eroare de conexiune."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [auth.accessToken, refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setRefresh(value => value + 1), 60000);
    const onVisible = () => { if (document.visibilityState === "visible") setRefresh(value => value + 1); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return <main className="min-h-screen bg-neutral-950 text-white px-4 py-8 sm:py-12">
    <Helmet><title>Azi | Anca Visuals</title><meta name="robots" content="noindex, nofollow, noarchive" /><meta name="referrer" content="no-referrer" /></Helmet>
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-3"><Link to="/admin" className="text-sm text-neutral-400 hover:text-white">← Dashboard</Link>
        <h1 className="text-3xl font-light">Azi, ce ai de făcut</h1>
        {data && <p className="text-neutral-400">{new Date(`${data.day}T12:00:00Z`).toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest", weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>}
        <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm disabled:opacity-50">Actualizează</button>
      </header>
      {loading && <p role="status">Se încarcă evenimentele și brief-urile…</p>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {data?.events.length === 0 && <p className="rounded-xl border border-neutral-800 p-5 text-neutral-300">Nu ai evenimente confirmate pentru azi.</p>}
      {data?.events.map(event => <article key={event.id} className="rounded-2xl border border-neutral-800 p-5 sm:p-6 space-y-6">
        <header className="space-y-2"><h2 className="text-2xl font-light">{event.clientName}</h2><p className="text-neutral-400">{event.eventType}</p>
          {event.phone && <a className="inline-block text-amber-200" href={`tel:${event.phone.replace(/[^+0-9]/g, "")}`}>Sună clientul: {event.phone}</a>}
          {event.services.length > 0 && <p className="text-sm text-neutral-400">Servicii rezervate: {event.services.join(" · ")}</p>}
        </header>
        {event.brief ? <>
          <BriefSummary brief={event.brief} />
          <Link className="inline-block text-sm text-amber-200 underline underline-offset-4" to={`/admin/events/${encodeURIComponent(event.id)}/brief`}>Deschide brief-ul în admin</Link>
        </> : <div className="space-y-3"><p className="text-amber-200">Acest eveniment nu are încă un brief client.</p><CreateClientBriefLink eventId={event.id} /></div>}
      </article>)}
    </div>
  </main>;
}
