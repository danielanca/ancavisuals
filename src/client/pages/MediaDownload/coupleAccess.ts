/*
 * Purpose: remembers the couple's secret album key on this device. The key arrives
 * once via /media/:slug?cheie=…, is stored per album and immediately removed from
 * the address bar — so if the bride copies the album URL to guests, the manager
 * does not travel with it.
 */
import { useEffect, useRef, useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import { COUPLE_KEY_HEADER, COUPLE_KEY_PARAM } from "../../../shared/media/shareLinks";

const storageKey = (slug: string) => `av:couple-key:${slug}`;

export function readCoupleKey(slug: string): string | null {
  try { return localStorage.getItem(storageKey(slug)); } catch { return null; }
}

function storeCoupleKey(slug: string, key: string) {
  try { localStorage.setItem(storageKey(slug), key); } catch { /* private mode: works for this visit only */ }
}

function clearCoupleKey(slug: string) {
  try { localStorage.removeItem(storageKey(slug)); } catch { /* ignore */ }
}

export const coupleKeyHeaders = (key: string | null): Record<string, string> =>
  key ? { [COUPLE_KEY_HEADER]: key } : {};

export type CoupleAccess = {
  /** Verified key for this album, or null for guests. */
  coupleKey: string | null;
  isCouple: boolean;
  /** True when the URL carried a key the server rejected (old/rotated link). */
  keyRejected: boolean;
};

export function useCoupleAccess(
  slug: string | undefined,
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
): CoupleAccess {
  const [coupleKey, setCoupleKey] = useState<string | null>(null);
  const [keyRejected, setKeyRejected] = useState(false);
  // Read once on arrival: dropping the key from the URL must not undo the unlock.
  const keyFromUrl = useRef(searchParams.get(COUPLE_KEY_PARAM)).current;

  useEffect(() => {
    if (!keyFromUrl) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(COUPLE_KEY_PARAM);
      return next;
    }, { replace: true });
  }, [keyFromUrl, setSearchParams]);

  useEffect(() => {
    if (!slug) return;
    const candidate = keyFromUrl ?? readCoupleKey(slug);
    if (!candidate) return;
    let cancelled = false;
    fetch(`/api/share/couple/${encodeURIComponent(slug)}`, { headers: coupleKeyHeaders(candidate) })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          storeCoupleKey(slug, candidate);
          setCoupleKey(candidate);
          setKeyRejected(false);
        } else if (res.status === 401) {
          // Rotated or mistyped: forget it so the device stops trying.
          clearCoupleKey(slug);
          setCoupleKey(null);
          if (keyFromUrl) setKeyRejected(true);
        }
      })
      .catch(() => { /* offline: keep guest view, retry on next visit */ });
    return () => { cancelled = true; };
  }, [slug, keyFromUrl]);

  return { coupleKey, isCouple: coupleKey !== null, keyRejected };
}
