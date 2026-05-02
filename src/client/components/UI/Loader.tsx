import React from "react";
import styles from "./Loader.module.scss";

type LoaderVariant = "fullscreen" | "topBar";

type LoaderProps = {
  variant?: LoaderVariant;
  label?: string;
  subtitle?: string;
};

const Loader: React.FC<LoaderProps> = ({
  variant = "fullscreen",
  label = "AncaVisuals",
  subtitle,
}) => {
  if (variant === "topBar") {
    return <div aria-hidden="true" className={styles.topBar} />;
  }

  return (
    <div className={styles.fullscreenOverlay} role="status" aria-live="polite">
      <div className={styles.brandStack}>
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
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
    </div>
  );
};

export default Loader;
