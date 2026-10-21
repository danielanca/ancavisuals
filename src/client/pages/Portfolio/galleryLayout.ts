/*
 * Purpose: where each portfolio photo goes — computed in advance from the photos' pixel sizes
 * (measured once by the server and saved on each photo), so nothing has to load before its
 * place is known. Shared by the public gallery and the admin organizer, so the organizer shows
 * exactly what visitors get.
 *
 * On two columns (phones) a very wide photo — WIDE_PHOTO_RATIO times wider than tall or more,
 * e.g. 16:9 and panoramas — takes the whole row; the others (portrait, square, a classic 3:2
 * landscape) stay in the masonry. Before each wide photo the two columns are evened out, so it
 * sits under them without a gap and still feels part of the masonry: the last photos of the two
 * columns are swapped, and if a gap is still left, one or two normal photos from right after the wide one
 * move up into the short column. With more columns, or without sizes, the photos are dealt row
 * by row (#1, #2, #3, #4 on the first row) as before.
 */

export const WIDE_PHOTO_RATIO = 1.7;
// A photo of unknown shape counts as a portrait (the most common one) for column heights.
const UNKNOWN_HEIGHT = 1.5;
// The 10px gap under each photo, in column widths (a phone column is ~170px wide).
const GAP_HEIGHT = 0.06;
// A gap above a wide photo smaller than this (in column widths, ~25px) is not worth fixing.
const EVEN_ENOUGH = 0.15;
// How many photos after a wide one may move up to fill the short column, and how far ahead.
const MAX_BORROWED = 2;
const BORROW_LOOKAHEAD = 4;
// Only the last photos of each column (right above the wide one) may swap columns: swapping
// anywhere in the block moved photos far from their neighbours in the admin order, so one
// event's photos ended up split, one part high in a column and the rest much lower.
const SWAP_TAIL = 3;

export type GalleryBlock =
  | { kind: "wide"; index: number }
  | { kind: "columns"; columns: number[][] };

/** True when a photo of this width/height ratio takes the whole row on two columns. */
export const isWidePhoto = (ratio: number | undefined) => ratio !== undefined && ratio >= WIDE_PHOTO_RATIO;

const photoHeight = (ratio: number | undefined) => (ratio ? 1 / ratio : UNKNOWN_HEIGHT) + GAP_HEIGHT;

/** Swaps photos between the ends of the two columns while that brings their heights closer. */
function evenOut(columns: number[][], ratios: Array<number | undefined>): void {
  const sum = (column: number[]) => column.reduce((total, index) => total + photoHeight(ratios[index]), 0);
  for (let round = 0; round < 20; round += 1) {
    const [left, right] = columns;
    const diff = sum(left) - sum(right);
    let best: { a: number; b: number; diff: number } | null = null;
    for (let a = Math.max(0, left.length - SWAP_TAIL); a < left.length; a += 1) {
      for (let b = Math.max(0, right.length - SWAP_TAIL); b < right.length; b += 1) {
        const next = diff - 2 * (photoHeight(ratios[left[a]]) - photoHeight(ratios[right[b]]));
        if (Math.abs(next) < Math.abs(best?.diff ?? diff) - 1e-6) best = { a, b, diff: next };
      }
    }
    if (!best) return;
    [left[best.a], right[best.b]] = [right[best.b], left[best.a]];
  }
}

/**
 * The photos (by their order index) grouped into blocks: either one wide photo across the row,
 * or columns. `ratios[i]` is photo i's width / height (undefined = unknown).
 */
export function galleryBlocks(ratios: Array<number | undefined>, columnCount: number): GalleryBlock[] {
  const spanWide = columnCount === 2 && ratios.some(isWidePhoto);
  if (!spanWide) {
    const columns: number[][] = Array.from({ length: columnCount }, () => []);
    ratios.forEach((_, index) => columns[index % columnCount].push(index));
    return [{ kind: "columns", columns }];
  }

  const blocks: GalleryBlock[] = [];
  const placed = new Set<number>();
  let columns: number[][] = [[], []];
  const heights = () => columns.map((column) => column.reduce((total, index) => total + photoHeight(ratios[index]), 0));
  const addToShorter = (index: number) => {
    const current = heights();
    columns[current[0] <= current[1] ? 0 : 1].push(index);
    placed.add(index);
  };
  const closeColumns = () => {
    if (columns.some((column) => column.length > 0)) {
      blocks.push({ kind: "columns", columns: columns.map((column) => [...column].sort((a, b) => a - b)) });
    }
    columns = [[], []];
  };

  ratios.forEach((ratio, index) => {
    if (placed.has(index)) return;
    if (!isWidePhoto(ratio)) { addToShorter(index); return; }

    // A wide photo: even the columns out above it first.
    if (columns.some((column) => column.length > 0)) {
      evenOut(columns, ratios);
      for (let borrowed = 0; borrowed < MAX_BORROWED; borrowed += 1) {
        const [left, right] = heights();
        const gap = Math.abs(left - right);
        if (gap <= EVEN_ENOUGH) break;
        // The next normal photo that fills the gap best (and does not overshoot it by more).
        let best: { index: number; miss: number } | null = null;
        for (let next = index + 1; next < ratios.length && next <= index + BORROW_LOOKAHEAD; next += 1) {
          if (placed.has(next) || isWidePhoto(ratios[next])) continue;
          const miss = Math.abs(gap - photoHeight(ratios[next]));
          if (miss < gap && (!best || miss < best.miss)) best = { index: next, miss };
        }
        if (!best) break;
        addToShorter(best.index);
      }
    }
    closeColumns();
    blocks.push({ kind: "wide", index });
    placed.add(index);
  });
  closeColumns();
  return blocks;
}
