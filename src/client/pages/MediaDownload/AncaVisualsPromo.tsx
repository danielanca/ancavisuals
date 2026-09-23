import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import PhotoLightbox from "./PhotoLightbox";
import PhoneNumberReveal from "../../components/PhoneReveal/PhoneNumberReveal";
import RetryImage from "../../components/UI/RetryImage";

const PROMO_PHONE = "0745469907";
const PROMO_PHONE_DISPLAY = "0745 469 907";

const compactPhoneBtnStyle: CSSProperties = {
  flex: "1 1 180px",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "14px 16px",
  background: "#c9a96e",
  border: "1px solid #c9a96e",
  color: "#0a0a0a",
  borderRadius: "3px",
  textDecoration: "none",
  fontSize: "11px",
  letterSpacing: "1.5px",
  textTransform: "uppercase" as const,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const fullPhoneBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: "100%",
  padding: "15px 24px",
  background: "#c9a96e",
  color: "#0a0a0a",
  border: "none",
  borderRadius: "3px",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "2.5px",
  textTransform: "uppercase" as const,
  cursor: "pointer",
  fontFamily: "inherit",
};

interface AncaVisualsPromoProps {
  compact?: boolean;
}

const STRIP_SIZE = 18;
const STRIP_ROTATE_MS = 10000;

export default function AncaVisualsPromo({ compact = false }: AncaVisualsPromoProps) {
  const [showcasePhotos, setShowcasePhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  // La fiecare 10s, fâșia de sus arată alte 18 poze din pool — cu efect de
  // mozaic (fiecare pătrat apare cu propria întârziere), nu un fade uniform.
  const [stripTick, setStripTick] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (compact) return;
    fetch("/api/showcase-zones/media_footer")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { photos?: string[] } | null) => {
        if (data?.photos?.length) setShowcasePhotos(data.photos);
      })
      .catch(() => {});
  }, [compact]);

  const stripTickRef = useRef(0);
  useEffect(() => { stripTickRef.current = stripTick; }, [stripTick]);

  useEffect(() => {
    if (compact || isMobile || showcasePhotos.length <= STRIP_SIZE) return;
    let cancelled = false;
    const interval = window.setInterval(() => {
      const nextTick = stripTickRef.current + 1;
      const nextUrls = Array.from(
        { length: STRIP_SIZE },
        (_, i) => showcasePhotos[(i + nextTick * STRIP_SIZE) % showcasePhotos.length],
      );
      // Preîncarcă lotul următor în fundal — abia când pozele chiar au sosit
      // (sau după cel mult 3s, ca un lot cu o poză căzută să nu blocheze la
      // nesfârșit rotația) trecem efectiv la el, ca mozaicul să nu apară gol.
      Promise.race([
        Promise.all(nextUrls.map((url) => new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        }))),
        new Promise<void>((resolve) => window.setTimeout(resolve, 3000)),
      ]).then(() => {
        if (!cancelled) setStripTick(nextTick);
      });
    }, STRIP_ROTATE_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [compact, isMobile, showcasePhotos]);

  const dropBrokenPhoto = (url: string) => {
    setShowcasePhotos((prev) => prev.filter((p) => p !== url));
  };

  const stripPhotos = useMemo(() => {
    if (showcasePhotos.length === 0) return [];
    return Array.from(
      { length: STRIP_SIZE },
      (_, i) => showcasePhotos[(i + stripTick * STRIP_SIZE) % showcasePhotos.length],
    );
  }, [showcasePhotos, stripTick]);

  const galleryColumns = useMemo(() => {
    const columns: Array<Array<{ url: string; index: number }>> = [[], []];
    showcasePhotos.forEach((url, index) => {
      columns[index % 2].push({ url, index });
    });
    return columns;
  }, [showcasePhotos]);

  if (compact) {
    return (
      <section style={{ background: "#0a0a0a", padding: "48px 24px 56px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", maxWidth: "680px", margin: "0 auto" }}>
          <a
            href={`https://wa.me/40${PROMO_PHONE.slice(1)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: "1 1 180px", display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 16px", background: "#25D366", border: "1px solid #25D366", color: "#fff", borderRadius: "3px", textDecoration: "none", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 700 }}
          >
            WhatsApp
          </a>
          <PhoneNumberReveal
            phone={PROMO_PHONE}
            display={PROMO_PHONE_DISPLAY}
            revealedPrefix="Call — "
            buttonLabel="AFIȘEAZĂ NUMĂRUL"
            context="media promo compact"
            style={compactPhoneBtnStyle}
          />
        </div>
      </section>
    );
  }

  return (
    <>
      {lightboxIndex !== null && showcasePhotos.length > 0 && (
        <PhotoLightbox
          photos={showcasePhotos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNext={() => setLightboxIndex((prev) => (prev !== null ? Math.min(showcasePhotos.length - 1, prev + 1) : 0))}
          onPrev={() => setLightboxIndex((prev) => (prev !== null ? Math.max(0, prev - 1) : 0))}
        />
      )}

      <div id="media-promo-zone" style={{ background: "#0a0a0a", marginTop: "48px" }}>
        {/* Gold divider */}
        <div style={{ height: "2px", background: "linear-gradient(90deg, transparent 0%, #c9a96e 20%, #e8c97a 50%, #c9a96e 80%, transparent 100%)" }} />

        {/* Photo strip — desktop only, se reînnoiește la fiecare 10s cu efect de mozaic */}
        {!isMobile && stripPhotos.length > 0 && (
          <>
            <style>{`
              @keyframes mediaPromoMosaicIn {
                0% { opacity: 0; transform: scale(1.15); filter: blur(8px) saturate(1.5); }
                60% { opacity: 1; filter: blur(0) saturate(1.2); }
                100% { opacity: 0.75; transform: scale(1); filter: blur(0) saturate(1); }
              }
            `}</style>
            <div style={{ display: "flex", gap: "3px", flexWrap: "nowrap", padding: 0, overflow: "hidden" }}>
              {stripPhotos.map((url, i) => (
                <div key={`${i}-${stripTick}`} style={{ flex: "1 1 0", minWidth: 0, aspectRatio: "1 / 1", overflow: "hidden" }}>
                  <RetryImage
                    src={url}
                    alt=""
                    style={{
                      width: "100%", height: "100%", objectFit: "cover", display: "block",
                      // Totul într-un singur shorthand — "animation" + "animationDelay"
                      // separate se anulau reciproc (browserul le combină pe una singură
                      // și întârzierea individuală se pierdea, rămânând blocată la 0).
                      // Ordinea întârzierilor e pseudo-aleatorie, ca pătratele să nu
                      // apară strict de la stânga la dreapta — mai aproape de un mozaic.
                      animation: `mediaPromoMosaicIn 700ms ease ${(i * 137) % 650}ms 1 normal both`,
                    }}
                    // Fâșia se reînnoiește la fiecare 10s — poze noi, neîncărcate încă
                    // de browser, deci "lazy" ar întârzia inutil apariția lor.
                    loading="eager"
                    context="media_footer promo strip"
                    onGiveUp={dropBrokenPhoto}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Content */}
        <div style={{ maxWidth: "680px", margin: "0 auto", textAlign: "center", padding: "56px 24px 64px" }}>
          <div style={{ width: "36px", height: "1px", background: "#c9a96e", margin: "0 auto 28px", opacity: 0.6 }} />

          <p style={{ color: "#c9a96e", fontSize: "10px", letterSpacing: "5px", textTransform: "uppercase", margin: "0 0 22px", fontWeight: 500 }}>
            Anca Visuals
          </p>

          <h2 style={{ color: "#f0ebe0", fontSize: "clamp(20px, 4vw, 30px)", fontWeight: 300, margin: "0 0 16px", lineHeight: 1.35, letterSpacing: "0.3px" }}>
            <span style={{ textTransform: "uppercase", fontWeight: 500 }}>Foto &amp; Video</span> pentru<br />momentele tale autentice
          </h2>

          <p style={{ color: "#555", fontSize: "13px", margin: "0 0 10px", lineHeight: 1.7 }}>
            Creăm amintiri fără vârstă prin arta fotografiei autentice.
          </p>

          <p style={{ color: "#c9a96e", fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", margin: "0 0 40px", opacity: 0.7 }}>
            Nuntă · Botez · Majorat · Fotocabină · Videobooth 360°
          </p>

          <div style={{ width: "36px", height: "1px", background: "#c9a96e", margin: "0 auto 40px", opacity: 0.25 }} />

          {showcasePhotos.length > 0 && (
            <div style={{ margin: "0 0 40px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", alignItems: "start", textAlign: "left" }}>
                {galleryColumns.map((column, columnIndex) => (
                  <div key={columnIndex} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {column.map(({ url, index }) => (
                      <div key={url} style={{ overflow: "hidden", borderRadius: "6px", background: "#111" }}>
                        <RetryImage
                          src={url}
                          alt=""
                          style={{ width: "100%", height: "auto", objectFit: "cover", opacity: 0.85, display: "block", cursor: "pointer" }}
                          loading="lazy"
                          context="media_footer promo grid"
                          onClick={() => setLightboxIndex(index)}
                          onGiveUp={dropBrokenPhoto}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "300px", margin: "0 auto" }}>
            <PhoneNumberReveal
              phone={PROMO_PHONE}
              display={PROMO_PHONE_DISPLAY}
              revealedPrefix="Sună — "
              context="media promo full"
              style={fullPhoneBtnStyle}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <a
                href={`https://wa.me/40${PROMO_PHONE.slice(1)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
                  padding: "13px 16px",
                  background: "#25D366",
                  border: "none",
                  color: "#fff",
                  borderRadius: "3px",
                  textDecoration: "none",
                  fontSize: "11px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.523 5.849L0 24l6.335-1.483A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.371l-.36-.213-3.728.872.933-3.636-.234-.374A9.818 9.818 0 1112 21.818z"/></svg>
                WhatsApp
              </a>
              <a
                href="https://instagram.com/ancavisuals"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
                  padding: "13px 16px",
                  background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                  border: "none",
                  color: "#fff",
                  borderRadius: "3px",
                  textDecoration: "none",
                  fontSize: "11px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                Instagram
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
