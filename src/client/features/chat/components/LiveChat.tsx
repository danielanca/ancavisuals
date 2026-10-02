import { useEffect } from "react";

// Tidio live chat — the owner answers from the Tidio mobile/desktop app.
// Public key from Tidio → Settings → Installation (the script src). Empty = off,
// and the site keeps the AI chat (AncaChat).
export const TIDIO_PUBLIC_KEY = "bmuyaucyr4zkpbksh63nq5dnbbufnqsr";

export const isLiveChatConfigured = () => Boolean(TIDIO_PUBLIC_KEY);

// Site primary (index.css --primary: 0 0% 9%) — the widget matches the black header/buttons.
export const LIVE_CHAT_COLOR = "#171717";

type TidioApi = { show: () => void; hide: () => void; setColorPalette?: (color: string) => void };

declare global {
  interface Window {
    tidioChatApi?: TidioApi;
  }
}

/** Loads the Tidio script once; afterwards only shows/hides the widget per page. */
export default function LiveChat({ visible }: { visible: boolean }) {
  useEffect(() => {
    if (!isLiveChatConfigured() || !visible || document.getElementById("tidio-script")) return;
    const script = document.createElement("script");
    script.id = "tidio-script";
    script.async = true;
    script.src = `https://code.tidio.co/${TIDIO_PUBLIC_KEY}.js`;
    document.body.appendChild(script);
  }, [visible]);

  useEffect(() => {
    const apply = () => {
      window.tidioChatApi?.setColorPalette?.(LIVE_CHAT_COLOR);
      if (visible) window.tidioChatApi?.show();
      else window.tidioChatApi?.hide();
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
