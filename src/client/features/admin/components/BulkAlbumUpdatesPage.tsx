/*
 * Purpose: "Noutăți în masă" — tick several clients' albums and post the same update on each
 * (typically "mai durează puțin pozele / videoclipul / albumul"). Every album gets its own entry
 * in its "Noutăți despre album" log and its own messages (email / SMS automatically, WhatsApp as
 * one-tap links here and in one email). Uses the same templates as the album-page composer.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import {
  ALBUM_UPDATE_KINDS,
  ALBUM_UPDATE_META,
  ALBUM_UPDATE_TEXT_MAX,
  kindHasDate,
  phoneDeliveryFromChoice,
  type AlbumUpdateKind,
} from "../../../../shared/albumUpdates";
import { ALBUM_UPDATE_TEMPLATES, DELIVERABLES, findAlbumUpdateTemplate, type Deliverable } from "../../../../shared/albumUpdateTemplates";

type AlbumRow = {
  slug: string;
  clients: string[];
  eventDate: string | null;
  subscribers: number;
  lastUpdate: { kind: string; text: string; createdAt: string | null } | null;
};

type WhatsappRecipient = { name: string | null; phone: string; link: string };
type BulkResult = { slug: string; ok: boolean; error?: string; sent?: { email: number; sms: number; failed: number }; whatsapp?: WhatsappRecipient[]; smsSkipped?: boolean };

type Period = "all" | "past" | "upcoming";

const input = "w-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Diacritic- and case-insensitive search ("stefan" finds "Ștefan"). */
const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export default function BulkAlbumUpdatesPage() {
  const { auth } = useAuth();
  const [albums, setAlbums] = useState<AlbumRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("past");

  const [templateId, setTemplateId] = useState("delay-volume");
  const [deliverable, setDeliverable] = useState<Deliverable>("photos");
  const [estimateDate, setEstimateDate] = useState("");
  const [delayDays, setDelayDays] = useState("");
  const [kind, setKind] = useState<AlbumUpdateKind>("delay");
  const [text, setText] = useState("");
  const [sendTo, setSendTo] = useState({ email: true, sms: true, whatsapp: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [adminEmailed, setAdminEmailed] = useState(false);

  const template = templateId ? findAlbumUpdateTemplate(templateId) : undefined;

  useEffect(() => {
    if (!template) return;
    setKind(template.kind);
    setText(template.build({ deliverable, date: estimateDate || undefined, delayDays: Number(delayDays) || undefined }));
  }, [template, deliverable, estimateDate, delayDays]);

  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const res = await fetch("/api/album-subscriptions/admin/albums-overview", { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      const data = (await res.json()) as { albums?: AlbumRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Eroare ${res.status}`);
      setAlbums(data.albums ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Nu am putut încărca albumele.");
    }
  }, [auth.accessToken]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const now = Date.now();
    const q = fold(query.trim());
    return (albums ?? []).filter((album) => {
      const time = album.eventDate ? new Date(album.eventDate).getTime() : 0;
      if (period === "past" && time > now) return false;
      if (period === "upcoming" && time <= now) return false;
      if (!q) return true;
      return fold(`${album.slug} ${album.clients.join(" ")}`).includes(q);
    });
  }, [albums, query, period]);

  const allVisibleSelected = visible.length > 0 && visible.every((album) => selected.has(album.slug));
  const toggle = (slug: string) => setSelected((current) => {
    const next = new Set(current);
    next.has(slug) ? next.delete(slug) : next.add(slug);
    return next;
  });
  const toggleVisible = () => setSelected((current) => {
    const next = new Set(current);
    visible.forEach((album) => (allVisibleSelected ? next.delete(album.slug) : next.add(album.slug)));
    return next;
  });

  const dateRequired = template ? template.needs.date === "required" : kind === "estimate";
  const datePast = Boolean(estimateDate) && estimateDate < todayIso();
  const notify = sendTo.email || sendTo.sms || sendTo.whatsapp;
  const selectedRows = (albums ?? []).filter((album) => selected.has(album.slug));
  const subscriberTotal = selectedRows.reduce((sum, album) => sum + album.subscribers, 0);
  const canPublish = selected.size > 0 && text.trim().length > 0 && !(dateRequired && !estimateDate) && !datePast && !busy;

  const publish = async () => {
    if (!auth.accessToken || !canPublish) return;
    const where = notify ? ` și o trimit pe ${[sendTo.email && "Email", sendTo.sms && "SMS", sendTo.whatsapp && "WhatsApp"].filter(Boolean).join(", ")}` : "";
    if (!window.confirm(`Public noutatea la ${selected.size} ${selected.size === 1 ? "album" : "albume"}${where}?`)) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/album-subscriptions/updates-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({
          slugs: Array.from(selected),
          kind,
          text: text.trim(),
          estimateDate: kindHasDate(kind) && estimateDate ? estimateDate : undefined,
          notify,
          email: sendTo.email,
          phoneDelivery: phoneDeliveryFromChoice(sendTo.sms, sendTo.whatsapp),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { results?: BulkResult[]; adminEmailed?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Eroare ${res.status}`);
      setResults(data.results ?? []);
      setAdminEmailed(Boolean(data.adminEmailed));
      setSelected(new Set());
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare.");
    } finally {
      setBusy(false);
    }
  };

  const clientsOf = (slug: string) => albums?.find((album) => album.slug === slug)?.clients.join(" & ") || slug;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Breadcrumb />
      <div>
        <h1 className="text-2xl font-light tracking-tight text-white">Noutăți în masă</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Bifează albumele clienților și trimite-le aceeași noutate, de exemplu că mai durează puțin pozele, videoclipul sau albumul.
          Apare în „Noutăți despre album” la fiecare și pleacă pe canalele alese.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* ── Albums ── */}
        <section aria-label="Albume" className="border border-neutral-800 bg-neutral-950">
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 p-3">
            <input
              className={`${input} min-w-[180px] flex-1`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută client sau album…"
              aria-label="Caută client sau album"
            />
            <div className="flex" role="group" aria-label="Perioada evenimentului">
              {([["past", "Trecute"], ["upcoming", "Viitoare"], ["all", "Toate"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={period === value}
                  onClick={() => setPeriod(value)}
                  className={`border px-3 py-2 text-xs font-semibold ${period === value ? "border-white bg-white text-black" : "border-neutral-700 text-neutral-300 hover:border-neutral-500"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2 text-xs text-neutral-400">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} disabled={visible.length === 0} />
              Selectează toate ({visible.length})
            </label>
            <span>{selected.size} selectate · {subscriberTotal} abonați</span>
          </div>

          {loadError && <p role="alert" className="p-3 text-sm text-red-400">{loadError}</p>}
          {!albums && !loadError && <p className="p-3 text-sm text-neutral-500">Se încarcă albumele…</p>}
          {albums && visible.length === 0 && <p className="p-3 text-sm text-neutral-500">Niciun album pentru filtrul ales.</p>}

          <ul className="max-h-[60vh] divide-y divide-neutral-900 overflow-y-auto" aria-label="Lista albumelor">
            {visible.map((album) => {
              const last = album.lastUpdate;
              const lastMeta = last && (ALBUM_UPDATE_KINDS as readonly string[]).includes(last.kind) ? ALBUM_UPDATE_META[last.kind as AlbumUpdateKind] : null;
              return (
                <li key={album.slug}>
                  <label className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 ${selected.has(album.slug) ? "bg-[#0f2a18]" : "hover:bg-neutral-900"}`}>
                    <input type="checkbox" className="mt-1" checked={selected.has(album.slug)} onChange={() => toggle(album.slug)} aria-label={`Selectează ${album.clients.join(" & ") || album.slug}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold text-white">{album.clients.join(" & ") || album.slug}</span>
                        <span className="text-xs text-neutral-500">{formatDay(album.eventDate)}</span>
                      </span>
                      <span className="block truncate text-xs text-neutral-500">
                        /media/{album.slug} · {album.subscribers} {album.subscribers === 1 ? "abonat" : "abonați"}
                      </span>
                      <span className="block truncate text-xs text-neutral-400">
                        {last ? `Ultima: ${lastMeta ? `${lastMeta.emoji} ${lastMeta.label}` : last.kind}, ${formatDay(last.createdAt)}` : "Nicio noutate încă"}
                      </span>
                    </span>
                    <a href={`/media/${encodeURIComponent(album.slug)}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-xs text-neutral-500 underline hover:text-white">
                      album ↗
                    </a>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Message ── */}
        <section aria-label="Mesajul" className="space-y-3 border border-neutral-800 bg-neutral-950 p-3 lg:sticky lg:top-4 lg:self-start">
          <div>
            <p className="mb-1.5 text-xs text-neutral-400">Șablon</p>
            <div className="flex flex-wrap gap-1.5">
              {ALBUM_UPDATE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={templateId === t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`border px-2.5 py-1.5 text-xs ${templateId === t.id ? "border-white bg-neutral-800 font-bold text-white" : "border-neutral-700 text-neutral-400 hover:border-neutral-500"}`}
                >
                  {t.title}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={templateId === ""}
                onClick={() => { setTemplateId(""); setText(""); }}
                className={`border border-dashed px-2.5 py-1.5 text-xs ${templateId === "" ? "border-white text-white" : "border-neutral-700 text-neutral-400"}`}
              >
                ✏️ Scriu eu
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(!template || template.needs.deliverable) && (
              <label className="block text-xs text-neutral-400">
                Despre ce
                <select className={`${input} mt-1`} value={deliverable} onChange={(e) => setDeliverable(e.target.value as Deliverable)}>
                  {(Object.keys(DELIVERABLES) as Deliverable[]).map((d) => <option key={d} value={d}>{DELIVERABLES[d].label}</option>)}
                </select>
              </label>
            )}
            {template?.needs.delayDays && (
              <label className="block text-xs text-neutral-400">
                Câte zile în plus <span className="text-neutral-600">(opț.)</span>
                <input type="number" min={1} max={90} inputMode="numeric" className={`${input} mt-1`} value={delayDays} onChange={(e) => setDelayDays(e.target.value)} placeholder="ex. 7" />
              </label>
            )}
            {!template && (
              <label className="block text-xs text-neutral-400">
                Tip
                <select className={`${input} mt-1`} value={kind} onChange={(e) => setKind(e.target.value as AlbumUpdateKind)}>
                  {ALBUM_UPDATE_KINDS.map((k) => <option key={k} value={k}>{ALBUM_UPDATE_META[k].emoji} {ALBUM_UPDATE_META[k].label}</option>)}
                </select>
              </label>
            )}
            {(template ? template.needs.date : kindHasDate(kind)) && (
              <label className="block text-xs text-neutral-400">
                {template?.id === "delay-volume" ? "Noua estimare" : "Data estimată"} {dateRequired ? "" : <span className="text-neutral-600">(opț.)</span>}
                <input type="date" min={todayIso()} className={`${input} mt-1`} value={estimateDate} onChange={(e) => setEstimateDate(e.target.value)} />
              </label>
            )}
          </div>
          {datePast && <p role="alert" className="text-xs text-red-400">Data e în trecut. Verifică anul.</p>}

          <label className="block text-xs text-neutral-400">
            Mesajul <span className="text-neutral-600">(același pentru toți; poți să-l modifici)</span>
            <textarea className={`${input} mt-1 min-h-[120px]`} maxLength={ALBUM_UPDATE_TEXT_MAX} value={text} onChange={(e) => setText(e.target.value)} />
          </label>

          <fieldset className="border border-neutral-800 p-2">
            <legend className="px-1 text-xs text-neutral-400">Unde trimit noutatea</legend>
            <div className="flex flex-wrap gap-3 text-sm text-white">
              {(["email", "sms", "whatsapp"] as const).map((channel) => (
                <label key={channel} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={sendTo[channel]} onChange={(e) => setSendTo((current) => ({ ...current, [channel]: e.target.checked }))} />
                  {channel === "email" ? "Email" : channel === "sms" ? "SMS" : "WhatsApp"}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">Fără nicio bifă, noutatea apare doar în albume, fără mesaje.</p>
          </fieldset>

          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button
            type="button"
            onClick={() => void publish()}
            disabled={!canPublish}
            className="w-full bg-white px-4 py-3 text-sm font-bold uppercase tracking-wider text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {busy ? "Se publică…" : `Publică la ${selected.size} ${selected.size === 1 ? "album" : "albume"}`}
          </button>
        </section>
      </div>

      {results && (
        <section aria-label="Rezultat" className="border border-neutral-800 bg-neutral-950 p-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            ✓ Publicat la {results.filter((r) => r.ok).length} din {results.length}
            {adminEmailed && <span className="ml-2 text-xs font-normal normal-case tracking-normal text-neutral-400">· ți-am trimis pe email și linkurile de WhatsApp</span>}
          </h2>
          {results.some((r) => r.smsSkipped) && <p className="mt-1 text-xs text-amber-300">SMS-urile nu au plecat: lipsește SMSAPI_TOKEN în .env.</p>}
          <ul className="mt-2 space-y-2">
            {results.map((r) => (
              <li key={r.slug} className="border border-neutral-900 p-2 text-sm">
                <p className={r.ok ? "text-white" : "text-red-400"}>
                  {r.ok ? "✓" : "✕"} {clientsOf(r.slug)}{" "}
                  <span className="text-xs text-neutral-500">
                    {r.ok && r.sent ? `${r.sent.email} email · ${r.sent.sms} SMS${r.sent.failed ? ` · ${r.sent.failed} eșuate` : ""}` : r.error}
                  </span>
                </p>
                {r.whatsapp && r.whatsapp.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {r.whatsapp.map((w) => (
                      <a key={w.phone} href={w.link} target="_blank" rel="noreferrer" className="bg-[#25D366] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#1ebe5b]">
                        WhatsApp → {w.name || w.phone}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
