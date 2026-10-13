const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function getPublicAppOrigin(): string {
  if (typeof window === "undefined") return "https://ancavisuals.ro";
  return LOCAL_HOSTS.has(window.location.hostname) ? "https://ancavisuals.ro" : window.location.origin;
}
