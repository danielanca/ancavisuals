import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useParams,useSearchParams } from "react-router-dom";
import BunnyPhotoGallery from "../Portfolio/BunnyPhotoGallery";
import styles from "./MediaAlbumPage.module.scss";
import type { Album } from "./AlbumTypes";
import AlbumNotFound from "./AlbumNotFound";
import AlbumPager from "../Portfolio/AlbumPager";
import DeliveryForm from './DeliveryForm';
import DeliveryAddressModal from "../DeliveryAddress/AddressList";

type AlbumWithPrint = Album & {
  print?: string[];
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
    return JSON.parse(raw) as PersistedStateV3;
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

const getSwissUrl = async (slug: string) => {
const res = await fetch(`/api/album/${slug}/delivery-address`);

if(res.ok){
  if (!res.ok) throw new Error('Failed to load address');
        
  const json = await res.json();
 return json.data.swissLink;
}
return "";
};

export default function MediaAlbumPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page") ?? "1");

  const [album, setAlbum] = useState<AlbumWithPrint | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"none" | "print" | "download">("none");
  const [selectedPrint, setSelectedPrint] = useState<Set<string>>(new Set());
  const [selectedDownload, setSelectedDownload] = useState<Set<string>>(new Set());

  const [savingPrint, setSavingPrint] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  // Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [showAdminButton, setShowAdminButton] = useState(false);

  const [isMobile, setIsMobile] = useState(isMobileNow());

  const [browsePage, setBrowsePage] = useState(1);
  const [printPage, setPrintPage] = useState(1);
  const [downloadPage, setDownloadPage] = useState(1);

  const photosTopRef = useRef<HTMLDivElement | null>(null);
  const shareBoxRef = useRef<HTMLDivElement | null>(null);

  const hydratedRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);

  const dimTapCountRef = useRef(0);
  const dimTapTimerRef = useRef<number | null>(null);

  const [stats, setStats] = useState<null | {
    photosCount: number;
    photosBytesTotal: number;
    shortVideoBytes: number;
    longVideoBytes: number;
    bytesTotalAll: number;
  }>(null);



  //SwissTransfer

  // Near other useState calls
const [downloadClickCount, setDownloadClickCount] = useState(0);
const [showUrlModal, setShowUrlModal] = useState(false);
const [customUrl, setCustomUrl] = useState("");           // ← value in the input
const clickTimeoutRef = useRef<number | null>(null);

const [swissLink, setSwissLink] = useState<string | null>(null);
const [swissLoading, setSwissLoading] = useState(true);



  //Delivery Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Încarcă starea admin din localStorage la mount
  useEffect(() => {
    if (!slug) return;
    const savedKey = localStorage.getItem(`adminKey_${slug}`);
    if (savedKey) {
      setAdminKey(savedKey);
      setIsAdmin(true);
    }
  }, [slug]);

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

  useEffect(() => {
    if (!slug) return;
  
    let cancelled = false;
  
    (async () => {
      try {
        setSwissLoading(true);
        const url = await getSwissUrl(slug);
        if (!cancelled) setSwissLink(url || null);
      } catch (err) {
        console.error("Failed to load swiss link", err);
        if (!cancelled) setSwissLink(null);
      } finally {
        if (!cancelled) setSwissLoading(false);
      }
    })();
  
    return () => { cancelled = true; };
  }, [slug]);

  const downloadAllPhotos = () => {
    if (!slug || !album?.photos?.length) return;
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

  const activePage = mode === "download" ? downloadPage : mode === "print" ? printPage : pageFromUrl;
  const safePage = clamp(activePage, 1, totalPages);

  useEffect(() => {
    if (mode === "download") setDownloadPage(safePage);
    else if (mode === "print") setPrintPage(safePage);
    else setBrowsePage(safePage);
  }, [mode, safePage]);

  const pagePhotos = useMemo(() => {
    if (!album?.photos?.length) return [];
    const start = (safePage - 1) * pageSize;
    return album.photos.slice(start, start + pageSize);
  }, [album?.photos, safePage, pageSize]);

  const galleryPhotos = pagePhotos;

  const originalByName = useMemo(() => {
    const m = new Map<string, string>();
    (album?.originalPhoto ?? []).forEach((u) => m.set(fileNameFromUrl(u), u));
    return m;
  }, [album?.originalPhoto]);

  const galleryOrgPhotos = useMemo(() => {
    if (!galleryPhotos.length) return [];
    if (!album?.originalPhoto?.length) return galleryPhotos;
    return galleryPhotos.map((u) => originalByName.get(fileNameFromUrl(u)) ?? u);
  }, [galleryPhotos, album?.originalPhoto, originalByName]);

  const featuredOrgPhotos = useMemo(() => {
    const featured = album?.featured ?? [];
    if (!featured.length) return [];
    if (!album?.originalPhoto?.length) return featured;
    return featured.map((u) => originalByName.get(fileNameFromUrl(u)) ?? u);
  }, [album?.featured, album?.originalPhoto, originalByName]);

  useEffect(() => {
    photosTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [safePage]);

  useEffect(() => {
    if (shareUrl) shareBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [shareUrl]);

  const pageNames = useMemo(() => pagePhotos.map(fileNameFromUrl), [pagePhotos]);
  const allOnPageSelected = mode !== "none" && pageNames.length > 0 && pageNames.every((n) => activeSelected.has(n));

  const setPage = (updater: (p: number) => number) => {
    const nextPage = updater(safePage);

    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("page", String(nextPage));
        return p;
      },
      { replace: false } // 👈 important: keeps browser history
    );

    if (mode === "download") setDownloadPage(updater);
    else if (mode === "print") setPrintPage(updater);
   // else setBrowsePage(updater);
  };
  

  const toggleSelectPage = () => {
    if (mode === "print") {
      setSelectedPrint((prev) => {
        const next = new Set(prev);
        if (allOnPageSelected) pageNames.forEach((n) => next.delete(n));
        else pageNames.forEach((n) => next.add(n));
        return next;
      });
    } else if (mode === "download") {
      setSelectedDownload((prev) => {
        const next = new Set(prev);
        if (allOnPageSelected) pageNames.forEach((n) => next.delete(n));
        else pageNames.forEach((n) => next.add(n));
        return next;
      });
    }
  };

  // Hydration & persistence
  useEffect(() => {
    if (!slug || typeof window === "undefined") return;
    hydratedRef.current = false;

    const raw = window.localStorage.getItem(storageKeyFor(slug));
    const data = safeParse(raw);

    const apply = (next: Partial<PersistedStateV3 & { mode: "none" | "print" | "download" }>) => {
      setMode(next.mode ?? "none");
      setBrowsePage(next.browsePage ?? 1);
      setPrintPage(next.printPage ?? 1);
      setDownloadPage(next.downloadPage ?? 1);
      setSelectedPrint(new Set(next.selectedPrint ?? []));
      setSelectedDownload(new Set(next.selectedDownload ?? []));
      setShareUrl(null);
      setShareError(null);
      hydratedRef.current = true;
    };

    if (data?.v === 3) apply(data);
    else apply({ mode: "none", browsePage: 1, printPage: 1, downloadPage: 1, selectedPrint: [], selectedDownload: [] });
  }, [slug]);

  useEffect(() => {
    if (!slug || typeof window === "undefined" || !hydratedRef.current) return;

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

  const onDimmedTap = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (mode === "none") return;

    const el = e.target as HTMLElement | null;
    if (!el) return;

    dimTapCountRef.current += 1;

    if (dimTapTimerRef.current) window.clearTimeout(dimTapTimerRef.current);
    dimTapTimerRef.current = window.setTimeout(() => {
      dimTapCountRef.current = 0;
      dimTapTimerRef.current = null;
    }, 1200);

    if (dimTapCountRef.current >= 3) {
      dimTapCountRef.current = 0;
      if (dimTapTimerRef.current) window.clearTimeout(dimTapTimerRef.current);
      dimTapTimerRef.current = null;
      closeMode();
    }
  };

  const togglePhoto = (src: string) => {
    const name = fileNameFromUrl(src);
    if (mode === "print") {
      setSelectedPrint((prev) => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
    } else if (mode === "download") {
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
    try {
      const res = await fetch(`/api/album/${slug}/print-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: Array.from(selectedPrint) }),
      });
      if (res.ok) {
        const refreshed = await fetch(`/api/album/${slug}`).then((r) => r.json());
        setAlbum(refreshed);
        setMode("none");
      }
    } finally {
      setSavingPrint(false);
    }
  };

  // Ștergere din lista de imprimare (oricui)
  const removeFromPrint = async (fileName: string) => {
    if (!album || !slug) return;

    const newPrintUrls = (album.print ?? []).filter((url) => fileNameFromUrl(url) !== fileName);
    const newPrintNames = newPrintUrls.map(fileNameFromUrl);

    setAlbum((prev) => (prev ? { ...prev, print: newPrintUrls } : null));

    try {
      await fetch(`/api/album/${slug}/print-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: newPrintNames }),
      });
    } catch {
      const refreshed = await fetch(`/api/album/${slug}`).then((r) => r.json());
      setAlbum(refreshed);
    }
  };

  // Resetare totală imprimare (oricui)
  const resetAllPrint = async () => {
    if (!album || !slug || !window.confirm("Sigur vrei să elimini TOATE pozele din selecția de imprimare?")) return;

    setAlbum((prev) => (prev ? { ...prev, print: [] } : null));

    try {
      await fetch(`/api/album/${slug}/print-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      });
    } catch {
      const refreshed = await fetch(`/api/album/${slug}`).then((r) => r.json());
      setAlbum(refreshed);
    }
  };

  // Ștergere DEFINITIVĂ (doar admin)
  const deletePhoto = async (signedUrl: string) => {
    if (!slug || !isAdmin) return;

    const fileName = fileNameFromUrl(signedUrl);

    if (
      !window.confirm(
        `ȘTERGI DEFINITIV POZA:\n\n"${fileName}"\n\n` +
          `• Fișierul va fi șters fizic de pe server\n` +
          `• Va dispărea din toate secțiunile\n` +
          `• Acțiunea este IREVERSEBILĂ!\n\n` +
          `Confirmi?`
      )
    )
      return;

    try {
      const res = await fetch(`/api/album/${slug}/delete-photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ filename: fileName }),
      });

      if (res.ok) {
        const updatedAlbum = await res.json();
        setAlbum(updatedAlbum);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Acces interzis sau eroare la ștergere.");
        // Opțional: deconectare automată dacă cheia e invalidă
        setIsAdmin(false);
        setAdminKey("");
        localStorage.removeItem(`adminKey_${slug}`);
      }
    } catch (err) {
      alert("Eroare de conexiune.");
    }
  };

  const downloadSelected = () => {
    if (!slug || selectedDownload.size === 0) return;
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

  const downloadPrintDynamic = () => {
    if (!slug || !printCount) return;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/api/album/${slug}/download-print-dynamic`;
    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  const createShareLink = async () => {
    if (!slug || selectedDownload.size === 0) return;
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
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        setShareError("Invalid response");
        return;
      }
      if (!data?.id) {
        setShareError("Missing id");
        return;
      }
      const url = `${window.location.origin}/share/${data.id}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
    } finally {
      setCreatingShare(false);
    }
  };

const setDownloadLink = () => {
  getSwissUrl(slug!);
  setShowUrlModal(true);
  }


  const saveLink = async () => {
      const url = customUrl.trim();
      try {
         const res = await fetch(`/api/album/${slug}/swisslink`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
            link : url,
           }),
         });
         console.log(res);

         if (res.ok) {
          setShowUrlModal(false);
         }
   
       } catch (err) {
         console.error(err);
       } finally {
        // setIsSubmitting(false);
       }
  
  }

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

  if (loading) return <div className={styles.page}><div className={styles.container}>Se încarcă...</div></div>;
  if (!album) return <AlbumNotFound />;

  const downloadCount = selectedDownload.size;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Buton admin care apare doar după 10 click-uri pe titlu */}
        {showAdminButton && !isAdmin && (
          <div className={styles.adminTempButton}>
            <button
              className={styles.adminTempBtn}
              onClick={() => {
                const input = prompt("Introdu parola pentru acces admin:");
                if (input === "ankvisuals1994") {
                  setAdminKey(input);
                  setIsAdmin(true);
                  localStorage.setItem(`adminKey_${slug}`, input);
                  alert("🛡️ Acces admin activat! Butoanele de ștergere definitivă sunt acum vizibile.");
                  window.location.reload();
                } else if (input !== null) {
                  alert("Parolă incorectă.");
                }
              }}
            >
              🔑 Acces administrare
            </button>
          </div>
        )}

        {/* Titlul cu 10 click-uri pentru a afișa butonul admin */}
        <h1
          className={styles.title}
          style={{ cursor: "pointer" }}
          onClick={() => {
            // Inițializăm contorul
            if (!(window as any).adminClickCount) {
              (window as any).adminClickCount = 0;
              (window as any).adminClickTimeout = null;
            }

            (window as any).adminClickCount++;

            // Reset contor dacă trec >3 sec între click-uri
            if ((window as any).adminClickTimeout) clearTimeout((window as any).adminClickTimeout);
            (window as any).adminClickTimeout = setTimeout(() => {
              (window as any).adminClickCount = 0;
            }, 3000);

            // La 10 click-uri → toggle admin
            if ((window as any).adminClickCount >= 10) {
              if (isAdmin) {
                // Ești deja admin → deconectare
                setIsAdmin(false);
                setAdminKey("");
                localStorage.removeItem(`adminKey_${slug}`);
                alert("🔓 Mod admin dezactivat.");
                window.location.reload();
              } else {
                // Nu ești admin → afișăm butonul de login
                setShowAdminButton(true);
                alert("🔓 Butonul de acces admin a apărut mai sus!");
              }
              (window as any).adminClickCount = 0;
            }
          }}
        >
          {album.title}
        </h1>

        <p className={styles.meta}>
          {album.photos?.length ?? 0} fotografii
          {album.shortvideo ? " · video scurt" : ""}
          {album.longvideo ? " · film complet" : ""}
        </p>

        <div className={styles.actionButtons}>
  <button 
    className={`${styles.btn} ${styles.btnOutline} ${styles.fillAction}`}
    onClick={() => setIsFormOpen(true)}
  >
    Adresa de livrare a completării
  </button>

  <button 
    className={`${styles.btn} ${styles.btnOutline} ${styles.viewAction}`}
    onClick={() => setShowDeliveryModal(true)}
  >
    Vezi adresa de livrare
  </button>

</div>

<div className={styles.actionButtons}>
{ isAdmin && (
<button  type="button" className={`${styles.btn} ${styles.btnOutline} ${styles.fillAction}`}// ← add your own class if you want different style
        onClick={setDownloadLink} >
      Add Swiss Transfer Link
      </button>
)
    
}
</div>

        {isFormOpen && (
        <DeliveryForm
          albumId={slug || "hello"}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            setIsFormOpen(false);
            // optional: show toast "Address saved"
          }}
        />
      )}

{showDeliveryModal && (
  <DeliveryAddressModal
    slug={slug || ""}
    isOpen={showDeliveryModal}
    onClose={() => setShowDeliveryModal(false)}
  />
)}


{showUrlModal && (
  <div 
    className={styles.modalOverlay}
    onClick={() => setShowUrlModal(false)}
  >
    <div 
      className={styles.urlModal}
      onClick={e => e.stopPropagation()}
    >
      <div className={styles.modalHeader}>
        <h3>Custom Download Link</h3>
        <button 
          className={styles.closeBtn}
          onClick={() => setShowUrlModal(false)}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className={styles.modalBody}>
        <p className={styles.modalHint}>
          Paste or edit the direct download link:
        </p>

        <input
          type="url"
          value={customUrl}
          onChange={e => setCustomUrl(e.target.value)}
          placeholder="https://example.com/file.mp4"
          className={styles.urlInput}
          autoFocus
        />

        <div className={styles.modalFooter}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => setShowUrlModal(false)}
          >
            Cancel
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={saveLink}
            disabled={!customUrl.trim()}
          >
            Save Link
          </button>
        </div>
      </div>
    </div>
  </div>
)}

        <div className={styles.divider} />

        {album.featured?.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Selectate</h2>
            <BunnyPhotoGallery orgPhoto={featuredOrgPhotos} photos={album.featured} variant="plain" />
          </>
        )}

        {album.photos?.length > 0 && (
          <>
            <div className={styles.sectionRow} ref={photosTopRef}>
              <h2 className={styles.sectionTitle}>Fotografii ({album.photos.length})</h2>

              {mode === "none" ? (
                <div className={styles.rowActions}>
                  {totalPhotos > 0 && (
                    <button className={styles.pickBtn} type="button" onClick={openPrintMode}>
                      Modifică selecția pentru imprimare
                    </button>
                  )}
                  <button className={styles.pickBtnSecondary} type="button" onClick={openDownloadMode}>
                    Selectează poze pentru descărcare
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
                    <button className={styles.pickBtn} type="button" onClick={savePrintSelection} disabled={savingPrint}>
                      {savingPrint ? "Se salvează..." : `Salvează selecția (${selectedPrint.size})`}
                    </button>
                  ) : (
                    <>
                      <button className={styles.pickBtn} type="button" onClick={downloadSelected} disabled={downloadCount === 0}>
                        Descarcă selecția
                      </button>
                      <button className={styles.pickBtnSecondary} type="button" onClick={createShareLink} disabled={creatingShare || downloadCount === 0}>
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
                {shareError ? <div className={styles.shareError}>{shareError}</div> : (
                  <div className={styles.shareRow}>
                    <input className={styles.shareInput} value={shareUrl ?? ""} readOnly />
                    <button className={styles.shareBtn} type="button" onClick={() => navigator.clipboard.writeText(shareUrl!)}>Copy</button>
                    <button className={styles.shareBtn} type="button" onClick={() => (navigator as any).share?.({ url: shareUrl })}>Share</button>
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
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              onLast={() => setPage(() => totalPages)}
              onGoTo={(p) => setPage(() => p)}
              onToggleSelectPage={toggleSelectPage}
            />

            {/* Galeria principală – cu grid manual pentru admin */}
            <div className={styles.photosScroller}>
              {isAdmin && mode === "none" ? (
                <div className={styles.adminGalleryGrid}>
                  {galleryPhotos.map((src) => {
                    const fileName = fileNameFromUrl(src);
                    return (
                      <div key={src} className={styles.adminPhotoWrapper}>
                        <img
                          src={src}
                          alt={fileName}
                          className={styles.adminPhotoImg}
                          loading="lazy"
                        />
                        <button
                          className={styles.deletePhotoBtn}
                          onClick={() => deletePhoto(src)}
                          aria-label="Șterge definitiv"
                          title="Șterge definitiv din album"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <BunnyPhotoGallery
                  key={`${slug}:${safePage}`}
                  photos={galleryPhotos}
                  orgPhoto={galleryOrgPhotos}
                  variant="plain"
                  selectable={mode !== "none"}
                  selected={activeSelected}
                  getKey={fileNameFromUrl}
                  onToggle={togglePhoto}
                />
              )}
            </div>
          </>
        )}

        <div className={mode !== "none" ? styles.dimmedArea : undefined} onPointerDown={onDimmedTap}>
          <div className={styles.sectionRow}>
            <h2 className={styles.sectionTitle}>Poze de imprimat{printCount ? ` (${printCount})` : ""}</h2>

            <div className={styles.rowActions}>
              {totalPhotos > 0 && (
                <button className={styles.pickBtn} type="button" onClick={openPrintMode}>
                  Modifică selecția pentru imprimare
                </button>
              )}

              {printCount > 0 && (
                <button type="button" className={styles.resetAllPrintBtn} onClick={resetAllPrint}>
                  Resetează toate pozele pentru imprimare
                </button>
              )}
            </div>
          </div>

          {printCount > 0 ? (
            <div className={styles.printPhotosGrid}>
              {album.print!.map((src) => {
                const fileName = fileNameFromUrl(src);
                return (
                  <div key={src} className={styles.printPhotoWrapper}>
                    <img
                      src={src}
                      alt={`Poză pentru imprimare: ${fileName}`}
                      className={styles.printPhotoImg}
                      loading="lazy"
                    />
                    <button
                      className={styles.removePrintBtn}
                      onClick={() => removeFromPrint(fileName)}
                      aria-label={`Elimină ${fileName} din lista de imprimare`}
                      title="Elimină din lista de imprimare"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyPrint}>Nu ai selectat încă poze pentru imprimat.</p>
          )}
          {printCount > 0 && (
            <button
              type="button"
              className={styles.pickBtnSecondary}
              onClick={downloadPrintDynamic}
            >
              Descarcă pozele pentru imprimare
            </button>
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
                <a className={styles.downloadBtn} href={swissLink!}>
                  {"DESCARCĂ VIDEO" + (stats?.shortVideoBytes ? ` (${fmtBytes(stats.shortVideoBytes)})` : "")}
                </a>
              </div>
            </>
          )}

          {swissLink && (
            <>
              <h2 className={styles.sectionTitle}>Film complet</h2>
              <div className={styles.mediaCenter}>
                <div className={styles.videoWrap}>
                <img src="https://img.youtube.com/vi/sA8VXDYePwA/maxresdefault.jpg" alt="Static video frame"className={styles.video}/>
  </div>
              </div>
              <div className={styles.actions}>
                <a className={styles.downloadBtn} href={swissLink!}>
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
