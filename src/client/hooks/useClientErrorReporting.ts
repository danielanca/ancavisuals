import { useEffect } from "react";
import { getCookie } from "../utils/functions";

const ADMIN_COOKIE = "av_admin";

function sendError(message: string, stack: string) {
  fetch("/api/monitoring/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, stack, page: window.location.pathname }),
  }).catch(() => {});
}

export function useClientErrorReporting(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (getCookie(ADMIN_COOKIE) === "1") return;

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
