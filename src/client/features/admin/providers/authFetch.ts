import type { User } from "firebase/auth";

// Sends the signed-in admin's Firebase ID token with every same-origin /api/ request, so
// server routes can require it without each caller passing `Authorization` by hand.
// Requests that already set `Authorization` are left untouched.

const AUTH_WAIT_MS = 10_000;

let currentUser: User | null = null;
let settled = false;
let resolveSettled: () => void = () => {};
const settledPromise = new Promise<void>((resolve) => { resolveSettled = resolve; });

/** Called by AuthProvider whenever Firebase reports the user (null = signed out). */
export function setAuthFetchUser(user: User | null): void {
  currentUser = user;
  settled = true;
  resolveSettled();
}

/** Called when it is already known nobody is signed in (no session cookie). */
export function markAuthFetchSignedOut(): void {
  if (settled) return;
  settled = true;
  resolveSettled();
}

function apiPath(input: RequestInfo | URL): boolean {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

async function tokenForRequest(): Promise<string | null> {
  // Only admin pages wait for Firebase: public pages (which may load Firebase late, see
  // whenLandingSettled) send their requests at once and use the token only if already known.
  if (!settled && window.location.pathname.startsWith("/admin")) {
    await Promise.race([settledPromise, new Promise((resolve) => setTimeout(resolve, AUTH_WAIT_MS))]);
  }
  if (!currentUser) return null;
  try {
    return await currentUser.getIdToken();
  } catch {
    return null;
  }
}

let installed = false;

export function installAuthFetch(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!apiPath(input)) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has("Authorization")) {
      const token = await tokenForRequest();
      if (!token) return original(input, init);
      headers.set("Authorization", `Bearer ${token}`);
    }
    const response = await original(input, { ...init, headers });
    // Pages that pass `auth.accessToken` themselves can hold an expired token (tab asleep for an
    // hour, laptop lid closed) → the server answers 401 "Token invalid". Retry once with a fresh one.
    if (response.status !== 401 || !currentUser || !headers.get("Authorization")?.startsWith("Bearer ") || !replayableBody(init?.body)) {
      return response;
    }
    let fresh: string;
    try {
      fresh = await currentUser.getIdToken(true);
    } catch {
      return response;
    }
    if (headers.get("Authorization") === `Bearer ${fresh}`) return response;
    headers.set("Authorization", `Bearer ${fresh}`);
    return original(input, { ...init, headers });
  };
}

// A stream body is consumed by the first attempt, so it can't be sent again.
function replayableBody(body: BodyInit | null | undefined): boolean {
  return !(typeof ReadableStream !== "undefined" && body instanceof ReadableStream);
}

/** Opens an authenticated PDF/HTML response in a new tab (window.open can't send headers). */
export async function openAuthedInNewTab(url: string): Promise<void> {
  // Open synchronously, inside the click, so popup blockers allow it.
  const tab = window.open("", "_blank");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blobUrl = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = blobUrl;
    else window.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
