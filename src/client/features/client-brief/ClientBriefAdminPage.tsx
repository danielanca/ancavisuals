import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ClientBrief } from "../../../shared/clientBrief/clientBrief";
import useAuth from "../admin/auth/useAuth";
import BriefForm from "./BriefForm";

export default function ClientBriefAdminPage() {
  const { eventId } = useParams();
  const auth = useAuth();
  const accessToken = auth.auth.accessToken;
  const [brief, setBrief] = useState<ClientBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setBrief(null); setCopied(false);
    fetch(`/api/client-briefs/admin/events/${encodeURIComponent(eventId ?? "")}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Brief-ul nu a putut fi încărcat.");
      if (!controller.signal.aborted) setBrief(data.brief);
    }).catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Eroare de conexiune."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, accessToken, refresh]);
  const url = brief?.url && typeof window !== "undefined" ? `${window.location.origin}${brief.url}` : "";
  return <div className="max-w-3xl mx-auto space-y-6 text-white pb-10">
    <Link to="/admin" className="text-sm text-neutral-400 hover:text-white">← Evenimente</Link>
    <h1 className="text-2xl font-light">Brief client</h1>
    {loading && <p role="status">Se încarcă…</p>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {brief && <>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-3">
        <h2 className="text-lg">{brief.clientName}</h2>
        <p className="text-sm text-neutral-400">{brief.eventType}{brief.eventDate && ` · ${new Date(brief.eventDate).toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest" })}`}</p>
        <p className={brief.status === "completed" ? "text-emerald-300" : "text-amber-200"}>{brief.status === "completed" ? "Completat și trimis de client" : brief.revision > 0 ? "În curs de completare" : "Așteaptă completarea"}</p>
        {brief.revision > 0 && <p className="text-xs text-neutral-400">Ultima salvare: {new Date(brief.updatedAt).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}</p>}
        <label className="block text-sm text-neutral-400">Link pentru client<input aria-label="Link pentru client" readOnly value={url} onFocus={e => e.target.select()} className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-white text-base" /></label>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="rounded-lg bg-amber-200 text-black px-4 py-2 text-sm" onClick={async () => {
            try { await navigator.clipboard.writeText(url); setCopied(true); }
            catch { setError("Copiați manual linkul din câmpul de mai sus."); }
          }}>{copied ? "Link copiat" : "Copiază linkul"}</button>
          <a href={brief.url} target="_blank" rel="noreferrer" className="rounded-lg border border-neutral-700 px-4 py-2 text-sm">Deschide formularul</a>
          <button type="button" onClick={() => setRefresh(v => v + 1)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm">Actualizează răspunsurile</button>
        </div>
      </div>
      <h2 className="text-xl">Răspunsurile clientului</h2>
      <BriefForm moments={brief.moments} answers={brief.answers} readOnly />
    </>}
  </div>;
}
