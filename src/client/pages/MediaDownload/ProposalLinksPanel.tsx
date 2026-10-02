/*
 * Purpose: admin panel (inside the album's "Link unic de selecție poze" box) for public
 * proposal links — generate a unique link per person, copy it, follow their
 * progress (photos browsed / proposed / done) and see the photos they picked.
 */
import React, { useCallback, useEffect, useState } from "react";

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
  active: boolean;
  url: string;
  createdAt: string | null;
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
  totalPhotos: number;
  visitors: LinkVisitor[];
  photos: { fileName: string; previewUrl: string; proposedBy: string }[];
};

const GOLD = "#c9a96e";

const STATUS_STYLE: Record<ProposalLink["status"], { label: string; background: string; color: string }> = {
  not_started: { label: "Neînceput", background: "#262626", color: "#a3a3a3" },
  in_progress: { label: "În lucru", background: "#3f2b09", color: "#fcd34d" },
  completed: { label: "Finalizat", background: "#14532d", color: "#86efac" },
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function ProposalLinksPanel({ slug, accessToken }: { slug: string; accessToken: string }) {
  const [links, setLinks] = useState<ProposalLink[]>([]);
  const [label, setLabel] = useState("");
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
        body: JSON.stringify({ albumSlug: slug, label }),
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

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input
          value={label}
          onChange={event => setLabel(event.target.value)}
          maxLength={60}
          placeholder="Pentru cine? (ex: Soția)"
          style={{ flex: "1 1 220px", padding: "8px 12px", background: "#111", border: "1px solid #333", borderRadius: "6px", color: "#ddd", fontSize: "13px" }}
        />
        <button
          type="button"
          onClick={create}
          disabled={creating}
          style={{ padding: "8px 14px", background: GOLD, border: "none", borderRadius: "6px", color: "#111", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
        >
          {creating ? "Se generează..." : "Generează și copiază link"}
        </button>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: "12px", margin: 0 }}>{error}</p>}

      {links.map(link => {
        const status = STATUS_STYLE[link.status];
        const isOpen = openToken === link.token;
        return (
          <div key={link.token} style={{ padding: "10px", background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px", opacity: link.active ? 1 : 0.55 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: "#ddd", fontSize: "12px", fontWeight: 600, margin: 0 }}>
                  {link.label || "Fără etichetă"}{!link.active && " · dezactivat"}
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
