// PackageTiles.tsx
import React, { useMemo } from 'react';
import { PACKAGES_NEW, Pkg } from '../../packages';
import styles from './PackageTiles.module.scss';

type Props = {
  selected: string[]; // ex. ["photo"]
  onChange: (next: string[]) => void; // propagă în wizard
};

const fmtRON = (n: number) => n.toLocaleString('ro-RO');

export default function PackageTiles({ selected, onChange }: Props) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const total = useMemo(
    () => selected.reduce((sum, id) => sum + (PACKAGES_NEW.find(p => p.id === id)?.price || 0), 0),
    [selected]
  );

  return (
    <fieldset className={styles['pkg-tiles']}>
      <legend>Alege pachetul/pachetele</legend>

      <div className={styles.grid}>
        {PACKAGES_NEW.map(p => {
          const checked = selected.includes(p.id);
          const inputId = `pkg-${p.id}`;
          return (
            <div className={`${styles.tile} ${checked ? styles.checked : ''}`} key={p.id}>
              <input
                type='checkbox'
                id={inputId}
                name='packages'
                value={p.id}
                checked={checked}
                onChange={() => toggle(p.id)}
              />

              <label htmlFor={inputId}>
                <div className='title-row'>
                  <span className='title'>{p.title}</span>
                  {p.recommended && <span className='badge'>Recomandat</span>}
                </div>

                <div className='meta-row'>
                  <span className='price'>{fmtRON(p.price)} RON</span>
                </div>
              </label>

              {p.note && (
                <details className='expander'>
                  <summary>
                    <span className='label' data-closed='Arată-mi detalii' data-open='Ascunde detalii' />
                  </summary>
                  <div className='content'>{p.note}</div>
                </details>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.total}>
        <span>Preț estimativ:</span>
        <strong>{fmtRON(total)} RON</strong>
      </div>
    </fieldset>
  );
}
