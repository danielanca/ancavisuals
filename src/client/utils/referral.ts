/*
 * Purpose: a visitor who arrives through a guest's recommendation link (utm_source=recomandare,
 * sent from the "Recomandă-ne pe WhatsApp" button on shared photo pages) ALWAYS gets the
 * photobooth (+ QR code) free — even after the public free-photobooth promo has ended. The flag
 * is remembered in this browser, so it still applies if they browse around or come back later.
 */
import { useEffect, useState } from "react";

export const REFERRAL_UTM_SOURCE = "recomandare";
const STORAGE_KEY = "av-referral";

/** Remembers the referral if the current URL carries it; returns whether this visitor is referred. */
export function captureReferral(search: string = typeof window === "undefined" ? "" : window.location.search): boolean {
  const fromUrl = new URLSearchParams(search).get("utm_source") === REFERRAL_UTM_SOURCE;
  try {
    if (fromUrl) localStorage.setItem(STORAGE_KEY, String(Date.now()));
    return fromUrl || localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return fromUrl;
  }
}

/** False on the server and first render (so SSR markup matches), then the real value. */
export function useReferral(): boolean {
  const [referral, setReferral] = useState(false);
  useEffect(() => { setReferral(captureReferral()); }, []);
  return referral;
}
