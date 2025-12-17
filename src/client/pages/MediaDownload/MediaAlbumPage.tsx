import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import BunnyPhotoGallery from "../Portfolio/BunnyPhotoGallery";
import styles from "./MediaAlbumPage.module.scss";
import type { Album } from "./AlbumTypes";
import AlbumNotFound from "./AlbumNotFound";


type AlbumWithPrint = Album & {
  print?: string[];
};

type PersistedState = {
  v: 1;
  mode: "none" | "print" | "download";
  printPage: number;
  selectedPrint: string[];
  selectedDownload: string[];
};

const isMobileNow = () =>
  typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false;

const storageKeyFor = (slug: string) => `av:album:${slug}:state`;

const safeParse = (raw: string | null) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
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

  const [isMobile, setIsMobile] = useState(isMobileNow());
  const [printPage, setPrintPage] = useState(1);
  const photosTopRef = useRef<HTMLDivElement | null>(null);

  const hydratedRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const fileNameFromUrl = (src: string) => {
    const p = new URL(src).pathname;
    const last = p.split("/").pop() || "";
    return decodeURIComponent(last);
  };

  const getPathFromSignedUrl = (signedUrl: string) =>
    new URL(signedUrl).pathname.replace(/^\/+/, "");

  const buildDownloadUrl = (signedUrl: string, name: string) => {
    const path = getPathFromSignedUrl(signedUrl);
    return `/api/download?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}`;
  };

  const activeSelected = mode === "print" ? selectedPrint : selectedDownload;

  const totalPhotos = album?.photos?.length ?? 0;
  const pageSize = isMobile ? 36 : 50;
  const totalPages = Math.max(1, Math.ceil(totalPhotos / pageSize));
  const safePrintPage = Math.min(Math.max(1, printPage), totalPages);

  useEffect(() => {
    if (printPage !== safePrintPage) setPrintPage(safePrintPage);
  }, [printPage, safePrintPage]);

  const printPagePhotos = useMemo(() => {
    if (!album?.photos?.length) return [];
    const start = (safePrintPage - 1) * pageSize;
    return album.photos.slice(start, start + pageSize);
  }, [album?.photos, safePrintPage, pageSize]);

  useEffect(() => {
    if (mode !== "print") return;
    photosTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [mode, safePrintPage]);

  const pageNames = useMemo(() => printPagePhotos.map(fileNameFromUrl), [printPagePhotos]);
  const allOnPageSelected =
    mode === "print" && pageNames.length > 0 && pageNames.every((n) => selectedPrint.has(n));

  const toggleSelectPage = () => {
    if (mode !== "print") return;
    setSelectedPrint((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageNames.forEach((n) => next.delete(n));
      else pageNames.forEach((n) => next.add(n));
      return next;
    });
  };

  useEffect(() => {
    if (!slug) return;
    if (typeof window === "undefined") return;

    hydratedRef.current = false;

    const raw = window.localStorage.getItem(storageKeyFor(slug));
    const data = safeParse(raw);

    if (data && data.v === 1) {
      setMode(data.mode || "none");
      setPrintPage(Number.isFinite(data.printPage) && data.printPage > 0 ? data.printPage : 1);
      setSelectedPrint(new Set(Array.isArray(data.selectedPrint) ? data.selectedPrint : []));
      setSelectedDownload(new Set(Array.isArray(data.selectedDownload) ? data.selectedDownload : []));
      setShareUrl(null);
    } else {
      setMode("none");
      setPrintPage(1);
      setSelectedPrint(new Set());
      setSelectedDownload(new Set());
      setShareUrl(null);
    }

    hydratedRef.current = true;
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    if (typeof window === "undefined") return;
    if (!hydratedRef.current) return;

    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);

    persistTimerRef.current = window.setTimeout(() => {
      const payload: PersistedState = {
        v: 1,
        mode,
        printPage: safePrintPage,
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
  }, [slug, mode, safePrintPage, selectedPrint, selectedDownload]);

  const openPrintMode = () => {
    const initial = new Set<string>((album?.print ?? []).map(fileNameFromUrl));
    setSelectedPrint(initial);
    setShareUrl(null);
    setPrintPage(1);
    setMode("print");
  };

  const openDownloadMode = () => {
    setSelectedDownload(new Set());
    setShareUrl(null);
    setMode("download");
  };

  const closeMode = () => {
    setShareUrl(null);
    setMode("none");
  };

  const clearSelection = () => {
    if (mode === "print") setSelectedPrint(new Set());
    if (mode === "download") setSelectedDownload(new Set());
  };

  const togglePhoto = (src: string) => {
    const name = fileNameFromUrl(src);

    if (mode === "print") {
      setSelectedPrint((prev) => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
      return;
    }

    if (mode === "download") {
      setSelectedDownload((prev) => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
    }
  };

  const savePrintSelection = async () => {
    if (!slug) return;

    setSavingPrint(true);

    const res = await fetch(`/api/album/${slug}/print-selection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: Array.from(selectedPrint) }),
    });

    setSavingPrint(false);
    if (!res.ok) return;

    const refreshed = await fetch(`/api/album/${slug}`).then((r) => r.json());
    setAlbum(refreshed);
    setMode("none");
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

    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, items: Array.from(selectedDownload) }),
    });

    setCreatingShare(false);
    if (!res.ok) return;

    const data = await res.json();
    const url = `${window.location.origin}/share/${data.id}`;
    setShareUrl(url);

    try {
      await navigator.clipboard.writeText(url);
    } catch {}
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

  if (!album)
    return (
      <AlbumNotFound />
    );

  const galleryPhotos = mode === "print" ? printPagePhotos : album.photos;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>{album.title}</h1>

        <p className={styles.meta}>
          {album.photos?.length ?? 0} fotografii
          {album.shortvideo ? " · video scurt" : ""}
          {album.longvideo ? " · film complet" : ""}
        </p>

        <div className={styles.divider} />

        {mode !== "none" && (
          <div className={styles.selectBanner}>
            <div className={styles.selectBannerLeft}>
              Ai selectat <span className={styles.selectStrong}>{activeSelected.size}</span>{" "}
              {mode === "print" ? "poze pentru imprimare" : "poze pentru descărcare"}
            </div>

            <div className={styles.selectBannerActions}>
              <button className={styles.bannerBtnSecondary} type="button" onClick={clearSelection}>
                Golește
              </button>

              <button className={styles.bannerBtnSecondary} type="button" onClick={closeMode}>
                Renunță
              </button>

              {mode === "print" ? (
                <button className={styles.bannerBtn} type="button" onClick={savePrintSelection} disabled={savingPrint}>
                  {savingPrint ? "Se salvează..." : "Salvează"}
                </button>
              ) : (
                <>
                  <button
                    className={styles.bannerBtnSecondary}
                    type="button"
                    onClick={createShareLink}
                    disabled={creatingShare}
                  >
                    {creatingShare ? "Se creează..." : "Creează link de share"}
                  </button>

                  <button className={styles.bannerBtn} type="button" onClick={downloadSelected}>
                    Descarcă selecția
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {shareUrl && (
          <div className={styles.shareBox}>
            <div className={styles.shareTitle}>Link de share</div>
            <div className={styles.shareRow}>
              <input className={styles.shareInput} value={shareUrl} readOnly />
              <button
                className={styles.shareBtn}
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                  } catch {}
                }}
              >
                Copy
              </button>
              <button
                className={styles.shareBtn}
                type="button"
                onClick={async () => {
                  const nav: any = navigator;
                  if (!nav.share) return;
                  try {
                    await nav.share({ url: shareUrl });
                  } catch {}
                }}
              >
                Share
              </button>
            </div>
          </div>
        )}

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
                    Selectează poze pentru descărcare
                  </button>
                </div>
              ) : (
                <div className={styles.pickHint}>{mode === "print" ? "Mod imprimare activ" : "Mod descărcare activ"}</div>
              )}
            </div>

            {mode === "print" && (
              <div className={styles.pager}>
                <button
                  className={styles.pagerBtn}
                  type="button"
                  onClick={() => setPrintPage((p) => Math.max(1, p - 1))}
                  disabled={safePrintPage <= 1}
                >
                  Înapoi
                </button>

                <div className={styles.pagerInfo}>
                  Pagina <strong>{safePrintPage}</strong> din <strong>{totalPages}</strong> · afișezi{" "}
                  <strong>{printPagePhotos.length}</strong> / <strong>{totalPhotos}</strong>
                </div>

                <button
                  className={styles.pagerBtn}
                  type="button"
                  onClick={() => setPrintPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePrintPage >= totalPages}
                >
                  Înainte
                </button>

                <button className={styles.pagerBtnGhost} type="button" onClick={toggleSelectPage}>
                  {allOnPageSelected ? "Deselectează pagina" : "Selectează pagina"}
                </button>
              </div>
            )}

            <BunnyPhotoGallery
              photos={galleryPhotos}
              variant="plain"
              selectable={mode !== "none"}
              selected={activeSelected}
              getKey={fileNameFromUrl}
              onToggle={togglePhoto}
            />

            {mode === "print" && totalPages > 1 && (
              <div className={styles.pagerBottom}>
                <button
                  className={styles.pagerBtn}
                  type="button"
                  onClick={() => setPrintPage((p) => Math.max(1, p - 1))}
                  disabled={safePrintPage <= 1}
                >
                  Înapoi
                </button>

                <div className={styles.pagerInfo}>
                  Pagina <strong>{safePrintPage}</strong> din <strong>{totalPages}</strong>
                </div>

                <button
                  className={styles.pagerBtn}
                  type="button"
                  onClick={() => setPrintPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePrintPage >= totalPages}
                >
                  Înainte
                </button>
              </div>
            )}
          </>
        )}

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
              <a className={styles.downloadBtn} href={buildDownloadUrl(album.shortvideo, `${album.slug}-film-scurt.mp4`)}>
                DESCARCĂ VIDEO
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
              <a className={styles.downloadBtn} href={buildDownloadUrl(album.longvideo, `${album.slug}-film-complet.mp4`)}>
                DESCARCĂ FILMUL COMPLET
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
