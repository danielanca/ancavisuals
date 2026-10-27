/*
 * Purpose: admin panel (inside the album's "Link unic de selecție poze" box) for public
 * proposal links — generate a unique link per person, copy it, follow their
 * progress (photos browsed / proposed / done) and see the photos they picked.
 */
import React, { useCallback, useEffect, useState } from "react";
import { nameKey, type PhotoReviewer, type PhotoReviewerId } from "../../../shared/media/proposalConsensus";

type LinkVisitor = {
  id: string;
  name: string;
  viewedCount: number;
  proposedCount: number;
  lastSeenAt: string | null;
  completedAt: string | null;
};

type ProposalLink = {
  token: string;
  label: string;
  reviewerId?: PhotoReviewerId;
  active: boolean;
  url: string;
  createdAt: string | null;
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
  totalPhotos: number;
  reminderCount?: number;
  lastReminderAt?: string | null;
  lastReminderChannels?: string[];
  visitors: LinkVisitor[];
  photos: { fileName: string; previewUrl: string; proposedBy: string }[];
};

const GOLD = "#c9a96e";

const STATUS_STYLE: Record<ProposalLink["status"], { label: string; background: string; color: string }> = {
  not_started: { label: "Neînceput", background: "#262626", color: "#a3a3a3" },
  in_progress: { label: "În lucru", background: "#3f2b09", color: "#fcd34d" },
  completed: { label: "Finalizat", background: "#14532d", color: "#86efac" },
};

const inputStyle: React.CSSProperties = { padding: "8px 12px", background: "#111", border: "1px solid #333", borderRadius: "6px", color: "#ddd", fontSize: "13px", minWidth: 0 };
const smallButton: React.CSSProperties = { padding: "5px 10px", background: "transparent", border: "1px solid #333", borderRadius: "6px", color: "#ccc", fontSize: "11px", cursor: "pointer" };
const NEW_PERSON = "__new__";

/** Name + email + phone of one person; used for a new person and to edit an existing one. */
function ReviewerForm({ initial, saving, onSave, onCancel }: {
  initial: Partial<PhotoReviewer>;
  saving: boolean;
  onSave: (values: { name: string; email: string; phone: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  return (
    <form
      aria-label="Profilul persoanei"
      onSubmit={event => { event.preventDefault(); onSave({ name, email, phone }); }}
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "8px", padding: "10px", border: "1px solid #2a2a2a", borderRadius: "8px", background: "#0d0d0d" }}
    >
      <input aria-label="Nume" value={name} onChange={event => setName(event.target.value)} maxLength={60} placeholder="Nume" required style={inputStyle} />
      <input aria-label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email (pentru reminder)" style={inputStyle} />
      <input aria-label="Telefon" type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="Telefon (SMS reminder)" style={inputStyle} />
      <div style={{ display: "flex", gap: "6px" }}>
        <button type="submit" disabled={saving || !name.trim()} style={{ ...smallButton, background: GOLD, border: "none", color: "#111", fontWeight: 700, fontSize: "12px", padding: "8px 12px" }}>
          {saving ? "Se salvează..." : "Salvează"}
        </button>
        <button type="button" onClick={onCancel} style={{ ...smallButton, fontSize: "12px" }}>Renunță</button>
      </div>
    </form>
  );
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function ProposalLinksPanel({ slug, accessToken }: { slug: string; accessToken: string }) {
  const [links, setLinks] = useState<ProposalLink[]>([]);
  const [label, setLabel] = useState("");
  const [reviewerId, setReviewerId] = useState<PhotoReviewerId | "">("");
  const [reviewers, setReviewers] = useState<PhotoReviewer[]>([]);
  const [editing, setEditing] = useState<"new" | "edit" | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [reminding, setReminding] = useState<string | null>(null);
  const [reminderNote, setReminderNote] = useState<{ token: string; text: string; ok: boolean } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [openToken, setOpenToken] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  const load = useCallback(() => {
    fetch(`/api/proposal-links/admin?albumSlug=${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(response => response.json())
      .then((data: { links?: ProposalLink[] }) => setLinks(data.links ?? []))
      .catch(() => {});
  }, [slug, accessToken]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/proposal-links/admin/reviewers", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(response => response.json())
      .then((data: { reviewers?: PhotoReviewer[] }) => setReviewers(data.reviewers ?? []))
      .catch(() => {});
  }, [accessToken]);

  const selectedReviewer = reviewers.find(person => person.id === reviewerId);

  const saveProfile = async (values: { name: string; email: string; phone: string }) => {
    setSavingProfile(true);
    setError(null);
    try {
      const isNew = editing === "new";
      const response = await fetch(isNew ? "/api/proposal-links/admin/reviewers" : `/api/proposal-links/admin/reviewers/${encodeURIComponent(reviewerId)}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Nu am putut salva persoana.");
      const saved = data.reviewer as PhotoReviewer;
      setReviewers(previous => previous.some(person => person.id === saved.id)
        ? previous.map(person => (person.id === saved.id ? saved : person))
        : [...previous, saved]);
      setReviewerId(saved.id);
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const remind = async (link: ProposalLink) => {
    setReminding(link.token);
    setReminderNote(null);
    try {
      const response = await fetch(`/api/proposal-links/admin/${link.token}/reminder`, { method: "POST", headers: authHeaders });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Nu am putut trimite reminderul.");
      const channels = (data.channels as string[]).map(channel => (channel === "sms" ? "SMS" : "email")).join(" + ");
      setReminderNote({ token: link.token, ok: true, text: `✓ Reminder trimis pe ${channels}.` });
      load();
    } catch (err) {
      setReminderNote({ token: link.token, ok: false, text: (err as Error).message });
    } finally {
      setReminding(null);
    }
  };

  const absoluteUrl = (url: string) => `${window.location.origin}${url}`;

  const copy = async (link: ProposalLink) => {
    try {
      await navigator.clipboard.writeText(absoluteUrl(link.url));
      setCopied(link.token);
      window.setTimeout(() => setCopied(current => (current === link.token ? null : current)), 2000);
    } catch {
      window.prompt("Copiază linkul:", absoluteUrl(link.url));
    }
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/proposal-links/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ albumSlug: slug, label: selectedReviewer ? selectedReviewer.name : label, ...(selectedReviewer ? { reviewerId } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Nu am putut genera linkul.");
      setLabel("");
      setLinks(prev => [data.link as ProposalLink, ...prev]);
      await copy(data.link as ProposalLink);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const setActive = async (link: ProposalLink, active: boolean) => {
    await fetch(`/api/proposal-links/admin/${link.token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ active }),
    }).catch(() => {});
    setLinks(prev => prev.map(item => (item.token === link.token ? { ...item, active } : item)));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

      <p style={{ color: "#aaa", fontSize: "12px", margin: 0 }}>
        Pentru selecția comună, alege persoana și generează-i linkul personal. Cine nu parcurge toate pozele primește automat un reminder
        (email + SMS din profil) la 4 ore după ce s-a oprit — cel mult o dată pe zi, de 3 ori.
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <select
          aria-label="Persoana pentru linkul de selecție"
          value={editing === "new" ? NEW_PERSON : reviewerId}
          onChange={event => {
            if (event.target.value === NEW_PERSON) { setEditing("new"); return; }
            setEditing(null);
            setReviewerId(event.target.value);
          }}
          style={{ ...inputStyle, flex: "0 1 200px" }}
        >
          <option value="">Altă persoană (fără profil)</option>
          {reviewers.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
          <option value={NEW_PERSON}>＋ Persoană nouă…</option>
        </select>
        {!selectedReviewer && editing !== "new" && (
          <input
            value={label}
            onChange={event => setLabel(event.target.value)}
            maxLength={60}
            placeholder="Pentru cine? (ex: Soția)"
            aria-label="Eticheta linkului"
            style={{ ...inputStyle, flex: "1 1 200px" }}
          />
        )}
        <button
          type="button"
          onClick={create}
          disabled={creating || editing !== null}
          style={{ padding: "8px 14px", background: GOLD, border: "none", borderRadius: "6px", color: "#111", fontSize: "12px", fontWeight: 700, cursor: "pointer", opacity: editing !== null ? 0.5 : 1 }}
        >
          {creating ? "Se generează..." : "Generează și copiază link"}
        </button>
      </div>
      {selectedReviewer && editing === null && (
        <p style={{ color: "#999", fontSize: "12px", margin: 0 }}>
          {selectedReviewer.email || <span style={{ color: "#f59e0b" }}>fără email</span>}
          {" · "}
          {selectedReviewer.phone || <span style={{ color: "#f59e0b" }}>fără telefon</span>}
          {" · "}
          <button type="button" onClick={() => setEditing("edit")} style={{ background: "none", border: "none", padding: 0, color: GOLD, fontSize: "12px", cursor: "pointer" }}>Editează profilul</button>
        </p>
      )}
      {editing && (
        <ReviewerForm
          key={editing === "new" ? NEW_PERSON : reviewerId}
          initial={editing === "edit" ? selectedReviewer ?? {} : {}}
          saving={savingProfile}
          onSave={saveProfile}
          onCancel={() => setEditing(null)}
        />
      )}
      {error && <p style={{ color: "#f87171", fontSize: "12px", margin: 0 }}>{error}</p>}

      {links.map(link => {
        const status = STATUS_STYLE[link.status];
        const isOpen = openToken === link.token;
        return (
          <div key={link.token} style={{ padding: "10px", background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px", opacity: link.active ? 1 : 0.55 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: "#ddd", fontSize: "12px", fontWeight: 600, margin: 0 }}>
                  {link.label || "Fără etichetă"}{link.reviewerId && " · selecție comună"}{!link.active && " · dezactivat"}
                </p>
                <p style={{ color: "#666", fontSize: "11px", margin: "3px 0 0" }}>Creat {formatDate(link.createdAt)}</p>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ padding: "3px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: status.background, color: status.color }}>{status.label}</span>
                <button type="button" onClick={() => copy(link)} style={{ padding: "5px 10px", background: "transparent", border: "1px solid #333", borderRadius: "6px", color: copied === link.token ? "#4ade80" : "#ccc", fontSize: "11px", cursor: "pointer" }}>
                  {copied === link.token ? "✓ Copiat" : "Copiază"}
                </button>
                <button type="button" onClick={() => setActive(link, !link.active)} style={{ padding: "5px 10px", background: "transparent", border: "1px solid #333", borderRadius: "6px", color: "#999", fontSize: "11px", cursor: "pointer" }}>
                  {link.active ? "Dezactivează" : "Reactivează"}
                </button>
              </div>
            </div>

            {link.visitors.map(visitor => {
              const percent = link.totalPhotos > 0 ? Math.min(100, Math.round((visitor.viewedCount / link.totalPhotos) * 100)) : 0;
              return (
                <div key={visitor.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <p style={{ color: "#bbb", fontSize: "11px", margin: 0 }}>
                    <strong style={{ color: "#eee" }}>{visitor.name}</strong>
                    {" · "}a parcurs {visitor.viewedCount}/{link.totalPhotos || "?"} poze · {visitor.proposedCount} propuse
                    {" · "}{visitor.completedAt ? `✓ terminat ${formatDate(visitor.completedAt)}` : `activ ${formatDate(visitor.lastSeenAt)}`}
                  </p>
                  <div style={{ height: "4px", background: "#1f1f1f", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ width: `${visitor.completedAt ? 100 : percent}%`, height: "100%", background: visitor.completedAt ? "#22c55e" : GOLD }} />
                  </div>
                </div>
              );
            })}

            {/* Reminder until the link's own person says „Am terminat” (someone else finishing doesn't count). */}
            {link.reviewerId && !link.visitors.some(visitor => visitor.completedAt && nameKey(visitor.name) === nameKey(link.label)) && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" onClick={() => remind(link)} disabled={reminding === link.token || !link.active} style={smallButton}>
                  {reminding === link.token ? "Se trimite..." : "⏰ Trimite reminder acum"}
                </button>
                <span style={{ color: "#777", fontSize: "11px" }}>
                  {link.lastReminderAt
                    ? `Ultimul reminder: ${formatDate(link.lastReminderAt)}${link.lastReminderChannels?.length ? ` (${link.lastReminderChannels.map(channel => (channel === "sms" ? "SMS" : "email")).join(" + ")})` : ""} · ${link.reminderCount ?? 1}×`
                    : "Niciun reminder încă"}
                </span>
                {reminderNote?.token === link.token && (
                  <span role="status" style={{ color: reminderNote.ok ? "#4ade80" : "#f87171", fontSize: "11px" }}>{reminderNote.text}</span>
                )}
              </div>
            )}

            {link.photos.length > 0 && (
              <>
                <button type="button" onClick={() => setOpenToken(isOpen ? null : link.token)} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: GOLD, fontSize: "12px", cursor: "pointer" }}>
                  {isOpen ? "Ascunde pozele" : `Vezi pozele alese (${link.photos.length})`}
                </button>
                {isOpen && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "4px" }}>
                    {link.photos.map(photo => (
                      <a key={`${photo.fileName}-${photo.proposedBy}`} href={photo.previewUrl} target="_blank" rel="noreferrer" title={`${photo.fileName} · ${photo.proposedBy}`}>
                        <img src={photo.previewUrl} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block", borderRadius: "4px" }} />
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
