import { useEffect } from "react";

// Tidio live chat — the owner answers from the Tidio mobile/desktop app.
// Public key from Tidio → Settings → Installation (the script src). Empty = off,
// and the site keeps the AI chat (AncaChat).
export const TIDIO_PUBLIC_KEY = "bmuyaucyr4zkpbksh63nq5dnbbufnqsr";

export const isLiveChatConfigured = () => Boolean(TIDIO_PUBLIC_KEY);

// Site primary (index.css --primary: 0 0% 9%) — the widget matches the black header/buttons.
export const LIVE_CHAT_COLOR = "#171717";

type TidioApi = {
  show: () => void;
  hide: () => void;
  open?: () => void;
  close?: () => void;
  getStatus?: () => "online" | "offline";
  on?: (event: string, cb: () => void) => void;
  setColorPalette?: (color: string) => void;
};

declare global {
  interface Window {
    tidioChatApi?: TidioApi;
  }
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|::1|0\.0\.0\.0|.+\.local|.+\.localhost|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;

/**
 * The owner's own visits (dev on localhost / LAN, or the device logged in as admin —
 * cookie `av_admin` or the persistent `av_admin_device` marker) must not show up in
 * Tidio as visitors, so Tidio is never loaded there. `?tidio=1` forces it for testing.
 */
export function isTidioBlockedForThisDevice(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (new URLSearchParams(window.location.search).get("tidio") === "1") return false;
  } catch { /* ignore */ }
  if (LOCAL_HOST.test(window.location.hostname)) return true;
  if (/(?:^|;\s*)av_admin=1(?:;|$)/.test(document.cookie)) return true;
  try {
    return localStorage.getItem("av_admin_device") === "1";
  } catch {
    return false;
  }
}

/** Loads the Tidio script (hidden — nothing opens). Safe to call many times. */
export function loadTidio(): void {
  if (!isLiveChatConfigured() || isTidioBlockedForThisDevice() || document.getElementById("tidio-script")) return;
  const script = document.createElement("script");
  script.id = "tidio-script";
  script.async = true;
  script.src = `https://code.tidio.co/${TIDIO_PUBLIC_KEY}.js`;
  document.body.appendChild(script);
}

function whenTidioReady(fn: (api: TidioApi) => void): void {
  if (window.tidioChatApi) fn(window.tidioChatApi);
  else document.addEventListener("tidioChat-ready", () => window.tidioChatApi && fn(window.tidioChatApi), { once: true });
}

export type LiveChatStatus = "online" | "offline";

const STATUS_POLL_MS = 60_000;

/**
 * Reports whether someone is available in the Tidio app (Tidio's own operator status,
 * not a fixed schedule). Calls back once Tidio is ready, on its `setStatus` event and,
 * as a fallback, every minute. Returns an unsubscribe function.
 */
export function subscribeToLiveChatStatus(callback: (status: LiveChatStatus) => void): () => void {
  if (!isLiveChatConfigured() || typeof window === "undefined") return () => {};
  let active = true;
  let timer: number | undefined;
  const report = () => {
    const status = window.tidioChatApi?.getStatus?.();
    if (active && (status === "online" || status === "offline")) callback(status);
  };
  whenTidioReady((api) => {
    if (!active) return;
    report();
    api.on?.("setStatus", report);
    timer = window.setInterval(report, STATUS_POLL_MS);
  });
  return () => {
    active = false;
    if (timer) window.clearInterval(timer);
  };
}

let closeHookInstalled = false;
let closeControlInstalled = false;

const CLOSE_BUTTON_ID = "av-close-chat";

/**
 * Tidio's floating round button (the only "close" it offers) is replaced by an ✕ in the
 * chat header, next to the ⋮ options. The widget renders in a shadow root and re-renders
 * its header, so the ✕ is re-inserted on every DOM change. The floating button is hidden
 * only once the ✕ is in place — if Tidio's markup changes, visitors keep a way to close.
 */
function installHeaderCloseButton(api: TidioApi, attempt = 0): void {
  if (closeControlInstalled) return;
  const root = document.getElementById("tidio-chat")?.shadowRoot;
  if (!root) {
    // On a fresh load Tidio fires "ready" before its shadow root exists.
    if (attempt < 50) window.setTimeout(() => installHeaderCloseButton(api, attempt + 1), 200);
    return;
  }
  closeControlInstalled = true;

  // Tidio's window is a fixed 372px + 24px margins; on phones narrower than that it slid
  // off the left edge. Below 440px it now spans the screen with small margins.
  const layout = document.createElement("style");
  layout.id = "av-chat-layout";
  layout.textContent = `
    @media (max-width: 440px) {
      #tidio-chat-root { width: auto !important; max-width: none !important; left: 0 !important; right: 0 !important; margin: 8px 8px 12px !important; }
      #tidio-chat-root .chat { width: 100% !important; }
    }
  `;
  root.appendChild(layout);

  const ensure = () => {
    if (root.getElementById(CLOSE_BUTTON_ID)) return;
    const options = root.querySelector<HTMLButtonElement>("button.options");
    if (!options?.parentElement) return;

    const button = document.createElement("button");
    button.id = CLOSE_BUTTON_ID;
    button.type = "button";
    button.setAttribute("aria-label", "Închide chatul");
    button.textContent = "✕";
    button.addEventListener("click", () => {
      api.close?.();
      api.hide();
    });
    options.parentElement.insertBefore(button, options.nextSibling);

    if (!root.getElementById(`${CLOSE_BUTTON_ID}-style`)) {
      const style = document.createElement("style");
      style.id = `${CLOSE_BUTTON_ID}-style`;
      style.textContent = `
        #button { display: none !important; }
        #${CLOSE_BUTTON_ID} { width: 28px; height: 28px; margin-left: 4px; border: none; border-radius: 50%; background: transparent; color: inherit; font-size: 16px; line-height: 28px; cursor: pointer; opacity: .75; }
        #${CLOSE_BUTTON_ID}:hover { opacity: 1; background: rgba(0,0,0,.06); }
      `;
      root.appendChild(style);
    }
  };

  ensure();
  new MutationObserver(ensure).observe(root, { childList: true, subtree: true });
}

let openRequested = false;

/**
 * Loads Tidio on demand (only when the visitor asks to talk, from <ChatWithUs />) and
 * opens its chat window. Tidio's floating launcher stays hidden; the window hides again
 * on close. Resolves once the chat is open, so the button can show a loading state.
 */
export function openLiveChat(): Promise<void> {
  if (isTidioBlockedForThisDevice()) {
    console.info("[LiveChat] Tidio dezactivat pe acest dispozitiv (localhost/admin). Adaugă ?tidio=1 în URL ca să-l testezi.");
    return Promise.resolve();
  }
  openRequested = true;
  loadTidio();
  return new Promise((resolve) => {
    whenTidioReady((api) => {
      if (!closeHookInstalled && api.on) {
        api.on("close", () => api.hide());
        closeHookInstalled = true;
      }
      api.setColorPalette?.(LIVE_CHAT_COLOR);
      api.show();
      api.open?.();
      installHeaderCloseButton(api);
      resolve();
    });
  });
}

/**
 * Tidio is NOT loaded with the page — only by openLiveChat() when the visitor asks to talk.
 * Once loaded, this keeps it hidden on private pages and its launcher tab hidden until then.
 */
export default function LiveChat({ visible }: { visible: boolean }) {
  useEffect(() => {
    const apply = () => {
      window.tidioChatApi?.setColorPalette?.(LIVE_CHAT_COLOR);
      // The blue side tab is replaced by <ChatWithUs /> at the bottom of the page.
      if (!visible || !openRequested) window.tidioChatApi?.hide();
    };
    if (window.tidioChatApi) {
      apply();
      return;
    }
    // Tidio exposes its API only after loading.
    document.addEventListener("tidioChat-ready", apply, { once: true });
    return () => document.removeEventListener("tidioChat-ready", apply);
  }, [visible]);

  return null;
}
