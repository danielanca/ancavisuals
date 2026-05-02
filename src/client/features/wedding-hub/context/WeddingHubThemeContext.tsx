import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type WeddingHubTheme = "dark" | "light";
export type WeddingHubThemePreference = "system" | WeddingHubTheme;

type WeddingHubThemeContextType = {
  theme: WeddingHubTheme;
  themePreference: WeddingHubThemePreference;
  setThemePreference: (theme: WeddingHubThemePreference) => void;
  toggleThemeOverride: () => void;
};

const STORAGE_KEY = "wedding-hub-theme";

const WeddingHubThemeContext = createContext<WeddingHubThemeContextType | undefined>(undefined);

export const WeddingHubThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [theme, setTheme] = useState<WeddingHubTheme>("dark");
  const [themePreference, setThemePreference] = useState<WeddingHubThemePreference>("system");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedTheme = window.localStorage.getItem(STORAGE_KEY);
    if (storedTheme === "dark" || storedTheme === "light" || storedTheme === "system") {
      setThemePreference(storedTheme);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (preference: WeddingHubThemePreference) => {
      setTheme(preference === "system" ? (mediaQuery.matches ? "dark" : "light") : preference);
    };

    const handleMediaChange = () => {
      applyTheme(themePreference);
    };

    applyTheme(themePreference);
    mediaQuery.addEventListener("change", handleMediaChange);
    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, [themePreference]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, themePreference);
  }, [themePreference]);

  const toggleThemeOverride = () => {
    setThemePreference((previousPreference) => {
      if (previousPreference === "system") {
        return theme === "dark" ? "light" : "dark";
      }
      return previousPreference === "dark" ? "light" : "dark";
    });
  };

  const contextValue = useMemo(() => ({
    theme,
    themePreference,
    setThemePreference,
    toggleThemeOverride,
  }), [theme, themePreference]);

  return (
    <WeddingHubThemeContext.Provider value={contextValue}>
      {children}
    </WeddingHubThemeContext.Provider>
  );
};

export const useWeddingHubTheme = (): WeddingHubThemeContextType => {
  const context = useContext(WeddingHubThemeContext);
  if (!context) {
    throw new Error("useWeddingHubTheme must be used within <WeddingHubThemeProvider>");
  }
  return context;
};
