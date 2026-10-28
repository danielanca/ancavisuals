import { describe, expect, test } from "vitest";
import { albumProposalCoverage, albumsNeedingProposals } from "src/shared/media/albumProposalCoverage";

const albums = [
  { slug: "a", name: "Ana", eventDate: "2026-09-01" },
  { slug: "b", name: "Bia", eventDate: "2026-10-01" },
  { slug: "c", name: "Cris", eventDate: "2026-08-01" },
];

describe("album proposal coverage", () => {
  test("counts distinct photos per destination; rejected don't count; JPG and WebP are the same photo", () => {
    const coverage = albumProposalCoverage(albums, [
      { albumSlug: "a", fileName: "1.jpg", destinations: ["instagram"], by: "daniel", proposedAt: "2026-10-01" },
      { albumSlug: "a", fileName: "1.webp", destinations: ["instagram", "media_assets"], by: "estera", status: "accepted", proposedAt: "2026-10-05" },
      { albumSlug: "a", fileName: "2.jpg", by: "estera" },
      { albumSlug: "a", fileName: "3.jpg", destinations: ["media_assets"], status: "rejected" },
      { albumSlug: "zz", fileName: "9.jpg" },
    ]);
    expect(coverage[0]).toMatchObject({ slug: "a", instagram: 2, mediaAssets: 1, accepted: 1, people: ["daniel", "estera"], lastProposedAt: "2026-10-05" });
    expect(coverage[1]).toMatchObject({ slug: "b", instagram: 0, mediaAssets: 0, people: [], lastProposedAt: null });
  });

  test("lists albums under either minimum, the emptiest first", () => {
    const coverage = albumProposalCoverage(albums, [
      ...Array.from({ length: 3 }, (_, i) => ({ albumSlug: "a", fileName: `${i}.jpg`, destinations: ["instagram", "media_assets"] })),
      ...Array.from({ length: 5 }, (_, i) => ({ albumSlug: "c", fileName: `${i}.jpg`, destinations: ["instagram", "media_assets"] })),
    ]);
    expect(albumsNeedingProposals(coverage, { instagram: 3, mediaAssets: 3 }).map((a) => a.slug)).toEqual(["b"]);
    expect(albumsNeedingProposals(coverage, { instagram: 5, mediaAssets: 5 }).map((a) => a.slug)).toEqual(["b", "a"]);
  });
});
