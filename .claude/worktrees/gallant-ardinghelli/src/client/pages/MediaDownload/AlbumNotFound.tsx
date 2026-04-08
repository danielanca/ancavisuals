import { useEffect, useState } from "react";
import styles from "./AlbumNotFound.module.scss";

type Props = {
  title?: string;
  message?: string;
  redirectTo?: string;
  seconds?: number;
};

export default function AlbumNotFound({
  title = "404",
  message = "Album inexistent.",
  redirectTo = "https://ancavisuals.ro",
  seconds = 10,
}: Props) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const endAt = Date.now() + seconds * 1000;

    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) window.location.replace(redirectTo);
    };

    tick();

    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [redirectTo, seconds]);

  return (
    <div className={styles.page}>
      <div className={styles.bubbles} aria-hidden="true" />
      <div className={styles.card} role="status" aria-live="polite">
        <div className={styles.badge}>{title}</div>
        <h1 className={styles.heading}>Album indisponibil</h1>
        <p className={styles.message}>{message}</p>

        <div className={styles.countdown}>
          Redirecționare către <span className={styles.brand}>ancavisuals.ro</span> în{" "}
          <span className={styles.seconds}>{remaining}</span>s
        </div>

        <div className={styles.actions}>
          <a className={styles.primary} href={redirectTo}>
            Mergi acum
          </a>
          <a className={styles.secondary} href="/">
            Înapoi
          </a>
        </div>
      </div>
    </div>
  );
}
