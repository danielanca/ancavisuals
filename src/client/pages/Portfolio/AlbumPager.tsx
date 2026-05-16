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
  mobileColumns?: 1 | 2;
  onMobileColumnsChange?: (columns: 1 | 2) => void;
  "data-onboarding"?: string;
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
  mobileColumns,
  onMobileColumnsChange,
  "data-onboarding": dataOnboarding,
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
    const number = Number(value);
    if (!Number.isFinite(number)) {
      setValue(String(currentPage));
      return;
    }
    const clamped = Math.min(Math.max(1, Math.floor(number)), totalPages);
    setValue(String(clamped));
    onGoTo(clamped);
  };

  return (
    <div className={styles.bar} data-onboarding={dataOnboarding}>
      <div className={styles.row}>
        <div className={styles.left}>
          <button className={styles.btn} type="button" onClick={onFirst} disabled={disabled || currentPage <= 1} data-onboarding="pager-first">
            <span className={styles.icon} aria-hidden="true">«</span>
            <span className={styles.label}>Primul</span>
          </button>

          <button className={styles.btn} type="button" onClick={onPrev} disabled={disabled || currentPage <= 1} data-onboarding="pager-prev">
            <span className={styles.icon} aria-hidden="true">‹</span>
            <span className={styles.label}>Anterior</span>
          </button>
        </div>

        <div className={styles.pg} data-onboarding="pager-input">
          <span className={styles.pgLabel}>Pagina</span>
          <input
            className={styles.pgInput}
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ""))}
            onKeyDown={(event) => {
              if (event.key === "Enter") go();
            }}
            onBlur={go}
            disabled={disabled}
            aria-label="Mergi la pagina"
          />
          <span className={styles.pgTotal}>/ {totalPages}</span>
        </div>

        <div className={styles.right}>
          <button className={styles.btn} type="button" onClick={onNext} disabled={disabled || currentPage >= totalPages} data-onboarding="pager-next">
            <span className={styles.label}>Următorul</span>
            <span className={styles.icon} aria-hidden="true">›</span>
          </button>

          <button className={styles.btn} type="button" onClick={onLast} disabled={disabled || currentPage >= totalPages} data-onboarding="pager-last">
            <span className={styles.label}>Ultimul</span>
            <span className={styles.icon} aria-hidden="true">»</span>
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

        {onMobileColumnsChange && (
          <div className={styles.gridToggle}>
            <button
              className={`${styles.gridBtn} ${mobileColumns === 1 ? styles.gridBtnActive : ''}`}
              type="button"
              onClick={() => onMobileColumnsChange(1)}
              aria-label="1 coloană"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
            <button
              className={`${styles.gridBtn} ${mobileColumns === 2 ? styles.gridBtnActive : ''}`}
              type="button"
              onClick={() => onMobileColumnsChange(2)}
              aria-label="2 coloane"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="4" width="8" height="16" rx="2" />
                <rect x="13" y="4" width="8" height="16" rx="2" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}