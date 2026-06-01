import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BunnyPhotoGallery from "../Portfolio/BunnyPhotoGallery";
import styles from "./MediaAlbumPage.module.scss";
import AncaLoader from "../../components/UI/AncaLoader";
import useAuth from "../../features/admin/auth/useAuth";
import AncaVisualsPromo from "./AncaVisualsPromo";
import { OFFER_SERVICES } from "../../../shared/offers/offerServices";

type SharePayload = {
  id: string;
  slug: string;
  count: number;
  expiresAt: number;
  showAll?: boolean;
  photos: string[];
};

type ImportModal = {
  mode: "instagram" | "assets";
  serviceId: string;
  importing: boolean;
  done: number;
  total: number;
  error: string | null;
} | null;

function fileNameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.split("/").pop()?.split("?")[0] ?? "photo.jpg";
  } catch {
    return url.split("?")[0].split("/").pop() ?? "photo.jpg";
  }
}

// Convert a CDN preview URL to the original-resolution path (strips token, converts photos_preview → photos, .webp → .jpg)
function toOriginalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname
      .replace("/photos_preview/", "/photos/")
      .replace(/\.webp$/i, ".jpg");
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return url.split("?")[0];
  }
}

export default function SharePage() {
  const { id } = useParams();
  const { auth } = useAuth();
  const [data, setData] = useState<SharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [importModal, setImportModal] = useState<ImportModal>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const res = await fetch(`/api/share/${id}`);
      if (res.status === 410) { setExpired(true); setLoading(false); return; }
      if (!res.ok) { setData(null); setLoading(false); return; }
      const json = await res.json();
      setData(json);
      setLoading(false);
    })();
  }, [id]);

  async function importToInstagram() {
    if (!data || !auth.accessToken) return;
    setImportModal(prev => prev ? { ...prev, importing: true, done: 0, error: null } : null);
    let done = 0;
    let errors = 0;
    for (const photoUrl of data.photos) {
      try {
        const originalUrl = toOriginalUrl(photoUrl);
        const response = await fetch("/api/instagram-proposals/", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
          body: JSON.stringify({
            albumSlug: data.slug,
            photoUrl: originalUrl,
            fileName: fileNameFromUrl(originalUrl),
            destinations: ["instagram"],
          }),
        });
        if (response.ok) done++; else errors++;
      } catch { errors++; }
      setImportModal(prev => prev ? { ...prev, done: done + errors } : null);
    }
    setImportModal(prev => prev ? {
      ...prev,
      importing: false,
      done,
      error: errors > 0 ? `${errors} poze cu eroare` : null,
    } : null);
  }

  async function importToMediaAssets(serviceId: string) {
    if (!data || !auth.accessToken) return;
    setImportModal(prev => prev ? { ...prev, importing: true, error: null } : null);
    try {
      const items = data.photos.map(url => {
        const originalUrl = toOriginalUrl(url);
        return { url: originalUrl, fileName: fileNameFromUrl(originalUrl) };
      });
      const response = await fetch("/api/oferte/admin/media-assets/import-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ items, serviceId, sourceAlbumSlug: data.slug }),
      });
      const result = await response.json() as { assets?: unknown[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Import eșuat.");
      setImportModal(prev => prev ? { ...prev, importing: false, done: (result.assets ?? []).length } : null);
    } catch (err) {
      setImportModal(prev => prev ? { ...prev, importing: false, error: err instanceof Error ? err.message : String(err) } : null);
    }
  }

  function openImportModal(mode: "instagram" | "assets") {
    setImportModal({
      mode,
      serviceId: OFFER_SERVICES[0]?.id ?? "photo",
      importing: false,
      done: 0,
      total: data?.count ?? 0,
      error: null,
    });
  }

  if (loading) return <AncaLoader />;
  if (expired)
    return (
      <div className={styles.page}>
        <div className={styles.container}>Link expirat.</div>
      </div>
    );
  if (!data)
    return (
      <div className={styles.page}>
        <div className={styles.container}>Link invalid.</div>
      </div>
    );

  const isAdminView = auth.authorise;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>
          {data.showAll ? "Album foto" : "Selecție foto"}
        </h1>
        <p className={styles.meta}>{data.count} fotografii</p>
        <div className={styles.divider} />

        {/* Share CTA — prominent, above photos */}
        <div style={{
          margin: "0 0 24px",
          padding: "18px 20px",
          background: "linear-gradient(135deg, #0a1a0a, #0d1f0d)",
          border: "1px solid #166534",
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}>
          <div>
            <p style={{ color: "#4ade80", fontSize: "14px", fontWeight: 700, margin: "0 0 4px", letterSpacing: "0.01em" }}>
              📤 Trimite și tu pozele mai departe
            </p>
            <p style={{ color: "#555", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>
              Dă linkul prietenilor și familiei — direct din telefon, prin WhatsApp, SMS sau email.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator.share === "function") {
                void navigator.share({ title: "Poze eveniment — Anca Visuals", url: window.location.href });
              } else {
                void navigator.clipboard.writeText(window.location.href).then(() => {
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2500);
                });
              }
            }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "14px 20px",
              background: "#25D366",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.01em",
              boxShadow: "0 4px 20px rgba(37,211,102,0.25)",
            }}
          >
            {typeof navigator !== "undefined" && typeof (navigator as { share?: unknown }).share === "function"
              ? "📤 Trimite prin WhatsApp / SMS / Email..."
              : linkCopied ? "✓ Link copiat!" : "📋 Copiază linkul"}
          </button>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              readOnly
              value={typeof window !== "undefined" ? window.location.href : ""}
              style={{ flex: 1, minWidth: 0, padding: "8px 12px", background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: "6px", color: "#555", fontSize: "12px", outline: "none", fontFamily: "monospace" }}
              onClick={(event) => (event.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href).then(() => {
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2500);
                });
              }}
              style={{ padding: "8px 14px", background: linkCopied ? "#166534" : "#1a1a1a", border: `1px solid ${linkCopied ? "#166534" : "#333"}`, borderRadius: "6px", color: linkCopied ? "#4ade80" : "#aaa", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s", flexShrink: 0 }}
            >
              {linkCopied ? "✓ Copiat" : "Copiază"}
            </button>
          </div>
        </div>

        <div className={styles.actions}>
          <a className={styles.downloadBtn} href={`/api/share/${data.id}/download`}>
            Descarcă pozele
          </a>
        </div>

        {/* Admin bar — only visible when logged in as admin */}
        {isAdminView && (
          <div className="mx-auto mb-6 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="text-[11px] text-neutral-600 font-medium uppercase tracking-widest shrink-0">Admin</span>
            <div className="h-4 w-px bg-neutral-800 shrink-0" />
            <button
              type="button"
              onClick={() => openImportModal("instagram")}
              className="flex items-center gap-1.5 rounded-lg border border-fuchsia-900/60 bg-fuchsia-950/40 px-3 py-1.5 text-xs font-medium text-fuchsia-300 hover:border-fuchsia-700 hover:bg-fuchsia-900/40 transition-colors"
            >
              <span>→</span>
              <span>Propuneri Instagram</span>
              <span className="rounded-full bg-fuchsia-900/60 px-1.5 py-0.5 text-[10px] font-bold">{data.count}</span>
            </button>
            <button
              type="button"
              onClick={() => openImportModal("assets")}
              className="flex items-center gap-1.5 rounded-lg border border-teal-900/60 bg-teal-950/40 px-3 py-1.5 text-xs font-medium text-teal-300 hover:border-teal-700 hover:bg-teal-900/40 transition-colors"
            >
              <span>→</span>
              <span>Media Assets</span>
              <span className="rounded-full bg-teal-900/60 px-1.5 py-0.5 text-[10px] font-bold">{data.count}</span>
            </button>
          </div>
        )}

        <BunnyPhotoGallery orgPhoto={data.photos} photos={data.photos} variant="plain" />

        {/* Re-share nudge before promo */}
        <div style={{ margin: "32px 0 0", padding: "16px 20px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", textAlign: "center" }}>
          <p style={{ color: "#555", fontSize: "12px", margin: 0 }}>Ți-au plăcut pozele? Trimite-le și altora!</p>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator.share === "function") {
                void navigator.share({ title: "Poze eveniment — Anca Visuals", url: window.location.href });
              } else {
                void navigator.clipboard.writeText(window.location.href).then(() => {
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2500);
                });
              }
            }}
            style={{ padding: "10px 24px", background: "#25D366", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
          >
            📤 Trimite mai departe
          </button>
        </div>
      </div>

      <AncaVisualsPromo />

      {/* Import modal */}
      {importModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(event) => { if (event.target === event.currentTarget && !importModal.importing) setImportModal(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-5">
            {/* Header */}
            <div>
              <p className="text-[11px] uppercase tracking-widest text-neutral-600 mb-1">
                {importModal.mode === "instagram" ? "Propuneri Instagram" : "Media Assets"}
              </p>
              <h2 className="text-white font-medium text-base">
                Importă {importModal.total} {importModal.total === 1 ? "poză" : "poze"}
              </h2>
              <p className="text-xs text-neutral-500 mt-1">Album: <span className="text-neutral-300">{data.slug}</span></p>
            </div>

            {/* Service picker — only for assets */}
            {importModal.mode === "assets" && (
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-500">Serviciu</label>
                <select
                  value={importModal.serviceId}
                  onChange={(event) => setImportModal(prev => prev ? { ...prev, serviceId: event.target.value } : null)}
                  disabled={importModal.importing}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neutral-500"
                >
                  {OFFER_SERVICES.map(service => (
                    <option key={service.id} value={service.id}>{service.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Progress */}
            {importModal.importing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>Se importă...</span>
                  <span>{importModal.done}/{importModal.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${importModal.mode === "instagram" ? "bg-fuchsia-500" : "bg-teal-500"}`}
                    style={{ width: `${importModal.total > 0 ? (importModal.done / importModal.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Result */}
            {!importModal.importing && importModal.done > 0 && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${importModal.error ? "border-amber-800 bg-amber-900/20 text-amber-300" : "border-green-800 bg-green-900/20 text-green-300"}`}>
                {importModal.mode === "instagram"
                  ? `${importModal.done} poze adăugate în Propuneri Instagram.`
                  : `${importModal.done} poze importate în Media Assets.`}
                {importModal.error && <span className="text-amber-400 ml-1">({importModal.error})</span>}
              </div>
            )}

            {importModal.error && importModal.done === 0 && (
              <p className="text-xs text-red-400">{importModal.error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setImportModal(null)}
                disabled={importModal.importing}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500 disabled:opacity-40"
              >
                {importModal.done > 0 ? "Închide" : "Anulează"}
              </button>
              {!importModal.done && (
                <button
                  type="button"
                  disabled={importModal.importing}
                  onClick={() => importModal.mode === "instagram" ? void importToInstagram() : void importToMediaAssets(importModal.serviceId)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:bg-neutral-700 disabled:text-neutral-500 ${
                    importModal.mode === "instagram"
                      ? "bg-fuchsia-700 hover:bg-fuchsia-600"
                      : "bg-teal-700 hover:bg-teal-600"
                  }`}
                >
                  {importModal.importing ? "Se importă..." : `Importă (${importModal.total})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
