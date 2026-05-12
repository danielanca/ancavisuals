import React from "react";
import AncaLoader from "./AncaLoader";
import styles from "./Loader.module.scss";

type LoaderVariant = "fullscreen" | "topBar";

type LoaderProps = {
  variant?: LoaderVariant;
  label?: string;
  subtitle?: string;
};

const Loader: React.FC<LoaderProps> = ({
  variant = "fullscreen",
  subtitle,
}) => {
  if (variant === "topBar") {
    return <div aria-hidden="true" className={styles.topBar} />;
  }

  return <AncaLoader subtitle={subtitle} />;
};

export default Loader;
