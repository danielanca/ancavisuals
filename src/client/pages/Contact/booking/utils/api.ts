// src/booking/utils/api.ts
const IS_PROD = import.meta.env.PROD;
const API_BASE = ''; // same-origin
export const BOOKING_TO = import.meta.env.VITE_BOOKING_EMAIL ?? 'you@example.com';

export async function safeTrigger(payload: any) {
  try {
    const res = await fetch(`${API_BASE}/triggerEvent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, ...json };
    } else {
      await res.text().catch(() => '');
      return { ok: res.ok };
    }
  } catch (e) {
    if (!IS_PROD) {
      console.log('[dev] /triggerEvent fallback:', payload);
      return { ok: true, dev: true };
    }
    throw e;
  }
}
