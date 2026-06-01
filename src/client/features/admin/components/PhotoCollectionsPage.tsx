import React, { useEffect, useState, useCallback, useRef, memo } from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import SmartImage from "../../../components/UI/SmartImage";

interface CollectionItem {
  url: string;
  sourceType: "asset" | "proposal" | "manual";
  sourceId?: string;
}

interface PhotoCollection {
  id: string;
  name: string;
  description: string;
  items: CollectionItem[];
}

type MediaSource = { id: string; url: string; label: string; kind: "asset" | "proposal" };

function isVideo(url: string) {
  return /\.(mp4|mov|webm|avi)(\?|$)/i.test(url);
}

// ── Picker modal — state local, nu re-renderizează pagina la fiecare click ────
interface PickerModalProps {
  initialItems: CollectionItem[];
  sources: MediaSource[];
  sourcesLoading: boolean;
  collectionName: string;
  onConfirm: (items: CollectionItem[]) => void;
  onClose: () => void;
}

const PickerModal = memo(function PickerModal({ initialItems, sources, sourcesLoading, collectionName, onConfirm, onClose }: PickerModalProps) {
  const [localItems, setLocalItems] = useState<CollectionItem[]>(initialItems);
  const [tab, setTab] = useState<"assets" | "proposals">("assets");
  const [search, setSearch] = useState("");

  const toggle = useCallback((source: MediaSource) => {
    setLocalItems((prev) => {
      const exists = prev.some((i) => i.url === source.url);
      return exists
        ? prev.filter((i) => i.url !== source.url)
        : [...prev, { url: source.url, sourceType: source.kind, sourceId: source.id }];
    });
  }, []);

  const filtered = sources.filter((s) => {
    const matchTab = s.kind === (tab === "assets" ? "asset" : "proposal");
    const matchSearch = !search || s.label.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch && !isVideo(s.url);
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #1a1a1a" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Adaugă în „{collectionName}"</p>
            <p style={{ fontSize: 11, color: "#555", margin: "3px 0 0" }}>{localItems.length} selectate — click în ordinea dorită</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="text" placeholder="Caută..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "6px 12px", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#ccc", fontSize: 12, outline: "none", width: 160 }}
            />
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a" }}>
          {(["assets", "proposals"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: "10px 0", border: "none", borderBottom: `2px solid ${tab === t ? "#7c3aed" : "transparent"}`, background: "none", color: tab === t ? "#a78bfa" : "#555", fontSize: 12, fontWeight: tab === t ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}
            >
              {t === "assets" ? `Media Assets (${sources.filter((s) => s.kind === "asset" && !isVideo(s.url)).length})` : `Propuneri (${sources.filter((s) => s.kind === "proposal").length})`}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {sourcesLoading ? (
            <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "40px 0" }}>Se încarcă...</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: "#333", fontSize: 13, padding: "40px 0" }}>
              {search ? `Niciun rezultat pentru „${search}"` : "Nicio sursă disponibilă"}
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
              {filtered.map((item) => {
                const orderIndex = localItems.findIndex((i) => i.url === item.url);
                const selected = orderIndex !== -1;
                return (
                  <div key={item.id} onClick={() => toggle(item)} title={item.label}
                    style={{ position: "relative", borderRadius: 8, overflow: "hidden", cursor: "pointer", border: `3px solid ${selected ? "#7c3aed" : "transparent"}`, transition: "border-color 0.1s" }}
                  >
                    <SmartImage src={item.url} alt={item.label} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", opacity: selected ? 0.6 : 1 }} loading="lazy" />
                    {selected && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(124,58,237,0.3)" }}>
                        <span style={{ background: orderIndex === 0 ? "#7c3aed" : "rgba(0,0,0,0.8)", color: "#fff", fontSize: 13, fontWeight: 800, borderRadius: 6, padding: "3px 8px", border: "2px solid #7c3aed" }}>
                          {orderIndex === 0 ? "⭐" : `#${orderIndex + 1}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 18px", borderTop: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#555" }}>{localItems.length} poze în colecție</span>
          <button onClick={() => onConfirm(localItems)}
            style={{ padding: "9px 24px", background: "#7c3aed", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Aplică
          </button>
        </div>
      </div>
    </div>
  );
});

export default function PhotoCollectionsPage() {
  const { auth } = useAuth();
  const [collections, setCollections] = useState<PhotoCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PhotoCollection | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<"assets" | "proposals">("assets");
  const [sources, setSources] = useState<MediaSource[] | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<number | null>(null);

  const headers: Record<string, string> = auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {};

  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    const res = await fetch("/api/admin/photo-collections", { headers });
    if (res.ok) {
      const data = await res.json() as { collections: PhotoCollection[] };
      setCollections(data.collections);
    }
    setLoading(false);
  }, [auth.accessToken]);

  useEffect(() => { load(); }, [load]);

  const loadSources = async () => {
    if (sources !== null) return;
    setSourcesLoading(true);
    try {
      const res = await fetch("/api/showcase-zones/media_footer/sources", { headers });
      if (!res.ok) return;
      const data = await res.json() as { proposals?: { id: string; photoUrl: string; fileName: string }[]; assets?: { id: string; url: string; label: string }[] };
      setSources([
        ...(data.assets ?? []).map((a) => ({ id: a.id, url: a.url, label: a.label, kind: "asset" as const })),
        ...(data.proposals ?? []).map((p) => ({ id: p.id, url: p.photoUrl, label: p.fileName, kind: "proposal" as const })),
      ]);
    } finally {
      setSourcesLoading(false);
    }
  };

  const createCollection = async () => {
    if (!newName.trim() || !auth.accessToken) return;
    setCreating(true);
    const res = await fetch("/api/admin/photo-collections", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      const { id } = await res.json() as { id: string };
      const newCol: PhotoCollection = { id, name: newName.trim(), description: "", items: [] };
      setCollections((prev) => [newCol, ...prev]);
      setNewName("");
      setEditing(newCol);
    }
    setCreating(false);
  };

  const saveCollection = async () => {
    if (!editing || !auth.accessToken) return;
    setSaving(true);
    await fetch(`/api/admin/photo-collections/${editing.id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name: editing.name, description: editing.description, items: editing.items }),
    });
    setCollections((prev) => prev.map((c) => c.id === editing.id ? editing : c));
    setSaving(false);
  };

  const deleteCollection = async (id: string) => {
    if (!window.confirm("Ștergi această colecție?") || !auth.accessToken) return;
    setDeleting(id);
    await fetch(`/api/admin/photo-collections/${id}`, { method: "DELETE", headers });
    setCollections((prev) => prev.filter((c) => c.id !== id));
    if (editing?.id === id) setEditing(null);
    setDeleting(null);
  };

  const applyPickerItems = useCallback((items: CollectionItem[]) => {
    if (!editing) return;
    setEditing((prev) => prev ? { ...prev, items } : prev);
    setShowPicker(false);
  }, [editing]);

  const removeItem = (url: string) => {
    if (!editing) return;
    setEditing({ ...editing, items: editing.items.filter((i) => i.url !== url) });
  };

  const reorderItems = (from: number, to: number) => {
    if (!editing || from === to) return;
    const next = [...editing.items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setEditing({ ...editing, items: next });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const to = index + direction;
    if (!editing || to < 0 || to >= editing.items.length) return;
    reorderItems(index, to);
  };

  const filteredSources = (sources ?? []).filter((s) => {
    const matchTab = s.kind === (pickerTab === "assets" ? "asset" : "proposal");
    const matchSearch = !searchQuery || s.label.toLowerCase().includes(searchQuery.toLowerCase());
    return matchTab && matchSearch && !isVideo(s.url);
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#555", fontSize: 14 }}>Se încarcă...</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px 24px 80px" }}>
      <Breadcrumb />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Colecții de poze</h1>
          <p style={{ fontSize: 12, color: "#555", marginTop: 3 }}>Grupuri reutilizabile de poze din Media Assets și Propuneri</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: editing ? "300px 1fr" : "1fr", gap: 20 }}>

        {/* ── Collections list ── */}
        <div>
          {/* Create new */}
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Colecție nouă</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createCollection(); }}
                placeholder="Nume colecție..."
                style={{ flex: 1, background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none" }}
              />
              <button
                onClick={createCollection}
                disabled={creating || !newName.trim()}
                style={{ padding: "8px 14px", background: newName.trim() ? "#7c3aed" : "#1a1a1a", border: "none", borderRadius: 8, color: newName.trim() ? "#fff" : "#444", fontSize: 13, fontWeight: 600, cursor: newName.trim() ? "pointer" : "not-allowed" }}
              >
                {creating ? "..." : "+"}
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {collections.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#333", fontSize: 13 }}>
                <p style={{ fontSize: 24, margin: "0 0 8px" }}>📁</p>
                Nicio colecție creată
              </div>
            )}
            {collections.map((col) => (
              <div
                key={col.id}
                onClick={() => setEditing(editing?.id === col.id ? null : { ...col })}
                style={{
                  background: editing?.id === col.id ? "#1a0f3a" : "#111",
                  border: `1px solid ${editing?.id === col.id ? "#5b21b6" : "#1a1a1a"}`,
                  borderRadius: 10, padding: "12px 14px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {col.name}
                  </p>
                  <p style={{ fontSize: 11, color: "#555", margin: "3px 0 0" }}>{col.items.length} poze</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCollection(col.id); }}
                  disabled={deleting === col.id}
                  style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 14, padding: "2px 6px", flexShrink: 0 }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Editor ── */}
        {editing && (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                style={{ fontSize: 16, fontWeight: 700, background: "none", border: "none", color: "#fff", outline: "none", flex: 1, minWidth: 200 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    loadSources();
                    setShowPicker(true);
                  }}
                  style={{ padding: "8px 16px", background: "#1a1035", border: "1px solid #4a2d9e", borderRadius: 8, color: "#a78bfa", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  + Adaugă din Media Assets
                </button>
                <button
                  onClick={saveCollection}
                  disabled={saving}
                  style={{ padding: "8px 20px", background: "#7c3aed", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? "Se salvează..." : "Salvează"}
                </button>
              </div>
            </div>

            <input
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="Descriere opțională..."
              style={{ width: "100%", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: "8px 12px", color: "#888", fontSize: 12, outline: "none", marginBottom: 16, boxSizing: "border-box" }}
            />

            {editing.items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#333" }}>
                <p style={{ fontSize: 28, margin: "0 0 10px" }}>🖼</p>
                <p style={{ fontSize: 13, color: "#444" }}>Nicio poză în colecție</p>
                <p style={{ fontSize: 11, color: "#333", marginTop: 4 }}>Apasă "+ Adaugă din Media Assets"</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 11, color: "#444", margin: "0 0 10px" }}>
                  Trage pentru a reordona · {editing.items.length} poze
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                  {editing.items.map((item, index) => (
                    <div
                      key={item.url}
                      draggable
                      onDragStart={() => { setDragIndex(index); dragNodeRef.current = index; }}
                      onDragOver={(e) => { e.preventDefault(); setDropIndex(index); }}
                      onDragEnd={() => {
                        if (dragNodeRef.current !== null && dropIndex !== null) reorderItems(dragNodeRef.current, dropIndex);
                        setDragIndex(null); setDropIndex(null); dragNodeRef.current = null;
                      }}
                      style={{
                        position: "relative", borderRadius: 10, overflow: "hidden", background: "#0a0a0a",
                        cursor: "grab",
                        outline: dropIndex === index && dragIndex !== index ? "3px solid #7c3aed" : "3px solid transparent",
                        opacity: dragIndex === index ? 0.4 : 1,
                        transition: "opacity 0.15s, outline 0.1s",
                      }}
                    >
                      <SmartImage src={item.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", pointerEvents: "none" }} loading="lazy" draggable={false} />

                      {/* Position badge */}
                      <div style={{
                        position: "absolute", top: 6, left: 6,
                        background: index === 0 ? "#7c3aed" : "rgba(0,0,0,0.75)",
                        color: "#fff", fontSize: 11, fontWeight: 800,
                        borderRadius: 5, padding: "2px 7px",
                        backdropFilter: "blur(4px)",
                      }}>
                        {index === 0 ? "⭐ 1" : `#${index + 1}`}
                      </div>

                      {/* Remove */}
                      <button onClick={() => removeItem(item.url)}
                        style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.75)", border: "none", borderRadius: 5, color: "#ef4444", cursor: "pointer", padding: "2px 7px", fontSize: 12, fontWeight: 700, backdropFilter: "blur(4px)" }}
                      >✕</button>

                      {/* Move buttons */}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
                        <button onClick={() => moveItem(index, -1)} disabled={index === 0}
                          style={{ flex: 1, padding: "5px 0", border: "none", borderRight: "1px solid rgba(255,255,255,0.08)", background: "none", color: index === 0 ? "#333" : "#aaa", fontSize: 14, cursor: index === 0 ? "default" : "pointer" }}
                        >←</button>
                        <button onClick={() => moveItem(index, 1)} disabled={index === editing.items.length - 1}
                          style={{ flex: 1, padding: "5px 0", border: "none", background: "none", color: index === editing.items.length - 1 ? "#333" : "#aaa", fontSize: 14, cursor: index === editing.items.length - 1 ? "default" : "pointer" }}
                        >→</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Source Picker Modal — componentă separată, state local ── */}
      {showPicker && editing && (
        <PickerModal
          initialItems={editing.items}
          sources={sources ?? []}
          sourcesLoading={sourcesLoading}
          collectionName={editing.name}
          onConfirm={applyPickerItems}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
