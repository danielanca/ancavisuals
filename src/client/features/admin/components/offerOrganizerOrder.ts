/*
 * Purpose: the ordering operations of the offer photo organizer (/admin/template-oferte/:service).
 * The order is what visitors see: on the site the photos fill the columns row by row
 * (#1–#4 = first row on desktop, #1–#2 on mobile), so every operation works on that one list.
 * An "event" is the album a photo came from (`sourceAlbumSlug`); photos without one form one group.
 */

export const NO_EVENT = "Alte poze";

export type OrderAsset = { id: string; sourceAlbumSlug?: string };

export const eventKey = (asset: OrderAsset) => asset.sourceAlbumSlug || NO_EVENT;

const MONTHS = "ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie";

/** "21martie2026" → "21 martie 2026", "rebeca-florea" → "rebeca florea". */
export function formatEventLabel(key: string): string {
  const date = new RegExp(`^(\\d{1,2})(${MONTHS})(\\d{4})$`, "i").exec(key);
  if (date) return `${Number(date[1])} ${date[2].toLowerCase()} ${date[3]}`;
  return key.replace(/[-_]+/g, " ");
}

/** Events in the order their first photo appears. */
export function eventsInOrder<T extends OrderAsset>(assets: T[]): string[] {
  const seen: string[] = [];
  for (const asset of assets) if (!seen.includes(eventKey(asset))) seen.push(eventKey(asset));
  return seen;
}

/** How many times the list switches from one event to another (0 = every event in one block). */
export function eventSwitches<T extends OrderAsset>(assets: T[]): number {
  let switches = 0;
  for (let index = 1; index < assets.length; index += 1) if (eventKey(assets[index]) !== eventKey(assets[index - 1])) switches += 1;
  return Math.max(0, switches - (eventsInOrder(assets).length - 1));
}

/** Each event's photos together, events in the order of their first photo, photos in their own order. */
export function groupByEvent<T extends OrderAsset>(assets: T[]): T[] {
  return eventsInOrder(assets).flatMap((key) => assets.filter((asset) => eventKey(asset) === key));
}

/** Moves a whole event one place earlier (-1) or later (+1); the list is grouped first. */
export function moveEvent<T extends OrderAsset>(assets: T[], key: string, direction: -1 | 1): T[] {
  const order = eventsInOrder(assets);
  const from = order.indexOf(key);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= order.length) return groupByEvent(assets);
  [order[from], order[to]] = [order[to], order[from]];
  return order.flatMap((event) => assets.filter((asset) => eventKey(asset) === event));
}

/** Moves the given photos (kept in their list order) before or after the target photo. */
export function moveBeside<T extends OrderAsset>(assets: T[], movingIds: string[], targetId: string, place: "before" | "after"): T[] {
  if (movingIds.length === 0 || movingIds.includes(targetId)) return assets;
  const moving = assets.filter((asset) => movingIds.includes(asset.id));
  const rest = assets.filter((asset) => !movingIds.includes(asset.id));
  const targetIndex = rest.findIndex((asset) => asset.id === targetId);
  if (targetIndex === -1) return assets;
  rest.splice(place === "before" ? targetIndex : targetIndex + 1, 0, ...moving);
  return rest;
}

/**
 * Adds photos from the library next to their event: each one right after the last photo of its
 * album already in the list (so an album's photos stay together); an album not in the list yet
 * goes at the end. Photos already in the list are skipped.
 */
export function addBesideEvent<T extends OrderAsset>(assets: T[], incoming: T[]): T[] {
  const next = [...assets];
  for (const asset of incoming) {
    if (next.some((item) => item.id === asset.id)) continue;
    let last = -1;
    next.forEach((item, index) => { if (eventKey(item) === eventKey(asset)) last = index; });
    next.splice(last === -1 ? next.length : last + 1, 0, asset);
  }
  return next;
}

export function moveToEdge<T extends OrderAsset>(assets: T[], movingIds: string[], edge: "start" | "end"): T[] {
  const moving = assets.filter((asset) => movingIds.includes(asset.id));
  const rest = assets.filter((asset) => !movingIds.includes(asset.id));
  return edge === "start" ? [...moving, ...rest] : [...rest, ...moving];
}

/**
 * Swaps positions, in the order the photos were selected: 2 photos trade places; 2N photos —
 * the first N take the places of the last N and the other way round (1st ↔ N+1st, …).
 */
export function swapSelected<T extends OrderAsset>(assets: T[], selectedIds: string[]): T[] {
  if (selectedIds.length < 2 || selectedIds.length % 2 !== 0) return assets;
  const half = selectedIds.length / 2;
  const next = [...assets];
  for (let pair = 0; pair < half; pair += 1) {
    const a = next.findIndex((asset) => asset.id === selectedIds[pair]);
    const b = next.findIndex((asset) => asset.id === selectedIds[pair + half]);
    if (a === -1 || b === -1) continue;
    [next[a], next[b]] = [next[b], next[a]];
  }
  return next;
}

/** Puts `replacement[i]` exactly where `oldIds[i]` was (photos already in the list are skipped). */
export function replaceAt<T extends OrderAsset>(assets: T[], oldIds: string[], replacement: T[]): T[] {
  const next = [...assets];
  oldIds.forEach((oldId, index) => {
    const incoming = replacement[index];
    if (!incoming || next.some((asset) => asset.id === incoming.id)) return;
    const at = next.findIndex((asset) => asset.id === oldId);
    if (at !== -1) next[at] = incoming;
  });
  return next;
}

/** Photos of `source` that `target` does not have, in `source` order (e.g. desktop-only photos for the mobile list). */
export function missingFrom<T extends OrderAsset>(source: T[], target: T[]): T[] {
  const present = new Set(target.map((asset) => asset.id));
  return source.filter((asset) => !present.has(asset.id));
}

/**
 * Reorders `current` like `other` (the other device's list), without adding or removing photos:
 * events in `other`'s event order (events only in `current` keep their order, at the end); inside
 * each event, the photos `other` also has follow its order, the rest come after in their order.
 */
export function adoptOrder<T extends OrderAsset>(current: T[], other: T[]): T[] {
  const otherEvents = eventsInOrder(other);
  const currentEvents = eventsInOrder(current);
  const eventOrder = [...otherEvents.filter((key) => currentEvents.includes(key)), ...currentEvents.filter((key) => !otherEvents.includes(key))];
  const rank = new Map(other.map((asset, index) => [asset.id, index]));
  return eventOrder.flatMap((key) => current
    .filter((asset) => eventKey(asset) === key)
    .map((asset, position) => ({ asset, position }))
    .sort((a, b) => (rank.get(a.asset.id) ?? Number.POSITIVE_INFINITY) - (rank.get(b.asset.id) ?? Number.POSITIVE_INFINITY) || a.position - b.position)
    .map(({ asset }) => asset));
}
