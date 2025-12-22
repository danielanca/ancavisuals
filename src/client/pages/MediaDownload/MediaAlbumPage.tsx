import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import BunnyPhotoGallery from "../Portfolio/BunnyPhotoGallery";
import styles from "./MediaAlbumPage.module.scss";
import type { Album } from "./AlbumTypes";
import AlbumNotFound from "./AlbumNotFound";
import AlbumPager from "../Portfolio/AlbumPager";

type AlbumWithPrint = Album & {
  print?: string[];
};

type PersistedStateV1 = {
  v: 1;
  mode: "none" | "print" | "download";
  printPage: number;
  selectedPrint: string[];
  selectedDownload: string[];
};

type PersistedStateV2 = {
  v: 2;
  mode: "none" | "print" | "download";
  printPage: number;
  downloadPage: number;
  selectedPrint: string[];
  selectedDownload: string[];
};

type PersistedStateV3 = {
  v: 3;
  mode: "none" | "print" | "download";
  browsePage: number;
  printPage: number;
  downloadPage: number;
  selectedPrint: string[];
  selectedDownload: string[];
};

const isMobileNow = () => (typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false);

const storageKeyFor = (slug: string) => `av:album:${slug}:state`;

const safeParse = (raw: string | null) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedStateV1 | PersistedStateV2 | PersistedStateV3;
  } catch {
    return null;
  }
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const fmtBytes = (n: number) => {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${u[i]}`;
};
const fileNameFromUrl = (src: string) => {
  const p = new URL(src).pathname;
  const last = p.split("/").pop() || "";
  return decodeURIComponent(last);
};

const getPathFromSignedUrl = (signedUrl: string) => new URL(signedUrl).pathname.replace(/^\/+/, "");

const buildDownloadUrl = (signedUrl: string, name: string) => {
  const path = getPathFromSignedUrl(signedUrl);
  return `/api/download?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}`;
};

export default function MediaAlbumPage() {
  const { slug } = useParams();

  const [album, setAlbum] = useState<AlbumWithPrint | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"none" | "print" | "download">("none");
  const [selectedPrint, setSelectedPrint] = useState<Set<string>>(new Set());
  const [selectedDownload, setSelectedDownload] = useState<Set<string>>(new Set());

  const [savingPrint, setSavingPrint] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(isMobileNow());

  const [browsePage, setBrowsePage] = useState(1);
  const [printPage, setPrintPage] = useState(1);
  const [downloadPage, setDownloadPage] = useState(1);

  const photosTopRef = useRef<HTMLDivElement | null>(null);
  const shareBoxRef = useRef<HTMLDivElement | null>(null);

  const hydratedRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);

  const [stats, setStats] = useState<null | {
  photosCount: number;
  photosBytesTotal: number;
  shortVideoBytes: number;
  longVideoBytes: number;
  bytesTotalAll: number;
}>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
  if (!slug) return;

  fetch(`/api/album/${slug}/stats`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => setStats(d))
    .catch(() => setStats(null));
}, [slug]);

  const downloadAllPhotos = () => {
    if (!slug) return;
    if (!album?.photos?.length) return;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/api/album/${slug}/download-all`;

    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  const emptySelected = useMemo(() => new Set<string>(), []);
  const activeSelected = mode === "print" ? selectedPrint : mode === "download" ? selectedDownload : emptySelected;

  const totalPhotos = album?.photos?.length ?? 0;
  const pageSize = isMobile ? 36 : 50;
  const totalPages = Math.max(1, Math.ceil(totalPhotos / pageSize));

  const activePage = mode === "download" ? downloadPage : mode === "print" ? printPage : browsePage;
  const safePage = clamp(activePage, 1, totalPages);

  useEffect(() => {
    if (mode === "download") {
      if (downloadPage !== safePage) setDownloadPage(safePage);
      return;
    }
    if (mode === "print") {
      if (printPage !== safePage) setPrintPage(safePage);
      return;
    }
    if (browsePage !== safePage) setBrowsePage(safePage);
  }, [mode, downloadPage, printPage, browsePage, safePage]);

  const pagePhotos = useMemo(() => {
    if (!album?.photos?.length) return [];
    const start = (safePage - 1) * pageSize;
    return album.photos.slice(start, start + pageSize);
  }, [album?.photos, safePage, pageSize]);

  useEffect(() => {
    photosTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [safePage]);

  useEffect(() => {
    if (!shareUrl) return;
    shareBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [shareUrl]);

  const pageNames = useMemo(() => pagePhotos.map(fileNameFromUrl), [pagePhotos]);

  const allOnPageSelected = mode !== "none" && pageNames.length > 0 && pageNames.every(n => activeSelected.has(n));

  const setPage = (updater: (p: number) => number) => {
    if (mode === "download") setDownloadPage(p => updater(p));
    else if (mode === "print") setPrintPage(p => updater(p));
    else setBrowsePage(p => updater(p));
  };

  const toggleSelectPage = () => {
    if (mode === "print") {
      setSelectedPrint(prev => {
        const next = new Set(prev);
        if (allOnPageSelected) pageNames.forEach(n => next.delete(n));
        else pageNames.forEach(n => next.add(n));
        return next;
      });
      return;
    }

    if (mode === "download") {
      setSelectedDownload(prev => {
        const next = new Set(prev);
        if (allOnPageSelected) pageNames.forEach(n => next.delete(n));
        else pageNames.forEach(n => next.add(n));
        return next;
      });
    }
  };

  useEffect(() => {
    if (!slug) return;
    if (typeof window === "undefined") return;

    hydratedRef.current = false;

    const raw = window.localStorage.getItem(storageKeyFor(slug));
    const data = safeParse(raw);

    const apply = (next: {
      mode: "none" | "print" | "download";
      browsePage: number;
      printPage: number;
      downloadPage: number;
      selectedPrint: string[];
      selectedDownload: string[];
    }) => {
      setMode(next.mode);
      setBrowsePage(next.browsePage);
      setPrintPage(next.printPage);
      setDownloadPage(next.downloadPage);
      setSelectedPrint(new Set(next.selectedPrint));
      setSelectedDownload(new Set(next.selectedDownload));
      setShareUrl(null);
      setShareError(null);
      hydratedRef.current = true;
    };

    if (data?.v === 3) {
      apply({
        mode: data.mode || "none",
        browsePage: Number.isFinite(data.browsePage) && data.browsePage > 0 ? data.browsePage : 1,
        printPage: Number.isFinite(data.printPage) && data.printPage > 0 ? data.printPage : 1,
        downloadPage: Number.isFinite(data.downloadPage) && data.downloadPage > 0 ? data.downloadPage : 1,
        selectedPrint: Array.isArray(data.selectedPrint) ? data.selectedPrint : [],
        selectedDownload: Array.isArray(data.selectedDownload) ? data.selectedDownload : [],
      });
      return;
    }

    if (data?.v === 2) {
      const p = Number.isFinite(data.printPage) && data.printPage > 0 ? data.printPage : 1;
      const d = Number.isFinite(data.downloadPage) && data.downloadPage > 0 ? data.downloadPage : 1;
      const fallbackBrowse = (data.mode === "download" ? d : p) || 1;

      apply({
        mode: data.mode || "none",
        browsePage: Number.isFinite(fallbackBrowse) && fallbackBrowse > 0 ? fallbackBrowse : 1,
        printPage: p,
        downloadPage: d,
        selectedPrint: Array.isArray(data.selectedPrint) ? data.selectedPrint : [],
        selectedDownload: Array.isArray(data.selectedDownload) ? data.selectedDownload : [],
      });
      return;
    }

    if (data?.v === 1) {
      const p = Number.isFinite(data.printPage) && data.printPage > 0 ? data.printPage : 1;

      apply({
        mode: data.mode || "none",
        browsePage: p,
        printPage: p,
        downloadPage: 1,
        selectedPrint: Array.isArray(data.selectedPrint) ? data.selectedPrint : [],
        selectedDownload: Array.isArray(data.selectedDownload) ? data.selectedDownload : [],
      });
      return;
    }

    apply({
      mode: "none",
      browsePage: 1,
      printPage: 1,
      downloadPage: 1,
      selectedPrint: [],
      selectedDownload: [],
    });
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    if (typeof window === "undefined") return;
    if (!hydratedRef.current) return;

    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);

    persistTimerRef.current = window.setTimeout(() => {
      const payload: PersistedStateV3 = {
        v: 3,
        mode,
        browsePage,
        printPage,
        downloadPage,
        selectedPrint: Array.from(selectedPrint),
        selectedDownload: Array.from(selectedDownload),
      };

      try {
        window.localStorage.setItem(storageKeyFor(slug), JSON.stringify(payload));
      } catch {}
    }, 120);

    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    };
  }, [slug, mode, browsePage, printPage, downloadPage, selectedPrint, selectedDownload]);

  const openPrintMode = () => {
    const initial = new Set<string>((album?.print ?? []).map(fileNameFromUrl));
    setSelectedPrint(initial);
    setShareUrl(null);
    setShareError(null);
    setPrintPage(safePage);
    setMode("print");
  };

  const openDownloadMode = () => {
    setSelectedDownload(new Set());
    setShareUrl(null);
    setShareError(null);
    setDownloadPage(safePage);
    setMode("download");
  };

  const closeMode = () => {
    setShareUrl(null);
    setShareError(null);
    setBrowsePage(safePage);
    setMode("none");
  };

  const togglePhoto = (src: string) => {
    const name = fileNameFromUrl(src);

    if (mode === "print") {
      setSelectedPrint(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
      return;
    }

    if (mode === "download") {
      setSelectedDownload(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
    }
  };

  const savePrintSelection = async () => {
    if (!slug) return;

    setSavingPrint(true);

    try {
      const res = await fetch(`/api/album/${slug}/print-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: Array.from(selectedPrint) }),
      });

      if (!res.ok) return;

      const refreshed = await fetch(`/api/album/${slug}`).then(r => r.json());
      setAlbum(refreshed);
      setMode("none");
    } finally {
      setSavingPrint(false);
    }
  };

  const downloadSelected = () => {
    if (!slug) return;
    if (selectedDownload.size === 0) return;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/api/album/${slug}/download-selected`;

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "items";
    input.value = JSON.stringify(Array.from(selectedDownload));

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  const createShareLink = async () => {
    if (!slug) return;
    if (selectedDownload.size === 0) return;

    setCreatingShare(true);
    setShareUrl(null);
    setShareError(null);

    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, items: Array.from(selectedDownload) }),
      });

      const text = await res.text().catch(() => "");

      if (!res.ok) {
        setShareError(`Share failed (${res.status})`);
        return;
      }

      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        setShareError("Share response invalid");
        return;
      }

      if (!data?.id) {
        setShareError("Share id missing");
        return;
      }

      const url = `${window.location.origin}/share/${data.id}`;
      setShareUrl(url);

      try {
        await navigator.clipboard.writeText(url);
      } catch {}
    } finally {
      setCreatingShare(false);
    }
  };

  const printCount = useMemo(() => album?.print?.length ?? 0, [album?.print]);

  useEffect(() => {
    if (!slug) return;

    (async () => {
      const res = await fetch(`/api/album/${slug}`);
      if (!res.ok) {
        setAlbum(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setAlbum(data);
      setLoading(false);
    })();
  }, [slug]);

  if (loading)
    return (
      <div className={styles.page}>
        <div className={styles.container}>Se încarcă...</div>
      </div>
    );

  if (!album) return <AlbumNotFound />;

  const galleryPhotos = pagePhotos;
  const downloadCount = selectedDownload.size;
  const modeLabel = mode === "print" ? "IMPRIMARE" : mode === "download" ? "SHARE/DESCĂRCARE" : "";

  return (
    <div className={styles.page}>
      <div className={styles.container}>
       

        {mode !== "none" && (
          <div className={styles.modeBanner} role="status" aria-live="polite">
            EȘTI ÎN MODUL {modeLabel}. Finalizează selecția sau apasă „Închide”.
          </div>
        )}

        <h1 className={styles.title}>{album.title}</h1>

        <p className={styles.meta}>
          {album.photos?.length ?? 0} fotografii
          {album.shortvideo ? " · video scurt" : ""}
          {album.longvideo ? " · film complet" : ""}
        </p>

        <div className={styles.divider} />

        {album.featured?.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Selectate</h2>
            <BunnyPhotoGallery photos={album.featured} variant="plain" />
          </>
        )}

        {album.photos?.length > 0 && (
          <>
            <div className={styles.sectionRow} ref={photosTopRef}>
              <h2 className={styles.sectionTitle}>Fotografii ({album.photos.length})</h2>

              {mode === "none" ? (
                <div className={styles.rowActions}>
                  <button className={styles.pickBtn} type="button" onClick={openPrintMode}>
                    Alege pozele pentru imprimare
                  </button>

                  <button className={styles.pickBtnSecondary} type="button" onClick={openDownloadMode}>
                    Selectează poze
                  </button>
                    <button className={styles.pickBtnSecondary} type="button" onClick={downloadAllPhotos}>
                {"DESCARCĂ TOATE POZELE" + (stats ? ` (${fmtBytes(stats.photosBytesTotal)})` : "")}
                </button>
                </div>
                
              ) : (
                <div className={styles.rowActions}>
                  <button className={styles.pickBtnSecondary} type="button" onClick={closeMode}>
                    Închide
                  </button>

                  {mode === "print" ? (
                    <button
                      className={styles.pickBtn}
                      type="button"
                      onClick={savePrintSelection}
                      disabled={savingPrint}
                    >
                      {savingPrint ? "Se salvează..." : "Salvează selecția"}
                    </button>
                  ) : (
                    <>
                      <button
                        className={styles.pickBtn}
                        type="button"
                        onClick={downloadSelected}
                        disabled={downloadCount === 0}
                      >
                        Descarcă selecția
                      </button>

                      <button
                        className={styles.pickBtnSecondary}
                        type="button"
                        onClick={createShareLink}
                        disabled={creatingShare || downloadCount === 0}
                      >
                        {creatingShare ? "Se creează..." : `Creează link share (${downloadCount})`}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {mode === "download" && (shareUrl || shareError) && (
              <div ref={shareBoxRef} className={styles.shareBox}>
                <div className={styles.shareTitle}>Link de share</div>

                {shareError ? (
                  <div className={styles.shareError}>{shareError}</div>
                ) : (
                  <div className={styles.shareRow}>
                    <input className={styles.shareInput} value={shareUrl ?? ""} readOnly />
                    <button
                      className={styles.shareBtn}
                      type="button"
                      onClick={async () => {
                        if (!shareUrl) return;
                        try {
                          await navigator.clipboard.writeText(shareUrl);
                        } catch {}
                      }}
                      disabled={!shareUrl}
                    >
                      Copy
                    </button>
                    <button
                      className={styles.shareBtn}
                      type="button"
                      onClick={async () => {
                        if (!shareUrl) return;
                        const nav: any = navigator;
                        if (!nav.share) return;
                        try {
                          await nav.share({ url: shareUrl });
                        } catch {}
                      }}
                      disabled={!shareUrl}
                    >
                      Share
                    </button>
                  </div>
                )}
              </div>
            )}

            <AlbumPager
              mode={mode}
              currentPage={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalPhotos}
              shownCount={galleryPhotos.length}
              allOnPageSelected={allOnPageSelected}
              onFirst={() => setPage(() => 1)}
              onPrev={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(totalPages, p + 1))}
              onLast={() => setPage(() => totalPages)}
              onGoTo={p => setPage(() => p)}
              onToggleSelectPage={toggleSelectPage}
            />

            <div className={styles.photosScroller}>
              <BunnyPhotoGallery
                photos={galleryPhotos}
                variant="plain"
                selectable={mode !== "none"}
                selected={activeSelected}
                getKey={fileNameFromUrl}
                onToggle={togglePhoto}
              />
            </div>
          </>
        )}

        <div className={mode !== "none" ? styles.dimmedArea : undefined} aria-disabled={mode !== "none"}>
          <div className={styles.sectionRow}>
            <h2 className={styles.sectionTitle}>Poze de imprimat{printCount ? ` (${printCount})` : ""}</h2>

            {mode === "none" && (
              <button className={styles.pickBtn} type="button" onClick={openPrintMode}>
                Alege pozele pentru imprimare
              </button>
            )}
          </div>

          {printCount > 0 ? (
            <BunnyPhotoGallery photos={album.print as string[]} variant="plain" />
          ) : (
            <p className={styles.emptyPrint}>Nu ai selectat încă poze pentru imprimat.</p>
          )}

          {album.shortvideo && (
            <>
              <h2 className={styles.sectionTitle}>Video scurt</h2>

              <div className={styles.mediaCenter}>
                <div className={styles.videoWrap}>
                  <video className={styles.video} controls playsInline preload="metadata" src={album.shortvideo} />
                </div>
              </div>

              <div className={styles.actions}>
                <a
                  className={styles.downloadBtn}
                  href={buildDownloadUrl(album.shortvideo, `${album.slug}-film-scurt.mp4`)}
                >
                  {"DESCARCĂ VIDEO" + (stats?.shortVideoBytes ? ` (${fmtBytes(stats.shortVideoBytes)})` : "")}

                </a>
              </div>
            </>
          )}

          {album.longvideo && (
            <>
              <h2 className={styles.sectionTitle}>Film complet</h2>

              <div className={styles.mediaCenter}>
                <div className={styles.videoWrap}>
                  <video className={styles.video} controls playsInline preload="metadata" src={album.longvideo} />
                </div>
              </div>

              <div className={styles.actions}>
                <a
                  className={styles.downloadBtn}
                  href={buildDownloadUrl(album.longvideo, `${album.slug}-film-complet.mp4`)}
                >
                  {"DESCARCĂ FILMUL COMPLET" + (stats?.longVideoBytes ? ` (${fmtBytes(stats.longVideoBytes)})` : "")}

                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
