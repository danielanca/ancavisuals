import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getCookie, isBrowser } from "../utils/functions";
import { sendTriggerEmail } from "../utils/triggers";

const SKIP_PREFIXES = ["/admin", "/login", "/revin", "/wedding-hub", "/colaborator"];
const ADMIN_COOKIE = "av_admin";
const SESSION_KEY = "av_notified";

function getNotifiedUrls(): Set<string> {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function markUrlNotified(url: string): void {
  try {
    const notified = getNotifiedUrls();
    notified.add(url);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...notified]));
  } catch {
    // sessionStorage unavailable — silently skip
  }
}

export function useVisitorNotification() {
  const location = useLocation();

  useEffect(() => {
    if (!isBrowser()) return;
    if (getCookie(ADMIN_COOKIE) === "1") return;
    if (SKIP_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))) return;

    const notified = getNotifiedUrls();
    if (notified.has(location.pathname)) return;

    markUrlNotified(location.pathname);
    sendTriggerEmail({ typeEvent: "Vizitator", url: location.pathname }).catch(() => {});
  }, [location.pathname]);
}
