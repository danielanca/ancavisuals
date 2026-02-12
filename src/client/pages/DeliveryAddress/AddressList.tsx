// src/client/components/DeliveryAddressModal.tsx  (or wherever you keep modals)

import { useState, useEffect } from 'react';
import styles from './AddressList.module.scss';

type Props = {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
};

type DeliveryAddress = {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  easybox?: string | null;
  deliveryAddressUpdatedAt?: number;
};

export default function DeliveryAddressModal({ slug, isOpen, onClose }: Props) {
  const [data, setData] = useState<DeliveryAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err: any) {
        setError(err.message || 'Could not load delivery information');
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
          <h2 className={styles.title}>Delivery Address Details</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading delivery details...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : !data || Object.keys(data).length === 0 ? (
            <div className={styles.empty}>
              No delivery address has been submitted for this album yet.
            </div>
          ) : (
            <div className={styles.addressView}>
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Recipient</h3>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Full Name</span>
                  <span className={styles.fieldValue}>{data.fullName}</span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Phone Number</span>
                  <span className={styles.fieldValue}>{data.phone}</span>
                </div>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Delivery Location</h3>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Street Address</span>
                  <span className={styles.fieldValue}>{data.street}</span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>City</span>
                  <span className={styles.fieldValue}>{data.city}</span>
                </div>
                {data.easybox && (
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Easybox LockerRoom</span>
                    <span className={`${styles.fieldValue} ${styles.mono}`}>
                      {data.easybox}
                    </span>
                    <span className={styles.note}>(locker pickup location)</span>
                  </div>
                )}
              </div>

              <div className={styles.footer}>
                <div className={styles.timestamp}>
                  Last updated: {formatDate(data.deliveryAddressUpdatedAt)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}