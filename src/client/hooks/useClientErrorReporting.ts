import { useEffect } from "react";
import { getCookie } from "../utils/functions";

const ADMIN_COOKIE = "av_admin";
// One page load reports each distinct error once, and at most this many in total — a script
// failing in a loop must not flood /api/monitoring/client-error.
const MAX_REPORTS_PER_PAGE_LOAD = 10;

const reported = new Set<string>();

function sendError(message: string, stack: string) {
  const key = `${message}|${window.location.pathname}`;
  if (reported.has(key) || reported.size >= MAX_REPORTS_PER_PAGE_LOAD) return;
  reported.add(key);
  fetch("/api/monitoring/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      message,
      stack,
      page: window.location.pathname,
      // Kept, but flagged: the admin's own errors don't trigger the "new error" email.
      admin: getCookie(ADMIN_COOKIE) === "1",
    }),
  }).catch(() => {});
}

/** Sends the visitor's JavaScript errors to /admin/errors (stored and categorised on the server). */
export function useClientErrorReporting(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleError = (event: ErrorEvent) => {
      const message = event.message || "Unknown error";
      const stack = event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`;
      sendError(message, stack);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? (reason.stack || "") : "";
      sendError(`Unhandled Promise Rejection: ${message}`, stack);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [enabled]);
}
