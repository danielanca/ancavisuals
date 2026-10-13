import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../admin/auth/useAuth";
import { feedbackPath, type ClientFeedback } from "../../../shared/feedback/feedback";

export default function FeedbackAdminPage() {
  const { auth } = useAuth();
  const [items, setItems] = useState<ClientFeedback[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async (next: string | null = null) => {
    if (!auth.accessToken || active.current) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/feedback/admin/all${next ? `?cursor=${encodeURIComponent(next)}` : ""}`, { headers: { Authorization: `Bearer ${auth.accessToken}` }, signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Feedback-ul nu a putut fi încărcat.");
      if (controller.signal.aborted) return;
      setItems(previous => next ? [...previous, ...data.feedback.filter((item: ClientFeedback) => !previous.some(existing => existing.id === item.id))] : data.feedback);
      setCursor(data.nextCursor);
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Eroare de conexiune."); }
    finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  }, [auth.accessToken]);
  useEffect(() => {
    setItems([]); setCursor(null); void load();
    return () => { active.current?.abort(); active.current = null; };
  }, [load]);
  async function markRead(id: string) {
    if (marking) return;
    setMarking(id); setError("");
    try {
      const response = await fetch(`/api/feedback/admin/${encodeURIComponent(id)}/read`, { method: "PATCH", headers: { Authorization: `Bearer ${auth.accessToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Actualizarea a eșuat.");
      setItems(previous => previous.map(item => item.id === id ? { ...item, read: true } : item));
    } catch (err) { setError(err instanceof Error ? err.message : "Eroare de conexiune."); }
    finally { setMarking(null); }
  }
  return <main className="max-w-4xl mx-auto px-4 py-6 text-white">
    <header className="flex flex-wrap justify-between items-center gap-4 mb-6"><div><h1 className="text-2xl">Feedback clienți</h1><p className="text-sm text-neutral-400 mt-2">Mesajele rămân private până alegi să le publici ca recenzii.</p></div>
      <button disabled={busy} type="button" onClick={() => void load()} className="border border-neutral-700 rounded-lg px-4 py-2 disabled:opacity-50">Reîncarcă</button></header>
    {error && <p role="alert" className="mb-4 text-red-300">{error}</p>}
    {busy && <p role="status" className="mb-4 text-neutral-400">Se încarcă…</p>}
    {!busy && !error && items.length === 0 && <p className="text-neutral-400">Nu ai primit încă feedback. Copiază linkul de feedback din cardul evenimentului și trimite-l clientului.</p>}
    <div className="space-y-4">{items.map(item => <article key={item.id} className="border border-neutral-800 bg-neutral-900 rounded-xl p-5">
      <div className="flex flex-wrap items-center gap-3"><h2 className="font-medium break-words">{item.name}</h2>{!item.read && <span className="text-xs rounded-full bg-amber-200 text-black px-2 py-1">Nou</span>}<time className="text-xs text-neutral-400" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("ro-RO")}</time></div>
      <p className="my-4 whitespace-pre-wrap break-words leading-relaxed text-neutral-200">{item.message}</p>
      <div className="flex flex-wrap items-center gap-4 text-sm"><Link className="text-amber-200 break-all" to={`/media/${encodeURIComponent(item.albumSlug)}`}>Album: {item.albumSlug}</Link><Link className="text-neutral-400" to={feedbackPath(item.albumSlug)}>Pagina de feedback</Link>
        {item.publishedReviewId
          ? <Link className="text-emerald-300" to={`/admin/recenzii?edit=${encodeURIComponent(item.publishedReviewId)}`}>Publicat · Editează recenzia + poze</Link>
          : <Link className="rounded-lg border border-amber-200/30 px-3 py-2 text-amber-200" to="/admin/recenzii" state={{ feedback: item }}>Acceptă ca recenzie</Link>}
        {!item.read && <button type="button" disabled={marking !== null} className="text-neutral-300 underline underline-offset-4 disabled:opacity-50" onClick={() => void markRead(item.id)}>{marking === item.id ? "Se salvează…" : "Marchează citit"}</button>}</div>
    </article>)}</div>
    {cursor && <button type="button" disabled={busy} onClick={() => void load(cursor)} className="mt-6 rounded-lg border border-neutral-700 px-4 py-3 disabled:opacity-50">Încarcă mesajele mai vechi</button>}
  </main>;
}
