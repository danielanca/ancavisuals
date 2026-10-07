/** Preserve the protected page after sign-in, allowing only internal admin destinations. */
export function loginDestination(state: unknown): string {
  if (!state || typeof state !== "object" || !("from" in state)) return "/admin";
  const from = state.from;
  if (!from || typeof from !== "object" || !("pathname" in from) || typeof from.pathname !== "string") return "/admin";
  const path = from.pathname;
  if (path !== "/azi" && path !== "/admin" && !path.startsWith("/admin/")) return "/admin";
  const search = "search" in from && typeof from.search === "string" && from.search.startsWith("?") ? from.search : "";
  const hash = "hash" in from && typeof from.hash === "string" && from.hash.startsWith("#") ? from.hash : "";
  return `${path}${search}${hash}`;
}
