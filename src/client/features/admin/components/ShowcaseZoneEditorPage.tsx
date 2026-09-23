import React, { useEffect, useState, useCallback, useRef } from "react";
// useRef păstrat pentru saveResultTimerRef
import { useParams, useNavigate } from "react-router-dom";
import SmartImage from "../../../components/UI/SmartImage";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import ReorderableMediaGrid, { type ReorderableMediaItem } from "./shared/ReorderableMediaGrid";

type Proposal = { id: string; photoUrl: string; albumSlug: string; fileName: string };
type Asset = { id: string; url: string; label: string; serviceId: string; kind?: "image" | "video" };
type PhotoItem = { url: string; sourceType: "proposal" | "media_asset" | "manual"; sourceId?: string };
type ZoneMediaItem = ReorderableMediaItem & { sourceType: PhotoItem["sourceType"]; sourceId?: string };
type Device = "desktop" | "mobile";

export type ZoneConfig = {
  label: string;
  mode: "single" | "device";
  mediaKind: "image" | "video";
  description: string;
  // "grid": carduri mici pătrate, ordine strict stânga-dreapta — potrivit
  // pentru o fâșie/footer. Implicit "masonry" (proporții naturale).
  layout?: "masonry" | "grid";
};

export const ZONE_CONFIGS: Record<string, ZoneConfig> = {
  media_footer: {
    label: "Fâșie promo",
    mode: "single",
    mediaKind: "image",
    description: "Pozele selectate apar în secțiunea promo de pe site (album, share, homepage, contact, portofoliu).",
    layout: "grid",
  },
  homepage_gallery: {
    label: "Galerie Homepage",
    mode: "device",
    mediaKind: "image",
    description: "Pozele din secțiunea \"Ultimele evenimente\" de pe homepage. Set independent de galeria de portofoliu.",
  },
  portfolio_gallery: {
    label: "Galerie Portofoliu",
    mode: "device",
    mediaKind: "image",
    description: "Pozele afișate pe pagina de portofoliu. Set independent de galeria de pe homepage.",
  },
  homepage_videos: {
    label: "Videouri Homepage",
    mode: "device",
    mediaKind: "video",
    description: "Videourile afișate pe homepage.",
  },
};

const DEFAULT_CONFIG: ZoneConfig = { label: "Zonă", mode: "single", mediaKind: "image", description: "" };

// Ordinea taburilor din bibliotecă — cele mai folosite zone primele.
export const ZONE_TAB_ORDER = ["homepage_gallery", "portfolio_gallery", "homepage_videos", "media_footer"];

function photosEqual(a: PhotoItem[], b: PhotoItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) =>
    item.url === b[i].url &&
    item.sourceType === b[i].sourceType &&
    item.sourceId === b[i].sourceId
  );
}

function toZoneMediaItems(list: PhotoItem[], kind: "image" | "video"): ZoneMediaItem[] {
  return list.map((item, index) => ({
    id: item.url,
    url: item.url,
    kind,
    label: `Poza ${index + 1}`,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
  }));
}

function fromZoneMediaItems(items: ZoneMediaItem[]): PhotoItem[] {
  return items.map(({ url, sourceType, sourceId }) => ({ url, sourceType, sourceId }));
}

export default function ShowcaseZoneEditorPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const { zoneId = "media_footer" } = useParams<{ zoneId: string }>();
  const config = ZONE_CONFIGS[zoneId] ?? DEFAULT_CONFIG;

  const [sources, setSources] = useState<{ proposals: Proposal[]; assets: Asset[] } | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState(false);
  const [photosByDevice, setPhotosByDevice] = useState<Record<Device, PhotoItem[]>>({ desktop: [], mobile: [] });
  const [savedByDevice, setSavedByDevice] = useState<Record<Device, PhotoItem[]>>({ desktop: [], mobile: [] });
  const [activeDevice, setActiveDevice] = useState<Device>("desktop");
  const [sourceTab, setSourceTab] = useState<"proposals" | "assets">(config.mediaKind === "video" ? "assets" : "proposals");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const saveResultTimerRef = useRef<number | null>(null);
  const activeDeviceKey: Device = config.mode === "single" ? "desktop" : activeDevice;
  const activeList = photosByDevice[activeDeviceKey];

  // Load zone data — nu necesită autentificare
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/showcase-zones/${zoneId}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((zoneData: { photos?: string[]; desktop?: string[]; mobile?: string[] } | null) => {
        if (cancelled) return;
        const toItems = (urls?: string[]): PhotoItem[] => (urls ?? []).map((url) => ({ url, sourceType: "manual" as const }));
        const loaded: Record<Device, PhotoItem[]> = (ZONE_CONFIGS[zoneId] ?? DEFAULT_CONFIG).mode === "single"
          ? { desktop: toItems(zoneData?.photos), mobile: [] }
          : { desktop: toItems(zoneData?.desktop), mobile: toItems(zoneData?.mobile) };
        setPhotosByDevice(loaded);
        setSavedByDevice(loaded);
      })
      .catch((err) => { if (err.name !== "AbortError") console.error("[Showcase] zone load error:", err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [zoneId]);

  // Load sources — necesită autentificare
  useEffect(() => {
    if (auth.loading || !auth.accessToken) return;
    let cancelled = false;
    const controller = new AbortController();
    setSourcesLoading(true);
    setSourcesError(false);
    fetch(`/api/showcase-zones/${zoneId}/sources?kind=${config.mediaKind}`, {
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
  }, [auth.loading, auth.accessToken, zoneId, config.mediaKind]);

  const togglePhoto = useCallback((url: string, sourceType: PhotoItem["sourceType"], sourceId?: string) => {
    setPhotosByDevice((prev) => {
      const list = prev[activeDeviceKey];
      const nextList = list.some((p) => p.url === url)
        ? list.filter((p) => p.url !== url)
        : [...list, { url, sourceType, sourceId }];
      return { ...prev, [activeDeviceKey]: nextList };
    });
    setSaveResult(null);
  }, [activeDeviceKey]);

  const removePhotoByUrl = (url: string) => {
    setPhotosByDevice((prev) => ({ ...prev, [activeDeviceKey]: prev[activeDeviceKey].filter((p) => p.url !== url) }));
    setSaveResult(null);
  };

  const handleReorder = (nextItems: ReorderableMediaItem[]) => {
    setPhotosByDevice((prev) => ({ ...prev, [activeDeviceKey]: fromZoneMediaItems(nextItems as ZoneMediaItem[]) }));
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
      const body = config.mode === "single"
        ? { photos: photosByDevice.desktop }
        : { desktop: photosByDevice.desktop, mobile: photosByDevice.mobile };
      console.log("[Showcase] PUT", zoneId, body);
      const res = await fetch(`/api/showcase-zones/${zoneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      console.log("[Showcase] răspuns:", res.status);
      if (res.ok) {
        setSavedByDevice(photosByDevice);
        showSaveResult("Salvat ✓");
      } else {
        const errBody = await res.text().catch(() => res.statusText);
        console.error("[Showcase] eroare:", res.status, errBody);
        showSaveResult(`Eroare ${res.status}: ${errBody}`);
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

  const isDirty = !photosEqual(photosByDevice.desktop, savedByDevice.desktop) || !photosEqual(photosByDevice.mobile, savedByDevice.mobile);

  // Filtered source list
  const rawSourceList = sourceTab === "proposals"
    ? (sources?.proposals ?? []).map((p) => ({ id: p.id, url: p.photoUrl, label: p.fileName, sourceType: "proposal" as const, kind: "image" as const }))
    : (sources?.assets ?? []).map((a) => ({ id: a.id, url: a.url, label: a.label, sourceType: "media_asset" as const, kind: a.kind ?? "image" }));

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

      {/* Taburi — o singură pagină pentru toate destinațiile de media */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {ZONE_TAB_ORDER.map((id) => {
          const tabConfig = ZONE_CONFIGS[id] ?? DEFAULT_CONFIG;
          const isActive = id === zoneId;
          return (
            <button
              key={id}
              onClick={() => {
                if (isActive) return;
                if (isDirty && !window.confirm("Ai modificări nesalvate în această zonă. Schimbi oricum și le pierzi?")) return;
                navigate(`/admin/showcase/${id}`);
              }}
              style={{
                padding: "8px 16px", borderRadius: 10, border: "1px solid",
                borderColor: isActive ? "#7c3aed" : "#2a2a2a",
                background: isActive ? "#7c3aed22" : "#111",
                color: isActive ? "#a78bfa" : "#888",
                fontSize: 13, fontWeight: isActive ? 700 : 500, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {tabConfig.label}
            </button>
          );
        })}
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{config.label}</h1>
          <p style={{ fontSize: 12, color: "#555", marginTop: 3 }}>{config.description}</p>
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
            {saving ? "Se salvează..." : isDirty ? "Salvează" : "Salvat ✓"}
          </button>
        </div>
      </div>

      {/* ── SECTION 1: SOURCE PICKER ─────────────────────────────── */}
      <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            📂 Surse disponibile — selectează {config.mediaKind === "video" ? "videourile" : "pozele"}
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
        {config.mediaKind !== "video" && (
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
        )}

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
              const isSelected = activeList.some((p) => p.url === item.url);
              const positionIndex = activeList.findIndex((p) => p.url === item.url);
              return (
                <div
                  key={item.id}
                  onClick={() => togglePhoto(item.url, item.sourceType, item.id)}
                  title={item.label}
                  style={{ position: "relative", cursor: "pointer", borderRadius: 8, overflow: "hidden", userSelect: "none" }}
                >
                  {item.kind === "video" ? (
                    <video
                      src={item.url}
                      muted
                      style={{
                        width: "100%", aspectRatio: "1", objectFit: "cover", display: "block",
                        border: isSelected ? "3px solid #7c3aed" : "3px solid transparent",
                        borderRadius: 8,
                        opacity: isSelected ? 0.6 : 1,
                        transition: "all 0.15s",
                      }}
                    />
                  ) : (
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
                  )}
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
              🔢 Ordinea în care apar pe site ({activeList.length})
            </p>
            <p style={{ fontSize: 11, color: "#444", marginTop: 4 }}>
              Trage cardurile pentru reordonare • dublu-click pe două poze ca să facă schimb de locuri • ține apăsat pentru selecție multiplă • prima apare prima pe site
            </p>
          </div>
          {config.mode === "device" && (
            <div style={{ display: "flex", borderRadius: 8, border: "1px solid #2a2a2a", padding: 4 }}>
              {(["desktop", "mobile"] as const).map((device) => (
                <button
                  key={device}
                  onClick={() => setActiveDevice(device)}
                  style={{
                    padding: "6px 14px", borderRadius: 6, border: "none",
                    background: activeDevice === device ? "#7c3aed" : "transparent",
                    color: activeDevice === device ? "#fff" : "#888",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {device === "desktop" ? "🖥️ Desktop" : "📱 Mobil"}
                </button>
              ))}
            </div>
          )}
        </div>

        {config.mode === "device" && (
          <p style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>
            {activeDevice === "desktop" ? "Aceasta ordine e văzută pe desktop." : "Aceasta ordine e văzută pe mobil."}
          </p>
        )}

        <ReorderableMediaGrid
          items={toZoneMediaItems(activeList, config.mediaKind)}
          onReorder={handleReorder}
          onRemove={removePhotoByUrl}
          emptyLabel={`Nicio ${config.mediaKind === "video" ? "video" : "poză"} selectată${config.mode === "device" ? ` pentru ${activeDevice === "desktop" ? "desktop" : "mobil"}` : ""}.`}
          layout={config.layout ?? "masonry"}
        />
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
