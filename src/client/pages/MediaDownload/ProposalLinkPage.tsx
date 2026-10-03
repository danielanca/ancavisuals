/*
 * Purpose: public, account-less page behind a proposal link (`/propune/:token`).
 * The visitor enters their name, browses the album, picks the photos they like
 * and proposes them for Instagram / Media Assets. Scroll progress and the final
 * "Am terminat" are reported back so the admin task tracks completion.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

type LinkPhoto = { fileName: string; previewUrl: string };
type LinkData = { albumSlug: string; title: string; label: string; photos: LinkPhoto[] };
type Destination = "instagram" | "media_assets";
type StoredVisitor = { visitorId: string; name: string };

const PAGE_SIZE = 60;
const PROGRESS_INTERVAL_MS = 5000;
const GOLD = "#c9a96e";
// Rânduri justificate: fiecare poză își păstrează aspect ratio-ul real (citit la încărcare),
// iar rândul se întinde pe toată lățimea. Până se încarcă, presupunem 3:2.
const ROW_HEIGHT = 180;
const DEFAULT_RATIO = 3 / 2;

const mediaKey = (fileName: string) => {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
};

const storageKey = (token: string) => `proposalLink:${token}`;

function readVisitor(token: string): StoredVisitor | null {
  try {
    const raw = window.localStorage.getItem(storageKey(token));
    const parsed = raw ? JSON.parse(raw) as StoredVisitor : null;
    return parsed?.visitorId ? parsed : null;
  } catch {
    return null;
  }
}

function writeVisitor(token: string, visitor: StoredVisitor) {
  try {
    window.localStorage.setItem(storageKey(token), JSON.stringify(visitor));
  } catch { /* private mode — the session still works, it just won't be remembered */ }
}

function newVisitorId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Ceva n-a mers. Încearcă din nou.");
  return data;
}

export default function ProposalLinkPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<LinkData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visitor, setVisitor] = useState<StoredVisitor | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [proposed, setProposed] = useState<Set<string>>(new Set());
  const [destinations, setDestinations] = useState<Set<Destination>>(new Set(["instagram", "media_assets"]));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);

  const maxSeenRef = useRef(0);
  const reportedRef = useRef(-1);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisitor(readVisitor(token));
    fetch(`/api/proposal-links/${encodeURIComponent(token)}`)
      .then(async response => {
        if (response.status === 404) throw new Error("Linkul nu mai este activ. Cere unul nou de la Daniel.");
        if (!response.ok) throw new Error("Nu am putut încărca albumul.");
        return response.json() as Promise<LinkData>;
      })
      .then(setData)
      .catch((error: Error) => setLoadError(error.message));
  }, [token]);

  useEffect(() => {
    if (!visitor) return;
    fetch(`/api/proposal-links/${encodeURIComponent(token)}/proposals?visitorId=${encodeURIComponent(visitor.visitorId)}`)
      .then(response => response.ok ? response.json() : { fileNames: [] })
      .then((result: { fileNames?: string[] }) => setProposed(new Set(result.fileNames ?? [])))
      .catch(() => {});
  }, [token, visitor]);

  const reportProgress = useCallback(() => {
    if (!visitor || maxSeenRef.current === reportedRef.current) return;
    reportedRef.current = maxSeenRef.current;
    postJson(`/api/proposal-links/${encodeURIComponent(token)}/progress`, {
      name: visitor.name,
      visitorId: visitor.visitorId,
      viewedCount: maxSeenRef.current,
    }).catch(() => { reportedRef.current = -1; });
  }, [token, visitor]);

  // Report as soon as the visitor starts, then periodically while scrolling.
  useEffect(() => {
    if (!visitor || !data) return;
    reportProgress();
    const timer = window.setInterval(reportProgress, PROGRESS_INTERVAL_MS);
    const onHide = () => { if (document.visibilityState === "hidden") reportProgress(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [visitor, data, reportProgress]);

  // Tracks the furthest photo seen + auto-loads the next page at the bottom.
  useEffect(() => {
    if (!visitor || !data) return;
    observerRef.current = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = entry.target as HTMLElement;
        if (target === sentinelRef.current) {
          setVisibleCount(count => Math.min(count + PAGE_SIZE, data.photos.length));
          continue;
        }
        const index = Number(target.dataset.index);
        if (Number.isFinite(index)) maxSeenRef.current = Math.max(maxSeenRef.current, index + 1);
      }
    }, { rootMargin: "0px 0px 400px 0px" });
    // Tiles mounted before the observer existed (their ref callbacks ran first).
    gridRef.current?.querySelectorAll<HTMLElement>("[data-index]").forEach(node => observerRef.current?.observe(node));
    return () => observerRef.current?.disconnect();
  }, [visitor, data]);

  const observe = useCallback((node: HTMLElement | null) => {
    if (node) observerRef.current?.observe(node);
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (node) observerRef.current?.observe(node);
    return () => { if (node) observerRef.current?.unobserve(node); };
  }, [visibleCount, visitor, data]);

  const startSession = (event: React.FormEvent) => {
    event.preventDefault();
    const name = nameInput.trim().replace(/\s+/g, " ");
    if (!name) return;
    const next = { visitorId: visitor?.visitorId ?? readVisitor(token)?.visitorId ?? newVisitorId(), name };
    writeVisitor(token, next);
    setVisitor(next);
  };

  const toggle = (fileName: string) => {
    const key = mediaKey(fileName);
    if (proposed.has(key)) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleDestination = (destination: Destination) => {
    setDestinations(prev => {
      const next = new Set(prev);
      if (next.has(destination) && next.size > 1) next.delete(destination);
      else next.add(destination);
      return next;
    });
  };

  const submit = async () => {
    if (!visitor || selected.size === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await postJson(`/api/proposal-links/${encodeURIComponent(token)}/proposals`, {
        name: visitor.name,
        visitorId: visitor.visitorId,
        fileNames: Array.from(selected),
        destinations: Array.from(destinations),
      });
      setProposed(prev => new Set([...prev, ...selected]));
      setSelected(new Set());
      const count = Number(result.added ?? 0) + Number(result.updated ?? 0);
      setMessage({ kind: "ok", text: `Mulțumesc! ${count} ${count === 1 ? "poză trimisă" : "poze trimise"}.` });
    } catch (error) {
      setMessage({ kind: "error", text: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const finish = async () => {
    if (!visitor) return;
    if (selected.size > 0) await submit();
    reportProgress();
    try {
      await postJson(`/api/proposal-links/${encodeURIComponent(token)}/complete`, { name: visitor.name, visitorId: visitor.visitorId });
      setCompleted(true);
      window.scrollTo({ top: 0 });
    } catch (error) {
      setMessage({ kind: "error", text: (error as Error).message });
    }
  };

  useEffect(() => {
    if (preview !== null) maxSeenRef.current = Math.max(maxSeenRef.current, preview + 1);
  }, [preview]);

  const photos = useMemo(() => data?.photos ?? [], [data]);
  const shown = useMemo(() => photos.slice(0, visibleCount), [photos, visibleCount]);
  const previewPhoto = preview !== null ? photos[preview] : null;

  const page: React.CSSProperties = { minHeight: "100vh", background: "#0a0a0a", color: "#eee", fontFamily: "inherit" };

  if (loadError) {
    return (
      <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <p style={{ color: "#aaa", fontSize: "15px", textAlign: "center", maxWidth: "360px" }}>{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#777" }}>Se încarcă albumul…</p></div>;
  }

  if (!visitor) {
    return (
      <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <form onSubmit={startSession} style={{ width: "100%", maxWidth: "380px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ color: GOLD, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Anca Visuals · {data.title}</p>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0, color: "#fff" }}>Alege pozele tale preferate</h1>
          <p style={{ color: "#999", fontSize: "14px", lineHeight: 1.5, margin: 0 }}>
            Răsfoiește albumul ({photos.length} poze) și atinge pozele care îți plac. Le folosim pentru Instagram și pentru prezentarea serviciilor.
          </p>
          <input
            autoFocus
            value={nameInput}
            onChange={event => setNameInput(event.target.value)}
            maxLength={60}
            placeholder="Numele tău"
            style={{ padding: "12px 14px", background: "#111", border: "1px solid #333", borderRadius: "8px", color: "#fff", fontSize: "16px" }}
          />
          <button
            type="submit"
            disabled={!nameInput.trim()}
            style={{ padding: "12px", background: nameInput.trim() ? GOLD : "#232323", color: nameInput.trim() ? "#111" : "#666", border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 700, cursor: nameInput.trim() ? "pointer" : "not-allowed" }}
          >
            Începe
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ ...page, paddingBottom: "140px" }}>
      <header style={{ padding: "20px 16px 12px", maxWidth: "1200px", margin: "0 auto" }}>
        <p style={{ color: GOLD, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>{data.title}</p>
        <h1 style={{ fontSize: "20px", fontWeight: 700, margin: "6px 0 4px", color: "#fff" }}>Salut, {visitor.name}!</h1>
        <p style={{ color: "#888", fontSize: "13px", margin: 0 }}>
          Atinge pozele care îți plac, apoi „Trimite”. Când ai terminat de răsfoit, apasă „Am terminat”.
          {" "}<button type="button" onClick={() => { setNameInput(visitor.name); setVisitor(null); }} style={{ background: "none", border: "none", color: GOLD, padding: 0, fontSize: "13px", cursor: "pointer" }}>Schimbă numele</button>
        </p>
        {completed && (
          <div style={{ marginTop: "12px", padding: "12px 14px", background: "#052e16", border: "1px solid #166534", borderRadius: "8px", color: "#4ade80", fontSize: "13px" }}>
            ✓ Gata, mulțumesc mult! Selecția ta a ajuns la Daniel. Poți reveni oricând pe link ca să mai adaugi poze.
          </div>
        )}
      </header>

      <div ref={gridRef} style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "0 6px", maxWidth: "1200px", margin: "0 auto" }}>
        {shown.map((photo, index) => {
          const key = mediaKey(photo.fileName);
          const isProposed = proposed.has(key);
          const isSelected = selected.has(key);
          const ratio = ratios[photo.fileName] ?? DEFAULT_RATIO;
          return (
            <div key={photo.fileName} ref={observe} data-index={index} style={{ position: "relative", flexGrow: ratio, flexBasis: `${ratio * ROW_HEIGHT}px`, aspectRatio: String(ratio), background: "#151515", borderRadius: "4px", overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => toggle(photo.fileName)}
                aria-pressed={isSelected || isProposed}
                aria-label={isProposed ? "Deja propusă" : isSelected ? "Deselectează poza" : "Selectează poza"}
                style={{ all: "unset", display: "block", width: "100%", height: "100%", cursor: isProposed ? "default" : "pointer" }}
              >
                <img
                  src={photo.previewUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onLoad={event => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    if (naturalWidth && naturalHeight) setRatios(prev => ({ ...prev, [photo.fileName]: naturalWidth / naturalHeight }));
                  }}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: isProposed ? 0.55 : 1, outline: isSelected ? `3px solid ${GOLD}` : "none", outlineOffset: "-3px" }}
                />
              </button>
              {(isSelected || isProposed) && (
                <span style={{ position: "absolute", top: "6px", left: "6px", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: isProposed ? "#14532d" : GOLD, color: isProposed ? "#86efac" : "#111", pointerEvents: "none" }}>
                  {isProposed ? "✓ Trimisă" : "♥"}
                </span>
              )}
              <button
                type="button"
                onClick={() => setPreview(index)}
                aria-label="Mărește poza"
                style={{ position: "absolute", bottom: "6px", right: "6px", width: "30px", height: "30px", borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: "14px", cursor: "pointer" }}
              >
                ⤢
              </button>
            </div>
          );
        })}
        {/* Ultimul rând nu se întinde: spațiul rămas îl ia acest spacer. */}
        <div aria-hidden="true" style={{ flexGrow: 1e6, flexBasis: 0, height: 0 }} />
      </div>
      {visibleCount < photos.length && <div ref={sentinelRef} style={{ height: "1px" }} />}

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "rgba(10,10,10,0.96)", borderTop: "1px solid #222", padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: "8px" }}>
        {message && <p style={{ margin: 0, fontSize: "12px", color: message.kind === "ok" ? "#4ade80" : "#f87171", textAlign: "center" }}>{message.text}</p>}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", flexWrap: "wrap", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
          {(["instagram", "media_assets"] as Destination[]).map(destination => (
            <label
              key={destination}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: `1px solid ${destinations.has(destination) ? GOLD : "#333"}`, background: destinations.has(destination) ? "rgba(201,169,110,0.15)" : "transparent", color: destinations.has(destination) ? GOLD : "#888" }}
            >
              <input
                type="checkbox"
                checked={destinations.has(destination)}
                onChange={() => toggleDestination(destination)}
                style={{ margin: 0, width: "15px", height: "15px", accentColor: GOLD, cursor: "pointer" }}
              />
              {destination === "instagram" ? "Instagram" : "Media Assets"}
            </label>
          ))}
          <button
            type="button"
            onClick={submit}
            disabled={submitting || selected.size === 0}
            style={{ padding: "9px 16px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 700, background: selected.size > 0 ? GOLD : "#232323", color: selected.size > 0 ? "#111" : "#666", cursor: selected.size > 0 ? "pointer" : "not-allowed" }}
          >
            {submitting ? "Se trimite…" : `Trimite${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={submitting}
            style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #166534", background: "transparent", color: "#4ade80", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
          >
            Am terminat
          </button>
        </div>
        <p style={{ margin: 0, fontSize: "11px", color: "#555", textAlign: "center" }}>{proposed.size} trimise · {photos.length} poze în album</p>
      </div>

      {previewPhoto && preview !== null && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", padding: "16px", zIndex: 50 }}
        >
          <img src={previewPhoto.previewUrl} alt="" style={{ maxWidth: "100%", maxHeight: "78vh", objectFit: "contain" }} onClick={event => event.stopPropagation()} />
          <div style={{ display: "flex", gap: "10px" }} onClick={event => event.stopPropagation()}>
            <button type="button" disabled={preview === 0} onClick={() => setPreview(preview - 1)} style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid #333", background: "transparent", color: "#ccc", cursor: "pointer" }}>‹</button>
            <button
              type="button"
              onClick={() => toggle(previewPhoto.fileName)}
              disabled={proposed.has(mediaKey(previewPhoto.fileName))}
              style={{ padding: "9px 18px", borderRadius: "8px", border: "none", fontWeight: 700, background: selected.has(mediaKey(previewPhoto.fileName)) ? GOLD : "#232323", color: selected.has(mediaKey(previewPhoto.fileName)) ? "#111" : "#ddd", cursor: "pointer" }}
            >
              {proposed.has(mediaKey(previewPhoto.fileName)) ? "✓ Trimisă" : selected.has(mediaKey(previewPhoto.fileName)) ? "♥ Îmi place" : "♡ Îmi place"}
            </button>
            <button type="button" disabled={preview >= photos.length - 1} onClick={() => setPreview(preview + 1)} style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid #333", background: "transparent", color: "#ccc", cursor: "pointer" }}>›</button>
            <button type="button" onClick={() => setPreview(null)} style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid #333", background: "transparent", color: "#ccc", cursor: "pointer" }}>Închide</button>
          </div>
        </div>
      )}
    </div>
  );
}
