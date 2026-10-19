/*
 * Purpose: the couple's "Pozele trimise de voi" manager on /media/:slug — every share
 * link of the album (theirs and guests'), who it was for, how far it travelled, and
 * quick actions to copy, resend, rename or switch a link off.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { coupleKeyHeaders } from "./coupleAccess";
import { SHARE_LABEL_MAX, sharePath, type ShareLinkSummary } from "../../../shared/media/shareLinks";

type Props = {
  slug: string;
  coupleKey: string;
  /** Bump to reload after a new link was created on the page. */
  refreshToken: number;
};

type Tab = "couple" | "guest";

const COLLAPSED_COUNT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export function formatAgo(ms: number | null, now = Date.now()): string {
  if (!ms) return "";
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (ms >= startOfToday.getTime()) return "azi";
  if (ms >= startOfToday.getTime() - DAY_MS) return "ieri";
  const days = Math.floor((startOfToday.getTime() - ms) / DAY_MS) + 1;
  if (days < 7) return `acum ${days} zile`;
  return new Date(ms).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function shareUrl(id: string) {
  return `${window.location.origin}${sharePath(id)}`;
}

export default function ShareManagerPanel({ slug, coupleKey, refreshToken }: Props) {
  const [links, setLinks] = useState<ShareLinkSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("couple");
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/share/couple/${encodeURIComponent(slug)}/links`, { headers: coupleKeyHeaders(coupleKey) });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { links?: ShareLinkSummary[] };
      setLinks(data.links ?? []);
      setError(null);
    } catch {
      setError("Nu am putut încărca linkurile. Reîncearcă puțin mai târziu.");
    }
  }, [slug, coupleKey]);

  useEffect(() => { void load(); }, [load, refreshToken]);

  const update = useCallback(async (id: string, patch: { label?: string; revoked?: boolean }) => {
    setLinks((prev) => prev?.map((link) => (link.id === id ? { ...link, ...patch } : link)) ?? prev);
    const res = await fetch(`/api/share/couple/${encodeURIComponent(slug)}/links/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...coupleKeyHeaders(coupleKey) },
      body: JSON.stringify(patch),
    }).catch(() => null);
    if (!res?.ok) {
      setError("Modificarea nu s-a salvat. Reîncearcă.");
      void load();
    }
  }, [slug, coupleKey, load]);

  const byTab = useMemo(() => ({
    couple: (links ?? []).filter((link) => link.createdBy === "couple"),
    guest: (links ?? []).filter((link) => link.createdBy === "guest"),
  }), [links]);

  const totals = useMemo(() => (links ?? []).reduce(
    (acc, link) => ({ views: acc.views + link.views, forwards: acc.forwards + link.forwards, downloads: acc.downloads + link.downloads }),
    { views: 0, forwards: 0, downloads: 0 },
  ), [links]);

  const visible = byTab[tab];
  const shown = expanded ? visible : visible.slice(0, COLLAPSED_COUNT);

  return (
    <section
      data-onboarding="share-manager"
      className="my-4 rounded-2xl border border-[#3a2f1c] bg-gradient-to-b from-[#14110b] to-[#0a0a0a] p-4 sm:p-5"
      aria-label="Pozele trimise de voi"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c9a96e]">Doar pentru voi, mirilor</p>
          <h2 className="mt-1 text-lg font-semibold text-white">💌 Pozele trimise de voi</h2>
          {links && links.length > 0 && (
            <p className="mt-1 text-xs text-neutral-400">
              {plural(links.length, "link", "linkuri")} · {plural(totals.views, "deschidere", "deschideri")} · {plural(totals.forwards, "trimitere mai departe", "trimiteri mai departe")}
            </p>
          )}
        </div>
        <span className="mt-1 text-neutral-500" aria-hidden>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2" role="tablist">
            {([["couple", "De la voi"], ["guest", "De la invitați"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => { setTab(value); setExpanded(false); }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === value ? "bg-[#c9a96e] text-black" : "border border-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                {label} ({byTab[value].length})
              </button>
            ))}
          </div>

          {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
          {!links && !error && <p className="text-xs text-neutral-500">Se încarcă…</p>}

          {links && visible.length === 0 && (
            <div className="rounded-xl border border-dashed border-neutral-800 px-4 py-5 text-center">
              {tab === "couple" ? (
                <>
                  <p className="text-sm text-neutral-300">Încă n-ați trimis nimănui poze.</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Apăsați <strong className="text-neutral-300">„Trimite poze invitaților”</strong> din „Ce poți face aici”, bifați pozele cu nașii, părinții sau prietenii, apoi <strong className="text-neutral-300">📤 Trimite pozele</strong>. Fiecare primește doar pozele alese de voi, nu tot albumul.
                  </p>
                </>
              ) : (
                <p className="text-xs text-neutral-500">Niciun invitat n-a trimis încă poze din album.</p>
              )}
            </div>
          )}

          <ul className="space-y-2">
            {shown.map((link) => <ShareLinkRow key={link.id} link={link} onUpdate={update} />)}
          </ul>

          {visible.length > COLLAPSED_COUNT && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs text-[#c9a96e] hover:underline">
              {expanded ? "Arată mai puține" : `Vezi toate (${visible.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function ShareLinkRow({ link, onUpdate }: { link: ShareLinkSummary; onUpdate: (id: string, patch: { label?: string; revoked?: boolean }) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(link.label);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const url = shareUrl(link.id);
  const title = link.label || (link.createdBy === "guest" ? "Trimis de un invitat" : "Fără nume");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the link is still visible in the row */ }
  };

  const resend = () => {
    if (typeof navigator.share === "function") {
      void navigator.share({ title: link.label ? `Poze pentru ${link.label}` : "Poze de la eveniment", url }).catch(() => undefined);
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
    }
  };

  const saveLabel = () => {
    setEditing(false);
    const next = draft.trim().slice(0, SHARE_LABEL_MAX);
    if (next !== link.label) onUpdate(link.id, { label: next });
  };

  return (
    <li className={`rounded-xl border p-3 ${link.revoked ? "border-neutral-900 bg-neutral-950 opacity-60" : "border-neutral-800 bg-neutral-950/70"}`}>
      <div className="flex gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
          {link.cover && <img src={link.cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={(event) => { event.preventDefault(); saveLabel(); }} className="flex gap-2">
              <input
                autoFocus
                value={draft}
                maxLength={SHARE_LABEL_MAX}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={saveLabel}
                placeholder="Pentru cine e? ex. Nașii"
                className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-black px-2 py-1 text-sm text-white outline-none focus:border-[#c9a96e]"
              />
            </form>
          ) : (
            <p className="truncate text-sm font-medium text-white">
              {link.createdBy === "couple" ? "Pentru " : ""}{title}
              {link.revoked && <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">dezactivat</span>}
            </p>
          )}
          <p className="mt-0.5 text-xs text-neutral-500">
            {link.showAll ? `Tot albumul (${link.count})` : plural(link.count, "poză", "poze")} · creat {formatAgo(link.createdAt)}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-400">
            <span title="Deschideri">👁 {link.views}</span>
            <span title="Descărcări">⬇️ {link.downloads}</span>
            <span title="Trimis mai departe">📤 {link.forwards}</span>
            {link.lastViewedAt && <span className="text-neutral-500">văzut {formatAgo(link.lastViewedAt)}</span>}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {!link.revoked && (
          <>
            <button type="button" onClick={resend} className="rounded-lg bg-[#25D366] px-3 py-1.5 font-semibold text-white">📤 Trimite</button>
            <button type="button" onClick={() => void copy()} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-neutral-300 hover:text-white">
              {copied ? "✓ Copiat" : "Copiază linkul"}
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-neutral-700 px-3 py-1.5 text-neutral-300 hover:text-white">Deschide</a>
          </>
        )}
        <button type="button" onClick={() => { setDraft(link.label); setEditing(true); }} className="rounded-lg border border-neutral-800 px-3 py-1.5 text-neutral-400 hover:text-white">Redenumește</button>
        {link.revoked ? (
          <button type="button" onClick={() => onUpdate(link.id, { revoked: false })} className="rounded-lg border border-neutral-800 px-3 py-1.5 text-neutral-400 hover:text-white">Reactivează</button>
        ) : confirmRevoke ? (
          <>
            <button type="button" onClick={() => { setConfirmRevoke(false); onUpdate(link.id, { revoked: true }); }} className="rounded-lg bg-red-900/70 px-3 py-1.5 text-red-100">Da, oprește linkul</button>
            <button type="button" onClick={() => setConfirmRevoke(false)} className="rounded-lg px-2 py-1.5 text-neutral-500">Nu</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmRevoke(true)} className="rounded-lg border border-neutral-800 px-3 py-1.5 text-neutral-500 hover:text-red-300">Dezactivează</button>
        )}
      </div>
    </li>
  );
}
