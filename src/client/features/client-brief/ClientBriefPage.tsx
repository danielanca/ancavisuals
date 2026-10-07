import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import type { BriefAnswers, ClientBrief } from "../../../shared/clientBrief/clientBrief";
import BriefForm from "./BriefForm";

export default function ClientBriefPage() {
  const { token } = useParams();
  const [brief, setBrief] = useState<ClientBrief | null>(null);
  const [answers, setAnswers] = useState<BriefAnswers | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setBrief(null); setAnswers(null); setError(""); setMessage(""); setDirty(false);
    fetch(`/api/client-briefs/${encodeURIComponent(token ?? "")}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Brief-ul nu este disponibil.");
        if (!controller.signal.aborted) { setBrief(data.brief); setAnswers(data.brief.answers); }
      }).catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Eroare de conexiune."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(status: ClientBrief["status"]) {
    if (!brief || !answers || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/client-briefs/${encodeURIComponent(token ?? "")}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, status, revision: brief.revision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Răspunsurile nu au putut fi salvate.");
      setBrief(data.brief); setAnswers(data.brief.answers); setDirty(false);
      setMessage(status === "completed" ? "Mulțumim! Am primit brief-ul vostru. Puteți reveni pe acest link pentru actualizări." : "Progresul a fost salvat. Puteți reveni pe același link pentru a continua.");
    } catch (err) { setError(err instanceof Error ? err.message : "Eroare de conexiune. Încercați din nou."); }
    finally { setSaving(false); }
  }
  return <main className="min-h-screen bg-neutral-950 text-white px-4 py-10 sm:py-16">
    <Helmet><title>Brief client | Anca Visuals</title><meta name="robots" content="noindex, nofollow" /><meta name="referrer" content="no-referrer" /></Helmet>
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-3"><p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Anca Visuals</p><h1 className="text-3xl sm:text-4xl font-light">Ce contează pentru voi</h1>
        {brief && <p className="text-amber-200">{brief.clientName} · {brief.eventType}{brief.eventDate && ` · ${new Date(brief.eventDate).toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest", day: "numeric", month: "long", year: "numeric" })}`}</p>}
        <p className="text-neutral-400">Ne dorim să surprindem oamenii, emoțiile și momentele care contează pentru voi. Completați ce știți deja; detaliile încă nehotărâte le putem clarifica împreună.</p>
      </header>
      {loading && <p role="status">Se încarcă brief-ul…</p>}
      {!loading && brief && answers && <form onSubmit={e => { e.preventDefault(); void save("completed"); }} className="space-y-8">
        <p className="text-sm text-neutral-400">{brief.status === "completed" ? "Brief trimis. Puteți actualiza răspunsurile și le puteți trimite din nou." : "Salvați progresul dacă doriți să continuați mai târziu."}</p>
        <BriefForm moments={brief.moments} answers={answers} disabled={saving} onChange={value => { setAnswers(value); setDirty(true); setMessage(""); }} />
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" disabled={saving} onClick={() => void save("draft")} className="rounded-xl border border-neutral-600 px-5 py-3 disabled:opacity-50">Salvează progresul</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-amber-200 text-black px-5 py-3 font-medium disabled:opacity-50">{saving ? "Se salvează…" : "Trimite brief-ul"}</button>
        </div>
        <p className="text-xs text-neutral-500">Păstrați linkul pentru voi: permite accesul și actualizarea răspunsurilor.</p>
      </form>}
      {error && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-red-300">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-500/10 p-4 text-emerald-300">{message}</p>}
    </div>
  </main>;
}
