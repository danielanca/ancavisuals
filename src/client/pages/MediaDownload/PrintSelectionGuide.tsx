import styles from "./PrintSelectionGuide.module.scss";

export const printSelectionPath = (slug: string) => `/media/${encodeURIComponent(slug)}?select=print`;

interface Props {
  selecting: boolean;
  count: number;
  savedCount: number;
  hasPhotos: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onStart: () => void;
  onSave: () => void;
  notifying: boolean;
  notified: boolean;
  /** Photographer already told: "Am terminat" stays locked until this time (ms), max once / 24 h. */
  notifiedUntil?: number | null;
  onNotify: () => void;
  onDelivery: () => void;
}

const formatUnlock = (ms: number) =>
  new Date(ms).toLocaleString("ro-RO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function PrintSelectionGuide({ selecting, count, savedCount, hasPhotos, saving, saved, error, onStart, onSave, notifying, notified, notifiedUntil = null, onNotify, onDelivery }: Props) {
  const currentCount = selecting ? count : savedCount;
  const locked = notifiedUntil !== null && notifiedUntil > Date.now();
  return (
    <section className={styles.guide} aria-labelledby="print-invitation-title">
      <p className={styles.eyebrow}>Amintirile voastre, pe hârtie</p>
      <h2 id="print-invitation-title">Alegeți cele 100 de fotografii pentru imprimare</h2>
      <div className={styles.albumNote}>
        <p>📖 <strong>Aveți album tipărit în contract?</strong> Pozele alese aici intră în albumul vostru. Câte alegeți depinde de tipul albumului:</p>
        <ul>
          <li><strong>Album tip cutie</strong>: până la 100 de poze</li>
          <li><strong>Fotocarte</strong>: în jur de 32 de poze</li>
        </ul>
      </div>
      <ol>
        <li>Bifați pozele preferate, pe oricâte pagini. Bifele rămân când schimbați pagina.</li>
        <li>Apăsați <strong>„Salvează selecția”</strong>. Puteți salva și pe parcurs.</li>
        <li>La final, apăsați <strong>„Am terminat”</strong> ca să-l anunțăm pe fotograf.</li>
      </ol>
      <div className={styles.progressRow}>
        <p className={styles.progress} role="status">
          {currentCount} / 100 {selecting ? "selectate" : "salvate"}
          {currentCount < 100 && <span className={styles.progressHint}> · mai aveți {100 - currentCount}</span>}
          {currentCount > 100 && <span className={styles.progressHint}> · cu {currentCount - 100} peste 100</span>}
        </p>
        <div className={styles.bar} aria-hidden><div style={{ width: `${Math.min(100, currentCount)}%` }} /></div>
      </div>
      {!hasPhotos ? <p>Fotografiile nu sunt disponibile încă. Reveniți când albumul este încărcat.</p> : (
        <div className={styles.actions}>
          {selecting ? (
            <button type="button" onClick={onSave} disabled={saving}>
              {saving ? "Se salvează..." : `Salvează selecția (${count})`}
            </button>
          ) : (
            <button type="button" onClick={onStart}>{savedCount > 0 ? "Continuă selecția" : "Începe selecția"}</button>
          )}
          <button
            type="button"
            className={styles.done}
            onClick={onNotify}
            disabled={savedCount === 0 || notifying || notified || locked}
            title={savedCount === 0 ? "Salvați întâi selecția" : undefined}
          >
            {notified || locked ? "✓ Fotograful a fost anunțat" : notifying ? "Se trimite..." : "✓ Am terminat · anunță fotograful"}
          </button>
        </div>
      )}
      {hasPhotos && (
        <button type="button" className={styles.link} onClick={onDelivery}>Completează adresa de livrare</button>
      )}
      {selecting && <p className={styles.hint}>Bifarea nu trimite pozele fotografului: apăsați „Salvează selecția”.</p>}
      {saved && <p role="status" className={styles.success}>Selecția a fost salvată ({savedCount} poze).{savedCount > 0 && !notified ? " Când ați terminat, apăsați „Am terminat”." : ""}</p>}
      {(notified || locked) && (
        <p role="status" className={styles.success}>
          Fotograful a fost anunțat și va verifica selecția.
          {locked && notifiedUntil ? ` Îl poți anunța din nou după ${formatUnlock(notifiedUntil)}.` : ""}
        </p>
      )}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>
  );
}
