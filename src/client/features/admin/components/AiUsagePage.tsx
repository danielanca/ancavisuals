import React, { useCallback, useEffect, useRef, useState } from "react";
import useAuth from "../auth/useAuth";
import type { AiUsageEntry } from "../../../../shared/ai/usage";

const number = (value: number | null) => value === null ? "Necunoscut" : value.toLocaleString("ro-RO");
const money = (value: number | null) => value === null ? "Necunoscut" : `$${value.toFixed(6)}`;
const time = (value: string) => new Date(value).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", dateStyle: "medium", timeStyle: "medium" });
const status = { success: "Finalizat", error: "Eroare", interrupted: "Întrerupt" };

export default function AiUsagePage() {
  const { auth } = useAuth();
  const [items, setItems] = useState<AiUsageEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async (next: string | null = null) => {
    if (!auth.accessToken || active.current) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams();
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      if (next) params.set("cursor", next);
      const response = await fetch(`/api/admin/ai-usage?${params}`, { headers: { Authorization: `Bearer ${auth.accessToken}` }, signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Istoricul nu a putut fi încărcat.");
      if (controller.signal.aborted) return;
      setItems(previous => next ? [...previous, ...data.items.filter((item: AiUsageEntry) => !previous.some(existing => existing.id === item.id))] : data.items);
      setCursor(data.nextCursor);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Eroare de conexiune.");
    } finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  }, [auth.accessToken, start, end]);
  useEffect(() => {
    setItems([]); setCursor(null); void load();
    return () => { active.current?.abort(); active.current = null; };
  }, [load]);
  const visible = items.filter(item => [item.feature, item.operation, item.provider, item.model, item.route, item.appRequestId, item.providerRequestId].filter(Boolean).join(" ").toLocaleLowerCase("ro").includes(search.trim().toLocaleLowerCase("ro")));
  const totalTokens = visible.reduce((sum, item) => sum + (item.totalTokens ?? 0), 0);
  const cost = visible.reduce((sum, item) => sum + (item.estimatedCostUsd ?? 0), 0);
  const incomplete = visible.filter(item => !item.usageComplete).length;
  const unknownCost = visible.filter(item => item.estimatedCostUsd === null).length;
  return <main className="max-w-6xl mx-auto px-4 py-6 text-white">
    <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div><h1 className="text-2xl font-semibold">Istoric consum AI</h1><p className="mt-2 text-sm text-neutral-400 max-w-3xl">Apelurile AI făcute de proiect după activarea istoricului. Data și ora sunt afișate pentru România. Apelurile din alte aplicații și consumul anterior activării nu sunt incluse.</p></div>
      <button type="button" disabled={busy} onClick={() => void load()} className="rounded-lg border border-neutral-700 px-4 py-2 disabled:opacity-50">Reîncarcă</button>
    </header>
    <div className="flex flex-wrap gap-4 mb-5">
      <label className="text-sm">De la<input aria-label="De la" type="date" value={start} onChange={event => setStart(event.target.value)} className="block mt-1 rounded-lg border border-neutral-700 bg-neutral-900 p-2" /></label>
      <label className="text-sm">Până la<input aria-label="Până la" type="date" value={end} onChange={event => setEnd(event.target.value)} className="block mt-1 rounded-lg border border-neutral-700 bg-neutral-900 p-2" /></label>
      <label className="text-sm flex-1 min-w-[200px]">Caută în înregistrările încărcate<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Funcție, model, operație…" className="block mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2" /></label>
    </div>
    <section aria-label="Rezumat înregistrări încărcate" className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 mb-5">
      <p className="text-sm text-neutral-400 mb-3">Rezumat pentru cele {visible.length} înregistrări afișate{cursor ? " · există înregistrări mai vechi de încărcat" : ""}</p>
      <div className="flex flex-wrap gap-x-8 gap-y-3"><p><strong>{visible.length}</strong> {visible.length === 1 ? "apel" : "apeluri"}</p><p><strong>{number(totalTokens)}</strong> tokenuri raportate</p><p><strong>{money(cost)}</strong> cost estimat tokenuri</p></div>
      {(incomplete > 0 || unknownCost > 0) && <p className="mt-3 text-sm text-amber-200">{incomplete} {incomplete === 1 ? "apel cu" : "apeluri cu"} consum incomplet sau necunoscut · {unknownCost} fără estimare de cost. Totalurile pot fi parțiale.</p>}
      <p className="mt-3 text-xs text-neutral-500">Costul este estimat la tarifele salvate la data apelului, fără taxe, reduceri sau costuri pentru instrumente externe. Factura furnizorului AI rămâne sursa pentru costul final. Reîncercările sunt apeluri separate.</p>
    </section>
    {error && <p role="alert" className="mb-4 text-red-300">{error}</p>}
    {busy && <p role="status" className="mb-4 text-neutral-400">Se încarcă…</p>}
    {!busy && !error && !visible.length && <p className="text-neutral-400">{items.length ? "Nicio înregistrare nu corespunde căutării." : "Nu există apeluri AI înregistrate în perioada selectată. Istoricul se completează automat la folosirea funcțiilor AI."}</p>}
    <div className="space-y-4">{visible.map(item => <article key={item.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-medium text-amber-200">{item.feature}</h2>{item.operation && <p className="mt-1 text-sm">{item.operation}</p>}</div><div className="text-sm"><time dateTime={item.createdAt}>{time(item.createdAt)}</time><p className={item.status === "success" ? "text-emerald-300" : "text-amber-200"}>{status[item.status]}{!item.usageComplete ? " · consum parțial / necunoscut" : ""}</p></div></div>
      <p className="mt-3 text-sm text-neutral-400 break-all">{item.provider === "anthropic" ? "Anthropic" : item.provider === "openai" ? "OpenAI" : item.provider || "Furnizor necunoscut"} · {item.model} · {item.source === "script" ? "Script" : "Site"} · {(item.durationMs / 1000).toFixed(1)} s</p>
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
        {[["Intrare fără cache", number(item.inputTokens)], ["Ieșire", number(item.outputTokens)], ["Cache citit", number(item.cacheReadTokens)], ["Cache scris", number(item.cacheWriteTokens)], ["Total tokenuri", number(item.totalTokens)], ["Cost estimat", money(item.estimatedCostUsd)]].map(([label, value]) => <div key={label}><dt className="text-neutral-400">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
      </dl>
      <details className="mt-4 text-xs text-neutral-400"><summary className="cursor-pointer">Detalii apel</summary><dl className="mt-2 space-y-2 break-all">
        <div><dt>Context tehnic</dt><dd>{item.route || "Execuție fără cerere HTTP"}</dd></div>
        <div><dt>Cerere din aplicație (grupează apelurile și reîncercările)</dt><dd>{item.appRequestId || "—"}</dd></div>
        <div><dt>ID cerere furnizor</dt><dd>{item.providerRequestId || "—"}</dd></div>
        <div><dt>ID mesaj furnizor</dt><dd>{item.messageId || "—"}</dd></div>
        <div><dt>Încheiat la</dt><dd>{time(item.completedAt)}</dd></div>
        <div><dt>Status HTTP</dt><dd>{item.httpStatus ?? "Fără răspuns HTTP"}</dd></div>
        <div><dt>Cache scris cu durată de o oră</dt><dd>{number(item.cacheWrite1hTokens)}</dd></div>
        <div><dt>Tokenuri de raționament (incluse în ieșire)</dt><dd>{number(item.reasoningTokens)}</dd></div>
        <div><dt>Tarife estimate</dt><dd>{item.pricingVersion || "Estimare indisponibilă"}</dd></div>
      </dl></details>
    </article>)}</div>
    {cursor && <button type="button" disabled={busy} onClick={() => void load(cursor)} className="mt-6 rounded-lg border border-neutral-700 px-4 py-3 disabled:opacity-50">Încarcă apeluri mai vechi</button>}
  </main>;
}
