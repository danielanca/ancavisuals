import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

export type ErrorEntry = {
  id: string;
  timestamp: Date;
  type: "client" | "server" | "promise" | "console";
  message: string;
  detail?: string;
  url?: string;
  status?: number;
};

type ErrorMonitorContextType = {
  errors: ErrorEntry[];
  debugging: boolean;
  setDebugging: (value: boolean) => void;
  addError: (entry: Omit<ErrorEntry, "id" | "timestamp">) => void;
  clearErrors: () => void;
};

const ErrorMonitorContext = createContext<ErrorMonitorContextType | null>(null);

export function useErrorMonitor() {
  const ctx = useContext(ErrorMonitorContext);
  if (!ctx) throw new Error("useErrorMonitor must be used within ErrorMonitorProvider");
  return ctx;
}

export function ErrorMonitorProvider({ children }: { children: React.ReactNode }) {
  const [debugging, setDebuggingState] = useState(() => {
    try { return localStorage.getItem("av_debugging") === "1"; } catch { return false; }
  });
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const debuggingRef = useRef(debugging);
  debuggingRef.current = debugging;

  const setDebugging = useCallback((value: boolean) => {
    setDebuggingState(value);
    try { localStorage.setItem("av_debugging", value ? "1" : "0"); } catch {}
  }, []);

  const addError = useCallback((entry: Omit<ErrorEntry, "id" | "timestamp">) => {
    setErrors(prev => [
      { ...entry, id: Math.random().toString(36).slice(2), timestamp: new Date() },
      ...prev,
    ].slice(0, 100));
  }, []);

  const clearErrors = useCallback(() => setErrors([]), []);

  // Always-on: capture real JS errors and unhandled promise rejections
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const location = `${event.filename}:${event.lineno}:${event.colno}`;
      const errorClass = event.error?.constructor?.name ?? "Error";
      const stack = event.error?.stack;
      const detail = stack ?? `${errorClass}: ${event.message}\n    at ${location}`;
      addError({
        type: "client",
        message: event.message || "Unknown error",
        detail,
        url: location,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const errorClass = reason?.constructor?.name ?? "Error";
      const stack = reason instanceof Error ? reason.stack : undefined;
      const detail = stack ?? `${errorClass}: ${message}`;
      addError({ type: "promise", message: `Promise: ${message}`, detail });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [addError]);

  // Debugging-only: patch console.error and fetch for verbose capture
  useEffect(() => {
    if (!debugging) return;

    const origConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      origConsoleError(...args);
      if (debuggingRef.current) {
        addError({
          type: "console",
          message: args.map(arg => (typeof arg === "object" ? JSON.stringify(arg) : String(arg))).join(" "),
        });
      }
    };

    const origFetch = window.fetch;
    window.fetch = async function patchedFetch(input, init) {
      const response = await origFetch(input, init);
      if (!response.ok && debuggingRef.current) {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        if (url.includes("/api/")) {
          response.clone().json().then(data => {
            addError({
              type: "server",
              message: (data as { error?: string }).error ?? `HTTP ${response.status}`,
              url,
              status: response.status,
            });
          }).catch(() => {
            addError({ type: "server", message: `HTTP ${response.status}`, url, status: response.status });
          });
        }
      }
      return response;
    };

    return () => {
      console.error = origConsoleError;
      window.fetch = origFetch;
    };
  }, [debugging, addError]);

  return (
    <ErrorMonitorContext.Provider value={{ errors, debugging, setDebugging, addError, clearErrors }}>
      {children}
    </ErrorMonitorContext.Provider>
  );
}
