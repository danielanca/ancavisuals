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
  onDelivery: () => void;
}

export default function PrintSelectionGuide({ selecting, count, savedCount, hasPhotos, saving, saved, error, onStart, onSave, onDelivery }: Props) {
  const currentCount = selecting ? count : savedCount;
  return (
    <section className={styles.guide} aria-labelledby="print-invitation-title">
      <p className={styles.eyebrow}>Amintirile voastre, pe hârtie</p>
      <h2 id="print-invitation-title">Alegeți cele 100 de fotografii pentru imprimare</h2>
      <p>Alegeți momentele preferate din album. Vă ghidăm pas cu pas:</p>
      <ol>
        <li>Apăsați <strong>„{savedCount > 0 ? "Continuă selecția" : "Începe selecția"}”</strong>. Se activează selectarea fotografiilor.</li>
        <li><strong>Atingeți fotografiile dorite</strong> pentru a le bifa. Apăsați din nou pe o poză pentru a o debifa.</li>
        <li>Folosiți <strong>„Următorul ›”</strong> pentru celelalte pagini. Pozele bifate rămân selectate când schimbați pagina.</li>
        <li>Când ați ales cele 100 de poze, apăsați <strong>„Salvează selecția”</strong>. Fotograful va vedea selecția salvată.</li>
        <li>Apăsați <strong>„Completează adresa de livrare”</strong> pentru a ne spune unde trimitem fotografiile.</li>
      </ol>
      <p className={styles.progress} role="status">
        {currentCount} / 100 fotografii {selecting ? "selectate" : "salvate"}
        {currentCount < 100 && ` · Mai aveți de ales ${100 - currentCount}`}
        {currentCount > 100 && ` · Ați ales cu ${currentCount - 100} peste cele 100 de poze`}
      </p>
      {!hasPhotos ? <p>Fotografiile nu sunt disponibile încă. Reveniți când albumul este încărcat.</p> : (
        <div className={styles.actions}>
          {selecting ? (
            <button type="button" onClick={onSave} disabled={saving}>
              {saving ? "Se salvează..." : `Salvează selecția (${count})`}
            </button>
          ) : (
            <button type="button" onClick={onStart}>{savedCount > 0 ? "Continuă selecția" : "Începe selecția"}</button>
          )}
          <button type="button" className={styles.secondary} onClick={onDelivery}>Completează adresa de livrare</button>
        </div>
      )}
      {selecting && <p className={styles.hint}>Bifarea pozelor nu le trimite fotografului. Apăsați „Salvează selecția” pentru a înregistra alegerea. Puteți salva și progresul intermediar.</p>}
      {saved && <p role="status" className={styles.success}>Selecția a fost salvată. Fotograful poate vedea cele {savedCount} de fotografii alese.{savedCount < 100 ? " Puteți continua până la 100 de poze." : ""}</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>
  );
}
