/** Empty string removes the link; null means invalid input. */
export function normalizeEventVideoLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const link = value.trim();
  if (!link) return "";
  if (link.length > 4096) return null;
  try {
    const url = new URL(link);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
