import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BunnyPhotoGallery from "../Portfolio/BunnyPhotoGallery";
import styles from "./MediaAlbumPage.module.scss";

type SharePayload = {
  id: string;
  slug: string;
  count: number;
  expiresAt: number;
  photos: string[];
};

export default function SharePage() {
  const { id } = useParams();
  const [data, setData] = useState<SharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!id) return;

    (async () => {
      const res = await fetch(`/api/share/${id}`);
      if (res.status === 410) {
        setExpired(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setData(null);
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
      setLoading(false);
    })();
  }, [id]);

  if (loading)
    return (
      <div className={styles.page}>
        <div className={styles.container}>Se încarcă...</div>
      </div>
    );
  if (expired)
    return (
      <div className={styles.page}>
        <div className={styles.container}>Link expirat.</div>
      </div>
    );
  if (!data)
    return (
      <div className={styles.page}>
        <div className={styles.container}>Link invalid.</div>
      </div>
    );

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Selecție foto</h1>
        <p className={styles.meta}>{data.count} fotografii</p>
        <div className={styles.divider} />

        <div className={styles.actions}>
          <a className={styles.downloadBtn} href={`/api/share/${data.id}/download`}>
            Descarcă selecția
          </a>
        </div>

        <BunnyPhotoGallery photos={data.photos} variant="plain" />
      </div>
    </div>
  );
}
