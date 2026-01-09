import styles from './WeddingHero.module.scss';

type WeddingHeroProps = {
  groom: string;
  bride: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  phone: string;
};

export default function WeddingHero({
  groom,
  bride,
  date,
  time,
  venue,
  address,
  phone
}: WeddingHeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.card}>
        <div className={styles.border} />

        <img src="/flowers/tl.png" className={`${styles.flower} ${styles.flowerTl}`} />
        <img src="/flowers/br.png" className={`${styles.flower} ${styles.flowerBr}`} />

        <div className={styles.content}>
          <span className={styles.pretitle}>Save The Date</span>
          <span className={styles.subtitle}>For the wedding ceremony of</span>

          <h1 className={styles.name}>{groom}</h1>
          <div className={styles.amp}>&</div>
          <h1 className={styles.name}>{bride}</h1>

          <div className={styles.details}>
            <p>{date}</p>
            <p>{time} | {venue}</p>
            <p>{address}</p>
          </div>

          <div className={styles.footer}>
            <span>Reception to follow</span>
            <span>{phone}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
