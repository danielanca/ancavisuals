import React, { useEffect, useState } from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";

type Proposal = { id: string; photoUrl: string; albumSlug: string; fileName: string };
type Asset = { id: string; url: string; label: string; serviceId: string };
type PhotoItem = { url: string; sourceType: "proposal" | "media_asset" | "manual"; sourceId?: string };

const ZONE_ID = "media_footer";

function photosEqual(a: PhotoItem[], b: PhotoItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.url === b[i].url && item.sourceType === b[i].sourceType && item.sourceId === b[i].sourceId);
}

export default function ShowcaseZoneEditorPage() {
  const { auth } = useAuth();
  const [sources, setSources] = useState<{ proposals: Proposal[]; assets: Asset[] } | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<PhotoItem[]>([]);
  const [tab, setTab] = useState<"proposals" | "assets">("proposals");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile" | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    if (auth.loading) return;

    const headers: Record<string, string> = auth.accessToken
      ? { Authorization: `Bearer ${auth.accessToken}` }
      : {};

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
      fetch(`/api/showcase-zones/${ZONE_ID}/sources`, { headers })
        .then((r) => r.ok ? r.json() : null)
        .then((data: { proposals?: Proposal[]; assets?: Asset[] } | null) => { if (data) setSources(data); })
        .catch(() => {});
    }
  }, [auth.loading, auth.accessToken]);

  const addPhoto = (url: string, sourceType: PhotoItem["sourceType"], sourceId?: string) => {
    setPhotos((prev) => {
      if (prev.some((p) => p.url === url)) return prev.filter((p) => p.url !== url);
      return [...prev, { url, sourceType, sourceId }];
    });
    setSaveResult(null);
  };

  const removePhoto = (url: string) => {
    setPhotos((prev) => prev.filter((p) => p.url !== url));
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

  const moveUp = (index: number) => {
    if (index === 0) return;
    setPhotos((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setSaveResult(null);
  };

  const moveDown = (index: number) => {
    setPhotos((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({ photos }),
      });
      if (res.ok) {
        setSavedPhotos([...photos]);
        setSaveResult("Salvat cu succes.");
      } else {
        setSaveResult("Eroare la salvare.");
      }
    } catch {
      setSaveResult("Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = !photosEqual(photos, savedPhotos);

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    backgroundColor: "#0a0a0a",
    color: "#fff",
    padding: "24px",
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: "24px",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "22px",
    fontWeight: 600,
    color: "#fff",
    margin: 0,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "#6b6b6b",
    marginTop: "4px",
  };

  const columnsStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
  };

  const panelStyle: React.CSSProperties = {
    backgroundColor: "#111",
    border: "1px solid #1a1a1a",
    borderRadius: "10px",
    padding: "20px",
  };

  const panelTitleStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 600,
    color: "#aaa",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: "16px",
  };

  const tabsStyle: React.CSSProperties = {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  };

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: "6px",
    border: "1px solid",
    borderColor: active ? "#7c3aed" : "#2a2a2a",
    backgroundColor: active ? "#7c3aed22" : "transparent",
    color: active ? "#a78bfa" : "#666",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all 0.15s",
  });

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
    gap: "8px",
    maxHeight: "480px",
    overflowY: "auto",
  };

  const thumbStyle = (selected: boolean): React.CSSProperties => ({
    aspectRatio: "1",
    objectFit: "cover" as const,
    borderRadius: "6px",
    cursor: "pointer",
    border: selected ? "2px solid #7c3aed" : "2px solid transparent",
    opacity: selected ? 0.6 : 1,
    transition: "all 0.15s",
    width: "100%",
  });

  const selectedItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 10px",
    backgroundColor: "#1a1a1a",
    borderRadius: "6px",
    marginBottom: "6px",
  };

  const selectedThumbStyle: React.CSSProperties = {
    width: "44px",
    height: "44px",
    objectFit: "cover" as const,
    borderRadius: "4px",
    flexShrink: 0,
  };

  const selectedUrlStyle: React.CSSProperties = {
    flex: 1,
    fontSize: "11px",
    color: "#666",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  };

  const iconButtonStyle: React.CSSProperties = {
    background: "none",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    color: "#888",
    cursor: "pointer",
    padding: "3px 6px",
    fontSize: "12px",
    lineHeight: 1,
    flexShrink: 0,
  };

  const removeButtonStyle: React.CSSProperties = {
    ...iconButtonStyle,
    color: "#ef4444",
    borderColor: "#3a1a1a",
  };

  const previewStripStyle: React.CSSProperties = {
    display: "flex",
    gap: "6px",
    overflowX: "auto",
    padding: "10px 0",
    marginTop: "16px",
    borderTop: "1px solid #1a1a1a",
  };

  const previewThumbStyle: React.CSSProperties = {
    width: "60px",
    height: "60px",
    objectFit: "cover" as const,
    borderRadius: "5px",
    flexShrink: 0,
  };

  const saveButtonStyle: React.CSSProperties = {
    marginTop: "20px",
    padding: "10px 24px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: isDirty && !saving ? "#7c3aed" : "#2a2a2a",
    color: isDirty && !saving ? "#fff" : "#555",
    fontSize: "14px",
    fontWeight: 500,
    cursor: isDirty && !saving ? "pointer" : "not-allowed",
    transition: "all 0.15s",
  };

  const saveResultStyle: React.CSSProperties = {
    marginTop: "10px",
    fontSize: "13px",
    color: saveResult?.startsWith("Salvat") ? "#34d399" : "#f87171",
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#555", fontSize: "14px" }}>Se încarcă...</span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <Breadcrumb />
      <div style={headerStyle}>
        <h1 style={titleStyle}>Zone Showcase</h1>
        <p style={subtitleStyle}>Footer /media</p>
      </div>

      <div style={columnsStyle}>
        <div style={panelStyle}>
          <p style={panelTitleStyle}>Surse disponibile</p>
          <div style={tabsStyle}>
            <button style={tabButtonStyle(tab === "proposals")} onClick={() => setTab("proposals")}>
              Propuneri
            </button>
            <button style={tabButtonStyle(tab === "assets")} onClick={() => setTab("assets")}>
              Media Assets
            </button>
          </div>

          {tab === "proposals" && (
            <div style={gridStyle}>
              {(sources?.proposals ?? []).map((p) => (
                <img
                  key={p.id}
                  src={p.photoUrl}
                  alt={p.fileName}
                  title={p.fileName}
                  style={thumbStyle(photos.some((ph) => ph.url === p.photoUrl))}
                  onClick={() => addPhoto(p.photoUrl, "proposal", p.id)}
                />
              ))}
              {(sources?.proposals ?? []).length === 0 && (
                <span style={{ color: "#555", fontSize: "13px", gridColumn: "1/-1" }}>Nicio propunere acceptată.</span>
              )}
            </div>
          )}

          {tab === "assets" && (
            <div style={gridStyle}>
              {(sources?.assets ?? []).map((a) => (
                <img
                  key={a.id}
                  src={a.url}
                  alt={a.label}
                  title={a.label}
                  style={thumbStyle(photos.some((ph) => ph.url === a.url))}
                  onClick={() => addPhoto(a.url, "media_asset", a.id)}
                />
              ))}
              {(sources?.assets ?? []).length === 0 && (
                <span style={{ color: "#555", fontSize: "13px", gridColumn: "1/-1" }}>Niciun asset disponibil.</span>
              )}
            </div>
          )}
        </div>

        <div style={panelStyle}>
          <p style={panelTitleStyle}>Selecție curentă ({photos.length} poze)</p>

          {photos.length === 0 && (
            <span style={{ color: "#555", fontSize: "13px" }}>Nicio poză selectată. Click pe sursele din stânga.</span>
          )}

          {photos.length > 0 && (
            <div style={{ columns: 2, columnGap: "8px" }}>
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
                    position: "relative", breakInside: "avoid", marginBottom: "8px",
                    borderRadius: "8px", overflow: "hidden", cursor: "grab",
                    outline: dropIndex === index && dragIndex !== index ? "2px solid #7c3aed" : "none",
                    opacity: dragIndex === index ? 0.45 : 1,
                    transition: "opacity 0.15s, outline 0.1s",
                  }}
                >
                  <img src={photo.url} alt="" style={{ width: "100%", display: "block", borderRadius: "8px", pointerEvents: "none" }} />

                  {/* Order badge */}
                  <div style={{
                    position: "absolute", top: "6px", left: "6px",
                    background: "rgba(0,0,0,0.7)", color: "#aaa",
                    fontSize: "11px", fontWeight: 600, borderRadius: "4px",
                    padding: "2px 6px", lineHeight: 1.4, pointerEvents: "none",
                  }}>
                    #{index + 1}
                  </div>

                  {/* Remove button */}
                  <button
                    style={{
                      position: "absolute", top: "6px", right: "6px",
                      background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "4px",
                      color: "#ef4444", cursor: "pointer", padding: "3px 7px", fontSize: "13px", lineHeight: 1,
                    }}
                    onClick={() => removePhoto(photo.url)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Desktop / Mobile preview */}
          {photos.length > 0 && (
            <div style={{ marginTop: "16px", borderTop: "1px solid #1a1a1a", paddingTop: "14px" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                {(["desktop", "mobile"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPreviewMode(previewMode === mode ? null : mode)}
                    style={{
                      padding: "5px 14px", borderRadius: "6px", fontSize: "12px", cursor: "pointer",
                      border: "1px solid", transition: "all 0.15s",
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
                <div style={{ borderRadius: "8px", overflow: "hidden", background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
                  <div style={{ fontSize: "10px", color: "#444", padding: "6px 10px 4px", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                    Desktop — primele {Math.min(photos.length, 12)} poze
                  </div>
                  <div style={{ columns: 4, columnGap: "3px", maxHeight: "200px", overflow: "hidden", padding: "0 3px 3px" }}>
                    {photos.slice(0, 12).map((photo, index) => (
                      <div key={index} style={{ breakInside: "avoid", marginBottom: "3px" }}>
                        <img src={photo.url} alt="" style={{ width: "100%", display: "block", borderRadius: "3px" }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewMode === "mobile" && (
                <div style={{ borderRadius: "8px", overflow: "hidden", background: "#0a0a0a", border: "1px solid #1a1a1a", maxWidth: "180px", margin: "0 auto" }}>
                  <div style={{ fontSize: "10px", color: "#444", padding: "6px 10px 4px", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                    Mobile — primele {Math.min(photos.length, 6)} poze
                  </div>
                  <div style={{ columns: 2, columnGap: "3px", maxHeight: "200px", overflow: "hidden", padding: "0 3px 3px" }}>
                    {photos.slice(0, 6).map((photo, index) => (
                      <div key={index} style={{ breakInside: "avoid", marginBottom: "3px" }}>
                        <img src={photo.url} alt="" style={{ width: "100%", display: "block", borderRadius: "3px" }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button style={saveButtonStyle} onClick={save} disabled={!isDirty || saving}>
            {saving ? "Se salvează..." : "Salvează"}
          </button>

          {saveResult && <p style={saveResultStyle}>{saveResult}</p>}
        </div>
      </div>
    </div>
  );
}
