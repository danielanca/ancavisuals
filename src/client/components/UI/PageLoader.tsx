import styles from "./PageLoader.module.css";
export default function PageLoader() {
  return (
    <div className={styles.wrap}>
      <div className={styles.spinner} />
      <div className={styles.text}>please wait…</div>
    </div>
  );
}
