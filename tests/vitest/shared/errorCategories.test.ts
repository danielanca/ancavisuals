/*
 * Purpose: the error categories and fingerprints shown in /admin/errors.
 */
import { describe, expect, test } from "vitest";
import { categorizeError, errorFingerprint, isNoiseError } from "../../../src/shared/errorCategories";

describe("errorCategories", () => {
  test("sorts errors by what went wrong", () => {
    expect(categorizeError({ message: "Something", source: "server" })).toBe("server");
    expect(categorizeError({ message: "[404] /oferta/xyz" })).toBe("not-found");
    expect(categorizeError({ message: "[QR DEBUG] upload failed" })).toBe("qr");
    expect(categorizeError({ message: "TypeError: x", page: "/qr-moments/abc" })).toBe("qr");
    expect(categorizeError({ message: "[SLOW LOAD] 9s" })).toBe("slow-load");
    expect(categorizeError({ message: "[IMAGE LOAD FAILED] https://cdn/x.webp" })).toBe("image");
    expect(categorizeError({ message: "Failed to fetch dynamically imported module: /assets/Contact-abc.js" })).toBe("chunk");
    expect(categorizeError({ message: "Unhandled Promise Rejection: Loading chunk 12 failed." })).toBe("chunk");
    expect(categorizeError({ message: "Minified React error #418; visit https://react.dev" })).toBe("hydration");
    expect(categorizeError({ message: "Unhandled Promise Rejection: Failed to fetch" })).toBe("network");
    expect(categorizeError({ message: "Unhandled Promise Rejection: boom" })).toBe("promise");
    expect(categorizeError({ message: "TypeError: Cannot read properties of undefined" })).toBe("js");
  });

  test("gives the same fingerprint to the same error from different visitors", () => {
    const a = errorFingerprint("js", "TypeError at https://ancavisuals.ro/assets/a1b2c3d4e5.js line 12", "/media/2026");
    const b = errorFingerprint("js", "TypeError at https://ancavisuals.ro/assets/ffeeddccbb.js line 98", "/media/other-album");
    expect(a).toBe(b);
    expect(a).not.toBe(errorFingerprint("js", "TypeError at https://x line 1", "/contact"));
  });

  test("recognises browser noise that is not our code", () => {
    expect(isNoiseError("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(isNoiseError("Script error.")).toBe(true);
    expect(isNoiseError("x", "at chrome-extension://abc/content.js:1")).toBe(true);
    // Brave's built-in crypto wallet script on iPhone (no window.ethereum there).
    expect(isNoiseError("TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')")).toBe(true);
    // Facebook / Instagram in-app browser on Android, closing the page.
    expect(isNoiseError("Uncaught Error: Error invoking postMessage: Java object is gone", "at sendDataToNative (iabjs://navigation_performance_logger_android:1:11722)")).toBe(true);
    expect(isNoiseError("TypeError: a is undefined")).toBe(false);
  });
});
