import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getCookie, setCookie, isBrowser } from "../utils/functions";

const SKIP_PREFIXES = ["/admin", "/login", "/revin"];
const ADMIN_COOKIE = "av_admin";
const VISITOR_COOKIE = "av_vid";

function looksLikeBot(): boolean {
  try {
    sessionStorage.setItem("__av_test", "1");
    sessionStorage.removeItem("__av_test");
    if (window.screen.width === 0 || window.screen.height === 0) return true;
    if (navigator.webdriver) return true;
    return false;
  } catch {
    return true;
  }
}

function getSessionId(): string {
  const key = "av_sid";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, id);
  }
  return id;
}

function getVisitorId(): { visitorId: string; isNew: boolean } {
  const existing = getCookie(VISITOR_COOKIE);
  if (existing) return { visitorId: existing, isNew: false };
  const visitorId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  setCookie(VISITOR_COOKIE, visitorId, 365);
  return { visitorId, isNew: true };
}

export function usePageTracking() {
  const location = useLocation();
  const prevPage = useRef<string>("");

  useEffect(() => {
    if (!isBrowser()) return;
    if (getCookie(ADMIN_COOKIE) === "1") return;
    if (looksLikeBot()) return;

    const page = location.pathname;
    if (SKIP_PREFIXES.some((p) => page.startsWith(p))) return;

    const referrer = prevPage.current || document.referrer;
    prevPage.current = page;

    const sessionId = getSessionId();
    const { visitorId, isNew } = getVisitorId();

    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, referrer, sessionId, visitorId, isNew }),
    }).catch(() => {});
  }, [location.pathname]);
}
