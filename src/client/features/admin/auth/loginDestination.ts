/** Album pages an admin may return to after signing in from the album itself (`/login?redirect=/media/<slug>`). */
const ALBUM_PATH = /^\/media\/[^/?#\\]+$/;

/** Preserve the protected page after sign-in, allowing only internal admin destinations (or an album page via `?redirect=`). */
export function loginDestination(state: unknown, search = ""): string {
  const fromState = stateDestination(state);
  if (fromState) return fromState;
  const redirect = new URLSearchParams(search).get("redirect");
  if (redirect && ALBUM_PATH.test(redirect)) return redirect;
  return "/admin";
}

function stateDestination(state: unknown): string | null {
  if (!state || typeof state !== "object" || !("from" in state)) return null;
  const from = state.from;
  if (!from || typeof from !== "object" || !("pathname" in from) || typeof from.pathname !== "string") return null;
  const path = from.pathname;
  if (path !== "/azi" && path !== "/admin" && !path.startsWith("/admin/")) return null;
  const search = "search" in from && typeof from.search === "string" && from.search.startsWith("?") ? from.search : "";
  const hash = "hash" in from && typeof from.hash === "string" && from.hash.startsWith("#") ? from.hash : "";
  return `${path}${search}${hash}`;
}
