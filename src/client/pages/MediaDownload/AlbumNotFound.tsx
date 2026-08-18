import React from "react";
import { useLocation, Link } from "react-router-dom";
import styles from "./AlbumNotFound.module.scss";

type Props = {
  title?: string;
  heading?: string;
  message?: string;
};

export default function AlbumNotFound({
  title = "404",
  heading,
  message,
}: Props) {
  const location = useLocation();
  const pathname = location?.pathname || "";

  // Check if user is at root with a single slug (e.g. /2martie2026 instead of /media/2martie2026)
  const isDirectSlug = !pathname.startsWith("/media/") && !pathname.startsWith("/qr-moments/") && pathname.length > 1;
  const cleanSlug = pathname.replace(/^\/+|\/+$/g, "");
  const suggestedMediaUrl = `/media/${cleanSlug}`;

  const isMediaRoute = pathname.startsWith("/media/");

  const whatsappMessage = encodeURIComponent(
    `Bună! Încerc să deschid linkul ancavisuals.ro${pathname}, dar nu găsesc albumul. Mă poți ajuta, te rog?`
  );

  return (
    <div className={styles.page}>
      <div className={styles.bubbles} aria-hidden="true" />
      <div className={styles.card} role="status" aria-live="polite">
        <div className={styles.badge}>{title} · Link negăsit</div>
        
        <h1 className={styles.heading}>
          {heading || (isMediaRoute ? "Albumul nu a fost găsit" : "Pagina nu a fost găsită")}
        </h1>
        
        <p className={styles.message}>
          {message || (
            isMediaRoute
              ? `Nu am găsit niciun album la adresa "${pathname}". Este posibil ca data sau numele din link să fie scrise greșit.`
              : `Adresa "${pathname}" nu există pe site.`
          )}
        </p>

        {isDirectSlug && (
          <div className={styles.suggestionBox}>
            <p className={styles.suggestionTitle}>
              <span>💡</span> Căutai un album foto-video?
            </p>
            <p className={styles.suggestionText}>
              Dacă ai încercat să accesezi un album de eveniment, adresa corectă include de obicei prefixul <code className={styles.urlCode}>/media/</code>:
            </p>
            <Link to={suggestedMediaUrl} className={styles.primary}>
              👉 Deschide {suggestedMediaUrl}
            </Link>
          </div>
        )}

        <div className={styles.tipBox}>
          <p className={styles.tipTitle}>Ce poți face:</p>
          <ul className={styles.tipList}>
            <li>Verifică dacă linkul primit pe WhatsApp sau Email este scris complet (ex: <code className={styles.urlCode}>ancavisuals.ro/media/nume-eveniment</code>).</li>
            <li>Dacă ai primit un link de la fotograf și nu funcționează, scrie-ne direct pe WhatsApp și ți-l trimitem imediat.</li>
          </ul>
        </div>

        <div className={styles.actions}>
          <a
            className={styles.whatsappBtn}
            href={`https://wa.me/40745469907?text=${whatsappMessage}`}
            target="_blank"
            rel="noreferrer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.115 1.527 5.845L.057 23.455a.5.5 0 00.614.614l5.61-1.47A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.896 0-3.673-.497-5.21-1.367l-.374-.218-3.878 1.016 1.016-3.878-.218-.374A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
            </svg>
            Scrie-ne pe WhatsApp
          </a>

          <a className={styles.callBtn} href="tel:+40745469907">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Sună la 0745 469 907
          </a>

          <a className={styles.secondary} href="/">
            Mergi pe ancavisuals.ro
          </a>
        </div>
      </div>
    </div>
  );
}
