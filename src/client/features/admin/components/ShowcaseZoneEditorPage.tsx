import React, { useEffect, useState, useCallback, useRef } from "react";
// useRef păstrat pentru saveResultTimerRef
import SmartImage from "../../../components/UI/SmartImage";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";

type Proposal = { id: string; photoUrl: string; albumSlug: string; fileName: string };
type Asset = { id: string; url: string; label: string; serviceId: string };
type PhotoItem = { url: string; sourceType: "proposal" | "media_asset" | "manual"; sourceId?: string };

const ZONE_ID = "media_footer";

function photosEqual(a: PhotoItem[], b: PhotoItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) =>
    item.url === b[i].url &&
    item.sourceType === b[i].sourceType &&
    item.sourceId === b[i].sourceId
  );
}

export default function ShowcaseZoneEditorPage() {
  const { auth } = useAuth();

  const [sources, setSources] = useState<{ proposals: Proposal[]; assets: Asset[] } | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<PhotoItem[]>([]);
  const [sourceTab, setSourceTab] = useState<"proposals" | "assets">("proposals");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const saveResultTimerRef = useRef<number | null>(null);

  const authHeaders: Record<string, string> = auth.accessToken
    ? { Authorization: `Bearer ${auth.accessToken}` }
    : {};

  // Load zone data — nu necesită autentificare
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetch(`/api/showcase-zones/${ZONE_ID}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((zoneData: { photos?: string[] } | null) => {
        if (cancelled) return;
        if (zoneData?.photos) {
          const loaded: PhotoItem[] = zoneData.photos.map((url) => ({ url, sourceType: "manual" as const }));
          setPhotos(loaded);
          setSavedPhotos(loaded);
        }
      })
      .catch((err) => { if (err.name !== "AbortError") console.error("[Showcase] zone load error:", err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, []);

  // Load sources — necesită autentificare
  useEffect(() => {
    if (auth.loading || !auth.accessToken) return;
    let cancelled = false;
    const controller = new AbortController();
    setSourcesLoading(true);
    setSourcesError(false);
    fetch(`/api/showcase-zones/${ZONE_ID}/sources`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      signal: controller.signal,
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: { proposals?: Proposal[]; assets?: Asset[] } | null) => {
        if (cancelled) return;
        setSources({ proposals: data?.proposals ?? [], assets: data?.assets ?? [] });
      })
      .catch((err) => {
        if (cancelled || err.name === "AbortError") return;
        console.error("[Showcase] sources load error:", err);
        setSourcesError(true);
      })
      .finally(() => { if (!cancelled) setSourcesLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [auth.loading, auth.accessToken]);

  const togglePhoto = useCallback((url: string, sourceType: PhotoItem["sourceType"], sourceId?: string) => {
    setPhotos((prev) => {
      if (prev.some((p) => p.url === url)) return prev.filter((p) => p.url !== url);
      return [...prev, { url, sourceType, sourceId }];
    });
    setSaveResult(null);
  }, []);

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setSaveResult(null);
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= photos.length) return;
    setPhotos((prev) => {
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr;
    });
    setSaveResult(null);
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    setPhotos((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setSaveResult(null);
  };

  const showSaveResult = (msg: string) => {
    setSaveResult(msg);
    if (saveResultTimerRef.current) window.clearTimeout(saveResultTimerRef.current);
    if (msg.startsWith("Salvat")) {
      saveResultTimerRef.current = window.setTimeout(() => {
        setSaveResult(null);
      }, 3500);
    }
  };

  const save = async () => {
    if (!auth.accessToken) {
      console.warn("[Showcase] save() fără accessToken");
      return;
    }
    setSaving(true);
    setSaveResult(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
      console.error("[Showcase] PUT timeout după 12s");
    }, 12000);
    try {
      console.log("[Showcase] PUT", photos.length, "poze");
      const res = await fetch(`/api/showcase-zones/${ZONE_ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ photos }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      console.log("[Showcase] răspuns:", res.status);
      if (res.ok) {
        setSavedPhotos([...photos]);
        showSaveResult("Salvat ✓");
      } else {
        const body = await res.text().catch(() => res.statusText);
        console.error("[Showcase] eroare:", res.status, body);
        showSaveResult(`Eroare ${res.status}: ${body}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";
      console.error("[Showcase] fetch error:", err);
      showSaveResult(isAbort ? "Timeout — serverul nu răspunde." : "Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = !photosEqual(photos, savedPhotos);

  // Filtered source list
  const rawSourceList = sourceTab === "proposals"
    ? (sources?.proposals ?? []).map((p) => ({ id: p.id, url: p.photoUrl, label: p.fileName, sourceType: "proposal" as const }))
    : (sources?.assets ?? []).map((a) => ({ id: a.id, url: a.url, label: a.label, sourceType: "media_asset" as const }));

  const filteredSourceList = searchQuery.trim()
    ? rawSourceList.filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : rawSourceList;

  const proposalCount = sources?.proposals.length ?? 0;
  const assetCount = sources?.assets.length ?? 0;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#555", fontSize: 14 }}>Se încarcă...</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px 24px 80px" }}>
      <Breadcrumb />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Zone Showcase</h1>
          <p style={{ fontSize: 12, color: "#555", marginTop: 3 }}>
            Pozele selectate apar în secțiunea promo de pe site (album, share, homepage, contact, portofoliu)
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saveResult && (
            <span style={{ fontSize: 13, fontWeight: 600, color: saveResult.startsWith("Salvat") ? "#34d399" : "#f87171" }}>
              {saveResult}
            </span>
          )}
          <button
            onClick={save}
            disabled={!isDirty || saving}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "none",
              background: isDirty && !saving ? "#7c3aed" : "#1a1a1a",
              color: isDirty && !saving ? "#fff" : "#444",
              fontSize: 14, fontWeight: 700,
              cursor: isDirty && !saving ? "pointer" : "not-allowed",
              transition: "all 0.15s",
            }}
          >
            {saving ? "Se salvează..." : isDirty ? `Salvează (${photos.length} poze)` : "Salvat ✓"}
          </button>
        </div>
      </div>

      {/* ── SECTION 1: SOURCE PICKER ─────────────────────────────── */}
      <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            📂 Surse disponibile — selectează pozele
          </p>
          {/* Search */}
          <input
            type="text"
            placeholder="Caută după nume..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "7px 12px", borderRadius: 8, border: "1px solid #2a2a2a",
              background: "#0a0a0a", color: "#ccc", fontSize: 13, outline: "none",
              width: 200,
            }}
          />
        </div>

        {/* Source tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["proposals", "assets"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setSourceTab(t); setSearchQuery(""); }}
              style={{
                padding: "7px 16px", borderRadius: 8, border: "1px solid",
                borderColor: sourceTab === t ? "#7c3aed" : "#2a2a2a",
                background: sourceTab === t ? "#7c3aed22" : "transparent",
                color: sourceTab === t ? "#a78bfa" : "#666",
                fontSize: 13, cursor: "pointer", fontWeight: sourceTab === t ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              {t === "proposals" ? `📸 Propuneri (${proposalCount})` : `🖼 Media Assets (${assetCount})`}
            </button>
          ))}
        </div>

        {/* Source grid */}
        {sourcesLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ aspectRatio: "1", borderRadius: 8, background: "#1a1a1a", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : sourcesError ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#f87171", fontSize: 13 }}>
            Eroare la încărcarea surselor.{" "}
            <button
              onClick={() => window.location.reload()}
              style={{ color: "#a78bfa", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}
            >
              Reîncarcă
            </button>
          </div>
        ) : filteredSourceList.length === 0 ? (
          <p style={{ color: "#444", fontSize: 13, padding: "24px 0" }}>
            {searchQuery ? `Niciun rezultat pentru „${searchQuery}"` : "Nicio sursă disponibilă în această categorie."}
          </p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
            gap: 8,
            maxHeight: 360,
            overflowY: "auto",
            paddingRight: 4,
          }}>
            {filteredSourceList.map((item) => {
              const isSelected = photos.some((p) => p.url === item.url);
              const positionIndex = photos.findIndex((p) => p.url === item.url);
              return (
                <div
                  key={item.id}
                  onClick={() => togglePhoto(item.url, item.sourceType, item.id)}
                  title={item.label}
                  style={{ position: "relative", cursor: "pointer", borderRadius: 8, overflow: "hidden", userSelect: "none" }}
                >
                  <SmartImage
                    src={item.url}
                    alt={item.label}
                    style={{
                      width: "100%", aspectRatio: "1", objectFit: "cover", display: "block",
                      border: isSelected ? "3px solid #7c3aed" : "3px solid transparent",
                      borderRadius: 8,
                      opacity: isSelected ? 0.6 : 1,
                      transition: "all 0.15s",
                    }}
                  />
                  {isSelected && (
                    <div style={{
                      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(124,58,237,0.35)", borderRadius: 6,
                    }}>
                      <span style={{
                        background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 800,
                        borderRadius: 999, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {positionIndex + 1}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 2: ORDER PANEL ───────────────────────────────── */}
      <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
              🔢 Ordinea în care apar pe site ({photos.length} poze)
            </p>
            <p style={{ fontSize: 11, color: "#444", marginTop: 4 }}>
              Trage pozele pentru a reordona • Prima poză apare prima pe site
            </p>
          </div>
          {photos.length > 0 && (
            confirmClear ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#f87171" }}>Sigur ștergi tot?</span>
                <button
                  onClick={() => { setPhotos([]); setSaveResult(null); setConfirmClear(false); }}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #7f1d1d", background: "none", color: "#f87171", fontSize: 12, cursor: "pointer" }}
                >
                  Da, golește
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #2a2a2a", background: "none", color: "#666", fontSize: 12, cursor: "pointer" }}
                >
                  Anulează
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #2a2a2a", background: "none", color: "#555", fontSize: 12, cursor: "pointer" }}
              >
                Golește tot
              </button>
            )
          )}
        </div>

        {photos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#333" }}>
            <p style={{ fontSize: 32, margin: "0 0 12px" }}>📭</p>
            <p style={{ fontSize: 14, color: "#444" }}>Nicio poză selectată.</p>
            <p style={{ fontSize: 12, color: "#333", marginTop: 4 }}>Selectează din surse de mai sus.</p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 12,
          }}>
            {photos.map((photo, index) => (
              <div
                key={`${photo.url}-${index}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => { e.preventDefault(); setDropIndex(index); }}
                onDragEnd={() => {
                  if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
                    reorder(dragIndex, dropIndex);
                  }
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                style={{
                  position: "relative",
                  borderRadius: 10,
                  overflow: "hidden",
                  cursor: "grab",
                  outline: dropIndex === index && dragIndex !== index ? "3px solid #7c3aed" : "3px solid transparent",
                  opacity: dragIndex === index ? 0.4 : 1,
                  transition: "opacity 0.15s, outline 0.1s",
                  background: "#0a0a0a",
                }}
              >
                <SmartImage
                  src={photo.url}
                  alt={`Poza ${index + 1}`}
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", pointerEvents: "none" }}
                  draggable={false}
                />

                {/* Position badge */}
                <div style={{
                  position: "absolute", top: 8, left: 8,
                  background: index === 0 ? "#7c3aed" : "rgba(0,0,0,0.75)",
                  color: "#fff", fontSize: 13, fontWeight: 800,
                  borderRadius: 6, padding: "2px 8px",
                  backdropFilter: "blur(4px)",
                  border: index === 0 ? "none" : "1px solid rgba(255,255,255,0.1)",
                }}>
                  {index === 0 ? "⭐ 1" : `#${index + 1}`}
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removePhoto(index)}
                  style={{
                    position: "absolute", top: 8, right: 8,
                    background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6, color: "#ef4444", cursor: "pointer",
                    padding: "2px 8px", fontSize: 13, fontWeight: 700,
                    backdropFilter: "blur(4px)",
                  }}
                >
                  ✕
                </button>

                {/* Move buttons — visible on hover via opacity trick, always visible on mobile */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  display: "flex", gap: 0, background: "rgba(0,0,0,0.7)",
                  backdropFilter: "blur(4px)",
                }}>
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    style={{
                      flex: 1, padding: "6px 0", border: "none",
                      background: "none", color: index === 0 ? "#333" : "#aaa",
                      fontSize: 16, cursor: index === 0 ? "default" : "pointer",
                      borderRight: "1px solid rgba(255,255,255,0.08)",
                    }}
                    title="Mută înainte"
                  >←</button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === photos.length - 1}
                    style={{
                      flex: 1, padding: "6px 0", border: "none",
                      background: "none", color: index === photos.length - 1 ? "#333" : "#aaa",
                      fontSize: 16, cursor: index === photos.length - 1 ? "default" : "pointer",
                    }}
                    title="Mută înapoi"
                  >→</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Save at bottom too */}
        {photos.length > 0 && (
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={save}
              disabled={!isDirty || saving}
              style={{
                padding: "12px 32px", borderRadius: 8, border: "none",
                background: isDirty && !saving ? "#7c3aed" : "#1a1a1a",
                color: isDirty && !saving ? "#fff" : "#444",
                fontSize: 14, fontWeight: 700,
                cursor: isDirty && !saving ? "pointer" : "not-allowed",
              }}
            >
              {saving ? "Se salvează..." : isDirty ? `Salvează ordinea (${photos.length} poze)` : "Totul e salvat ✓"}
            </button>
            {saveResult && (
              <span style={{ fontSize: 13, fontWeight: 600, color: saveResult.startsWith("Salvat") ? "#34d399" : "#f87171" }}>
                {saveResult}
              </span>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
