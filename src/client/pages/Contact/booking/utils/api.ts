/*
 * Purpose: sends booking-related trigger events to the backend using the public
 * same-origin endpoint, while providing a safe development fallback if the local
 * endpoint is unavailable.
 */
// src/booking/utils/api.ts
const IS_PROD = import.meta.env.PROD;
const API_BASE = ""; // same-origin requests from the public site.
const TRIGGER_EVENT_PATH = "/triggerEvent";
const DEFAULT_BOOKING_EMAIL = "ancadaniel1994@gmail.com";

export const BOOKING_TO = import.meta.env.VITE_BOOKING_EMAIL ?? DEFAULT_BOOKING_EMAIL;

export async function safeTrigger(payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${API_BASE}${TRIGGER_EVENT_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, ...json };
    } else {
      await res.text().catch(() => "");
      return { ok: res.ok };
    }
  } catch (e) {
    if (!IS_PROD) {
      console.log(`[dev] ${TRIGGER_EVENT_PATH} fallback:`, payload);
      return { ok: true, dev: true };
    }
    throw e;
  }
}
