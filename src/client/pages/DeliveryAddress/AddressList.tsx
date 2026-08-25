// src/client/components/DeliveryAddressModal.tsx  (or wherever you keep modals)

import { useState, useEffect } from 'react';
import styles from './AddressList.module.scss';
import AncaLoader from '../../components/UI/AncaLoader';

type Props = {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
};

type DeliveryAddress = {
  fullName: string;
  phone: string;
  street: string;
  county?: string | null;
  city: string;
  easybox?: string | null;
  deliveryAddressUpdatedAt?: number;
};

export default function DeliveryAddressModal({ slug, isOpen, onClose }: Props) {
  const [data, setData] = useState<DeliveryAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return 'Nu s-au putut încărca informațiile de livrare';
  };

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/album/${slug}/delivery-address`);
        if (!res.ok) throw new Error('Failed to load address');
        
        const json = await res.json();
        setData(json.data?.deliveryAddress || null);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, slug]);

  if (!isOpen) return null;

  const formatDate = (ts?: number) =>
    ts ? new Date(ts).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Detalii adresă de livrare</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Închide">
            ×
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <AncaLoader variant="inline" />
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : !data || Object.keys(data).length === 0 ? (
            <div className={styles.empty}>
              Nu a fost încă trimisă nicio adresă de livrare pentru acest album.
            </div>
          ) : (
            <div className={styles.addressView}>
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Destinatar</h3>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Nume și prenume</span>
                  <span className={styles.fieldValue}>{data.fullName}</span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Număr de telefon</span>
                  <span className={styles.fieldValue}>{data.phone}</span>
                </div>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Loc de livrare</h3>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Adresă stradală</span>
                  <span className={styles.fieldValue}>{data.street}</span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Județ</span>
                  <span className={styles.fieldValue}>{data.county || '—'}</span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Oraș / Localitate</span>
                  <span className={styles.fieldValue}>{data.city}</span>
                </div>
                {data.easybox && (
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Easybox / Locker</span>
                    <span className={`${styles.fieldValue} ${styles.mono}`}>
                      {data.easybox}
                    </span>
                    <span className={styles.note}>(punct de ridicare locker)</span>
                  </div>
                )}
              </div>

              <div className={styles.footer}>
                <div className={styles.timestamp}>
                  Ultima actualizare: {formatDate(data.deliveryAddressUpdatedAt)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
