import { useEffect, useMemo, useState } from "react";
import styles from "./AlbumPager.module.scss";

type Props = {
  mode: "none" | "print" | "download";
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  shownCount: number;
  allOnPageSelected: boolean;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onGoTo: (page: number) => void;
  onToggleSelectPage: () => void;
};

export default function AlbumPager({
  mode,
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  shownCount,
  allOnPageSelected,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onGoTo,
  onToggleSelectPage,
}: Props) {
  const [value, setValue] = useState(String(currentPage));

  useEffect(() => {
    setValue(String(currentPage));
  }, [currentPage]);

  const disabled = totalPages <= 1;

  const info = useMemo(() => {
    const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min((currentPage - 1) * pageSize + shownCount, totalItems);
    return `${start}-${end} din ${totalItems}`;
  }, [currentPage, pageSize, shownCount, totalItems]);

  const go = () => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      setValue(String(currentPage));
      return;
    }
    const clamped = Math.min(Math.max(1, Math.floor(n)), totalPages);
    setValue(String(clamped));
    onGoTo(clamped);
  };

  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        <div className={styles.left}>
          <button className={styles.btn} type="button" onClick={onFirst} disabled={disabled || currentPage <= 1}>
            <span className={styles.icon} aria-hidden="true">
              «
            </span>
            <span className={styles.label}>Primul</span>
          </button>

          <button className={styles.btn} type="button" onClick={onPrev} disabled={disabled || currentPage <= 1}>
            <span className={styles.icon} aria-hidden="true">
              ‹
            </span>
            <span className={styles.label}>Anterior</span>
          </button>
        </div>

        <div className={styles.pg}>
          <span className={styles.pgLabel}>Pagina</span>
          <input
            className={styles.pgInput}
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={e => setValue(e.target.value.replace(/[^\d]/g, ""))}
            onKeyDown={e => {
              if (e.key === "Enter") go();
            }}
            onBlur={go}
            disabled={disabled}
            aria-label="Mergi la pagina"
          />
          <span className={styles.pgTotal}>/ {totalPages}</span>
        </div>

        <div className={styles.right}>
          <button
            className={styles.btn}
            type="button"
            onClick={onNext}
            disabled={disabled || currentPage >= totalPages}
          >
            <span className={styles.label}>Următorul</span>
            <span className={styles.icon} aria-hidden="true">
              ›
            </span>
          </button>

          <button
            className={styles.btn}
            type="button"
            onClick={onLast}
            disabled={disabled || currentPage >= totalPages}
          >
            <span className={styles.label}>Ultimul</span>
            <span className={styles.icon} aria-hidden="true">
              »
            </span>
          </button>
        </div>
      </div>

      <div className={styles.row2}>
        {mode !== "none" && (
          <button className={styles.btnGhost} type="button" onClick={onToggleSelectPage}>
            {allOnPageSelected ? "Deselectează pagina" : "Selectează pagina"}
          </button>
        )}

        <div className={styles.meta}>
          <span className={styles.metaStrong}>{info}</span>
        </div>
      </div>
    </div>
  );
}
