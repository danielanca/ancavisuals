import React, { useEffect, useState, useCallback } from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";

type Proposal = { id: string; photoUrl: string; albumSlug: string; fileName: string };
type Asset = { id: string; url: string; label: string; serviceId: string };
type PhotoItem = { url: string; sourceType: "proposal" | "media_asset" | "manual"; sourceId?: string };

const ZONE_ID = "media_footer";

function photosEqual(a: PhotoItem[], b: PhotoItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.url === b[i].url && item.sourceType === b[i].sourceType);
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export default function ShowcaseZoneEditorPage() {
  const { auth } = useAuth();
  const isMobile = useIsMobile();
  const [sources, setSources] = useState<{ proposals: Proposal[]; assets: Asset[] } | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<PhotoItem[]>([]);
  const [sourceTab, setSourceTab] = useState<"proposals" | "assets">("proposals");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile" | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<"source" | "selection">("source");

  const authHeaders: Record<string, string> = auth.accessToken
    ? { Authorization: `Bearer ${auth.accessToken}` }
    : {};

  useEffect(() => {
    if (auth.loading) return;
    fetch(`/api/showcase-zones/${ZONE_ID}`)
      .then((r) => r.ok ? r.json() : null)
      .then((zoneData: { photos?: string[] } | null) => {
        if (zoneData?.photos) {
          const loaded: PhotoItem[] = zoneData.photos.map((url) => ({ url, sourceType: "manual" as const }));
          setPhotos(loaded);
          setSavedPhotos(loaded);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    if (auth.accessToken) {
      fetch(`/api/showcase-zones/${ZONE_ID}/sources`, { headers: authHeaders })
        .then((r) => r.ok ? r.json() : null)
        .then((data: { proposals?: Proposal[]; assets?: Asset[] } | null) => {
          if (data) setSources({ proposals: data.proposals ?? [], assets: data.assets ?? [] });
        })
        .catch(() => {});
    }
  }, [auth.loading, auth.accessToken]);

  const togglePhoto = useCallback((url: string, sourceType: PhotoItem["sourceType"], sourceId?: string) => {
    setPhotos((prev) => {
      if (prev.some((p) => p.url === url)) return prev.filter((p) => p.url !== url);
      return [...prev, { url, sourceType, sourceId }];
    });
    setSaveResult(null);
    if (isMobile) setActivePanel("selection");
  }, [isMobile]);

  const removePhoto = (url: string) => {
    setPhotos((prev) => prev.filter((p) => p.url !== url));
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

  const save = async () => {
    if (!auth.accessToken) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`/api/showcase-zones/${ZONE_ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ photos }),
      });
      if (res.ok) { setSavedPhotos([...photos]); setSaveResult("Salvat ✓"); }
      else setSaveResult("Eroare la salvare.");
    } catch {
      setSaveResult("Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = !photosEqual(photos, savedPhotos);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#555", fontSize: 14 }}>Se încarcă...</span>
      </div>
    );
  }

  const sourceList = sourceTab === "proposals"
    ? (sources?.proposals ?? []).map((p) => ({ id: p.id, url: p.photoUrl, label: p.fileName, sourceType: "proposal" as const }))
    : (sources?.assets ?? []).map((a) => ({ id: a.id, url: a.url, label: a.label, sourceType: "media_asset" as const }));

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0a", color: "#fff", padding: isMobile ? "16px" : "24px", paddingBottom: isMobile ? "100px" : "40px" }}>
      <Breadcrumb />

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Zone Showcase</h1>
        <p style={{ fontSize: 13, color: "#555", marginTop: 4 }}>Footer /media · {photos.length} poze selectate</p>
      </div>

      {/* Mobile panel switcher */}
      {isMobile && (
        <div style={{ display: "flex", gap: 0, marginBottom: 16, borderRadius: 10, overflow: "hidden", border: "1px solid #222" }}>
          {(["source", "selection"] as const).map((panel) => (
            <button
              key={panel}
              onClick={() => setActivePanel(panel)}
              style={{
                flex: 1, padding: "11px 0", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
                background: activePanel === panel ? "#7c3aed" : "#111",
                color: activePanel === panel ? "#fff" : "#555",
                transition: "all 0.15s",
              }}
            >
              {panel === "source" ? "📂 Surse" : `🖼 Selecție (${photos.length})`}
            </button>
          ))}
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: 20,
      }}>

        {/* Source panel */}
        {(!isMobile || activePanel === "source") && (
          <div style={{ backgroundColor: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: isMobile ? 14 : 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              Surse disponibile
            </p>

            {/* Source tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["proposals", "assets"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSourceTab(t)}
                  style={{
                    padding: isMobile ? "9px 18px" : "6px 14px",
                    borderRadius: 8, border: "1px solid",
                    borderColor: sourceTab === t ? "#7c3aed" : "#2a2a2a",
                    background: sourceTab === t ? "#7c3aed22" : "transparent",
                    color: sourceTab === t ? "#a78bfa" : "#666",
                    fontSize: 13, cursor: "pointer",
                  }}
                >
                  {t === "proposals" ? "Propuneri" : "Media Assets"}
                </button>
              ))}
            </div>

            {/* Photo grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? "90px" : "90px"}, 1fr))`,
              gap: isMobile ? 10 : 8,
              maxHeight: isMobile ? "55vh" : 460,
              overflowY: "auto",
            }}>
              {sourceList.map((item) => {
                const isSelected = photos.some((p) => p.url === item.url);
                return (
                  <div
                    key={item.id}
                    onClick={() => togglePhoto(item.url, item.sourceType, item.id)}
                    style={{ position: "relative", cursor: "pointer", borderRadius: 8, overflow: "hidden" }}
                  >
                    <img
                      src={item.url}
                      alt={item.label}
                      style={{
                        width: "100%", aspectRatio: "1", objectFit: "cover", display: "block",
                        border: isSelected ? "3px solid #7c3aed" : "3px solid transparent",
                        borderRadius: 8, opacity: isSelected ? 0.55 : 1,
                        transition: "all 0.15s",
                      }}
                    />
                    {isSelected && (
                      <div style={{
                        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        background: "rgba(124,58,237,0.3)", borderRadius: 6,
                      }}>
                        <span style={{ fontSize: 22, color: "#fff" }}>✓</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {sourceList.length === 0 && (
                <span style={{ color: "#444", fontSize: 13, gridColumn: "1/-1" }}>Nicio sursă disponibilă.</span>
              )}
            </div>
          </div>
        )}

        {/* Selection panel */}
        {(!isMobile || activePanel === "selection") && (
          <div style={{ backgroundColor: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: isMobile ? 14 : 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              Selecție curentă ({photos.length})
            </p>

            {photos.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#444", fontSize: 13 }}>
                {isMobile ? "Mergi la Surse și apasă pe o poză." : "Click pe sursele din stânga pentru a adăuga."}
              </div>
            )}

            {/* Selected photos — masonry on desktop, list on mobile */}
            {photos.length > 0 && (
              isMobile ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "55vh", overflowY: "auto" }}>
                  {photos.map((photo, index) => (
                    <div
                      key={photo.url}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: "#1a1a1a", borderRadius: 10, padding: "8px 10px",
                      }}
                    >
                      <img src={photo.url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 11, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        #{index + 1}
                      </span>
                      {/* Up / Down / Remove — large touch targets */}
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #2a2a2a", background: "none", color: index === 0 ? "#333" : "#aaa", fontSize: 16, cursor: index === 0 ? "default" : "pointer" }}
                        >↑</button>
                        <button
                          onClick={() => move(index, 1)}
                          disabled={index === photos.length - 1}
                          style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #2a2a2a", background: "none", color: index === photos.length - 1 ? "#333" : "#aaa", fontSize: 16, cursor: index === photos.length - 1 ? "default" : "pointer" }}
                        >↓</button>
                        <button
                          onClick={() => removePhoto(photo.url)}
                          style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #3a1a1a", background: "none", color: "#ef4444", fontSize: 16, cursor: "pointer" }}
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ columns: 2, columnGap: 8, maxHeight: 400, overflowY: "auto" }}>
                  {photos.map((photo, index) => (
                    <div
                      key={photo.url}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(e) => { e.preventDefault(); setDropIndex(index); }}
                      onDragEnd={() => {
                        if (dragIndex !== null && dropIndex !== null) reorder(dragIndex, dropIndex);
                        setDragIndex(null); setDropIndex(null);
                      }}
                      style={{
                        position: "relative", breakInside: "avoid", marginBottom: 8,
                        borderRadius: 8, overflow: "hidden", cursor: "grab",
                        outline: dropIndex === index && dragIndex !== index ? "2px solid #7c3aed" : "none",
                        opacity: dragIndex === index ? 0.4 : 1,
                      }}
                    >
                      <img src={photo.url} alt="" style={{ width: "100%", display: "block", borderRadius: 8, pointerEvents: "none" }} />
                      <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.7)", color: "#aaa", fontSize: 11, fontWeight: 600, borderRadius: 4, padding: "2px 6px" }}>
                        #{index + 1}
                      </div>
                      <button
                        onClick={() => removePhoto(photo.url)}
                        style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 4, color: "#ef4444", cursor: "pointer", padding: "3px 7px", fontSize: 13 }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Preview toggle — desktop only */}
            {!isMobile && photos.length > 0 && (
              <div style={{ marginTop: 16, borderTop: "1px solid #1a1a1a", paddingTop: 14 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {(["desktop", "mobile"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPreviewMode(previewMode === mode ? null : mode)}
                      style={{
                        padding: "5px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "1px solid",
                        borderColor: previewMode === mode ? "#7c3aed" : "#2a2a2a",
                        background: previewMode === mode ? "#7c3aed22" : "transparent",
                        color: previewMode === mode ? "#a78bfa" : "#666",
                      }}
                    >
                      {mode === "desktop" ? "🖥 Desktop" : "📱 Mobile"}
                    </button>
                  ))}
                </div>
                {previewMode === "desktop" && (
                  <div style={{ borderRadius: 8, overflow: "hidden", background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
                    <div style={{ fontSize: 10, color: "#444", padding: "6px 10px 4px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Desktop — primele {Math.min(photos.length, 12)}</div>
                    <div style={{ columns: 4, columnGap: 3, maxHeight: 200, overflow: "hidden", padding: "0 3px 3px" }}>
                      {photos.slice(0, 12).map((photo, i) => (
                        <div key={i} style={{ breakInside: "avoid", marginBottom: 3 }}>
                          <img src={photo.url} alt="" style={{ width: "100%", display: "block", borderRadius: 3 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {previewMode === "mobile" && (
                  <div style={{ borderRadius: 8, overflow: "hidden", background: "#0a0a0a", border: "1px solid #1a1a1a", maxWidth: 180, margin: "0 auto" }}>
                    <div style={{ fontSize: 10, color: "#444", padding: "6px 10px 4px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Mobile — primele {Math.min(photos.length, 6)}</div>
                    <div style={{ columns: 2, columnGap: 3, maxHeight: 200, overflow: "hidden", padding: "0 3px 3px" }}>
                      {photos.slice(0, 6).map((photo, i) => (
                        <div key={i} style={{ breakInside: "avoid", marginBottom: 3 }}>
                          <img src={photo.url} alt="" style={{ width: "100%", display: "block", borderRadius: 3 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isMobile && (
              <>
                <button
                  onClick={save}
                  disabled={!isDirty || saving}
                  style={{
                    marginTop: 20, padding: "11px 28px", borderRadius: 8, border: "none",
                    background: isDirty && !saving ? "#7c3aed" : "#1a1a1a",
                    color: isDirty && !saving ? "#fff" : "#444",
                    fontSize: 14, fontWeight: 600, cursor: isDirty && !saving ? "pointer" : "not-allowed",
                  }}
                >
                  {saving ? "Se salvează..." : "Salvează"}
                </button>
                {saveResult && (
                  <p style={{ marginTop: 8, fontSize: 13, color: saveResult.startsWith("Salvat") ? "#34d399" : "#f87171" }}>
                    {saveResult}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile sticky save bar */}
      {isMobile && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#111", borderTop: "1px solid #222",
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, zIndex: 50,
        }}>
          <button
            onClick={save}
            disabled={!isDirty || saving}
            style={{
              flex: 1, padding: "13px 0", borderRadius: 10, border: "none",
              background: isDirty && !saving ? "#7c3aed" : "#1a1a1a",
              color: isDirty && !saving ? "#fff" : "#444",
              fontSize: 15, fontWeight: 700, cursor: isDirty && !saving ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Se salvează..." : isDirty ? `Salvează (${photos.length} poze)` : "Salvat ✓"}
          </button>
          {saveResult && (
            <span style={{ fontSize: 13, color: saveResult.startsWith("Salvat") ? "#34d399" : "#f87171", flexShrink: 0 }}>
              {saveResult}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
