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
import { installImageFailureRecovery } from "./utils/imageFailureRecovery";
import { LOAD_USERCENTRICS_EVENT } from "./utils/cookieConsent";

const stopImageFailureRecovery = installImageFailureRecovery();
if (import.meta.hot) import.meta.hot.dispose(stopImageFailureRecovery);

const USERCENTRICS_SCRIPT_ID = "usercentrics-cmp";
const USERCENTRICS_SETTINGS_ID = "g4Hy0STeVeDNJo";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const SUPPRESS_UC_PREFIXES = ["/admin", "/media"];

const UC_HOST_ID = "usercentrics-cmp-ui";
const UC_HIDE_STYLE_ID = "uc-hide-privacy-button";

// The floating fingerprint button lives inside Usercentrics' shadow DOM, so a
// stylesheet in <head> can't reach it — the rule has to go into the shadow root.
// Only the collapsed state (.privacyButton) is hidden; the footer's
// "Cookie Settings" link still reopens the full dialog.
const injectPrivacyButtonStyle = (): boolean => {
  const root = document.getElementById(UC_HOST_ID)?.shadowRoot;
  if (!root) return false;
  if (!root.getElementById(UC_HIDE_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = UC_HIDE_STYLE_ID;
    style.textContent = "#uc-main-dialog.privacyButton { display: none !important; }";
    root.appendChild(style);
  }
  return true;
};

const hidePrivacyButton = () => {
  if (injectPrivacyButtonStyle()) return;
  const observer = new MutationObserver(() => {
    if (injectPrivacyButtonStyle()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 15_000);
};

const UC_EVENT_TO_CONSENT_ACTION: Record<string, string> = {
  CMP_SHOWN: "shown",
  ACCEPT_ALL: "accept_all",
  DENY_ALL: "deny_all",
  SAVE: "save",
};

// After "Save" (custom choice) — did the visitor keep Marketing on?
// Usercentrics v3 exposes __ucCmp, older loaders UC_UI; undefined if neither answers.
const readMarketingConsent = async (): Promise<boolean | undefined> => {
  const w = window as unknown as Record<string, unknown>;
  try {
    const cmp = w["__ucCmp"] as { getConsentDetails?: () => Promise<{ categories?: Record<string, { state?: string }> }> } | undefined;
    const details = await cmp?.getConsentDetails?.();
    const state = details?.categories?.marketing?.state;
    if (state) return state !== "ALL_DENIED";
  } catch { /* fall through */ }
  try {
    const ucUi = w["UC_UI"] as { getServicesBaseInfo?: () => { categorySlug?: string; consent?: { status?: boolean } }[] } | undefined;
    const services = ucUi?.getServicesBaseInfo?.()?.filter((s) => s.categorySlug === "marketing");
    if (services?.length) return services.some((s) => s.consent?.status === true);
  } catch { /* ignore */ }
  return undefined;
};

// Anonymous banner stats (/admin/analytics) — only the action is sent, no ids.
const reportConsentAction = async (ucType: string) => {
  const action = UC_EVENT_TO_CONSENT_ACTION[ucType];
  if (!action) return;
  const marketing = action === "save" ? await readMarketingConsent() : undefined;
  fetch("/api/analytics/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, marketing }),
    keepalive: true,
  }).catch(() => {});
};

const setupUcConsentListener = () => {
  // Hide after user accepts/saves/denies in current session
  window.addEventListener("UC_UI_CMP_EVENT", (event: Event) => {
    const detail = (event as CustomEvent<{ type: string }>).detail;
    if (detail?.type) void reportConsentAction(detail.type);
    if (["ACCEPT_ALL", "DENY_ALL", "SAVE"].includes(detail?.type)) {
      hidePrivacyButton();
    }
  });

  // Hide if the visitor already decided (accept, deny or custom) in a previous session
  window.addEventListener("UC_UI_INITIALIZED", () => {
    const ucUi = (window as unknown as Record<string, unknown>)["UC_UI"] as { isConsentRequired?: () => boolean } | undefined;
    if (ucUi?.isConsentRequired?.() === false) {
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
    // Listener only — lets the banner stats be tested locally with simulated UC_UI_CMP_EVENTs.
    setupUcConsentListener();
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

// Intarzie incarcarea CMP-ului pana cand utilizatorul incepe sa miste mouse-ul
// sau degetul pe pagina (fara fallback pe timp).
const scheduleUsercentrics = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  // Pe local / rute suprimate nu are rost sa atasam listenerii.
  if (LOCAL_HOSTS.has(window.location.hostname)) {
    bootstrapUsercentrics();
    return;
  }
  if (SUPPRESS_UC_PREFIXES.some((p) => window.location.pathname.startsWith(p))) {
    return;
  }

  const INTERACTION_EVENTS = ["pointermove", "touchstart", "touchmove", "scroll", "wheel"];
  let started = false;

  const start = () => {
    if (started) {
      return;
    }
    started = true;
    INTERACTION_EVENTS.forEach((evt) => window.removeEventListener(evt, start));
    bootstrapUsercentrics();
  };

  INTERACTION_EVENTS.forEach((evt) => window.addEventListener(evt, start, { once: true, passive: true }));
  // "Setări cookie" clicked before any interaction loaded the CMP (typical on phones).
  window.addEventListener(LOAD_USERCENTRICS_EVENT, start, { once: true });
};

scheduleUsercentrics();

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
