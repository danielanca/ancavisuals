import { firestore } from "../firestore";
import admin from "firebase-admin";
import { sendEmail } from "../notifications/mailer";
import { adminUser } from "../constants/credentials";

export const ERRORS_COLLECTION = "serverErrors";

type Severity = "error" | "warn";
type Source = "server" | "client";

let originalConsoleError: typeof console.error | null = null;
let originalConsoleWarn: typeof console.warn | null = null;
let isSaving = false;

function serializeArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.message}\n${arg.stack ?? ""}`;
  if (typeof arg === "object" && arg !== null) {
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }
  return String(arg);
}

async function saveError(severity: Severity, message: string, source: Source, stack = "", page = ""): Promise<void> {
  try {
    await firestore().collection(ERRORS_COLLECTION).add({
      message,
      stack,
      source,
      severity,
      page,
      seen: false,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (saveError) {
    originalConsoleError?.("[server-monitor] Firestore save failed:", saveError);
  }
}

function capture(severity: Severity, args: unknown[]): void {
  if (isSaving) return;
  const message = args.map(serializeArg).join(" ");
  saveError(severity, message, "server").catch(() => {});
}

export function captureClientError(message: string, stack: string, page: string): void {
  saveError("error", message, "client", stack, page).catch(() => {});
}

async function sendCrashEmail(message: string): Promise<void> {
  try {
    await sendEmail({
      to: adminUser.email,
      subject: "[AncaVisuals] 🔴 CRASH pe server",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#dc2626;">🔴 Server crash</h2>
          <pre style="background:#1f1f1f;color:#f87171;padding:16px;border-radius:8px;font-size:12px;overflow:auto;white-space:pre-wrap;">${message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
        </div>
      `,
    });
  } catch {
    // nu mai logăm, suntem deja în crash handler
  }
}

export function startServerMonitor(): void {
  originalConsoleError = console.error;
  originalConsoleWarn = console.warn;

  console.error = (...args: unknown[]) => {
    originalConsoleError!(...args);
    capture("error", args);
  };

  console.warn = (...args: unknown[]) => {
    originalConsoleWarn!(...args);
    capture("warn", args);
  };

  process.on("uncaughtException", (error: Error) => {
    originalConsoleError?.("[server-monitor] uncaughtException:", error);
    const message = `UNCAUGHT EXCEPTION: ${error.message}\n${error.stack ?? ""}`;
    isSaving = true;
    Promise.all([
      saveError("error", message, "server"),
      sendCrashEmail(message),
    ]).finally(() => { isSaving = false; });
  });

  process.on("unhandledRejection", (reason: unknown) => {
    originalConsoleError?.("[server-monitor] unhandledRejection:", reason);
    const message = reason instanceof Error
      ? `UNHANDLED REJECTION: ${reason.message}\n${reason.stack ?? ""}`
      : `UNHANDLED REJECTION: ${serializeArg(reason)}`;
    saveError("error", message, "server").catch(() => {});
  });

  console.log("[server-monitor] Pornit — salvează în Firestore colecția serverErrors");
}

export function stopServerMonitor(): void {
  if (originalConsoleError) { console.error = originalConsoleError; originalConsoleError = null; }
  if (originalConsoleWarn) { console.warn = originalConsoleWarn; originalConsoleWarn = null; }
}
