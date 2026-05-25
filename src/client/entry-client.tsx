import React from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// ⬇️ pune la loc importul CLASIC:
import { HelmetProvider } from "react-helmet-async";
import { App } from "./App";
import "./index.css";

const USERCENTRICS_SCRIPT_ID = "usercentrics-cmp";
const USERCENTRICS_SETTINGS_ID = "g4Hy0STeVeDNJo";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const bootstrapUsercentrics = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (LOCAL_HOSTS.has(window.location.hostname)) {
    console.info("[Usercentrics] CMP nu se incarca pe local; domeniul nu este allow-listed.");
    return;
  }

  if (document.getElementById(USERCENTRICS_SCRIPT_ID)) {
    return;
  }

  const script = document.createElement("script");
  script.id = USERCENTRICS_SCRIPT_ID;
  script.src = "https://web.cmp.usercentrics.eu/ui/loader.js";
  script.async = true;
  script.setAttribute("data-settings-id", USERCENTRICS_SETTINGS_ID);
  document.head.appendChild(script);
};

bootstrapUsercentrics();

if (!LOCAL_HOSTS.has(window.location.hostname)) {
  import("./firebase").then(({ auth }) => {
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      onAuthStateChanged(auth, (user) => {
        if (user && typeof window.gtag === "function") {
          window.gtag("set", { traffic_type: "internal" });
        }
      });
    });
  });
}

const container = document.getElementById("app");

const FullApp = () => (
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);

if (import.meta.hot || !container?.innerText) {
  const root = createRoot(container!);
  root.render(<FullApp />);
} else {
  hydrateRoot(container!, <FullApp />);
}
