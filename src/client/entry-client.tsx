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
import { installStableViewport } from "./utils/stableViewport";
import { LOAD_USERCENTRICS_EVENT } from "./utils/cookieConsent";
import { InitialDataContext, readInitialData } from "./ssr/initialData";
import { preloadSsrLazy } from "./routes/ssrLazy";
import { whenLandingSettled } from "./utils/whenLandingSettled";
import { installAuthFetch } from "./features/admin/providers/authFetch";

// Before render: adds the signed-in user's token to /api/ requests (and is installed before
// ErrorMonitorContext wraps fetch, so that wrapper's cleanup restores this one).
installAuthFetch();
const stopImageFailureRecovery = installImageFailureRecovery();
if (import.meta.hot) import.meta.hot.dispose(stopImageFailureRecovery);
const stopStableViewport = installStableViewport();
if (import.meta.hot) import.meta.hot.dispose(stopStableViewport);

const USERCENTRICS_SCRIPT_ID = "usercentrics-cmp";
const USERCENTRICS_SETTINGS_ID = "g4Hy0STeVeDNJo";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const SUPPRESS_UC_PREFIXES = ["/admin", "/media"];

const UC_HOST_ID = "usercentrics-cmp-ui";
const UC_HIDE_STYLE_ID = "uc-hide-privacy-button";
const HOTJAR_SCRIPT_ID = "hotjar-script";
const OPENAI_PIXEL_SCRIPT_ID = "openai-pixel-script";
let marketingScriptsStarted = false;

// The floating fingerprint button lives inside Usercentrics' shadow DOM, so a
// stylesheet in <head> can't reach it — the rule has to go into the shadow root.
// Only the collapsed state (.privacyButton) is hidden, never the banner; the
// footer's "Cookie Settings" / "Setări cookie" link still reopens the full dialog.
const injectPrivacyButtonStyle = (root: ShadowRoot) => {
  if (root.getElementById(UC_HIDE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = UC_HIDE_STYLE_ID;
  style.textContent = "#uc-main-dialog.privacyButton { display: none !important; }";
  root.appendChild(style);
};

// Usercentrics replaces its shadow root's children after every choice (Accept All
// & co.), dropping a style added once — so it is re-added whenever they change.
const keepPrivacyButtonHidden = () => {
  let watchedRoot: ShadowRoot | null = null;
  const rootObserver = new MutationObserver(() => { if (watchedRoot) injectPrivacyButtonStyle(watchedRoot); });
  const watch = () => {
    const root = document.getElementById(UC_HOST_ID)?.shadowRoot;
    if (!root || root === watchedRoot) return;
    watchedRoot = root;
    injectPrivacyButtonStyle(root);
    rootObserver.disconnect();
    rootObserver.observe(root, { childList: true });
  };
  watch();
  // The host is a direct child of <body>.
  new MutationObserver(watch).observe(document.body, { childList: true });
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

const isHotjarExcludedPath = (pathname: string) =>
  ["/admin", "/media", "/qr-moments", "/qr-code", "/blog"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

type OaiqQueue = ((...args: unknown[]) => void) & { q?: unknown[][] };

/** Hotjar and the OpenAI Pixel are marketing/measurement scripts: load neither before consent. */
const startConsentGatedMarketing = () => {
  if (marketingScriptsStarted || typeof window === "undefined" || typeof document === "undefined") return;
  if (LOCAL_HOSTS.has(window.location.hostname)) return;
  if (window.location.pathname.startsWith("/admin")) return;
  marketingScriptsStarted = true;

  let hotjarIgnored = false;
  try { hotjarIgnored = localStorage.getItem("av_ignore_hotjar") === "1"; } catch { /* privacy mode */ }
  if (!isHotjarExcludedPath(window.location.pathname) && !hotjarIgnored) {
    const hotjar = window as typeof window & { hj?: (...args: unknown[]) => void; _hjSettings?: { hjid: number; hjsv: number } };
    hotjar.hj = hotjar.hj || ((...args: unknown[]) => {
      (hotjar.hj as unknown as { q?: unknown[] }).q ??= [];
      (hotjar.hj as unknown as { q: unknown[] }).q.push(args);
    });
    hotjar._hjSettings = { hjid: 6491925, hjsv: 6 };
    const script = document.createElement("script");
    script.id = HOTJAR_SCRIPT_ID;
    script.async = true;
    script.src = `https://static.hotjar.com/c/hotjar-${hotjar._hjSettings.hjid}.js?sv=${hotjar._hjSettings.hjsv}`;
    document.head.appendChild(script);
  }

  if (!document.getElementById(OPENAI_PIXEL_SCRIPT_ID)) {
    const pixelWindow = window as typeof window & { oaiq?: OaiqQueue };
    if (!pixelWindow.oaiq) {
      const queue = ((...args: unknown[]) => { queue.q?.push(args); }) as OaiqQueue;
      queue.q = [];
      pixelWindow.oaiq = queue;
    }
    const script = document.createElement("script");
    script.id = OPENAI_PIXEL_SCRIPT_ID;
    script.async = true;
    script.src = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
    script.onload = () => {
      pixelWindow.oaiq?.("init", { pixelId: "EfkfFdccMQc1Dj6pmG7pva", debug: true });
      pixelWindow.oaiq?.("measure", "page_viewed", { type: "contents" });
    };
    document.head.appendChild(script);
  }
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
  window.addEventListener("UC_UI_INITIALIZED", () => {
    void readMarketingConsent().then((consent) => {
      if (consent === true) startConsentGatedMarketing();
    });
  }, { once: true });
  window.addEventListener("UC_UI_CMP_EVENT", (event: Event) => {
    const detail = (event as CustomEvent<{ type: string }>).detail;
    if (detail?.type) {
      void reportConsentAction(detail.type);
      if (detail.type === "ACCEPT_ALL") {
        startConsentGatedMarketing();
      } else if (detail.type === "SAVE") {
        void readMarketingConsent().then((consent) => {
          if (consent === true) startConsentGatedMarketing();
        });
      }
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
  keepPrivacyButtonHidden();

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

if (!LOCAL_HOSTS.has(window.location.hostname)) whenLandingSettled(() => {
  import("./firebase").then(({ auth }) => {
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      onAuthStateChanged(auth, (user) => {
        if (user && typeof window.gtag === "function") {
          window.gtag("set", { traffic_type: "internal" });
        }
      });
    });
  });
});

const container = document.getElementById("app");

const initialData = readInitialData();

const FullApp = () => (
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <InitialDataContext.Provider value={initialData}>
          <App />
        </InitialDataContext.Provider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);

if (import.meta.hot || !container?.innerText) {
  const root = createRoot(container!);
  root.render(<FullApp />);
} else {
  // Pages the server rendered that download only when opened (ssrLazy): load them
  // first, so the first render matches the server's HTML.
  void preloadSsrLazy(window.__SSR_LAZY__ ?? []).then(() => hydrateRoot(container!, <FullApp />));
}
