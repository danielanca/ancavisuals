/*
 * Purpose: the portfolio layout computed from photo sizes — on two columns only very wide photos
 * take the whole row, the columns above each wide photo are evened out (swaps, then photos from
 * right after it fill a gap), and with four columns nothing changes.
 */
import { describe, expect, test } from "vitest";
import { galleryBlocks, type GalleryBlock } from "src/client/pages/Portfolio/galleryLayout";

const portrait = 1067 / 1600; // 0.67 → 1.5 column widths tall
const landscape = 1400 / 933; // 1.5 — classic 3:2 (0.67 tall), stays in the masonry
const panorama = 1920 / 1080; // 1.78 — takes the whole row on a phone

const height = (ratios: number[], column: number[]) => column.reduce((total, index) => total + 1 / ratios[index] + 0.06, 0);
const placedOnce = (blocks: GalleryBlock[], count: number) => {
  const all = blocks.flatMap((block) => (block.kind === "wide" ? [block.index] : block.columns.flat())).sort((a, b) => a - b);
  expect(all).toEqual(Array.from({ length: count }, (_, index) => index));
};

describe("galleryBlocks", () => {
  test("on two columns only very wide photos take the whole row; 3:2 and portraits stay in columns", () => {
    const ratios = [portrait, landscape, landscape, panorama, portrait, portrait];
    const blocks = galleryBlocks(ratios, 2);
    expect(blocks.map((block) => block.kind)).toEqual(["columns", "wide", "columns"]);
    expect(blocks[1]).toEqual({ kind: "wide", index: 3 });
    placedOnce(blocks, ratios.length);
  });

  test("the columns above a wide photo end (almost) level", () => {
    // Greedy: portrait left (1.56), landscape right (0.73), portrait right (2.29), landscape left (2.29)…
    const ratios = [portrait, landscape, portrait, portrait, landscape, panorama, landscape, portrait];
    const blocks = galleryBlocks(ratios, 2);
    const columnsBeforeWide = blocks[0];
    expect(columnsBeforeWide.kind).toBe("columns");
    if (columnsBeforeWide.kind !== "columns") return;
    const [left, right] = columnsBeforeWide.columns;
    expect(Math.abs(height(ratios, left) - height(ratios, right))).toBeLessThanOrEqual(0.15 + 1e-6);
    placedOnce(blocks, ratios.length);
  });

  test("a photo from right after the wide one moves up when swapping is not enough", () => {
    // Above the panorama: one portrait (1.56) vs nothing — only a later photo can fill the gap.
    const ratios = [portrait, panorama, portrait, landscape];
    const blocks = galleryBlocks(ratios, 2);
    expect(blocks[0]).toEqual({ kind: "columns", columns: [[0], [2]] });
    expect(blocks[1]).toEqual({ kind: "wide", index: 1 });
    placedOnce(blocks, ratios.length);
  });

  test("evening out before a wide photo keeps the admin order: photos far apart never swap places", () => {
    // Like /oferta/olx: a long run of portraits, then one event's landscapes, then a panorama.
    // Swapping anywhere in the block used to move photo #27 next to #14 (one event split in two).
    const ratios = [portrait, portrait, portrait, landscape, portrait, portrait, portrait, portrait, landscape, landscape,
      landscape, landscape, portrait, portrait, landscape, landscape, landscape, landscape, portrait, portrait, panorama];
    const [block] = galleryBlocks(ratios, 2);
    expect(block.kind).toBe("columns");
    if (block.kind !== "columns") return;
    const top = new Map<number, number>();
    for (const column of block.columns) {
      let y = 0;
      for (const index of column) { top.set(index, y); y += 1 / ratios[index] + 0.06; }
    }
    for (let i = 0; i < ratios.length - 1; i += 1) {
      for (let j = i + 6; j < ratios.length - 1; j += 1) expect(top.get(i)!).toBeLessThanOrEqual(top.get(j)!);
    }
  });

  test("four columns, no wide photos or no sizes: row by row, as before", () => {
    expect(galleryBlocks([portrait, panorama, landscape, portrait, panorama], 4)).toEqual([{ kind: "columns", columns: [[0, 4], [1], [2], [3]] }]);
    expect(galleryBlocks([portrait, landscape, portrait], 2)).toEqual([{ kind: "columns", columns: [[0, 2], [1]] }]);
    expect(galleryBlocks([undefined, undefined, undefined], 2)).toEqual([{ kind: "columns", columns: [[0, 2], [1]] }]);
  });
});
