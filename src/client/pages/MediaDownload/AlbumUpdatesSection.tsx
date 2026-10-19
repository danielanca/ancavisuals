/*
 * Purpose: "Noutăți album" on /media/:slug — the latest estimate / new-photos / announcement
 * from the photographer, a subscribe form (Email, SMS, WhatsApp) and, for the admin, a
 * composer that publishes an update and optionally sends it to every subscriber.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ALBUM_UPDATE_KINDS,
  ALBUM_UPDATE_META,
  ALBUM_UPDATE_TEXT_MAX,
  phoneDeliveryFromChoice,
  SUBSCRIBE_CHANNELS,
  SUBSCRIBE_CHANNEL_META,
  formatEstimateDate,
  isValidEmail,
  kindHasDate,
  type AlbumUpdate,
  type AlbumUpdateKind,
  type SubscribeChannel,
} from "../../../shared/albumUpdates";
import { sendLiveEvent } from "../../utils/liveEvent";
import {
  ALBUM_UPDATE_TEMPLATES,
  DELIVERABLES,
  findAlbumUpdateTemplate,
  type Deliverable,
} from "../../../shared/albumUpdateTemplates";

type Props = {
  slug: string;
  isAdmin: boolean;
  accessToken: string | null;
  /** Signed-in admin currently looking at the page in "👁 Client" view — the composer is hidden. */
  adminPreviewHidden?: boolean;
  onExitClientPreview?: () => void;
  /** Collapsed by default (only the header + latest update line); tests and deep links can open it. */
  defaultOpen?: boolean;
};

/** Dispatched by "Noutăți & abonare" in the action hub, so the panel opens before scrolling to it. */
export const OPEN_ALBUM_UPDATES_EVENT = "album-updates:open";

type PublishResult = {
  sent: { email: number; sms: number; failed: number };
  smsSkipped: boolean;
  whatsapp: { name: string | null; phone: string; link: string }[];
  adminEmailed?: boolean;
};

const input = "w-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white";

function formatPostedParts(iso: string | null): { day: string; time: string } | null {
  if (!iso) return null;
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const day = date.toLocaleDateString("ro-RO", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  const time = date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  return { day, time };
}

export default function AlbumUpdatesSection({ slug, isAdmin, accessToken, adminPreviewHidden = false, onExitClientPreview, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [updates, setUpdates] = useState<AlbumUpdate[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/album-subscriptions/updates/${encodeURIComponent(slug)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { updates?: AlbumUpdate[] };
      setUpdates(data.updates ?? []);
    } catch { /* timeline is optional */ }
    finally { setLoaded(true); }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const openPanel = () => setOpen(true);
    window.addEventListener(OPEN_ALBUM_UPDATES_EVENT, openPanel);
    return () => window.removeEventListener(OPEN_ALBUM_UPDATES_EVENT, openPanel);
  }, []);

  const [latest, ...older] = updates;
  const visibleOlder = showAll ? older : older.slice(0, 2);

  return (
    <div className="my-5 space-y-3">
      <section
        aria-label="Noutăți despre album"
        className="relative border border-neutral-600 border-l-4 border-l-white bg-[#0b0b0b]"
      >

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="album-updates-body"
          className={`relative flex w-full items-center gap-3 bg-white px-4 py-3 text-left sm:px-5 ${open ? "border-b border-neutral-700" : ""}`}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="flex shrink-0 items-center gap-1 bg-black px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                <span className="relative flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 bg-red-500" />
                </span>
                Live
              </span>
              <span className="truncate text-sm font-bold uppercase leading-tight tracking-wide text-black sm:text-lg">Noutăți despre album</span>
            </span>
            <span className="mt-1 line-clamp-2 block text-xs leading-snug text-neutral-600">
              {!open && latest
                ? <>Ultima: <strong className="font-semibold text-black">{ALBUM_UPDATE_META[latest.kind].label}{latest.estimateDate ? ` · ${formatEstimateDate(latest.estimateDate)}` : ""}</strong>{updates.length > 1 ? ` · ${updates.length} noutăți` : ""}</>
                : "Stadiul pozelor, al videoclipului și al albumului, direct de la noi"}
            </span>
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-black text-sm text-black sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[11px] sm:font-bold sm:uppercase sm:tracking-wider">
            <span className="hidden sm:inline">{open ? "Ascunde" : "Vezi"}</span>
            <span aria-hidden>{open ? "▲" : "▼"}</span>
          </span>
        </button>

        <div id="album-updates-body" hidden={!open}>

          {isAdmin && accessToken && <UpdateComposer slug={slug} accessToken={accessToken} onPublished={load} />}
          {isAdmin && accessToken && <SubscribersAdmin slug={slug} accessToken={accessToken} />}
          {adminPreviewHidden && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-700 bg-neutral-900 px-4 py-2.5 text-xs text-neutral-300 sm:px-5">
              <span>Ești în modul Client, așa că nu poți adăuga noutăți.</span>
              {onExitClientPreview && (
                <button type="button" onClick={onExitClientPreview} className="bg-white px-3 py-1 font-bold uppercase tracking-wider text-black hover:bg-neutral-200">
                  Treci pe Admin
                </button>
              )}
            </div>
          )}

          <div className="relative px-4 py-4 sm:px-5">
            {latest ? (
              <ol>
                <li><UpdateItem update={latest} highlight isAdmin={isAdmin} slug={slug} accessToken={accessToken} onDeleted={load} /></li>
                {visibleOlder.length > 0 && (
                  <li className="mb-3 mt-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                    <span>Mai vechi</span>
                    <span aria-hidden className="h-px flex-1 bg-neutral-800" />
                  </li>
                )}
                {visibleOlder.map((u, i) => (
                  <li key={u.id} className={i > 0 ? "mt-2" : ""}><UpdateItem update={u} isAdmin={isAdmin} slug={slug} accessToken={accessToken} onDeleted={load} /></li>
                ))}
              </ol>
            ) : loaded ? (
              <p className="border border-dashed border-neutral-700 px-4 py-3 text-sm text-neutral-400">
                Încă nu am publicat noutăți. Prima estimare de predare apare aici, cu data și ora.
              </p>
            ) : null}
            {older.length > 2 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 text-xs font-semibold uppercase tracking-wider text-white underline underline-offset-4 hover:text-neutral-300">
                {showAll ? "Arată mai puțin" : `Vezi toate noutățile (${updates.length})`}
              </button>
            )}
          </div>

          {/* Subscribing is for clients; the admin manages subscribers in "👥 Abonați" above. */}
          {!isAdmin && <SubscribeCard slug={slug} />}

          {!isAdmin && !adminPreviewHidden && (
            <div className="border-t border-neutral-800 px-4 py-2 text-right sm:px-5">
              <a href={`/login?redirect=${encodeURIComponent(`/media/${slug}`)}`} className="text-[11px] text-neutral-600 hover:text-neutral-300">
                🔑 Admin
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const FRESH_MS = 72 * 60 * 60 * 1000;

function UpdateItem({ update, highlight = false, isAdmin, slug, accessToken, onDeleted }: {
  update: AlbumUpdate;
  highlight?: boolean;
  isAdmin: boolean;
  slug: string;
  accessToken: string | null;
  onDeleted: () => void;
}) {
  const meta = ALBUM_UPDATE_META[update.kind];
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const remove = async () => {
    if (!accessToken || deleting) return;
    if (!window.confirm(`Ștergi noutatea „${meta.label}” din albumul clientului?\n\nDispare din album pentru toată lumea. Mesajele deja trimise (email/SMS) nu pot fi retrase.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/album-subscriptions/updates/${encodeURIComponent(slug)}/${encodeURIComponent(update.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      onDeleted();
    } catch {
      setDeleteError("Nu am putut șterge noutatea. Încearcă din nou.");
      setDeleting(false);
    }
  };
  const isFresh = update.createdAt ? Date.now() - new Date(update.createdAt).getTime() < FRESH_MS : false;
  const posted = formatPostedParts(update.createdAt);
  return (
    <div className={`flex flex-col gap-1 sm:flex-row sm:gap-4 ${highlight ? "" : "opacity-60 transition-opacity hover:opacity-100"}`}>
      {/* When it was posted — newest on top, reads like a log. Phones: one line above the card
          (a side column would eat half the width); wider screens: a column on the left. */}
      <div className="flex shrink-0 items-baseline gap-2 text-left sm:block sm:w-24 sm:pt-2.5">
        {highlight && <p className="text-[9px] font-bold uppercase tracking-wider text-white sm:mb-1">Cea mai nouă</p>}
        {posted && (
          <time dateTime={update.createdAt ?? undefined} className="flex items-baseline gap-1.5 font-mono leading-tight sm:block">
            <span className={`block ${highlight ? "text-xs font-semibold text-white sm:text-sm" : "text-xs text-neutral-400"}`}>{posted.day}</span>
            <span className={`block ${highlight ? "text-xs text-neutral-300" : "text-[11px] text-neutral-500"}`}>{posted.time}</span>
          </time>
        )}
      </div>
      <div
        className={`min-w-0 flex-1 border-l-4 px-3.5 py-2.5 text-left ${
          highlight ? "border border-l-4 border-neutral-500 border-l-white bg-neutral-900" : "border-l-neutral-700 bg-neutral-950"
        }`}
      >
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span aria-hidden>{meta.emoji}</span>
          <span className={`font-semibold uppercase tracking-wider ${highlight ? "text-white" : "text-neutral-400"}`}>{meta.label}</span>
          {highlight && isFresh && <span className="bg-red-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white">Nou</span>}
          {isAdmin && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={deleting}
              aria-label={`Șterge noutatea ${meta.label}`}
              className="ml-auto border border-red-500/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300 hover:bg-red-600 hover:text-white disabled:opacity-50"
            >
              {deleting ? "Se șterge…" : "🗑 Șterge"}
            </button>
          )}
        </p>
        {deleteError && <p role="alert" className="mt-1 text-xs text-red-400">{deleteError}</p>}
        {update.estimateDate && (
          <p className={`font-semibold ${highlight ? "mt-1.5 text-xl text-white sm:text-2xl" : "mt-1 text-sm text-neutral-200"}`}>{formatEstimateDate(update.estimateDate)}</p>
        )}
        <p className={`mt-1 whitespace-pre-line ${highlight ? "text-sm leading-relaxed text-neutral-100" : "text-xs text-neutral-400"}`}>{update.text}</p>
      </div>
    </div>
  );
}

function SubscribeCard({ slug }: { slug: string }) {
  const [channels, setChannels] = useState<SubscribeChannel[]>(["whatsapp"]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const needsEmail = channels.includes("email");
  const needsPhone = channels.includes("sms") || channels.includes("whatsapp");
  const ready = channels.length > 0 && (!needsEmail || isValidEmail(email)) && (!needsPhone || phone.replace(/\D/g, "").length >= 9);

  const toggle = (channel: SubscribeChannel) =>
    setChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]));

  const submit = async () => {
    if (!ready) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/album-subscriptions/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumSlug: slug, channels, email: email.trim(), phone: phone.trim(), name: name.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "A apărut o eroare. Încearcă din nou.");
      setStatus("done");
      sendLiveEvent("form_submitted", {
        priority: "high",
        label: "📧 S-a abonat — vrea să fie anunțat când sunt gata pozele",
        meta: { kind: "subscribe" },
      });
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "A apărut o eroare.");
    }
  };

  if (status === "done") {
    return (
      <div className="relative border-t border-neutral-700 bg-neutral-950 px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold text-white">✓ Te-ai abonat! Te anunțăm pe {channels.map((c) => SUBSCRIBE_CHANNEL_META[c].label).join(" și ")} când apar poze noi sau estimări.</p>
      </div>
    );
  }

  return (
    <div data-onboarding="subscribe" role="group" aria-label="Abonare la noutăți" className="relative border-t border-neutral-700 bg-neutral-950 px-4 py-4 sm:px-5">
      <p className="text-sm font-semibold text-white">🔔 Vrei să afli primul când apar poze noi?</p>
      <p className="mt-1 text-xs text-neutral-400">
        Primești automat fiecare noutate de mai sus: stadiul pozelor, al videoclipului și al albumului tipărit, cu estimări de predare. Nu mai e nevoie să ne întrebi.
      </p>

      <p className="mt-3 text-xs text-neutral-400">Unde vrei să primești noutățile? <span className="text-neutral-600">(poți bifa mai multe)</span></p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Unde vrei să primești noutățile">
        {SUBSCRIBE_CHANNELS.map((channel) => {
          const on = channels.includes(channel);
          return (
            <label
              key={channel}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 0, cursor: "pointer",
                fontSize: 14, userSelect: "none", transition: "all 0.15s",
                border: `1.5px solid ${on ? "#fff" : "#333"}`,
                background: on ? "rgba(255,255,255,0.08)" : "transparent",
                color: on ? "#fff" : "#999",
                fontWeight: on ? 600 : 400,
              }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(channel)}
                style={{ width: 18, height: 18, margin: 0, accentColor: "#fff", cursor: "pointer" }}
              />
              {SUBSCRIBE_CHANNEL_META[channel].emoji} {SUBSCRIBE_CHANNEL_META[channel].label}
            </label>
          );
        })}
      </div>
      {channels.length === 0 && <p className="mt-2 text-xs text-amber-300">Bifează cel puțin un canal.</p>}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {needsPhone && (
          <input className={input} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon (07xx xxx xxx)" aria-label="Telefon" />
        )}
        {needsEmail && (
          <input className={input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="adresa@email.com" aria-label="Email" />
        )}
        <input className={input} value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} placeholder="Numele tău (opțional)" aria-label="Nume" />
      </div>

      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!ready || status === "loading"}
        className="mt-3 w-full bg-white px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 sm:w-auto"
      >
        {status === "loading" ? "Se abonează..." : "Abonează-mă"}
      </button>
      <p className="mt-2 text-[11px] text-neutral-600">Te poți dezabona oricând din linkul primit în mesaj.</p>
    </div>
  );
}

type AdminSubscriber = {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  channels: SubscribeChannel[];
  source: string;
};

function SubscribersAdmin({ slug, accessToken }: { slug: string; accessToken: string }) {
  const [open, setOpen] = useState(false);
  const [subscribers, setSubscribers] = useState<AdminSubscriber[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/album-subscriptions/list/${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Eroare ${res.status}`);
        const data = (await res.json()) as { subscribers?: AdminSubscriber[] };
        if (!cancelled) setSubscribers(data.subscribers ?? []);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Nu am putut încărca abonații."); });
    return () => { cancelled = true; };
  }, [slug, accessToken, version]);

  const remove = async (subscriber: AdminSubscriber) => {
    if (!window.confirm(`Ștergi abonatul ${subscriber.name || subscriber.phone || subscriber.email}?`)) return;
    setRemoving(subscriber.id);
    try {
      const res = await fetch("/api/album-subscriptions/unsubscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ albumSlug: slug, id: subscriber.id }),
      });
      if (!res.ok) throw new Error();
      setSubscribers((prev) => (prev ?? []).filter((s) => s.id !== subscriber.id));
    } catch {
      setError("Nu am putut șterge abonatul.");
    } finally {
      setRemoving(null);
    }
  };

  const count = subscribers?.length;
  return (
    <section className="border-b border-neutral-700 bg-neutral-900 px-4 py-3 sm:px-5" aria-label="Abonați (admin)">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="text-sm font-bold uppercase tracking-wider text-white">
          👥 Abonați {count === undefined ? "" : `(${count})`} <span className="text-[11px] font-normal normal-case tracking-normal text-neutral-500">(doar tu îi vezi)</span>
        </span>
        <span className="text-lg leading-none text-neutral-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-3">
          {error && <p role="alert" className="mb-2 text-xs text-red-400">{error}</p>}
          {subscribers === null && !error && <p className="text-xs text-neutral-500">Se încarcă…</p>}
          {subscribers?.length === 0 && <p className="text-xs text-neutral-500">Niciun abonat încă.</p>}
          <AddSubscriberForm slug={slug} accessToken={accessToken} onAdded={reload} />
          {subscribers && subscribers.length > 0 && (
            <ul className="divide-y divide-neutral-800 border border-neutral-800">
              {subscribers.map((s) => (
                <li key={s.id} className="flex items-center gap-3 bg-black px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">
                      {s.name || s.phone || s.email}
                      {s.source === "event-client" && <span className="ml-2 bg-neutral-800 px-1.5 py-px text-[10px] uppercase tracking-wider text-neutral-300">din eveniment</span>}
                      {s.source === "admin" && <span className="ml-2 bg-neutral-800 px-1.5 py-px text-[10px] uppercase tracking-wider text-neutral-300">adăugat de tine</span>}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {s.channels.map((c) => SUBSCRIBE_CHANNEL_META[c]?.label ?? c).join(" · ")}
                      {s.phone ? ` · ${s.phone}` : ""}
                      {s.email ? ` · ${s.email}` : ""}
                    </p>
                  </div>
                  {s.phone && (
                    <a href={`https://wa.me/${s.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="shrink-0 border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:border-white hover:text-white">
                      WhatsApp
                    </a>
                  )}
                  <button type="button" onClick={() => void remove(s)} disabled={removing === s.id} aria-label={`Șterge ${s.name || s.phone || s.email}`} className="shrink-0 px-1 text-sm text-neutral-500 hover:text-red-400 disabled:opacity-40">
                    {removing === s.id ? "…" : "✕"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function AddSubscriberForm({ slug, accessToken, onAdded }: { slug: string; accessToken: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<SubscribeChannel[]>(["whatsapp"]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const needsEmail = channels.includes("email");
  const needsPhone = channels.includes("sms") || channels.includes("whatsapp");
  const toggle = (channel: SubscribeChannel) =>
    setChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]));

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/album-subscriptions/admin-add", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ albumSlug: slug, channels, name: name.trim(), phone: phone.trim(), email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; alreadySubscribed?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Eroare ${res.status}`);
      setMessage({ ok: true, text: data.alreadySubscribed ? "Era deja abonat — am adăugat canalele noi." : "Abonat adăugat." });
      setName(""); setPhone(""); setEmail("");
      onAdded();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Nu am putut adăuga abonatul." });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 border border-neutral-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:border-white">
        ＋ Adaugă abonat
      </button>
    );
  }
  return (
    <div className="mt-3 border border-neutral-700 bg-black p-3" role="group" aria-label="Adaugă abonat">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Canale abonat nou">
        {SUBSCRIBE_CHANNELS.map((channel) => (
          <label key={channel} className={`flex cursor-pointer items-center gap-2 border px-3 py-1.5 text-xs ${channels.includes(channel) ? "border-white text-white" : "border-neutral-700 text-neutral-400"}`}>
            <input type="checkbox" checked={channels.includes(channel)} onChange={() => toggle(channel)} className="accent-white" />
            {SUBSCRIBE_CHANNEL_META[channel].emoji} {SUBSCRIBE_CHANNEL_META[channel].label}
          </label>
        ))}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <input className={input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Nume (opțional)" aria-label="Nume abonat nou" />
        {needsPhone && <input className={input} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon (07xx xxx xxx)" aria-label="Telefon abonat nou" />}
        {needsEmail && <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="adresa@email.com" aria-label="Email abonat nou" />}
      </div>
      {message && <p role={message.ok ? "status" : "alert"} className={`mt-2 text-xs ${message.ok ? "text-green-400" : "text-red-400"}`}>{message.text}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => void submit()} disabled={busy || channels.length === 0} className="bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-black hover:bg-neutral-200 disabled:opacity-40">
          {busy ? "Se adaugă…" : "Adaugă"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setMessage(null); }} className="border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-white">
          Închide
        </button>
      </div>
    </div>
  );
}

/** Local YYYY-MM-DD — an estimate can't be in the past (a 2024 date slipped in from the picker). */
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function UpdateComposer({ slug, accessToken, onPublished }: { slug: string; accessToken: string; onPublished: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AlbumUpdateKind>("estimate");
  const [text, setText] = useState("");
  const [estimateDate, setEstimateDate] = useState("");
  const [sendTo, setSendTo] = useState<Record<SubscribeChannel, boolean>>({ email: true, sms: true, whatsapp: true });
  const notify = sendTo.email || sendTo.sms || sendTo.whatsapp;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<string>("");
  const [deliverable, setDeliverable] = useState<Deliverable>("photos");
  const [delayDays, setDelayDays] = useState("");
  const [photoCount, setPhotoCount] = useState("");
  const template = templateId ? findAlbumUpdateTemplate(templateId) : undefined;

  // A template rewrites the message whenever its inputs change; the text stays editable.
  useEffect(() => {
    if (!template) return;
    setKind(template.kind);
    setText(template.build({
      deliverable,
      date: estimateDate || undefined,
      delayDays: Number(delayDays) || undefined,
      photoCount: Number(photoCount) || undefined,
    }));
  }, [template, deliverable, estimateDate, delayDays, photoCount]);

  const dateRequired = template ? template.needs.date === "required" : kind === "estimate";
  const datePast = Boolean(estimateDate) && estimateDate < todayIso();

  useEffect(() => {
    if (!open) return;
    fetch(`/api/album-subscriptions/count/${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count?: number } | null) => setSubscriberCount(data?.count ?? null))
      .catch(() => setSubscriberCount(null));
  }, [open, slug, accessToken]);

  const publish = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/album-subscriptions/updates/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ kind, text: text.trim(), estimateDate: kindHasDate(kind) && estimateDate ? estimateDate : undefined, notify, email: sendTo.email, phoneDelivery: phoneDeliveryFromChoice(sendTo.sms, sendTo.whatsapp) }),
      });
      const data = (await res.json().catch(() => ({}))) as PublishResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Eroare ${res.status}`);
      setResult(data);
      setText("");
      setTemplateId("");
      onPublished();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-b border-neutral-700 bg-neutral-900 px-4 py-3 sm:px-5" aria-label="Postează o noutate (admin)">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="text-sm font-bold uppercase tracking-wider text-white">＋ Adaugă o noutate <span className="text-[11px] font-normal normal-case tracking-normal text-neutral-500">(doar tu o vezi, ca admin)</span></span>
        <span className="text-lg leading-none text-neutral-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1.5 text-xs text-neutral-400">Șablon gata făcut <span className="text-neutral-600">(completezi doar data / zilele)</span></p>
            <div className="flex flex-wrap gap-2">
              {ALBUM_UPDATE_TEMPLATES.map((t) => (
                <button key={t.id} type="button" aria-pressed={templateId === t.id} onClick={() => setTemplateId(t.id)}
                  style={{
                    padding: "6px 12px", borderRadius: 0, fontSize: 12, cursor: "pointer",
                    border: `1.5px solid ${templateId === t.id ? "#fff" : "#3a3a3a"}`,
                    background: templateId === t.id ? "rgba(201,169,110,0.16)" : "transparent",
                    color: templateId === t.id ? "#fff" : "#aaa",
                    fontWeight: templateId === t.id ? 700 : 400,
                  }}>
                  {t.title}
                </button>
              ))}
              <button type="button" aria-pressed={templateId === ""} onClick={() => { setTemplateId(""); setText(""); }}
                style={{
                  padding: "6px 12px", borderRadius: 0, fontSize: 12, cursor: "pointer",
                  border: `1.5px dashed ${templateId === "" ? "#fff" : "#3a3a3a"}`,
                  background: "transparent", color: templateId === "" ? "#fff" : "#888",
                }}>
                ✏️ Scriu eu mesajul
              </button>
            </div>
          </div>

          {template && (
            <div className="grid gap-2 sm:grid-cols-2">
              {template.needs.deliverable && (
                <label className="block text-xs text-neutral-400">
                  Despre ce
                  <select className={`${input} mt-1`} value={deliverable} onChange={(e) => setDeliverable(e.target.value as Deliverable)}>
                    {(Object.keys(DELIVERABLES) as Deliverable[]).map((d) => <option key={d} value={d}>{DELIVERABLES[d].label}</option>)}
                  </select>
                </label>
              )}
              {template.needs.delayDays && (
                <label className="block text-xs text-neutral-400">
                  Câte zile de întârziere <span className="text-neutral-600">(opțional)</span>
                  <input type="number" min={1} max={90} inputMode="numeric" className={`${input} mt-1`} value={delayDays} onChange={(e) => setDelayDays(e.target.value)} placeholder="ex. 5" />
                </label>
              )}
              {template.needs.photoCount && (
                <label className="block text-xs text-neutral-400">
                  Câte poze <span className="text-neutral-600">(opțional)</span>
                  <input type="number" min={1} inputMode="numeric" className={`${input} mt-1`} value={photoCount} onChange={(e) => setPhotoCount(e.target.value)} placeholder="ex. 120" />
                </label>
              )}
            </div>
          )}

          {!template && (
          <div className="flex flex-wrap gap-2">
            {ALBUM_UPDATE_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                style={{
                  padding: "6px 12px", borderRadius: 0, fontSize: 12, cursor: "pointer",
                  border: `1.5px solid ${kind === k ? "#fff" : "#444"}`,
                  background: kind === k ? "#fff" : "transparent",
                  color: kind === k ? "#000" : "#aaa",
                  fontWeight: kind === k ? 700 : 400,
                }}>
                {ALBUM_UPDATE_META[k].emoji} {ALBUM_UPDATE_META[k].label}
              </button>
            ))}
          </div>
          )}
          {(template ? template.needs.date : kindHasDate(kind)) && (
            <label className="block text-xs text-neutral-400">
              {template?.id === "delay-volume" ? "Noua dată estimată" : "Data estimată"}{dateRequired ? "" : " (opțional)"}
              <input type="date" min={todayIso()} className={`${input} mt-1`} value={estimateDate} onChange={(e) => setEstimateDate(e.target.value)} />
            </label>
          )}
          {datePast && (
            <p role="alert" className="text-xs text-red-400">Data aleasă e în trecut ({formatEstimateDate(estimateDate)}). Verifică anul.</p>
          )}
          {template && <p className="text-xs text-neutral-500">Mesajul de mai jos se completează singur — îl poți modifica înainte să publici.</p>}
          <textarea
            className={input}
            rows={template ? 5 : 3}
            maxLength={ALBUM_UPDATE_TEXT_MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={ALBUM_UPDATE_META[kind].placeholder}
            aria-label="Mesaj"
          />
          <fieldset className="border border-neutral-700 p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-white">Unde trimit noutatea</legend>
            <p className="text-xs text-neutral-500">
              Apare oricum în album{subscriberCount !== null ? ` · ${subscriberCount} abonați` : ""}. Bifează și unde o trimiți:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUBSCRIBE_CHANNELS.map((channel) => (
                <label key={channel} className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm ${sendTo[channel] ? "border-white bg-white text-black" : "border-neutral-700 text-neutral-400 hover:border-neutral-400"}`}>
                  <input type="checkbox" checked={sendTo[channel]} onChange={(e) => setSendTo((prev) => ({ ...prev, [channel]: e.target.checked }))} className="accent-black" />
                  {SUBSCRIBE_CHANNEL_META[channel].emoji} {SUBSCRIBE_CHANNEL_META[channel].label}
                </label>
              ))}
            </div>
            <ul className="mt-2 space-y-0.5 text-[11px] text-neutral-500">
              {sendTo.email && <li>✉️ Email — pleacă automat la abonații cu email.</li>}
              {sendTo.sms && <li>💬 SMS — pleacă automat la toți abonații cu telefon.</li>}
              {sendTo.whatsapp && <li>🟢 WhatsApp — primești butoane cu mesajul completat (aici și pe email), tu doar apeși Trimite.</li>}
              {!notify && <li>Doar în album — nu trimit nimic abonaților.</li>}
            </ul>
          </fieldset>
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
          <button type="button" onClick={() => void publish()} disabled={busy || !text.trim() || (dateRequired && !estimateDate) || datePast}
            className="bg-white px-4 py-2 text-sm font-bold uppercase tracking-wider text-black hover:bg-neutral-200 disabled:opacity-40">
            {busy ? "Se publică..." : "Publică"}
          </button>

          {result && (
            <div className="border border-neutral-800 bg-black p-3 text-xs text-neutral-300 space-y-2">
              <p>✓ Publicat. Trimis: {result.sent.email} email, {result.sent.sms} SMS{result.sent.failed ? `, ${result.sent.failed} eșuate` : ""}.</p>
              {result.smsSkipped && <p className="text-amber-300">SMS-urile nu au plecat: SMS nu e configurat pe server (lipsește SMSAPI_TOKEN în .env).</p>}
              {result.whatsapp.length > 0 && (
                <div>
                  <p className="mb-1 text-neutral-400">
                    WhatsApp — {result.adminEmailed ? "ți-am trimis și pe email preview-ul + butoanele. Sau " : ""}apasă aici pe fiecare ca să trimiți mesajul pregătit:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.whatsapp.map((w) => (
                      <a key={w.phone} href={w.link} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#25D366] px-3 py-1 font-semibold text-white">
                        {w.name || w.phone}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
