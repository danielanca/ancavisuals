// src/client/utils/functions.ts
export const isBrowser = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Universal cookie getter.
 * - On the client, reads document.cookie.
 * - On the server, pass the raw cookie header string as `cookieString`.
 * Returns `null` if not found.
 */
export const getCookie = (name: string, cookieString?: string): string | null => {
  const source = cookieString ?? (isBrowser() ? document.cookie : '');
  if (!source) return null;
  const value = `; ${source}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(';').shift() ?? null;
  return null;
};

export const setCookie = (name: string, value: string, days: number) => {
  if (!isBrowser()) return;
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
};

/**
 * Client-only cookie setter.
 * NOTE: httpOnly/secure cookies should be set from the server via Set-Cookie.
 */
export const setJWT = (cname: string, cvalue: string, expireHours: number) => {
  if (!isBrowser()) return Promise.resolve(false); // no-op on server
  return new Promise<boolean>((resolve) => {
    const d = new Date(Date.now() + expireHours * 60 * 60 * 1000);
    const expires = `expires=${d.toUTCString()}`;
    // add SameSite and Secure if you serve over HTTPS
    document.cookie = `${cname}=${cvalue}; ${expires}; path=/; SameSite=Lax`;
    resolve(true);
  });
};
