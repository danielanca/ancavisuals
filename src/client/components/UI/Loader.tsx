import React from "react";
import styles from "./Loader.module.scss";

type LoaderVariant = "fullscreen" | "topBar";

type LoaderProps = {
  variant?: LoaderVariant;
  label?: string;
};

const Loader: React.FC<LoaderProps> = ({
  variant = "fullscreen",
  label = "AncaVisuals",
}) => {
  if (variant === "topBar") {
    return <div aria-hidden="true" className={styles.topBar} />;
  }

  return (
    <div className={styles.fullscreenOverlay} role="status" aria-live="polite">
      <p className={styles.brandLabel}>
        {label === "AncaVisuals" ? (
          <>
            <span className={styles.brandAccent}>Anca</span>
            Visuals
          </>
        ) : (
          label
        )}
      </p>
    </div>
  );
};

export default Loader;
