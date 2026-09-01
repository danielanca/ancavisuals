import React from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    oaiq?: (...args: unknown[]) => void;
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

const SUPPRESS_UC_PREFIXES = ["/admin", "/media"];

const hidePrivacyButton = () => {
  const el = document.getElementById("uc-main-dialog") as HTMLElement | null;
  if (el) {
    el.style.setProperty("opacity", "0", "important");
    el.style.setProperty("pointer-events", "none", "important");
    el.style.setProperty("z-index", "-1", "important");
  }
  // Also inject a persistent CSS rule in case the element mounts later
  if (!document.getElementById("uc-hide-badge-style")) {
    const style = document.createElement("style");
    style.id = "uc-hide-badge-style";
    style.textContent = `#uc-main-dialog.privacyButton { opacity: 0 !important; pointer-events: none !important; z-index: -1 !important; }`;
    document.head.appendChild(style);
  }
};

const setupUcConsentListener = () => {
  // Hide after user accepts/saves/denies in current session
  window.addEventListener("UC_UI_CMP_EVENT", (event: Event) => {
    const detail = (event as CustomEvent<{ type: string }>).detail;
    if (["ACCEPT_ALL", "DENY_ALL", "SAVE"].includes(detail?.type)) {
      hidePrivacyButton();
    }
  });

  // Hide if user already consented in a previous session
  window.addEventListener("UC_UI_INITIALIZED", () => {
    const ucUi = (window as unknown as Record<string, unknown>)["UC_UI"] as { areAllConsentsAccepted?: () => boolean } | undefined;
    if (ucUi?.areAllConsentsAccepted?.()) {
      hidePrivacyButton();
    }
  });
};

const bootstrapUsercentrics = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (LOCAL_HOSTS.has(window.location.hostname)) {
    console.info("[Usercentrics] CMP nu se incarca pe local; domeniul nu este allow-listed.");
    return;
  }

  if (SUPPRESS_UC_PREFIXES.some((p) => window.location.pathname.startsWith(p))) {
    return;
  }

  if (document.getElementById(USERCENTRICS_SCRIPT_ID)) {
    return;
  }

  setupUcConsentListener();

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
