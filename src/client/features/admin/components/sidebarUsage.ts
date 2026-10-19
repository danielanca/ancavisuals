/*
 * Purpose: the admin sidebar learns which pages are used most — every click counts, and inside
 * each category the most used items move up. Items never leave their category, and equal counts
 * keep the existing (default or dragged) order. Counts live in this browser's localStorage.
 */
const STORAGE_KEY = "admin-sidebar-usage";

export type SidebarUsage = Record<string, number>;

export function readSidebarUsage(): SidebarUsage {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as SidebarUsage) : {};
  } catch {
    return {};
  }
}

/** Adds one click for `path` and returns the new counts. */
export function recordSidebarClick(path: string): SidebarUsage {
  const usage = readSidebarUsage();
  usage[path] = (usage[path] ?? 0) + 1;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(usage)); } catch { /* private mode: order just doesn't learn */ }
  return usage;
}

/** Most used first; ties keep the order they came in (Array.prototype.sort is stable). */
export function sortByUsage<T extends { path: string }>(items: T[], usage: SidebarUsage): T[] {
  return [...items].sort((a, b) => (usage[b.path] ?? 0) - (usage[a.path] ?? 0));
}
