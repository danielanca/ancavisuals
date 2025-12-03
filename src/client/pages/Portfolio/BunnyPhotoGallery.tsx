// components/media/BunnyPhotoGallery/BunnyPhotoGallery.tsx
import React from "react";
import styles from "./bunnyPhotoGallery.module.scss";

export default function BunnyPhotoGallery({ photos }: { photos: string[] }) {
  return (
    <div className={styles.grid}>
      {photos.map((src) => (
        <img
          key={src}
          src={src}
          className={styles.item}
          onClick={() => window.open(src, "_blank")}
          alt=""
        />
      ))}
    </div>
  );
}
