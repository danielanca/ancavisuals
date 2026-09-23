import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Avoids double-reporting the same bad URL within one browsing session
// (e.g. React StrictMode double-mount in dev, or a re-render).
const reportedPaths = new Set<string>();

/**
 * Rendered by the catch-all `path="*"` route. Pings the server so the admin
 * gets an email when a real visitor lands on a broken link — usually a wrong
 * URL in an ad or a printed material — then sends the visitor on to a real,
 * useful page (/oferta/olx) instead of a dead end. The `notFound` query param
 * marks the landing as a redirect so it isn't mistaken for direct /oferta/olx
 * traffic anywhere it's tracked (view count, notification email, activity feed).
 */
export default function NotFoundPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname + window.location.search;
    if (reportedPaths.has(path)) return;
    reportedPaths.add(path);

    fetch("/api/monitoring/not-found", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        referrer: document.referrer || "",
        userAgent: navigator.userAgent || "",
      }),
      keepalive: true,
    }).catch(() => {});

    navigate(`/oferta/olx?notFound=${encodeURIComponent(path)}`, { replace: true });
  }, [navigate]);

  return null;
}
