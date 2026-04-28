import React, { createContext, useContext, useState } from "react";

interface PrivacyModeContextValue {
  privacyMode: boolean;
  togglePrivacyMode: () => void;
}

const PrivacyModeContext = createContext<PrivacyModeContextValue>({
  privacyMode: false,
  togglePrivacyMode: () => {},
});

const STORAGE_KEY = "av_privacy_mode";

export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  const [privacyMode, setPrivacyMode] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  const togglePrivacyMode = () => {
    setPrivacyMode((v) => {
      const next = !v;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  return (
    <PrivacyModeContext.Provider value={{ privacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyModeContext.Provider>
  );
}

export function usePrivacyMode() {
  return useContext(PrivacyModeContext);
}
